import type {
  AiArtifact,
  AiOrchestration,
  AiOrchestrationCreateInput,
  AiOrchestrationStep,
  AiOrchestrationStepKey,
  AiWorkflowKey,
  SearchJob,
  SearchJobInput
} from "../../shared/types.js";
import { createId, nowIso, unique } from "../../shared/utils.js";
import { store } from "../storage/localStore.js";
import { jobs } from "./jobService.js";
import { runAiWorkflow } from "./aiService.js";

type StoreLike = Pick<typeof store, "read" | "update">;

interface OrchestratorOptions {
  autoStart?: boolean;
  createJob?: (input: SearchJobInput) => Promise<SearchJob>;
  getJob?: (jobId: string) => Promise<SearchJob | undefined>;
  runWorkflow?: (input: { workflowKey: AiWorkflowKey; jobId?: string; modelId?: string; focus?: string }) => Promise<AiArtifact>;
  minNotes?: number;
  pollMs?: number;
  waitTimeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

interface Runtime {
  createJob: (input: SearchJobInput) => Promise<SearchJob>;
  getJob: (jobId: string) => Promise<SearchJob | undefined>;
  runWorkflow: (input: { workflowKey: AiWorkflowKey; jobId?: string; modelId?: string; focus?: string }) => Promise<AiArtifact>;
  minNotes: number;
  pollMs: number;
  waitTimeoutMs: number;
  sleep: (ms: number) => Promise<void>;
}

const activeRuns = new Set<string>();

const stepTitles: Record<AiOrchestrationStepKey, string> = {
  "create-search-job": "创建抓取任务",
  "wait-notes": "等待笔记入库",
  "run-content-planning": "生成内容规划与话题机会",
  "run-viral-template": "生成爆款模板与爆款结构",
  "run-audience-insight": "生成受众洞察与评论需求",
  "summarize": "汇总 AI 产物"
};

const controlledStepKeys: AiOrchestrationStepKey[] = [
  "create-search-job",
  "wait-notes",
  "run-content-planning",
  "run-viral-template",
  "run-audience-insight",
  "summarize"
];

const workflowSteps: Array<{ step: AiOrchestrationStepKey; workflowKey: AiWorkflowKey }> = [
  { step: "run-content-planning", workflowKey: "content-planning" },
  { step: "run-viral-template", workflowKey: "viral-template" },
  { step: "run-audience-insight", workflowKey: "audience-insight" }
];

export async function createAiOrchestration(
  input: AiOrchestrationCreateInput,
  storage: StoreLike = store,
  options: OrchestratorOptions = {}
): Promise<AiOrchestration> {
  const instruction = input.instruction.trim();
  if (!instruction) {
    throw new Error("AI 编排指令不能为空。");
  }

  const keywords = normalizeKeywords(input.keywords?.length ? input.keywords : extractKeywords(instruction));
  if (!keywords.length) {
    throw new Error("请提供明确关键词，例如：帮我抓取关键词 武汉相亲，然后生成分析。");
  }

  const now = nowIso();
  const orchestration: AiOrchestration = {
    id: createId("orch"),
    instruction,
    keywords,
    modelId: input.modelId,
    steps: createInitialSteps(),
    status: "queued",
    artifactIds: [],
    createdAt: now,
    updatedAt: now
  };

  await storage.update("aiOrchestrations", (items) => [orchestration, ...items]);
  if (options.autoStart ?? true) {
    startAiOrchestration(orchestration.id, storage, options);
  }
  return orchestration;
}

export async function listAiOrchestrations(storage: StoreLike = store): Promise<AiOrchestration[]> {
  return storage.read("aiOrchestrations");
}

export async function getAiOrchestration(id: string, storage: StoreLike = store): Promise<AiOrchestration | undefined> {
  return (await storage.read("aiOrchestrations")).find((item) => item.id === id);
}

export function startAiOrchestration(id: string, storage: StoreLike = store, options: OrchestratorOptions = {}): void {
  if (activeRuns.has(id)) {
    return;
  }
  activeRuns.add(id);
  void runAiOrchestration(id, storage, options)
    .catch(async (error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[ai-orchestration:${id}] ${message}`);
      await patchOrchestration(id, storage, (item) => ({
        ...item,
        status: "failed",
        error: message
      })).catch((patchError) => {
        const patchMessage = patchError instanceof Error ? patchError.message : String(patchError);
        console.error(`[ai-orchestration:${id}:patch] ${patchMessage}`);
      });
    })
    .finally(() => {
      activeRuns.delete(id);
    });
}

export async function runAiOrchestration(
  id: string,
  storage: StoreLike = store,
  options: OrchestratorOptions = {}
): Promise<AiOrchestration> {
  const runtime = createRuntime(options);
  let currentStep: AiOrchestrationStepKey | undefined;

  try {
    let orchestration = await requireOrchestration(id, storage);
    if (orchestration.status === "completed" || orchestration.status === "cancelled") {
      return orchestration;
    }

    orchestration = await patchOrchestration(id, storage, (item) => ({ ...item, status: "running", error: undefined }));

    currentStep = "create-search-job";
    await markStep(id, storage, currentStep, { status: "running", startedAt: nowIso(), error: undefined });
    const job = await runtime.createJob(buildSearchJobInput(orchestration.keywords));
    orchestration = await patchOrchestration(id, storage, (item) => ({ ...item, jobId: job.id }));
    await markStep(id, storage, currentStep, { status: "completed", completedAt: nowIso(), output: { jobId: job.id } });

    currentStep = "wait-notes";
    await markStep(id, storage, currentStep, { status: "running", startedAt: nowIso(), error: undefined });
    await patchOrchestration(id, storage, (item) => ({ ...item, status: "waiting" }));
    const noteCount = await waitForNotes(job.id, storage, runtime);
    await markStep(id, storage, currentStep, { status: "completed", completedAt: nowIso(), output: { noteCount } });
    await patchOrchestration(id, storage, (item) => ({ ...item, status: "running" }));

    for (const workflow of workflowSteps) {
      currentStep = workflow.step;
      await markStep(id, storage, currentStep, { status: "running", startedAt: nowIso(), error: undefined });
      const artifact = await runtime.runWorkflow({
        workflowKey: workflow.workflowKey,
        jobId: job.id,
        modelId: orchestration.modelId,
        focus: orchestration.instruction
      });
      await appendArtifact(id, storage, artifact.id);
      if (artifact.status === "failed") {
        throw new Error(`${stepTitles[currentStep]}失败：${artifact.error ?? "AI 工作流返回失败状态。"}`);
      }
      await markStep(id, storage, currentStep, {
        status: "completed",
        completedAt: nowIso(),
        output: { artifactId: artifact.id }
      });
    }

    currentStep = "summarize";
    await markStep(id, storage, currentStep, { status: "running", startedAt: nowIso(), error: undefined });
    orchestration = await requireOrchestration(id, storage);
    const summary = await createSummaryArtifact(orchestration, storage);
    await appendArtifact(id, storage, summary.id);
    await markStep(id, storage, currentStep, {
      status: "completed",
      completedAt: nowIso(),
      output: { artifactId: summary.id }
    });

    return patchOrchestration(id, storage, (item) => ({
      ...item,
      status: "completed",
      error: undefined
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (currentStep) {
      await markStep(id, storage, currentStep, { status: "failed", completedAt: nowIso(), error: message });
    }
    return patchOrchestration(id, storage, (item) => ({
      ...item,
      status: "failed",
      error: message
    }));
  }
}

function createInitialSteps(): AiOrchestrationStep[] {
  return controlledStepKeys.map((key) => ({
    key,
    title: stepTitles[key],
    status: "pending"
  }));
}

function createRuntime(options: OrchestratorOptions): Runtime {
  return {
    createJob: options.createJob ?? ((input) => jobs.createJob(input)),
    getJob: options.getJob ?? ((jobId) => jobs.getJob(jobId)),
    runWorkflow: options.runWorkflow ?? ((input) => runAiWorkflow(input)),
    minNotes: Math.max(1, Math.floor(options.minNotes ?? 1)),
    pollMs: Math.max(0, Math.floor(options.pollMs ?? 3000)),
    waitTimeoutMs: Math.max(1, Math.floor(options.waitTimeoutMs ?? 5 * 60 * 1000)),
    sleep: options.sleep ?? sleep
  };
}

function buildSearchJobInput(keywords: string[]): SearchJobInput {
  return {
    keywords,
    sort: "popular",
    noteType: "all",
    pages: 1,
    commentPages: 1,
    concurrency: 2
  };
}

async function waitForNotes(jobId: string, storage: StoreLike, runtime: Runtime): Promise<number> {
  const deadline = Date.now() + runtime.waitTimeoutMs;
  let latestCount = 0;
  while (Date.now() <= deadline) {
    latestCount = await countJobNotes(jobId, storage);
    if (latestCount >= runtime.minNotes) {
      return latestCount;
    }

    const job = await runtime.getJob(jobId);
    if (job?.status === "failed") {
      throw new Error(job.breakerReason || "抓取任务失败，未能获得可分析笔记。");
    }
    if ((job?.status === "completed" || job?.status === "paused") && latestCount > 0) {
      return latestCount;
    }
    if ((job?.status === "completed" || job?.status === "paused") && latestCount === 0) {
      throw new Error(job.breakerReason || "抓取任务结束，但没有笔记入库。");
    }

    await runtime.sleep(runtime.pollMs);
  }
  throw new Error(`等待笔记入库超时，当前入库 ${latestCount} 条。`);
}

async function countJobNotes(jobId: string, storage: StoreLike): Promise<number> {
  const notes = await storage.read("notes");
  return notes.filter((note) => note.jobIds.includes(jobId)).length;
}

async function createSummaryArtifact(orchestration: AiOrchestration, storage: StoreLike): Promise<AiArtifact> {
  const now = nowIso();
  const artifact: AiArtifact = {
    id: createId("artifact"),
    workflowKey: "assistant",
    jobId: orchestration.jobId,
    title: `AI 编排汇总 - ${orchestration.keywords.join(" / ")}`,
    markdown: buildSummaryMarkdown(orchestration),
    source: "local",
    status: "completed",
    modelId: orchestration.modelId,
    promptKey: "assistant",
    promptTitle: "AI 编排汇总",
    promptSource: "default",
    promptVersion: "xhs-orchestration-mvp",
    contextSummary: `关键词：${orchestration.keywords.join(" / ")}；产物：${orchestration.artifactIds.length}`,
    createdAt: now,
    updatedAt: now
  };
  await storage.update("aiArtifacts", (artifacts) => [artifact, ...artifacts]);
  return artifact;
}

function buildSummaryMarkdown(orchestration: AiOrchestration): string {
  const completedSteps = orchestration.steps.filter((step) => step.status === "completed");
  return `# AI 编排汇总

## 任务信息
- 原始指令：${orchestration.instruction}
- 关键词：${orchestration.keywords.join(" / ")}
- 抓取任务：${orchestration.jobId ?? "未创建"}
- 模型：${orchestration.modelId ?? "默认模型"}

## 已完成步骤
${completedSteps.map((step) => `- ${step.title}`).join("\n") || "- 暂无"}

## 已生成产物
${orchestration.artifactIds.map((artifactId, index) => `- ${index + 1}. ${artifactId}`).join("\n") || "- 暂无"}

## 下一步建议
- 打开 AI 工作台阅读内容规划、爆款模板和受众洞察。
- 回到笔记库检查实际入库笔记、评论和媒体素材。
- 如果样本量偏少，请恢复或重新创建抓取任务后再生成补充报告。
`;
}

async function appendArtifact(id: string, storage: StoreLike, artifactId: string): Promise<void> {
  await patchOrchestration(id, storage, (item) => ({
    ...item,
    artifactIds: unique([...item.artifactIds, artifactId])
  }));
}

async function markStep(
  id: string,
  storage: StoreLike,
  key: AiOrchestrationStepKey,
  patch: Partial<AiOrchestrationStep>
): Promise<AiOrchestration> {
  return patchOrchestration(id, storage, (item) => ({
    ...item,
    steps: item.steps.map((step) => (step.key === key ? { ...step, ...patch } : step))
  }));
}

async function requireOrchestration(id: string, storage: StoreLike): Promise<AiOrchestration> {
  const orchestration = await getAiOrchestration(id, storage);
  if (!orchestration) {
    throw new Error("AI orchestration not found.");
  }
  return orchestration;
}

async function patchOrchestration(
  id: string,
  storage: StoreLike,
  updater: (item: AiOrchestration) => AiOrchestration
): Promise<AiOrchestration> {
  let updated: AiOrchestration | undefined;
  await storage.update("aiOrchestrations", (items) =>
    items.map((item) => {
      if (item.id !== id) {
        return item;
      }
      updated = {
        ...updater(item),
        updatedAt: nowIso()
      };
      return updated;
    })
  );
  if (!updated) {
    throw new Error("AI orchestration not found.");
  }
  return updated;
}

function extractKeywords(instruction: string): string[] {
  const patterns = [
    /关键词\s*[:：]?\s*([^\n，,。；;]+)/u,
    /关键字\s*[:：]?\s*([^\n，,。；;]+)/u,
    /抓取\s*(?:关键词|关键字)?\s*([^\n，,。；;]+)/u,
    /搜索\s*(?:关键词|关键字)?\s*([^\n，,。；;]+)/u,
    /(?:通过|用|以)\s*([^\n，,。；;]+?)\s*(?:关键词|关键字)\s*(?:进行|做)?\s*(?:抓取|搜索|采集|爬取)/u
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(instruction);
    const candidate = match?.[1];
    if (candidate) {
      return splitKeywordCandidate(candidate);
    }
  }
  return [];
}

function splitKeywordCandidate(candidate: string): string[] {
  const cleaned = candidate
    .replace(/^关键词\s*[:：]?/u, "")
    .split(/然后|并且|并|基于|生成|分析|这个关键词|这些关键词|该关键词|这个关键字|这些关键字|该关键字|再/u)[0]
    ?.replace(/[“”"'`]/g, "")
    .replace(/(?:的)?(?:抓取|搜索|采集|爬取).*$/u, "")
    .trim();
  if (!cleaned) {
    return [];
  }
  return cleaned
    .split(/[\s、/|]+/u)
    .filter((item) => item && !["这个", "这些", "该", "关键词", "关键字", "抓取", "搜索", "采集", "爬取"].includes(item));
}

function normalizeKeywords(values: string[] = []): string[] {
  return unique(values.map((value) => value.trim()).filter(Boolean));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
