import type {
  AiModelToolsProbeResult,
  AiModelConfig,
  AiOrchestration,
  AiOrchestrationCreateInput,
  AiWorkflowKey,
  NoteTypeFilter,
  SearchSort
} from "../../shared/types.js";
import { clamp, nowIso, unique } from "../../shared/utils.js";
import { store } from "../storage/localStore.js";
import { getEnvValue } from "../utils/env.js";
import { createAiOrchestration } from "./aiOrchestratorService.js";

type StoreLike = Pick<typeof store, "read" | "update">;
type ControlledOptions = NonNullable<Parameters<typeof createAiOrchestration>[2]>;
type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
  }
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

interface ToolCallingOptions extends ControlledOptions {
  fetchImpl?: FetchLike;
  getApiKey?: (model: AiModelConfig) => string | undefined;
}

interface ToolsProbeOptions {
  fetchImpl?: FetchLike;
  getApiKey?: (model: AiModelConfig) => string | undefined;
}

export type AiToolName =
  | "create_search_job"
  | "get_job_status"
  | "list_job_notes"
  | "run_ai_workflow"
  | "create_summary_artifact";

export interface ParsedAiToolCall {
  id: string;
  name: AiToolName;
  arguments: Record<string, unknown>;
}

interface ChatCompletionToolMessage {
  tool_calls?: unknown;
  function_call?: unknown;
}

interface ToolPlan {
  keywords: string[];
  toolCalls: ParsedAiToolCall[];
}

const allowedToolNames: AiToolName[] = [
  "create_search_job",
  "get_job_status",
  "list_job_notes",
  "run_ai_workflow",
  "create_summary_artifact"
];

const workflowKeys: AiWorkflowKey[] = [
  "content-planning",
  "audience-insight",
  "competitor-analysis",
  "viral-deep-dive",
  "viral-batch-deep-dive",
  "viral-template",
  "note-analysis",
  "draft-review",
  "note-writing"
];

const toolArgumentKeys: Record<AiToolName, string[]> = {
  create_search_job: ["keywords", "keyword", "sort", "noteType", "pages", "commentPages"],
  get_job_status: ["jobId"],
  list_job_notes: ["jobId", "limit", "sort"],
  run_ai_workflow: ["workflowKey", "jobId", "noteId", "noteIds", "focus"],
  create_summary_artifact: ["jobId", "artifactIds", "title", "summaryMarkdown"]
};

const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "create_search_job",
      description: "Create a read-only Xiaohongshu keyword search job.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          keywords: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 },
          keyword: { type: "string" },
          sort: { type: "string", enum: ["general", "popular", "latest"] },
          noteType: { type: "string", enum: ["all", "video", "image"] },
          pages: { type: "integer", minimum: 1, maximum: 3 },
          commentPages: { type: "integer", minimum: 1, maximum: 2 }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_job_status",
      description: "Read a search job status.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["jobId"],
        properties: {
          jobId: { type: "string" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_job_notes",
      description: "List stored notes for a job without exposing secrets.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["jobId"],
        properties: {
          jobId: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 30 },
          sort: { type: "string", enum: ["hot", "likes", "comments", "collects", "latest"] }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "run_ai_workflow",
      description: "Run one existing read-only AI workflow.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["workflowKey"],
        properties: {
          workflowKey: { type: "string", enum: workflowKeys },
          jobId: { type: "string" },
          noteId: { type: "string" },
          noteIds: { type: "array", items: { type: "string" }, maxItems: 12 },
          focus: { type: "string", maxLength: 1000 }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_summary_artifact",
      description: "Create a local markdown summary artifact from existing AI artifacts.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["jobId", "artifactIds", "title", "summaryMarkdown"],
        properties: {
          jobId: { type: "string" },
          artifactIds: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 10 },
          title: { type: "string", maxLength: 120 },
          summaryMarkdown: { type: "string", maxLength: 8000 }
        }
      }
    }
  },
] as const;

export async function createAiOrchestrationWithToolsFallback(
  input: AiOrchestrationCreateInput,
  storage: StoreLike = store,
  options: ToolCallingOptions = {}
): Promise<AiOrchestration> {
  const { fetchImpl, getApiKey, ...controlledOptions } = options;
  let plan: ToolPlan;
  try {
    plan = await buildToolPlan(input, storage, {
      fetchImpl,
      getApiKey
    });
  } catch {
    return createAiOrchestration(input, storage, controlledOptions);
  }
  return createAiOrchestration({ ...input, keywords: plan.keywords }, storage, controlledOptions);
}

export function parseAiToolCalls(message: unknown): ParsedAiToolCall[] {
  const rawMessage = asRecord(message, "AI message");
  const toolCalls = normalizeRawToolCalls(rawMessage as ChatCompletionToolMessage);
  if (!toolCalls.length) {
    throw new Error("AI model did not return tool calls.");
  }
  return toolCalls.map((call, index) => parseOneToolCall(call, index));
}

export async function probeAiModelTools(
  modelId: string,
  storage: StoreLike = store,
  options: ToolsProbeOptions = {}
): Promise<AiModelToolsProbeResult> {
  const checkedAt = nowIso();
  try {
    const { model, apiKey } = await resolveModel(modelId, storage, options.getApiKey);
    const message = await requestToolMessage(
      model,
      apiKey,
      {
        instruction: "Probe whether this model can return OpenAI-compatible tool calls. Use create_search_job with keyword tools-probe.",
        keywords: ["tools-probe"]
      },
      options.fetchImpl ?? fetch
    );
    const toolCalls = parseAiToolCalls(message);
    const supportsTools = toolCalls.some((call) => call.name === "create_search_job");
    return {
      ok: supportsTools,
      supportsTools,
      message: supportsTools ? "模型支持 OpenAI-compatible tools。" : "模型返回了工具调用，但没有使用预期工具。",
      checkedAt
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      supportsTools: false,
      message: message.includes("API key") ? "模型未配置 API Key，无法检测 tools 支持。" : `模型 tools 检测失败：${message}`,
      checkedAt
    };
  }
}

async function buildToolPlan(
  input: AiOrchestrationCreateInput,
  storage: StoreLike,
  options: Pick<ToolCallingOptions, "fetchImpl" | "getApiKey">
): Promise<ToolPlan> {
  const { model, apiKey } = await resolveModel(input.modelId, storage, options.getApiKey);
  const message = await requestToolMessage(model, apiKey, input, options.fetchImpl ?? fetch);
  const toolCalls = parseAiToolCalls(message);
  const createJobCall = toolCalls.find((call) => call.name === "create_search_job");
  if (!createJobCall) {
    throw new Error("AI tool plan did not create a search job.");
  }
  const keywords = extractKeywordsFromCreateJob(createJobCall.arguments);
  if (!keywords.length) {
    throw new Error("AI tool plan did not include keywords.");
  }
  return { keywords, toolCalls };
}

async function resolveModel(
  modelId: string | undefined,
  storage: StoreLike,
  getApiKey?: (model: AiModelConfig) => string | undefined
): Promise<{ model: AiModelConfig; apiKey: string }> {
  const models = await storage.read("aiModels");
  const model = (modelId ? models.find((item) => item.id === modelId) : undefined) ?? models.find((item) => item.isDefault) ?? models[0];
  if (!model) {
    throw new Error("No AI model configured.");
  }
  const apiKey = getApiKey?.(model) ?? getEnvValue(keyNameForModel(model.id));
  if (!apiKey) {
    throw new Error("AI model API key is not configured.");
  }
  return { model, apiKey };
}

async function requestToolMessage(
  model: AiModelConfig,
  apiKey: string,
  input: AiOrchestrationCreateInput,
  fetchImpl: FetchLike
): Promise<unknown> {
  const response = await fetchImpl(`${model.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model.model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You are a safe search orchestration planner for a Xiaohongshu operations app. Use only the provided local tools. Never request deleting data, clearing data, sending comments, changing config, reading cookies, reading API keys, or accessing secrets. If the keyword is clear, call create_search_job first. For content creation or review requests, do not invent tools; those requests are handled by the content assistant workflow."
        },
        {
          role: "user",
          content: JSON.stringify({
            instruction: input.instruction,
            keywords: input.keywords ?? []
          })
        }
      ],
      tools: toolDefinitions,
      tool_choice: "auto"
    })
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    choices?: Array<{ message?: unknown }>;
  };
  if (!response.ok) {
    throw new Error(data.error?.message || `AI tools request failed: ${response.status}`);
  }
  const message = data.choices?.[0]?.message;
  if (!message) {
    throw new Error("AI tools response is empty.");
  }
  return message;
}

function normalizeRawToolCalls(message: ChatCompletionToolMessage): unknown[] {
  if (Array.isArray(message.tool_calls)) {
    return message.tool_calls;
  }
  if (message.function_call) {
    return [{ id: "function_call", type: "function", function: message.function_call }];
  }
  return [];
}

function parseOneToolCall(raw: unknown, index: number): ParsedAiToolCall {
  const call = asRecord(raw, `tool call ${index + 1}`);
  const fn = asRecord(call.function, `tool call ${index + 1} function`);
  const name = assertToolName(fn.name);
  const args = parseToolArguments(fn.arguments);
  assertAllowedArguments(name, args);
  return {
    id: typeof call.id === "string" && call.id.trim() ? call.id : `tool_${index + 1}`,
    name,
    arguments: args
  };
}

function assertToolName(value: unknown): AiToolName {
  if (typeof value !== "string" || !allowedToolNames.includes(value as AiToolName)) {
    throw new Error(`Unsupported AI tool: ${String(value)}`);
  }
  return value as AiToolName;
}

function parseToolArguments(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return {};
    }
    return asRecord(JSON.parse(trimmed), "tool arguments");
  }
  if (value === undefined || value === null) {
    return {};
  }
  return asRecord(value, "tool arguments");
}

function assertAllowedArguments(name: AiToolName, args: Record<string, unknown>): void {
  const allowed = new Set(toolArgumentKeys[name]);
  for (const key of Object.keys(args)) {
    if (!allowed.has(key)) {
      throw new Error(`Unsupported argument for ${name}: ${key}`);
    }
  }

  if (name === "run_ai_workflow") {
    const workflowKey = args.workflowKey;
    if (typeof workflowKey !== "string" || !workflowKeys.includes(workflowKey as AiWorkflowKey)) {
      throw new Error("Unsupported AI workflow.");
    }
  }
}

function extractKeywordsFromCreateJob(args: Record<string, unknown>): string[] {
  const values = Array.isArray(args.keywords)
    ? args.keywords
    : typeof args.keyword === "string"
      ? [args.keyword]
      : [];
  return unique(values.map((value) => (typeof value === "string" ? value.trim() : "")).filter(Boolean)).slice(0, 5);
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function keyNameForModel(id: string): string {
  return `AI_MODEL_${id.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}_KEY`;
}

export function sanitizeToolSearchArgs(args: Record<string, unknown>): {
  keywords: string[];
  sort: SearchSort;
  noteType: NoteTypeFilter;
  pages: number;
  commentPages: number;
} {
  return {
    keywords: extractKeywordsFromCreateJob(args),
    sort: normalizeEnum(args.sort, ["general", "popular", "latest"], "popular"),
    noteType: normalizeEnum(args.noteType, ["all", "video", "image"], "all"),
    pages: clamp(toInteger(args.pages, 1), 1, 3),
    commentPages: clamp(toInteger(args.commentPages, 1), 1, 2)
  };
}

function normalizeEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

function toInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : fallback;
}
