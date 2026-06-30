import type {
  AiArtifact,
  AiAssistantChatInput,
  AiAssistantChatResponse,
  AiAssistantMessage,
  AiModelConfig,
  AiModelInput,
  AiPromptConfig,
  AiPromptDetail,
  AiPromptInfo,
  AiPromptSource,
  AiReport,
  AiWorkflowDefinition,
  AiWorkflowRunInput,
  AnalyticsReport,
  AuthorPostRecord,
  AuthorRecord,
  CommentRecord,
  NoteRecord,
  SearchJob
} from "../../shared/types.js";
import { clamp, createId, nowIso } from "../../shared/utils.js";
import { store } from "../storage/localStore.js";
import { getEnvValue, saveEnvValue } from "../utils/env.js";
import {
  AI_ASSISTANT_PROMPT_VERSION,
  buildAiWorkflowPrompt,
  buildAssistantPrompt,
  buildCustomWorkflowPrompt,
  buildReportPrompt,
  getDefaultPromptTemplate,
  getPromptVariables,
  listAiPromptInfos
} from "./aiPrompts.js";
import { getAnalytics, listNotes } from "./queryService.js";

interface ReportInput {
  jobId: string;
  modelId?: string;
  title?: string;
  focus?: string;
}

const workflowDefinitions: AiWorkflowDefinition[] = [
  {
    key: "content-planning",
    title: "内容策划",
    description: "基于关键词、热门笔记和评论需求生成选题日历、标题方向和正文结构。",
    module: "research",
    requires: ["job", "analytics"]
  },
  {
    key: "audience-insight",
    title: "受众洞察",
    description: "从评论和互动信号中提炼用户画像、痛点、问题和用户原话。",
    module: "audience",
    requires: ["job", "comments"]
  },
  {
    key: "competitor-analysis",
    title: "竞品分析",
    description: "对比头部作者、互动数据和内容风格，生成竞品账号分析。",
    module: "competitors",
    requires: ["job", "authors"]
  },
  {
    key: "viral-deep-dive",
    title: "AI 爆款拆解",
    description: "解释当前爆款为什么爆、哪些结构可复用、哪些风险需要避开。",
    module: "viral",
    requires: ["job", "note", "comments", "analytics"]
  },
  {
    key: "viral-template",
    title: "爆款模板",
    description: "从 Top 笔记中提炼标题公式、正文段落、CTA 和适用场景。",
    module: "viral",
    requires: ["job", "analytics"]
  },
  {
    key: "note-analysis",
    title: "单篇笔记分析",
    description: "分析选中笔记的标题、正文、评论需求和可改写方向。",
    module: "notes",
    requires: ["note", "comments"]
  },
  {
    key: "draft-review",
    title: "AI 审稿员",
    description: "按产品规则、平台风险和小红书表达习惯审稿，并给出最小修改版。",
    module: "content",
    requires: []
  },
  {
    key: "note-writing",
    title: "笔记撰写",
    description: "基于结构化 Brief、热门笔记和评论需求生成小红书笔记草稿。",
    module: "content",
    requires: []
  }
];

export async function listAiModels(): Promise<AiModelConfig[]> {
  return store.read("aiModels");
}

export function listAiWorkflows(): AiWorkflowDefinition[] {
  return workflowDefinitions;
}

export async function listAiPrompts(): Promise<AiPromptInfo[]> {
  const [configs, artifacts] = await Promise.all([store.read("aiPromptConfigs"), store.read("aiArtifacts")]);
  return listAiPromptInfos().map((info) => {
    const config = configs.find((item) => item.key === info.key);
    const related = artifacts.filter((artifact) => artifact.promptKey === info.key);
    return {
      ...info,
      promptSource: config?.activeSource ?? "default",
      isCustomized: Boolean(config?.customTemplate?.trim()),
      artifactCount: related.length,
      lastUsedAt: config?.lastUsedAt ?? related.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.createdAt,
      updatedAt: config?.updatedAt
    };
  });
}

export async function getAiPromptDetail(key: AiWorkflowRunInput["workflowKey"]): Promise<AiPromptDetail> {
  const [configs, artifacts] = await Promise.all([store.read("aiPromptConfigs"), store.read("aiArtifacts")]);
  const info = listAiPromptInfos().find((item) => item.key === key);
  if (!info) {
    throw new Error("AI prompt not found.");
  }
  const config = configs.find((item) => item.key === key);
  const defaultTemplate = getDefaultPromptTemplate(key);
  const related = artifacts
    .filter((artifact) => artifact.promptKey === key)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    ...info,
    promptSource: config?.activeSource ?? "default",
    isCustomized: Boolean(config?.customTemplate?.trim()),
    artifactCount: related.length,
    lastUsedAt: config?.lastUsedAt ?? related[0]?.createdAt,
    updatedAt: config?.updatedAt,
    defaultTemplate,
    customTemplate: config?.customTemplate,
    activeTemplate: config?.activeSource === "custom" && config.customTemplate?.trim() ? config.customTemplate : defaultTemplate,
    variables: getPromptVariables(),
    recentArtifacts: related.slice(0, 8).map((artifact) => ({
      id: artifact.id,
      title: artifact.title,
      createdAt: artifact.createdAt,
      source: artifact.source
    }))
  };
}

export async function saveAiPromptConfig(key: AiWorkflowRunInput["workflowKey"], customTemplate: string): Promise<AiPromptDetail> {
  const now = nowIso();
  await store.update("aiPromptConfigs", (configs) => upsertPromptConfig(configs, {
    key,
    customTemplate: customTemplate.trim(),
    activeSource: "custom",
    updatedAt: now
  }));
  return getAiPromptDetail(key);
}

export async function resetAiPromptConfig(key: AiWorkflowRunInput["workflowKey"]): Promise<AiPromptDetail> {
  const now = nowIso();
  await store.update("aiPromptConfigs", (configs) => upsertPromptConfig(configs, {
    key,
    customTemplate: "",
    activeSource: "default",
    updatedAt: now
  }));
  return getAiPromptDetail(key);
}

export async function activateAiPrompt(key: AiWorkflowRunInput["workflowKey"], source: AiPromptSource): Promise<AiPromptDetail> {
  const now = nowIso();
  await store.update("aiPromptConfigs", (configs) => {
    const current = configs.find((item) => item.key === key);
    return upsertPromptConfig(configs, {
      key,
      customTemplate: current?.customTemplate ?? "",
      activeSource: source === "custom" && current?.customTemplate?.trim() ? "custom" : "default",
      updatedAt: now,
      lastUsedAt: current?.lastUsedAt
    });
  });
  return getAiPromptDetail(key);
}

export async function listAiArtifacts(jobId?: string): Promise<AiArtifact[]> {
  const artifacts = await store.read("aiArtifacts");
  return jobId ? artifacts.filter((artifact) => artifact.jobId === jobId) : artifacts;
}

export async function getAiArtifact(artifactId: string): Promise<AiArtifact | undefined> {
  return (await store.read("aiArtifacts")).find((artifact) => artifact.id === artifactId);
}

export async function deleteAiArtifact(artifactId: string): Promise<{ deleted: number }> {
  let deleted = 0;
  await store.update("aiArtifacts", (artifacts) => {
    const next = artifacts.filter((artifact) => artifact.id !== artifactId);
    deleted = artifacts.length - next.length;
    return next;
  });
  return { deleted };
}

export async function runAiWorkflow(input: AiWorkflowRunInput): Promise<AiArtifact> {
  const workflow = workflowDefinitions.find((item) => item.key === input.workflowKey);
  if (!workflow) {
    throw new Error("AI workflow not found.");
  }

  const context = await buildAiContext(input.jobId, input.noteId);
  const title = `${workflow.title}${context.job ? ` - ${context.job.keywords.join(" / ")}` : ""}`;
  const prompt = await resolveWorkflowPrompt(workflow.key, context, input.focus);
  return createArtifact({
    workflowKey: workflow.key,
    jobId: input.jobId,
    noteId: input.noteId,
    title,
    prompt: prompt.prompt,
    modelId: input.modelId,
    promptKey: prompt.promptKey,
    promptTitle: prompt.promptTitle,
    promptSource: prompt.promptSource,
    promptVersion: prompt.promptVersion,
    contextSummary: prompt.contextSummary,
    fallback: buildLocalWorkflowMarkdown(workflow, context, input.focus)
  });
}

export async function chatWithAssistant(input: AiAssistantChatInput): Promise<AiAssistantChatResponse> {
  const now = nowIso();
  const userMessage: AiAssistantMessage = {
    id: createId("msg"),
    role: "user",
    content: input.message,
    createdAt: now
  };
  const context = input.jobId ? await buildAiContext(input.jobId, input.noteId) : emptyAiContext();
  const prompt = buildAssistantPrompt(input.message, context, input.module);
  const artifact = await createArtifact({
    workflowKey: "assistant",
    jobId: input.jobId,
    noteId: input.noteId,
    title: "AI 助手回复",
    prompt,
    modelId: input.modelId,
    promptKey: "assistant",
    promptTitle: "AI 助手",
    promptSource: "default",
    promptVersion: AI_ASSISTANT_PROMPT_VERSION,
    contextSummary: summarizeContext(context),
    fallback: buildLocalAssistantMarkdown(input.message, context)
  });
  const assistantMessage: AiAssistantMessage = {
    id: createId("msg"),
    role: "assistant",
    content: artifact.markdown,
    createdAt: nowIso()
  };
  await store.update("aiMessages", (messages) => [...messages, userMessage, assistantMessage]);
  return { message: assistantMessage, artifact };
}

export async function saveAiModel(input: AiModelInput): Promise<AiModelConfig> {
  const now = nowIso();
  const id = createId("model");
  const apiKey = input.apiKey?.trim();
  if (apiKey) {
    await saveEnvValue(keyNameForModel(id), apiKey);
  }

  const model: AiModelConfig = {
    id,
    name: input.name.trim(),
    provider: input.provider.trim() || "OpenAI-compatible",
    baseUrl: normalizeBaseUrl(input.baseUrl),
    model: input.model.trim(),
    apiKeyMasked: apiKey ? maskKey(apiKey) : "",
    hasApiKey: Boolean(apiKey),
    isDefault: Boolean(input.isDefault),
    temperature: clamp(Number(input.temperature ?? 0.4), 0, 2),
    maxTokens: clamp(Number(input.maxTokens ?? 4000), 256, 32_000),
    createdAt: now,
    updatedAt: now
  };

  await store.update("aiModels", (models) => {
    const next = model.isDefault ? models.map((item) => ({ ...item, isDefault: false })) : models;
    return [model, ...next];
  });
  return model;
}

export async function updateAiModel(modelId: string, input: Partial<AiModelInput>): Promise<AiModelConfig> {
  const models = await store.read("aiModels");
  const current = models.find((item) => item.id === modelId);
  if (!current) {
    throw new Error("AI model not found.");
  }

  const apiKey = input.apiKey?.trim();
  if (apiKey) {
    await saveEnvValue(keyNameForModel(modelId), apiKey);
  }

  const updated: AiModelConfig = {
    ...current,
    name: input.name?.trim() || current.name,
    provider: input.provider?.trim() || current.provider,
    baseUrl: input.baseUrl ? normalizeBaseUrl(input.baseUrl) : current.baseUrl,
    model: input.model?.trim() || current.model,
    apiKeyMasked: apiKey ? maskKey(apiKey) : current.apiKeyMasked,
    hasApiKey: apiKey ? true : current.hasApiKey,
    isDefault: input.isDefault ?? current.isDefault,
    temperature: input.temperature !== undefined ? clamp(Number(input.temperature), 0, 2) : current.temperature,
    maxTokens: input.maxTokens !== undefined ? clamp(Number(input.maxTokens), 256, 32_000) : current.maxTokens,
    updatedAt: nowIso()
  };

  await store.update("aiModels", (items) =>
    items.map((item) => (item.id === modelId ? updated : updated.isDefault ? { ...item, isDefault: false } : item))
  );
  return updated;
}

export async function deleteAiModel(modelId: string): Promise<{ deleted: number }> {
  const models = await store.read("aiModels");
  const current = models.find((item) => item.id === modelId);
  if (!current) {
    return { deleted: 0 };
  }

  await store.update("aiModels", (items) => {
    const remaining = items.filter((item) => item.id !== modelId);
    if (current.isDefault && remaining.length && !remaining.some((item) => item.isDefault)) {
      return remaining.map((item, index) => ({ ...item, isDefault: index === 0 }));
    }
    return remaining;
  });
  return { deleted: 1 };
}

export async function setDefaultAiModel(modelId: string): Promise<AiModelConfig> {
  const models = await store.read("aiModels");
  const target = models.find((item) => item.id === modelId);
  if (!target) {
    throw new Error("AI model not found.");
  }

  const updated = { ...target, isDefault: true, updatedAt: nowIso() };
  await store.update("aiModels", (items) => items.map((item) => (item.id === modelId ? updated : { ...item, isDefault: false })));
  return updated;
}

export async function testAiModel(modelId: string): Promise<{ ok: boolean; message: string }> {
  const model = (await store.read("aiModels")).find((item) => item.id === modelId);
  if (!model) {
    throw new Error("AI model not found.");
  }
  const apiKey = getEnvValue(keyNameForModel(model.id));
  if (!apiKey) {
    return { ok: false, message: "未配置 API Key。" };
  }

  try {
    await callModel(model, apiKey, "请只回复：连接成功");
    return { ok: true, message: "连接成功。" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

export async function createAiReport(input: ReportInput): Promise<AiReport> {
  const [models, jobs, comments] = await Promise.all([
    store.read("aiModels"),
    store.read("searchJobs"),
    store.read("comments")
  ]);
  const job = jobs.find((item) => item.id === input.jobId);
  const notes = await listNotes({ jobId: input.jobId, sort: "hot" });
  const analytics = await getAnalytics(input.jobId);
  const title = input.title?.trim() || `${job?.keywords.join(" / ") || input.jobId} 分析报告`;
  const model = models.find((item) => item.id === input.modelId) ?? models.find((item) => item.isDefault);
  const relatedComments = comments.filter((comment) => notes.some((note) => note.id === comment.noteId));
  let markdown = buildLocalReport(title, analytics, notes, relatedComments, model ? undefined : "未配置 AI 模型，当前为本地规则版报告。");
  let status: AiReport["status"] = "completed";
  let source: AiReport["source"] = "local";
  let error: string | undefined;

  if (model) {
    const apiKey = getEnvValue(keyNameForModel(model.id));
    if (apiKey) {
      try {
        markdown = await callModel(model, apiKey, buildReportPrompt(title, analytics, notes, relatedComments, input.focus));
        source = "ai";
      } catch (err) {
        status = "failed";
        error = err instanceof Error ? err.message : String(err);
        markdown = buildLocalReport(title, analytics, notes, relatedComments, `AI 调用失败，以下为本地规则版报告。错误：${error}`);
      }
    } else {
      markdown = buildLocalReport(title, analytics, notes, relatedComments, "默认模型未配置 API Key，当前为本地规则版报告。");
    }
  }

  const now = nowIso();
  const report: AiReport = {
    id: createId("report"),
    jobId: input.jobId,
    title,
    modelId: model?.id,
    source,
    status,
    markdown,
    error,
    createdAt: now,
    updatedAt: now
  };
  await store.update("aiReports", (reports) => [report, ...reports]);
  return report;
}

export async function getAiReport(reportId: string): Promise<AiReport | undefined> {
  return (await store.read("aiReports")).find((report) => report.id === reportId);
}

export async function listAiReports(jobId?: string): Promise<AiReport[]> {
  const reports = await store.read("aiReports");
  return jobId ? reports.filter((report) => report.jobId === jobId) : reports;
}

export async function deleteAiReport(reportId: string): Promise<{ deleted: number }> {
  let deleted = 0;
  await store.update("aiReports", (reports) => {
    const next = reports.filter((report) => report.id !== reportId);
    deleted = reports.length - next.length;
    return next;
  });
  return { deleted };
}

interface AiContext {
  job?: SearchJob;
  analytics?: AnalyticsReport;
  notes: NoteRecord[];
  selectedNote?: NoteRecord;
  comments: CommentRecord[];
  authors: AuthorRecord[];
  authorPosts: AuthorPostRecord[];
}

function emptyAiContext(): AiContext {
  return {
    notes: [],
    comments: [],
    authors: [],
    authorPosts: []
  };
}

async function buildAiContext(jobId?: string, noteId?: string): Promise<AiContext> {
  const [jobs, comments, authors, authorPosts] = await Promise.all([
    store.read("searchJobs"),
    store.read("comments"),
    store.read("authors"),
    store.read("authorPosts")
  ]);
  const sortedJobs = [...jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const job = (jobId ? jobs.find((item) => item.id === jobId) : undefined) ?? sortedJobs[0];
  const notes = job ? await listNotes({ jobId: job.id, sort: "hot" }) : await listNotes({ sort: "hot" });
  const selectedNote = noteId ? notes.find((note) => note.id === noteId) ?? (await store.read("notes")).find((note) => note.id === noteId) : undefined;
  const relatedNoteIds = new Set((selectedNote ? [selectedNote] : notes.slice(0, 30)).map((note) => note.id));
  const analytics = job ? await getAnalytics(job.id) : undefined;
  return {
    job,
    analytics,
    notes,
    selectedNote,
    comments: comments.filter((comment) => relatedNoteIds.has(comment.noteId)).sort((a, b) => b.likedCount - a.likedCount),
    authors,
    authorPosts
  };
}

async function resolveWorkflowPrompt(
  key: AiWorkflowRunInput["workflowKey"],
  context: AiContext,
  focus?: string
): Promise<ReturnType<typeof buildAiWorkflowPrompt>> {
  const configs = await store.read("aiPromptConfigs");
  const config = configs.find((item) => item.key === key);
  const useCustom = config?.activeSource === "custom" && Boolean(config.customTemplate?.trim());
  const prompt = useCustom ? buildCustomWorkflowPrompt(key, config.customTemplate ?? "", context, focus) : buildAiWorkflowPrompt(key, context, focus);
  const now = nowIso();
  await store.update("aiPromptConfigs", (items) => upsertPromptConfig(items, {
    key,
    customTemplate: config?.customTemplate ?? "",
    activeSource: useCustom ? "custom" : "default",
    updatedAt: config?.updatedAt ?? now,
    lastUsedAt: now
  }));
  return prompt;
}

function upsertPromptConfig(configs: AiPromptConfig[], next: AiPromptConfig): AiPromptConfig[] {
  const exists = configs.some((item) => item.key === next.key);
  if (!exists) {
    return [next, ...configs];
  }
  return configs.map((item) => item.key === next.key ? { ...item, ...next } : item);
}

async function createArtifact(input: {
  workflowKey: AiArtifact["workflowKey"];
  jobId?: string;
  noteId?: string;
  title: string;
  prompt: string;
  promptKey?: AiArtifact["promptKey"];
  promptTitle?: string;
  promptSource?: AiArtifact["promptSource"];
  promptVersion?: string;
  contextSummary?: string;
  modelId?: string;
  fallback: string;
}): Promise<AiArtifact> {
  const models = await store.read("aiModels");
  const model = (input.modelId ? models.find((item) => item.id === input.modelId) : undefined) ?? models.find((item) => item.isDefault) ?? models[0];
  let markdown = input.fallback;
  let source: AiArtifact["source"] = "local";
  let status: AiArtifact["status"] = "completed";
  let error: string | undefined;

  if (model) {
    const apiKey = getEnvValue(keyNameForModel(model.id));
    if (apiKey) {
      try {
        markdown = await callModel(model, apiKey, input.prompt);
        source = "ai";
      } catch (err) {
        status = "failed";
        error = err instanceof Error ? err.message : String(err);
        markdown = `${input.fallback}\n\n> AI 调用失败，以上为本地规则版结果。错误：${error}`;
      }
    } else {
      markdown = `${input.fallback}\n\n> 默认模型未配置 API Key，当前为本地规则版结果。`;
    }
  } else {
    markdown = `${input.fallback}\n\n> 尚未配置 AI 模型，当前为本地规则版结果。`;
  }

  const now = nowIso();
  const artifact: AiArtifact = {
    id: createId("artifact"),
    workflowKey: input.workflowKey,
    jobId: input.jobId,
    noteId: input.noteId,
    title: input.title,
    markdown,
    source,
    status,
    modelId: model?.id,
    promptKey: input.promptKey,
    promptTitle: input.promptTitle,
    promptSource: input.promptSource,
    promptVersion: input.promptVersion,
    contextSummary: input.contextSummary,
    error,
    createdAt: now,
    updatedAt: now
  };
  await store.update("aiArtifacts", (artifacts) => [artifact, ...artifacts]);
  return artifact;
}

function buildLocalWorkflowMarkdown(workflow: AiWorkflowDefinition, context: AiContext, focus?: string): string {
  const topNotes = context.notes.slice(0, 8);
  const topKeywords = context.analytics?.keywords.slice(0, 8) ?? [];
  const topAuthors = context.analytics?.authors.slice(0, 8) ?? [];
  const topComments = context.comments.slice(0, 10);
  const selected = context.selectedNote;
  return `# ${workflow.title}

${focus ? `> 关注点：${focus}\n` : ""}生成时间：${nowIso()}

## 关键结论

- 当前样本包含 ${context.notes.length} 篇笔记、${context.comments.length} 条相关评论。
- 最高优先级关键词：${topKeywords.map((item) => item.keyword).join("、") || "暂无"}。
- 可重点参考的作者：${topAuthors.map((item) => item.nickname).join("、") || "暂无"}。

## 数据依据

${topNotes.map((note, index) => `${index + 1}. ${note.title}（赞 ${note.likedCount} / 藏 ${note.collectedCount} / 评 ${note.commentCount}）`).join("\n") || "- 暂无热门笔记样本。"}

## 可执行动作

${localActionsFor(workflow.key, selected)}

## 评论/受众信号

${topComments.map((comment) => `- ${comment.content}（赞 ${comment.likedCount}）`).join("\n") || "- 暂无评论样本。"}

## 风险和数据缺口

- 当前为本地规则版结果，配置默认模型后可生成更完整的 AI 分析。
- 写入类动作必须人工确认，不建议自动评论、自动点赞或自动发布。`;
}

function buildLocalAssistantMarkdown(message: string, context: AiContext): string {
  return `# AI 助手回复

你的问题：${message}

## 当前可用上下文

- 当前任务：${context.job?.keywords.join(" / ") || "暂无"}
- 笔记样本：${context.notes.length}
- 评论样本：${context.comments.length}
- 选中笔记：${context.selectedNote?.title || "暂无"}

## 建议

- 如果要做内容策划，先运行“内容策划”工作流。
- 如果要理解用户需求，先运行“受众洞察”工作流。
- 如果要拆解爆款，先选择一篇高热笔记再运行“AI 爆款拆解”。
- 如果要做竞品，先确保任务已抓取作者和作者作品。`;
}

function localActionsFor(key: AiWorkflowDefinition["key"], selected?: NoteRecord): string {
  if (key === "content-planning") {
    return "- 生成 7 天选题表，每天 1 个清单型标题、1 个避坑型标题、1 个对比型标题。\n- 优先复用 Top 关键词和高收藏笔记的正文结构。";
  }
  if (key === "audience-insight") {
    return "- 把高频问题拆成 FAQ 笔记。\n- 将高赞评论中的原话转成标题钩子。";
  }
  if (key === "competitor-analysis") {
    return "- 选 3 个头部作者做内容支柱对比。\n- 找出其高赞但低评论的内容作为模板，避开高争议话题。";
  }
  if (key === "viral-deep-dive" || key === "viral-template") {
    return `- 复盘标题钩子、正文开头、评论触发点。\n- ${selected ? `以《${selected.title}》为样本生成 3 个同结构选题。` : "先选择一篇高热笔记再做单篇拆解。"}`;
  }
  if (key === "draft-review") {
    return "- 粘贴原始笔记后，按规则库输出风险项、修改理由和最小修改版。\n- 修改后再做一次规则复核，发布前仍需人工确认。";
  }
  if (key === "note-writing") {
    return "- 用身份、痛点、场景、了解渠道和产品卖点生成真实分享型草稿。\n- 草稿生成后进入 AI 审稿员复核，避免硬广和敏感功效表达。";
  }
  return "- 分析标题是否清楚、正文是否有信息密度、评论是否暴露未满足需求。\n- 输出 3 个改写方向供人工选择。";
}

function summarizeContext(context: AiContext): string {
  return [
    context.job ? `任务：${context.job.keywords.join(" / ")}` : "无任务",
    `笔记：${context.notes.length}`,
    `评论：${context.comments.length}`,
    `作者：${context.authors.length}`,
    context.selectedNote ? `选中：${context.selectedNote.title}` : "未选中笔记"
  ].join(" · ");
}

function buildLocalReport(
  title: string,
  analytics: AnalyticsReport,
  notes: NoteRecord[],
  comments: CommentRecord[],
  notice?: string
): string {
  const topNotes = [...notes].sort((a, b) => b.hotScore - a.hotScore).slice(0, 10);
  const topComments = [...comments].sort((a, b) => b.likedCount - a.likedCount).slice(0, 8);
  const keywords = analytics.keywords.slice(0, 8);
  const authors = analytics.authors.slice(0, 8);

  return `# ${title}

${notice ? `> ${notice}\n` : ""}生成时间：${nowIso()}

## 市场概览

- 共抓取 ${analytics.overview.notes} 篇笔记，其中图文 ${analytics.overview.imageNotes} 篇、视频 ${analytics.overview.videos} 篇。
- 平均点赞 ${analytics.overview.avgLikes}，总评论 ${analytics.overview.totalComments}，总收藏 ${analytics.overview.totalCollects}。
- 当前样本更适合判断标题结构、互动比例和评论需求，不能单独代表全站流量。

## 关键词机会

${keywords
  .map(
    (item) =>
      `- ${item.keyword}：${item.tier} 级，Top1 点赞 ${item.top1Likes}，Top10 均赞 ${item.top10AvgLikes}，机会分 ${item.opportunityScore}。`
  )
  .join("\n") || "- 暂无关键词样本。"}

## 爆款标题与正文结构

${topNotes
  .map((note, index) => `${index + 1}. ${note.title}（赞 ${note.likedCount} / 藏 ${note.collectedCount} / 评 ${note.commentCount}）`)
  .join("\n") || "暂无笔记样本。"}

## 评论需求洞察

${topComments.map((comment) => `- @${comment.authorName ?? "用户"}：${comment.content}（赞 ${comment.likedCount}）`).join("\n") || "- 暂无评论样本。"}

## 竞品作者画像

${authors
  .map((author) => `- ${author.nickname}：粉丝 ${author.fansCount}，作品样本 ${author.noteCount}，最高点赞 ${author.maxLikes}。`)
  .join("\n") || "- 暂无作者样本。"}

## 未来 7 天选题建议

- 优先围绕 Top 关键词做“清单型、避坑型、对比型”标题。
- 收藏/点赞比高的笔记适合沉淀为攻略或模板，评论/点赞比高的笔记适合做问答续篇。
- 对评论中的高频问题单独拆成短笔记，标题直接复用用户提问语言。

## 风险与数据局限

- 小红书接口和 Cookie 状态可能触发验证码或空响应，任务暂停时应先重新验证登录。
- 评论回复属于写入动作，必须人工确认，并保持低频发送。`;
}

async function callModel(model: AiModelConfig, apiKey: string, prompt: string): Promise<string> {
  const response = await fetch(`${model.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model.model,
      temperature: model.temperature,
      max_tokens: model.maxTokens,
      messages: [
        { role: "system", content: "你是严谨的小红书数据分析助手，只输出 Markdown。" },
        { role: "user", content: prompt }
      ]
    })
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };
  if (!response.ok) {
    throw new Error(data.error?.message || `AI request failed: ${response.status}`);
  }
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("AI response is empty.");
  }
  return content;
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "") || "https://api.openai.com/v1";
}

function keyNameForModel(id: string): string {
  return `AI_MODEL_${id.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}_KEY`;
}

function maskKey(value: string): string {
  if (value.length <= 8) {
    return "****";
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
