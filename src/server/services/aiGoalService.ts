import type {
  AiArtifact,
  AiGoalRun,
  AiGoalRunCreateInput,
  AiGoalRunSourceInput,
  ContentBrief,
  GoalRunStep,
  GoalRunStepKey,
  ResearchDossier,
  ResearchEvidence,
  ResearchPlan,
  SearchJob,
  SearchJobInput
} from "../../shared/types.js";
import { createId, nowIso, unique } from "../../shared/utils.js";
import { store } from "../storage/localStore.js";
import { jobs } from "./jobService.js";
import { generateContentDraftBatch } from "./contentStudioService.js";

type StoreLike = Pick<typeof store, "read" | "write" | "update">;

interface GoalRuntime {
  createJob: (input: SearchJobInput) => Promise<SearchJob>;
  getJob: (jobId: string) => Promise<SearchJob | undefined>;
  generateBatch: typeof generateContentDraftBatch;
  fetchImpl: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  pollMs: number;
  waitTimeoutMs: number;
}

interface GoalOptions extends Partial<GoalRuntime> {
  autoStart?: boolean;
}

export type GoalToolName =
  | "search_xhs_notes"
  | "wait_xhs_dataset"
  | "read_xhs_evidence"
  | "search_public_sources"
  | "read_public_source"
  | "build_research_dossier"
  | "generate_note_batch"
  | "review_note_batch"
  | "save_campaign_artifacts";

const activeRuns = new Set<string>();
const stepTitles: Record<GoalRunStepKey, string> = {
  "understand-goal": "理解目标",
  "plan-research": "制定研究计划",
  "collect-xhs": "收集小红书资料",
  "collect-public-sources": "检索公开资料",
  "build-dossier": "整理研究证据",
  "plan-content": "规划内容角度",
  "generate-drafts": "批量撰写笔记",
  "review-drafts": "逐篇规则审稿",
  "archive-results": "归档终稿与报告"
};
const stepKeys = Object.keys(stepTitles) as GoalRunStepKey[];

export async function createAiGoalRun(
  input: AiGoalRunCreateInput,
  localStore: StoreLike = store
): Promise<AiGoalRun> {
  const instruction = input.instruction.trim();
  if (!instruction) throw new Error("目标不能为空。");
  const now = nowIso();
  const run: AiGoalRun = {
    id: createId("goal"),
    instruction,
    modelId: input.modelId,
    playbookId: input.playbookId,
    plan: parseResearchPlan(instruction),
    status: "waiting_confirmation",
    steps: stepKeys.map((key, index) => ({
      key,
      title: stepTitles[key],
      status: index < 2 ? "completed" : "pending",
      attempts: index < 2 ? 1 : 0,
      startedAt: index < 2 ? now : undefined,
      completedAt: index < 2 ? now : undefined
    })),
    userSourceUrls: [],
    evidence: [],
    artifactIds: [],
    createdAt: now,
    updatedAt: now
  };
  await localStore.update("aiGoalRuns", (items) => [run, ...items]);
  return run;
}

export async function planAiGoalRun(
  input: AiGoalRunCreateInput,
  localStore: StoreLike = store
): Promise<{ goalRun?: AiGoalRun }> {
  return isGoalInstruction(input.instruction) ? { goalRun: await createAiGoalRun(input, localStore) } : {};
}

export async function listAiGoalRuns(localStore: StoreLike = store): Promise<AiGoalRun[]> {
  return localStore.read("aiGoalRuns");
}

export async function getAiGoalRun(id: string, localStore: StoreLike = store): Promise<AiGoalRun | undefined> {
  return (await localStore.read("aiGoalRuns")).find((item) => item.id === id);
}

export async function confirmAiGoalRun(id: string, localStore: StoreLike = store, options: GoalOptions = {}): Promise<AiGoalRun> {
  const run = await requireRun(id, localStore);
  if (run.status !== "waiting_confirmation" && run.status !== "failed") return run;
  const updated = await patchRun(id, localStore, (item) => ({ ...item, status: "running", error: undefined }));
  if (options.autoStart ?? true) startAiGoalRun(id, localStore, options);
  return updated;
}

export async function retryAiGoalRun(id: string, localStore: StoreLike = store, options: GoalOptions = {}): Promise<AiGoalRun> {
  const run = await requireRun(id, localStore);
  if (run.status !== "failed" && run.status !== "waiting") throw new Error("当前目标任务不需要重试。");
  const updated = await patchRun(id, localStore, (item) => ({ ...item, status: "running", error: undefined }));
  if (options.autoStart ?? true) startAiGoalRun(id, localStore, options);
  return updated;
}

export async function addAiGoalRunSources(id: string, input: AiGoalRunSourceInput, localStore: StoreLike = store): Promise<AiGoalRun> {
  const urls = unique(input.urls.map((url) => normalizePublicUrl(url)).filter((url): url is string => Boolean(url)));
  if (!urls.length) throw new Error("请提供可公开访问的 HTTPS 资料链接。");
  return patchRun(id, localStore, (item) => ({ ...item, userSourceUrls: unique([...item.userSourceUrls, ...urls]) }));
}

export function startAiGoalRun(id: string, localStore: StoreLike = store, options: GoalOptions = {}): void {
  if (activeRuns.has(id)) return;
  activeRuns.add(id);
  void runAiGoalRun(id, localStore, options)
    .catch(async (error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[ai-goal:${id}] ${message}`);
      await patchRun(id, localStore, (item) => ({ ...item, status: "failed", error: message })).catch(() => undefined);
    })
    .finally(() => activeRuns.delete(id));
}

export async function runAiGoalRun(id: string, localStore: StoreLike = store, options: GoalOptions = {}): Promise<AiGoalRun> {
  const runtime = createRuntime(options);
  let run = await requireRun(id, localStore);
  if (run.status === "completed" || run.status === "cancelled") return run;
  await patchRun(id, localStore, (item) => ({ ...item, status: "running", error: undefined }));

  try {
    run = await executeStep(id, "collect-xhs", localStore, async () => {
      const current = await requireRun(id, localStore);
      let jobId = current.jobId;
      if (!jobId) {
        const job = await runtime.createJob({
          keywords: current.plan.keywords,
          sort: "popular",
          noteType: "all",
          pages: 1,
          commentPages: 1,
          concurrency: 2
        });
        jobId = job.id;
        await patchRun(id, localStore, (item) => ({ ...item, jobId, status: "waiting" }));
      }
      await waitForDataset(jobId, runtime, localStore);
      const evidence = await readXhsEvidence(id, jobId, localStore);
      await patchRun(id, localStore, (item) => ({ ...item, status: "running", evidence: mergeEvidence(item.evidence, evidence) }));
    });

    run = await executeStep(id, "collect-public-sources", localStore, async () => {
      const current = await requireRun(id, localStore);
      const discovered = await searchPublicSources(current.plan, runtime.fetchImpl);
      const urls = unique([...current.userSourceUrls, ...discovered]);
      const evidence: ResearchEvidence[] = [];
      for (const url of urls.slice(0, 10)) {
        const item = await readPublicSource(id, url, current.userSourceUrls.includes(url), runtime.fetchImpl).catch(() => undefined);
        if (item) evidence.push(item);
      }
      const warning = urls.length ? undefined : "未配置公开搜索服务且没有用户资料链接，已降级为仅使用小红书公开样本。";
      await patchRun(id, localStore, (item) => ({ ...item, evidence: mergeEvidence(item.evidence, evidence), warning }));
    });

    run = await executeStep(id, "build-dossier", localStore, async () => {
      const current = await requireRun(id, localStore);
      await patchRun(id, localStore, (item) => ({ ...item, dossier: buildDossier(current) }));
    });

    run = await executeStep(id, "plan-content", localStore, async () => {
      const current = await requireRun(id, localStore);
      if (!current.dossier) throw new Error("研究档案尚未生成。");
    });

    run = await executeStep(id, "generate-drafts", localStore, async () => {
      const current = await requireRun(id, localStore);
      if (current.contentBatch?.items.length) return;
      const brief = buildContentBrief(current);
      const result = await runtime.generateBatch({
        playbookId: current.playbookId,
        jobId: current.jobId,
        modelId: current.modelId,
        brief,
        count: current.plan.outputCount
      }, localStore);
      const evidenceIds = current.evidence.filter((item) => item.kind !== "ai-inference").map((item) => item.id);
      await patchRun(id, localStore, (item) => ({
        ...item,
        contentBatch: {
          createdAt: nowIso(),
          items: result.results.map((entry, index) => ({
            angle: current.plan.angles[index % current.plan.angles.length]!,
            draftId: entry.draft.id,
            reviewId: entry.review.id,
            draftArtifactId: entry.artifact.id,
            reviewArtifactId: entry.reviewArtifact.id,
            evidenceIds
          }))
        },
        artifactIds: unique([...item.artifactIds, ...result.results.flatMap((entry) => [entry.artifact.id, entry.reviewArtifact.id])])
      }));
    });

    run = await executeStep(id, "review-drafts", localStore, async () => {
      const current = await requireRun(id, localStore);
      if (!current.contentBatch?.items.every((item) => item.reviewId)) throw new Error("存在未完成审稿的草稿。");
    });

    run = await executeStep(id, "archive-results", localStore, async () => {
      const current = await requireRun(id, localStore);
      const artifact = await saveDossierArtifact(current, localStore);
      await patchRun(id, localStore, (item) => ({ ...item, artifactIds: unique([artifact.id, ...item.artifactIds]) }));
    });

    return patchRun(id, localStore, (item) => ({ ...item, status: "completed", error: undefined }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return patchRun(id, localStore, (item) => ({ ...item, status: "failed", error: message }));
  }
}

function parseResearchPlan(instruction: string): ResearchPlan {
  const countMatch = instruction.match(/(?:生成|写|撰写)?\s*([1-8一二三四五六七八])\s*篇/u);
  const numberMap: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8 };
  const outputCount = countMatch ? numberMap[countMatch[1]!] ?? Number(countMatch[1]) : 3;
  const normalized = instruction
    .replace(/^(?:请|帮我|请帮我)?\s*(?:围绕|关于|研究)?/u, "")
    .replace(/(?:生成|撰写|写)\s*(?:几篇|[1-8一二三四五六七八]篇)?\s*(?:适合小红书的)?(?:宣传)?笔记[\s\S]*$/u, "")
    .trim();
  const subject = normalized.match(/^(.+?)(?:的?(?:背景|品牌市场定位|市场定位|品牌价值观|价值观|传播数据|播放数据|影响力|创新亮点)|，|。|然后|并且|包括|最后)/u)?.[1]?.trim()
    || normalized.split(/，|。|然后|并且|包括|最后/u)[0]?.trim()
    || instruction.slice(0, 60);
  const keywords = unique([subject, ...subject.split(/\s+|的/u)]).filter((item) => item.length >= 2).slice(0, 5);
  return {
    subject,
    questions: ["背景故事", "品牌市场定位与价值观", "公开传播数据与影响力", "传播创新亮点", "小红书用户讨论视角"],
    keywords: keywords.length ? keywords : [subject],
    sourceTypes: ["xiaohongshu", "brand-official", "media", "user-source"],
    outputCount: Math.min(Math.max(outputCount || 3, 1), 8),
    angles: ["品牌故事与价值观", "宣传片创意及情绪表达", "小红书用户视角和讨论切口"]
  };
}

function isGoalInstruction(instruction: string): boolean {
  const text = instruction.trim();
  const wantsContent = /写|撰写|生成|创作/u.test(text) && /笔记|文案|小红书/u.test(text);
  const wantsResearch = /研究|收集|搜索|查找|背景|定位|价值观|播放|影响力|数据|亮点|资料/u.test(text);
  return wantsContent && wantsResearch;
}

async function executeStep(id: string, key: GoalRunStepKey, localStore: StoreLike, action: () => Promise<void>): Promise<AiGoalRun> {
  const run = await requireRun(id, localStore);
  const step = run.steps.find((item) => item.key === key);
  if (step?.status === "completed") return run;
  await patchStep(id, key, localStore, { status: "running", startedAt: nowIso(), error: undefined, attempts: (step?.attempts ?? 0) + 1 });
  try {
    await action();
    return patchStep(id, key, localStore, { status: "completed", completedAt: nowIso(), error: undefined });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await patchStep(id, key, localStore, { status: "failed", completedAt: nowIso(), error: message });
    throw error;
  }
}

async function waitForDataset(jobId: string, runtime: GoalRuntime, localStore: StoreLike): Promise<void> {
  const deadline = Date.now() + runtime.waitTimeoutMs;
  while (Date.now() <= deadline) {
    const notes = (await localStore.read("notes")).filter((note) => note.jobIds.includes(jobId));
    if (notes.length) return;
    const job = await runtime.getJob(jobId);
    if (job?.status === "failed") throw new Error(job.breakerReason || "小红书抓取任务失败。");
    if (job?.status === "paused") throw new Error(job.breakerReason || "小红书抓取任务已暂停，可稍后重试。");
    if (job?.status === "completed") throw new Error("小红书抓取完成，但没有获得可用笔记。");
    await runtime.sleep(runtime.pollMs);
  }
  throw new Error("等待小红书资料入库超时，可稍后从当前步骤重试。");
}

async function readXhsEvidence(goalRunId: string, jobId: string, localStore: StoreLike): Promise<ResearchEvidence[]> {
  const [notes, comments] = await Promise.all([localStore.read("notes"), localStore.read("comments")]);
  const selected = notes.filter((note) => note.jobIds.includes(jobId)).sort((a, b) => b.hotScore - a.hotScore).slice(0, 30);
  const selectedIds = new Set(selected.map((note) => note.id));
  const evidence = selected.map((note) => ({
    id: createId("evidence"), goalRunId, claim: note.title || "小红书样本", sourceTitle: note.title || "小红书笔记",
    sourceUrl: note.webUrl || note.noteUrl, sourceType: "xiaohongshu" as const, publishedAt: note.publishedAt,
    collectedAt: nowIso(), excerpt: note.desc.slice(0, 500), confidence: "medium" as const,
    kind: "platform-observation" as const,
    metricScope: `单篇公开互动：点赞 ${note.likedCount}，收藏 ${note.collectedCount}，评论 ${note.commentCount}，分享 ${note.shareCount}`,
    noteId: note.id
  }));
  const topComments = comments.filter((comment) => selectedIds.has(comment.noteId)).sort((a, b) => b.likedCount - a.likedCount).slice(0, 30);
  return [...evidence, ...topComments.map((comment) => ({
    id: createId("evidence"), goalRunId, claim: "用户讨论样本", sourceTitle: "小红书公开评论",
    sourceType: "xiaohongshu" as const, collectedAt: nowIso(), excerpt: comment.content.slice(0, 300),
    confidence: "low" as const, kind: "user-opinion" as const, metricScope: `单条评论点赞 ${comment.likedCount}`, noteId: comment.noteId
  }))];
}

async function searchPublicSources(plan: ResearchPlan, fetchImpl: typeof fetch): Promise<string[]> {
  const endpoint = process.env.AI_PUBLIC_SEARCH_ENDPOINT?.trim();
  if (!endpoint) return [];
  const url = new URL(endpoint);
  url.searchParams.set("q", `${plan.subject} ${plan.questions.slice(0, 3).join(" ")}`);
  const response = await fetchWithTimeout(fetchImpl, url.toString());
  if (!response.ok) throw new Error(`公开资料搜索失败：HTTP ${response.status}`);
  const data = await response.json() as { results?: Array<{ url?: string }> };
  return unique((data.results ?? []).map((item) => normalizePublicUrl(item.url ?? "")).filter((item): item is string => Boolean(item))).slice(0, 8);
}

async function readPublicSource(goalRunId: string, url: string, userSource: boolean, fetchImpl: typeof fetch): Promise<ResearchEvidence | undefined> {
  const safeUrl = normalizePublicUrl(url);
  if (!safeUrl) return undefined;
  const response = await fetchWithTimeout(fetchImpl, safeUrl);
  if (!response.ok) return undefined;
  const html = await response.text();
  const title = decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? new URL(safeUrl).hostname).trim().slice(0, 180);
  const excerpt = decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).slice(0, 1200);
  if (!excerpt) return undefined;
  return {
    id: createId("evidence"), goalRunId, claim: title, sourceTitle: title, sourceUrl: safeUrl,
    sourceType: userSource ? "user-source" : classifySource(safeUrl), collectedAt: nowIso(), excerpt,
    confidence: userSource ? "medium" : "high", kind: "verified-fact", metricScope: "公开网页内容，需以来源页面标注的时间与口径为准"
  };
}

function buildDossier(run: AiGoalRun): ResearchDossier {
  const verified = run.evidence.filter((item) => item.kind === "verified-fact");
  const observations = run.evidence.filter((item) => item.kind === "platform-observation");
  const gaps: string[] = [];
  if (!verified.length) gaps.push("暂无品牌官方或可信媒体公开资料，品牌背景与价值观不能作为已核验事实。");
  if (!verified.some((item) => /播放|观看|浏览|传播/u.test(`${item.claim}${item.excerpt}`))) gaps.push("暂无公开可验证的宣传片播放量或全网传播数据。");
  if (!observations.length) gaps.push("暂无可用的小红书平台样本。");
  return {
    summary: `围绕“${run.plan.subject}”共收集 ${run.evidence.length} 条证据，其中公开资料 ${verified.length} 条、小红书样本 ${observations.length} 条。`,
    verifiedClaims: verified.map((item) => `${item.claim}：${item.excerpt.slice(0, 180)}`).slice(0, 12),
    platformObservations: observations.map((item) => `${item.claim}（${item.metricScope ?? "平台公开样本"}）`).slice(0, 20),
    gaps,
    evidenceIds: run.evidence.map((item) => item.id)
  };
}

function buildContentBrief(run: AiGoalRun): ContentBrief {
  const dossier = run.dossier;
  const safeFacts = dossier?.verifiedClaims.length ? dossier.verifiedClaims : ["暂无公开可验证的品牌与播放数据，正文不得编造具体数值。"];
  return {
    playbookId: run.playbookId,
    productName: run.plan.subject,
    persona: "关注儿童成长与品牌内容的普通用户",
    painPoint: "希望快速理解宣传内容的故事、价值观和传播亮点",
    scenario: "小红书内容分享",
    channel: "小红书公开样本与公开资料研究",
    sellingPoints: [...safeFacts.slice(0, 2), ...(dossier?.platformObservations.slice(0, 1) ?? [])],
    tone: "真实、克制、有信息来源、不使用无法核验的绝对化数据",
    length: "medium",
    keywords: unique([run.plan.subject, ...run.plan.angles]),
    jobId: run.jobId
  };
}

async function saveDossierArtifact(run: AiGoalRun, localStore: StoreLike): Promise<AiArtifact> {
  const existing = (await localStore.read("aiArtifacts")).find((item) => item.contextSummary === `goal-run:${run.id}` && item.title.startsWith("目标研究档案"));
  if (existing) return existing;
  const now = nowIso();
  const dossier = run.dossier ?? buildDossier(run);
  const artifact: AiArtifact = {
    id: createId("artifact"), workflowKey: "assistant", jobId: run.jobId,
    title: `目标研究档案 - ${run.plan.subject}`,
    markdown: `# 目标研究档案\n\n${dossier.summary}\n\n## 已核验资料\n${dossier.verifiedClaims.map((item) => `- ${item}`).join("\n") || "- 暂无"}\n\n## 小红书平台观察\n${dossier.platformObservations.map((item) => `- ${item}`).join("\n") || "- 暂无"}\n\n## 数据缺口\n${dossier.gaps.map((item) => `- ${item}`).join("\n") || "- 暂无"}\n\n## 来源\n${run.evidence.map((item) => `- [${item.sourceTitle}](${item.sourceUrl ?? "#"}) · ${item.kind} · ${item.metricScope ?? "以原始来源为准"}`).join("\n") || "- 暂无"}`,
    source: "local", status: "completed", modelId: run.modelId, promptKey: "assistant", promptTitle: "目标研究档案",
    promptSource: "default", promptVersion: "xhs-goal-run-v1", contextSummary: `goal-run:${run.id}`, createdAt: now, updatedAt: now
  };
  await localStore.update("aiArtifacts", (items) => [artifact, ...items]);
  return artifact;
}

function createRuntime(options: GoalOptions): GoalRuntime {
  return {
    createJob: options.createJob ?? ((input) => jobs.createJob(input)),
    getJob: options.getJob ?? ((jobId) => jobs.getJob(jobId)),
    generateBatch: options.generateBatch ?? generateContentDraftBatch,
    fetchImpl: options.fetchImpl ?? fetch,
    sleep: options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    pollMs: Math.max(0, options.pollMs ?? 3000),
    waitTimeoutMs: Math.max(1, options.waitTimeoutMs ?? 5 * 60 * 1000)
  };
}

async function patchRun(id: string, localStore: StoreLike, updater: (run: AiGoalRun) => AiGoalRun): Promise<AiGoalRun> {
  let updated: AiGoalRun | undefined;
  await localStore.update("aiGoalRuns", (items) => items.map((item) => {
    if (item.id !== id) return item;
    updated = { ...updater(item), updatedAt: nowIso() };
    return updated;
  }));
  if (!updated) throw new Error("AI goal run not found.");
  return updated;
}

async function patchStep(id: string, key: GoalRunStepKey, localStore: StoreLike, patch: Partial<GoalRunStep>): Promise<AiGoalRun> {
  return patchRun(id, localStore, (run) => ({ ...run, steps: run.steps.map((step) => step.key === key ? { ...step, ...patch } : step) }));
}

async function requireRun(id: string, localStore: StoreLike): Promise<AiGoalRun> {
  const run = await getAiGoalRun(id, localStore);
  if (!run) throw new Error("AI goal run not found.");
  return run;
}

function mergeEvidence(current: ResearchEvidence[], incoming: ResearchEvidence[]): ResearchEvidence[] {
  const seen = new Set<string>();
  return [...current, ...incoming].filter((item) => {
    const key = `${item.sourceUrl ?? item.noteId ?? item.sourceTitle}:${item.excerpt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizePublicUrl(value: string): string | undefined {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || isPrivateHost(url.hostname)) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function isPrivateHost(hostname: string): boolean {
  const value = hostname.toLowerCase();
  return value === "localhost" || value === "::1" || value.endsWith(".local") || /^127\./.test(value) || /^10\./.test(value) || /^192\.168\./.test(value) || /^172\.(1[6-9]|2\d|3[01])\./.test(value);
}

async function fetchWithTimeout(fetchImpl: typeof fetch, url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    let current = url;
    for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
      const response = await fetchImpl(current, { headers: { "User-Agent": "XHS-Ops-Research/1.0" }, redirect: "manual", signal: controller.signal });
      if (![301, 302, 303, 307, 308].includes(response.status)) return response;
      const location = response.headers.get("location");
      if (!location) throw new Error("公开资料重定向缺少目标地址。");
      const next = normalizePublicUrl(new URL(location, current).toString());
      if (!next) throw new Error("公开资料重定向到了不允许的地址。");
      current = next;
    }
    throw new Error("公开资料重定向次数过多。");
  } finally {
    clearTimeout(timer);
  }
}

function classifySource(url: string): "brand-official" | "media" {
  return /official|brand|balabala|巴拉巴拉/u.test(url) ? "brand-official" : "media";
}

function decodeHtml(value: string): string {
  return value.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, "\"").replace(/&#39;/gi, "'");
}
