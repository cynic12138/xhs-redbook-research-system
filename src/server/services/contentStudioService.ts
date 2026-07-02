import type {
  AiArtifact,
  AiAssistantChatResponse,
  AiAssistantMessage,
  AiModelConfig,
  CommentRecord,
  ContentBrief,
  ContentDraft,
  ContentDraftBatchInput,
  ContentDraftBatchResult,
  ContentDraftInput,
  ContentDraftLength,
  ContentDraftResult,
  ContentIssueSeverity,
  ContentPlaybook,
  ContentPlaybookInput,
  ContentPlaybookRevision,
  ContentPlaybookStats,
  ContentProject,
  ContentProjectInput,
  ContentProjectMaterial,
  ContentProjectMaterialCategory,
  ContentProjectMaterialInput,
  ContentProjectStatus,
  ContentReviewBatchInput,
  ContentReviewBatchResult,
  ContentReplacementRule,
  ContentReviewInput,
  ContentReviewIssue,
  ContentReviewResult,
  ContentReviewRisk,
  ContentReviewRun,
  NoteRecord,
  SearchJob
} from "../../shared/types.js";
import { createId, nowIso, unique } from "../../shared/utils.js";
import { store } from "../storage/localStore.js";
import { getEnvValue } from "../utils/env.js";

type StoreLike = Pick<typeof store, "read" | "write" | "update">;

interface DraftText {
  title: string;
  body: string;
  tags: string[];
}

interface ModelJsonResult<T> {
  value?: T;
  source: AiArtifact["source"];
  status: AiArtifact["status"];
  modelId?: string;
  error?: string;
}

interface ContentContext {
  job?: SearchJob;
  notes: NoteRecord[];
  comments: CommentRecord[];
}

const defaultForbiddenTerms = [
  "yyds",
  "封神",
  "救命神器",
  "效果拉满",
  "绝了",
  "无敌",
  "性价比天花板",
  "闭眼冲",
  "必囤",
  "无限回购",
  "保姆式",
  "秒杀",
  "第一",
  "最强",
  "唯一"
];

const defaultSensitiveClaims = [
  "治疗",
  "治愈",
  "药效",
  "特效",
  "根治",
  "通便特效",
  "杜绝依赖",
  "宫缩风险",
  "早产风险",
  "永久不复发",
  "百分百有效"
];

const absolutePatterns = [/国家级/u, /最高级/u, /最佳/u, /顶级/u, /第一品牌/u, /百分百/u, /永久/u, /立刻见效/u];
const hardSellPatterns = [/马上下单/u, /赶紧买/u, /闭眼冲/u, /不买后悔/u, /链接在/u, /全网最低/u];
const maxPlaybookRevisionsPerPlaybook = 20;

export async function listContentPlaybooks(localStore: StoreLike = store): Promise<ContentPlaybook[]> {
  return localStore.read("contentPlaybooks");
}

export async function saveContentPlaybook(input: ContentPlaybookInput, id?: string, localStore: StoreLike = store): Promise<ContentPlaybook> {
  const now = nowIso();
  const current = id ? (await localStore.read("contentPlaybooks")).find((item) => item.id === id) : undefined;
  const playbook: ContentPlaybook = {
    id: current?.id ?? createId("playbook"),
    name: input.name.trim() || current?.name || "小红书种草规则",
    productName: input.productName.trim() || current?.productName || "产品",
    category: input.category?.trim() || current?.category || "通用种草",
    forbiddenTerms: normalizeList(input.forbiddenTerms, current?.forbiddenTerms ?? defaultForbiddenTerms),
    sensitiveClaims: normalizeList(input.sensitiveClaims, current?.sensitiveClaims ?? defaultSensitiveClaims),
    allowedSellingPoints: normalizeList(input.allowedSellingPoints, current?.allowedSellingPoints ?? ["真实体验", "生活场景", "温和表达"]),
    requiredSections: normalizeList(input.requiredSections, current?.requiredSections ?? ["标题", "内容", "标签"]),
    toneWords: normalizeList(input.toneWords, current?.toneWords ?? ["口语化", "真实分享", "生活化"]),
    personas: normalizeList(input.personas, current?.personas ?? ["孕妈", "大学生", "上班族"]),
    scenarios: normalizeList(input.scenarios, current?.scenarios ?? ["日常分享", "出门携带", "朋友推荐"]),
    tags: normalizeList(input.tags, current?.tags ?? ["孕期好物", "日常分享", "小红书种草"]),
    replacements: normalizeReplacements(input.replacements, current?.replacements ?? defaultReplacements()),
    createdAt: current?.createdAt ?? now,
    updatedAt: now
  };
  await localStore.update("contentPlaybooks", (items) => {
    const exists = items.some((item) => item.id === playbook.id);
    return exists ? items.map((item) => (item.id === playbook.id ? playbook : item)) : [playbook, ...items];
  });
  await appendContentPlaybookRevision(playbook, localStore);
  return playbook;
}

export async function deleteContentPlaybook(id: string, localStore: StoreLike = store): Promise<{ deleted: number }> {
  let deleted = 0;
  await localStore.update("contentPlaybooks", (items) => {
    const next = items.filter((item) => item.id !== id);
    deleted = items.length - next.length;
    return next;
  });
  if (deleted) {
    await localStore.update("contentPlaybookRevisions", (items) => items.filter((item) => item.playbookId !== id));
  }
  return { deleted };
}

export async function listContentPlaybookRevisions(playbookId: string, localStore: StoreLike = store): Promise<ContentPlaybookRevision[]> {
  const revisions = await localStore.read("contentPlaybookRevisions");
  return revisions.filter((item) => item.playbookId === playbookId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getContentPlaybookStats(playbookId: string, localStore: StoreLike = store): Promise<ContentPlaybookStats> {
  const reviews = (await localStore.read("contentReviews")).filter((review) => review.playbookId === playbookId);
  const categoryCounts = new Map<string, number>();
  const recentIssues: ContentPlaybookStats["recentIssues"] = [];
  for (const review of reviews) {
    for (const issue of review.issues) {
      categoryCounts.set(issue.category, (categoryCounts.get(issue.category) ?? 0) + 1);
      recentIssues.push({
        reviewId: review.id,
        title: review.revisedTitle || review.originalTitle || "未命名审稿",
        severity: issue.severity,
        category: issue.category,
        evidence: issue.evidence,
        createdAt: review.createdAt
      });
    }
  }
  return {
    playbookId,
    reviewCount: reviews.length,
    issueCount: reviews.reduce((sum, review) => sum + review.issues.length, 0),
    highRiskCount: reviews.filter((review) => review.risk === "high").length,
    passCount: reviews.filter((review) => review.risk === "pass").length,
    topCategories: [...categoryCounts.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    recentIssues: recentIssues.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8)
  };
}

export async function restoreContentPlaybookRevision(playbookId: string, revisionId: string, localStore: StoreLike = store): Promise<ContentPlaybook> {
  const revision = (await listContentPlaybookRevisions(playbookId, localStore)).find((item) => item.id === revisionId);
  if (!revision) {
    throw new Error("规则库版本不存在。");
  }
  const current = (await localStore.read("contentPlaybooks")).find((item) => item.id === playbookId);
  const now = nowIso();
  const restored: ContentPlaybook = {
    ...revision.snapshot,
    id: playbookId,
    createdAt: current?.createdAt ?? revision.snapshot.createdAt,
    updatedAt: now
  };
  await localStore.update("contentPlaybooks", (items) => {
    const exists = items.some((item) => item.id === playbookId);
    return exists ? items.map((item) => (item.id === playbookId ? restored : item)) : [restored, ...items];
  });
  await appendContentPlaybookRevision(restored, localStore);
  return restored;
}

export async function listContentProjects(localStore: StoreLike = store): Promise<ContentProject[]> {
  const projects = await localStore.read("contentProjects");
  return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveContentProject(input: ContentProjectInput, id?: string, localStore: StoreLike = store): Promise<ContentProject> {
  const now = nowIso();
  const current = id ? (await localStore.read("contentProjects")).find((item) => item.id === id) : undefined;
  const project: ContentProject = {
    id: current?.id ?? createId("content_project"),
    name: input.name.trim() || current?.name || "新内容项目",
    productName: input.productName.trim() || current?.productName || "产品",
    targetAudience: normalizeList(input.targetAudience, current?.targetAudience ?? []),
    scenarios: normalizeList(input.scenarios, current?.scenarios ?? []),
    goals: normalizeList(input.goals, current?.goals ?? []),
    playbookId: input.playbookId?.trim() || current?.playbookId,
    jobId: input.jobId?.trim() || current?.jobId,
    status: normalizeProjectStatus(input.status, current?.status ?? "planning"),
    createdAt: current?.createdAt ?? now,
    updatedAt: now
  };
  await localStore.update("contentProjects", (items) => {
    const exists = items.some((item) => item.id === project.id);
    return exists ? items.map((item) => (item.id === project.id ? project : item)) : [project, ...items];
  });
  return project;
}

export async function deleteContentProject(id: string, localStore: StoreLike = store): Promise<{ deleted: number }> {
  let deleted = 0;
  await localStore.update("contentProjects", (items) => {
    const next = items.filter((item) => item.id !== id);
    deleted = items.length - next.length;
    return next;
  });
  return { deleted };
}

export async function listContentProjectMaterials(projectId: string, localStore: StoreLike = store): Promise<ContentProjectMaterial[]> {
  const materials = await localStore.read("contentProjectMaterials");
  return materials.filter((item) => item.projectId === projectId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveContentProjectMaterial(input: ContentProjectMaterialInput, localStore: StoreLike = store): Promise<ContentProjectMaterial> {
  const now = nowIso();
  const material: ContentProjectMaterial = {
    id: createId("content_material"),
    projectId: input.projectId,
    source: input.source ?? "manual",
    sourceId: input.sourceId,
    category: normalizeMaterialCategory(input.category),
    title: input.title.trim() || "未命名素材",
    content: input.content.trim(),
    tags: normalizeList(input.tags, []),
    authorName: input.authorName?.trim(),
    stats: input.stats,
    createdAt: now,
    updatedAt: now
  };
  if (!material.content) {
    throw new Error("素材内容不能为空。");
  }
  await localStore.update("contentProjectMaterials", (items) => [material, ...items.filter((item) => !(item.projectId === material.projectId && item.source === material.source && item.sourceId && item.sourceId === material.sourceId))]);
  return material;
}

export async function addContentProjectMaterialsFromNotes(
  projectId: string,
  noteIds: string[],
  category: ContentProjectMaterialCategory = "general",
  localStore: StoreLike = store
): Promise<ContentProjectMaterial[]> {
  const selectedIds = new Set(noteIds.filter(Boolean));
  const notes = (await localStore.read("notes")).filter((note) => selectedIds.has(note.id) && note.desc.trim());
  const saved: ContentProjectMaterial[] = [];
  for (const note of notes) {
    saved.push(await saveContentProjectMaterial({
      projectId,
      source: "note",
      sourceId: note.id,
      category,
      title: note.title,
      content: note.desc,
      tags: note.keywords,
      authorName: note.authorName,
      stats: {
        liked: note.likedCount,
        collected: note.collectedCount,
        comments: note.commentCount
      }
    }, localStore));
  }
  return saved;
}

export async function deleteContentProjectMaterial(projectId: string, materialId: string, localStore: StoreLike = store): Promise<{ deleted: number }> {
  let deleted = 0;
  await localStore.update("contentProjectMaterials", (items) => {
    const next = items.filter((item) => !(item.projectId === projectId && item.id === materialId));
    deleted = items.length - next.length;
    return next;
  });
  return { deleted };
}

export async function listContentDrafts(localStore: StoreLike = store): Promise<ContentDraft[]> {
  return localStore.read("contentDrafts");
}

export async function listContentReviews(localStore: StoreLike = store): Promise<ContentReviewRun[]> {
  return localStore.read("contentReviews");
}

export async function acceptContentDraftReview(draftId: string, reviewId?: string, localStore: StoreLike = store): Promise<ContentDraft> {
  const drafts = await localStore.read("contentDrafts");
  const draft = drafts.find((item) => item.id === draftId);
  if (!draft) {
    throw new Error("草稿不存在。");
  }
  const reviews = await localStore.read("contentReviews");
  const review = (reviewId ? reviews.find((item) => item.id === reviewId && item.draftId === draftId) : undefined) ??
    reviews.find((item) => item.id === draft.reviewId && item.draftId === draftId) ??
    reviews.find((item) => item.draftId === draftId);
  if (!review) {
    throw new Error("草稿还没有可接受的审稿结果。");
  }
  const accepted: ContentDraft = {
    ...draft,
    title: review.revisedTitle || draft.title,
    body: review.revisedBody || draft.body,
    tags: review.revisedTags.length ? review.revisedTags : draft.tags,
    reviewId: review.id,
    status: "finalized",
    updatedAt: nowIso()
  };
  await localStore.update("contentDrafts", (items) => items.map((item) => (item.id === draftId ? accepted : item)));
  return accepted;
}

export async function generateContentDraft(input: ContentDraftInput, localStore: StoreLike = store): Promise<ContentDraftResult> {
  const project = await resolveProject(input.projectId, localStore);
  const playbook = await resolvePlaybook(input.playbookId ?? project?.playbookId, localStore);
  const jobId = input.jobId ?? project?.jobId;
  const context = await buildContentContext(jobId, localStore);
  const brief: ContentBrief = {
    ...input.brief,
    projectId: project?.id ?? input.brief.projectId,
    playbookId: playbook.id,
    jobId,
    productName: input.brief.productName || project?.productName || playbook.productName
  };
  const localDraft = buildLocalDraft(brief, playbook, context);
  const modelResult = await callJsonModel<DraftText>({
    modelId: input.modelId,
    prompt: buildDraftGenerationPrompt(brief, playbook, context),
    fallback: localDraft,
    validate: isDraftText
  }, localStore);
  const draftText = modelResult.value ?? localDraft;
  const now = nowIso();
  const draft: ContentDraft = {
    id: createId("draft"),
    projectId: project?.id,
    playbookId: playbook.id,
    jobId,
    title: draftText.title,
    body: draftText.body,
    tags: unique(draftText.tags.map(cleanTag).filter(Boolean)).slice(0, 12),
    brief,
    source: modelResult.source,
    status: "draft",
    createdAt: now,
    updatedAt: now
  };
  await localStore.update("contentDrafts", (drafts) => [draft, ...drafts]);

  const artifact = await createContentArtifact({
    workflowKey: "note-writing",
    jobId,
    title: `小红书笔记草稿 - ${draft.title}`,
    markdown: buildDraftArtifactMarkdown(draft, playbook, context, modelResult.error),
    source: modelResult.source,
    status: modelResult.status,
    modelId: modelResult.modelId,
    promptTitle: "小红书笔记撰写",
    contextSummary: summarizeContentContext(playbook, context)
  }, localStore);
  await localStore.update("contentDrafts", (drafts) => drafts.map((item) => (item.id === draft.id ? { ...item, artifactId: artifact.id } : item)));

  const reviewResult = await reviewContentDraft({
    projectId: project?.id,
    playbookId: playbook.id,
    jobId,
    draftId: draft.id,
    modelId: input.modelId,
    title: draft.title,
    body: draft.body,
    tags: draft.tags,
    mode: "minimal"
  }, localStore);
  const updatedDraft = {
    ...draft,
    artifactId: artifact.id,
    reviewId: reviewResult.review.id,
    status: "reviewed" as const,
    updatedAt: nowIso()
  };
  await localStore.update("contentDrafts", (drafts) => drafts.map((item) => (item.id === draft.id ? updatedDraft : item)));
  return { draft: updatedDraft, review: reviewResult.review, artifact, reviewArtifact: reviewResult.artifact };
}

export async function generateContentDraftBatch(input: ContentDraftBatchInput, localStore: StoreLike = store): Promise<ContentDraftBatchResult> {
  const project = await resolveProject(input.projectId, localStore);
  const materials = project ? await listContentProjectMaterials(project.id, localStore) : [];
  const count = Math.min(Math.max(input.count ?? 3, 1), 8);
  const results: ContentDraftResult[] = [];
  for (let index = 0; index < count; index += 1) {
    results.push(await generateContentDraft({
      ...input,
      projectId: project?.id ?? input.projectId,
      playbookId: input.playbookId ?? project?.playbookId,
      jobId: input.jobId ?? project?.jobId,
      brief: buildBatchBrief(input.brief, project, materials, index)
    }, localStore));
  }
  return { results };
}

export async function reviewContentDraft(input: ContentReviewInput, localStore: StoreLike = store): Promise<ContentReviewResult> {
  const project = await resolveProject(input.projectId, localStore);
  const playbook = await resolvePlaybook(input.playbookId ?? project?.playbookId, localStore);
  const jobId = input.jobId ?? project?.jobId;
  const context = await buildContentContext(jobId, localStore);
  const localReview = scanContentDraft(input, playbook);
  const modelResult = await callJsonModel<DraftText>({
    modelId: input.modelId,
    prompt: buildReviewPrompt(input, playbook, context, localReview.issues),
    fallback: {
      title: localReview.revisedTitle,
      body: localReview.revisedBody,
      tags: localReview.revisedTags
    },
    validate: isDraftText
  }, localStore);
  const revised = modelResult.value ?? {
    title: localReview.revisedTitle,
    body: localReview.revisedBody,
    tags: localReview.revisedTags
  };
  const secondScan = scanContentDraft({
    ...input,
    title: revised.title,
    body: revised.body,
    tags: revised.tags
  }, playbook);
  const now = nowIso();
  const review: ContentReviewRun = {
    id: createId("review"),
    projectId: project?.id,
    playbookId: playbook.id,
    jobId,
    noteId: input.noteId,
    draftId: input.draftId,
    originalTitle: input.title,
    originalBody: input.body,
    originalTags: normalizeList(input.tags, []),
    risk: localReview.risk,
    score: localReview.score,
    issues: localReview.issues,
    revisedTitle: revised.title,
    revisedBody: revised.body,
    revisedTags: unique(revised.tags.map(cleanTag).filter(Boolean)).slice(0, 12),
    modelId: modelResult.modelId,
    source: modelResult.source,
    status: modelResult.status,
    createdAt: now,
    updatedAt: now
  };
  const artifact = await createContentArtifact({
    workflowKey: "draft-review",
    jobId,
    noteId: input.noteId,
    title: `AI 审稿报告 - ${input.title || revised.title || playbook.productName}`,
    markdown: buildReviewArtifactMarkdown(review, playbook, secondScan, modelResult.error),
    source: modelResult.source,
    status: modelResult.status,
    modelId: modelResult.modelId,
    promptTitle: "AI 审稿员",
    contextSummary: summarizeContentContext(playbook, context)
  }, localStore);
  const savedReview = { ...review, artifactId: artifact.id, updatedAt: nowIso() };
  await localStore.update("contentReviews", (reviews) => [savedReview, ...reviews]);
  if (input.draftId) {
    await localStore.update("contentDrafts", (drafts) =>
      drafts.map((draft) => (draft.id === input.draftId ? { ...draft, reviewId: savedReview.id, status: "reviewed", updatedAt: nowIso() } : draft))
    );
  }
  return { review: savedReview, artifact };
}

export async function reviewContentDraftBatch(input: ContentReviewBatchInput, localStore: StoreLike = store): Promise<ContentReviewBatchResult> {
  const safeItems = input.items
    .map((item) => ({
      ...item,
      title: item.title?.trim(),
      body: item.body.trim(),
      tags: normalizeList(item.tags, [])
    }))
    .filter((item) => item.body);
  const selectedItems = safeItems.slice(0, 20);
  const results: ContentReviewResult[] = [];
  for (const item of selectedItems) {
    results.push(await reviewContentDraft({
      projectId: input.projectId,
      playbookId: input.playbookId,
      jobId: input.jobId,
      modelId: input.modelId,
      title: item.title,
      body: item.body,
      tags: item.tags,
      mode: input.mode ?? "minimal"
    }, localStore));
  }
  return {
    reviews: results.map((result) => result.review),
    artifacts: results.map((result) => result.artifact)
  };
}

export function scanContentDraft(input: Pick<ContentReviewInput, "title" | "body" | "tags">, playbook: ContentPlaybook): {
  risk: ContentReviewRisk;
  score: number;
  issues: ContentReviewIssue[];
  revisedTitle: string;
  revisedBody: string;
  revisedTags: string[];
} {
  const title = input.title?.trim() ?? "";
  const body = input.body.trim();
  const tags = normalizeList(input.tags, []);
  const text = `${title}\n${body}\n${tags.join(" ")}`;
  const issues: ContentReviewIssue[] = [];

  for (const term of playbook.forbiddenTerms) {
    addTermIssue(issues, text, term, "warning", "广告话术", `避免使用“${term}”这类强营销或网感过重表达。`, replacementFor(term, playbook));
  }
  for (const term of playbook.sensitiveClaims) {
    addTermIssue(issues, text, term, "blocker", "敏感功效", `“${term}”容易被理解为医疗或绝对功效承诺。`, replacementFor(term, playbook) || "改成真实体验、使用感或生活场景描述。");
  }
  for (const pattern of absolutePatterns) {
    const match = text.match(pattern);
    if (match) {
      issues.push(createIssue("blocker", "绝对化表达", "避免使用绝对化、唯一性或保证性表达。", match[0], "改成个人体验或相对描述。"));
    }
  }
  for (const pattern of hardSellPatterns) {
    const match = text.match(pattern);
    if (match) {
      issues.push(createIssue("warning", "硬广风险", "表达偏强销售，容易削弱真实分享感。", match[0], "增加生活场景、个人感受和具体使用原因。"));
    }
  }
  if (playbook.productName && countOccurrences(text, playbook.productName) > 4) {
    issues.push(createIssue("warning", "产品露出过密", "产品名出现过多，文案可能显得像硬广。", playbook.productName, "保留关键位置，其余用“它”“这个小物”等自然代称。"));
  }
  if (!title) {
    issues.push(createIssue("warning", "格式缺失", "缺少标题。", undefined, "补充一句生活化标题。"));
  }
  if (body.length < 40) {
    issues.push(createIssue("info", "内容厚度", "正文偏短，缺少具体生活场景。", undefined, "补充身份、场景、为什么需要、使用后的主观感受。"));
  }
  if (!tags.length) {
    issues.push(createIssue("info", "标签缺失", "缺少标签。", undefined, "补充产品、人设、场景和内容主题标签。"));
  }

  const revisedTitle = reviseText(title || localTitle(playbook.productName, "真实分享"), playbook);
  const revisedBody = reviseText(body, playbook);
  const revisedTags = unique([
    ...tags.map((tag) => reviseText(cleanTag(tag), playbook)),
    ...playbook.tags.slice(0, 4)
  ].map(cleanTag).filter(Boolean)).slice(0, 10);
  const score = scoreForIssues(issues);
  return {
    risk: riskForIssues(issues, score),
    score,
    issues,
    revisedTitle,
    revisedBody,
    revisedTags
  };
}

export async function runContentAssistant(input: {
  message: string;
  projectId?: string;
  jobId?: string;
  modelId?: string;
  playbookId?: string;
}, localStore: StoreLike = store): Promise<AiAssistantChatResponse> {
  const now = nowIso();
  const userMessage: AiAssistantMessage = {
    id: createId("msg"),
    role: "user",
    content: input.message,
    createdAt: now
  };
  const playbook = await resolvePlaybook(input.playbookId, localStore);
  let artifact: AiArtifact;
  if (isReviewRequest(input.message)) {
    const result = await reviewContentDraft({
        projectId: input.projectId,
        playbookId: playbook.id,
        jobId: input.jobId,
        modelId: input.modelId,
        title: extractLineValue(input.message, "标题"),
        body: extractDraftBody(input.message),
        tags: splitList(extractLineValue(input.message, "标签")),
        mode: "minimal"
      }, localStore);
    artifact = result.artifact;
  } else {
    const result = await generateContentDraft({
      projectId: input.projectId,
      playbookId: playbook.id,
      jobId: input.jobId,
      modelId: input.modelId,
      brief: briefFromMessage(input.message, playbook, input.jobId)
    }, localStore);
    artifact = result.reviewArtifact;
  }
  const assistantMessage: AiAssistantMessage = {
    id: createId("msg"),
    role: "assistant",
    content: `已完成内容创作台任务，结果已保存为「${artifact.title}」。\n\n${artifact.markdown}`,
    createdAt: nowIso()
  };
  await localStore.update("aiMessages", (messages) => [...messages, userMessage, assistantMessage]);
  return { message: assistantMessage, artifact };
}

function createDefaultPlaybook(): ContentPlaybook {
  const now = nowIso();
  return {
    id: "playbook_default_xhs_seed",
    name: "通用种草审稿规则",
    productName: "产品",
    category: "小红书种草",
    forbiddenTerms: defaultForbiddenTerms,
    sensitiveClaims: defaultSensitiveClaims,
    allowedSellingPoints: ["真实使用感", "生活场景", "携带方便", "温和表达", "个人体验"],
    requiredSections: ["标题", "内容", "标签"],
    toneWords: ["口语化", "真实分享", "生活化", "少广告感"],
    personas: ["孕妈", "大学生", "上班族"],
    scenarios: ["日常分享", "出门携带", "朋友推荐", "宿舍备用"],
    tags: ["日常分享", "好物分享", "生活小物", "真实体验"],
    replacements: defaultReplacements(),
    createdAt: now,
    updatedAt: now
  };
}

function defaultReplacements(): ContentReplacementRule[] {
  return [
    { from: "yyds", to: "挺适合日常用", reason: "降低网感和硬夸张" },
    { from: "封神", to: "用下来比较顺手", reason: "避免绝对化夸赞" },
    { from: "救命神器", to: "最近帮我省心不少", reason: "弱化夸张承诺" },
    { from: "效果拉满", to: "使用感比较明显", reason: "改成主观体验" },
    { from: "闭眼冲", to: "可以按自己的需求考虑", reason: "避免强促销" },
    { from: "必囤", to: "我会备一个", reason: "改成个人选择" },
    { from: "根治", to: "改善体验", reason: "避免医疗功效承诺" },
    { from: "通便特效", to: "使用体验更顺手", reason: "避免医疗功效承诺" },
    { from: "特效", to: "使用感", reason: "避免药品化表达" },
    { from: "治愈", to: "改善体验", reason: "避免医疗表述" },
    { from: "治疗", to: "缓解不适感", reason: "避免医疗表述" },
    { from: "药效", to: "使用感", reason: "避免药品化表达" },
    { from: "杜绝依赖", to: "减少顾虑", reason: "避免绝对承诺" },
    { from: "百分百有效", to: "对我来说有帮助", reason: "避免保证性表达" }
  ];
}

async function resolvePlaybook(id: string | undefined, localStore: StoreLike): Promise<ContentPlaybook> {
  const playbooks = await listContentPlaybooks(localStore);
  return (id ? playbooks.find((item) => item.id === id) : undefined) ?? playbooks[0] ?? createDefaultPlaybook();
}

async function resolveProject(id: string | undefined, localStore: StoreLike): Promise<ContentProject | undefined> {
  if (!id) {
    return undefined;
  }
  return (await localStore.read("contentProjects")).find((item) => item.id === id);
}

async function appendContentPlaybookRevision(playbook: ContentPlaybook, localStore: StoreLike): Promise<void> {
  const revision: ContentPlaybookRevision = {
    id: createId("playbook_rev"),
    playbookId: playbook.id,
    snapshot: playbook,
    createdAt: nowIso()
  };
  await localStore.update("contentPlaybookRevisions", (items) => {
    const samePlaybook = [revision, ...items.filter((item) => item.playbookId === playbook.id)].slice(0, maxPlaybookRevisionsPerPlaybook);
    return [...samePlaybook, ...items.filter((item) => item.playbookId !== playbook.id)];
  });
}

async function buildContentContext(jobId: string | undefined, localStore: StoreLike): Promise<ContentContext> {
  if (!jobId) {
    return { notes: [], comments: [] };
  }
  const [jobs, allNotes, comments] = await Promise.all([
    localStore.read("searchJobs"),
    localStore.read("notes"),
    localStore.read("comments")
  ]);
  const notes = allNotes.filter((note) => note.jobIds.includes(jobId)).sort((a, b) => b.hotScore - a.hotScore);
  const noteIds = new Set(notes.map((note) => note.id));
  return {
    job: jobs.find((job) => job.id === jobId),
    notes: notes.slice(0, 20),
    comments: comments.filter((comment) => noteIds.has(comment.noteId)).sort((a, b) => b.likedCount - a.likedCount).slice(0, 30)
  };
}

function buildLocalDraft(brief: ContentBrief, playbook: ContentPlaybook, context: ContentContext): DraftText {
  const productName = brief.productName || playbook.productName;
  const title = localTitle(productName, brief.painPoint || context.comments[0]?.content || brief.scenario);
  const body = [
    `${brief.persona || playbook.personas[0] || "普通用户"}视角，最近在${brief.scenario || "日常生活"}里一直遇到${brief.painPoint || "一个小困扰"}。`,
    `${brief.channel || "朋友推荐"}让我注意到${productName}，真正打动我的不是夸张卖点，而是它和我的使用场景比较贴。`,
    `我比较在意的是${brief.sellingPoints.join("、") || playbook.allowedSellingPoints.slice(0, 3).join("、")}，用起来更像是给生活多一个顺手的小选择。`,
    context.comments[0] ? `评论里也有人提到“${context.comments[0].content.slice(0, 60)}”，这个点我会放进后续选题继续观察。` : "如果你也有类似场景，可以先从自己的使用频率和实际需求出发，不用盲目跟风。",
    "整体更适合作为真实体验分享，不建议写成夸张功效或强推荐。"
  ];
  return {
    title,
    body: body.join("\n\n"),
    tags: unique([...brief.keywords, ...playbook.tags, brief.persona, brief.scenario].map(cleanTag).filter(Boolean)).slice(0, 10)
  };
}

function localTitle(productName: string, angle?: string): string {
  const suffix = angle?.replace(/\s+/g, "").slice(0, 18) || "真实使用感";
  return `${productName}这点让我愿意留下来用：${suffix}`;
}

function buildBatchBrief(base: ContentBrief, project: ContentProject | undefined, materials: ContentProjectMaterial[], index: number): ContentBrief {
  const material = materials[index % Math.max(materials.length, 1)];
  const targetAudience = project?.targetAudience[index % Math.max(project.targetAudience.length, 1)];
  const scenario = project?.scenarios[index % Math.max(project.scenarios.length, 1)];
  const materialKeywords = material?.tags ?? [];
  return {
    ...base,
    projectId: project?.id ?? base.projectId,
    playbookId: project?.playbookId ?? base.playbookId,
    jobId: project?.jobId ?? base.jobId,
    productName: project?.productName || base.productName,
    persona: targetAudience || base.persona,
    scenario: scenario || base.scenario,
    painPoint: material ? `${material.title}：${material.content.slice(0, 80)}` : base.painPoint,
    sellingPoints: unique([...base.sellingPoints, ...(material ? [material.title] : []), ...(project?.goals ?? [])]).slice(0, 8),
    keywords: unique([...base.keywords, ...materialKeywords, ...(project?.goals ?? [])]).slice(0, 12)
  };
}

function buildDraftGenerationPrompt(brief: ContentBrief, playbook: ContentPlaybook, context: ContentContext): string {
  return `你是小红书种草内容策划，请严格输出 JSON，不要 Markdown。

目标：基于结构化 Brief 生成一篇真实分享型小红书笔记。

规则库：${JSON.stringify(compactPlaybook(playbook))}
Brief：${JSON.stringify(brief)}
当前任务：${context.job ? context.job.keywords.join(" / ") : "无"}
热门笔记：${JSON.stringify(context.notes.slice(0, 8).map(compactNote))}
高赞评论：${JSON.stringify(context.comments.slice(0, 12).map(compactComment))}

要求：
- 输出 JSON：{"title":"", "body":"", "tags":[""]}
- 避免医疗功效、绝对化承诺和硬广话术。
- 要有身份、场景、为什么需要、真实使用感。
- 不要自动发布、自动评论或引导购买。`;
}

function buildReviewPrompt(input: ContentReviewInput, playbook: ContentPlaybook, context: ContentContext, issues: ContentReviewIssue[]): string {
  return `你是小红书 AI 审稿员，请严格输出 JSON，不要 Markdown。

任务：在保留原稿意图和人设的前提下做最小必要修改。

规则库：${JSON.stringify(compactPlaybook(playbook))}
原始标题：${input.title ?? ""}
原始正文：${input.body}
原始标签：${JSON.stringify(input.tags ?? [])}
本地规则命中：${JSON.stringify(issues)}
当前任务：${context.job ? context.job.keywords.join(" / ") : "无"}
热门笔记：${JSON.stringify(context.notes.slice(0, 6).map(compactNote))}
高赞评论：${JSON.stringify(context.comments.slice(0, 10).map(compactComment))}

要求：
- 输出 JSON：{"title":"", "body":"", "tags":[""]}
- 只做审稿修改，不新增未经证实的功效。
- 弱化广告感，增强生活化场景和个人主观感受。
- 保留原稿经历、情绪和叙事顺序。`;
}

async function callJsonModel<T>(
  input: {
    modelId?: string;
    prompt: string;
    fallback: T;
    validate: (value: unknown) => value is T;
  },
  localStore: StoreLike
): Promise<ModelJsonResult<T>> {
  const models = await localStore.read("aiModels");
  const model = (input.modelId ? models.find((item) => item.id === input.modelId) : undefined) ?? models.find((item) => item.isDefault) ?? models[0];
  if (!model) {
    return { value: input.fallback, source: "local", status: "completed" };
  }
  const apiKey = getEnvValue(keyNameForModel(model.id));
  if (!apiKey) {
    return { value: input.fallback, source: "local", status: "completed", modelId: model.id };
  }
  try {
    const value = await requestJsonModel<T>(model, apiKey, input.prompt, input.validate);
    return { value, source: "ai", status: "completed", modelId: model.id };
  } catch (error) {
    return {
      value: input.fallback,
      source: "local",
      status: "failed",
      modelId: model.id,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function requestJsonModel<T>(
  model: AiModelConfig,
  apiKey: string,
  prompt: string,
  validate: (value: unknown) => value is T
): Promise<T> {
  const response = await fetch(`${model.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model.model,
      temperature: Math.min(0.7, model.temperature),
      max_tokens: model.maxTokens,
      messages: [
        { role: "system", content: "你是严谨的小红书内容创作与审稿助手，只输出可解析 JSON。" },
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
  const parsed = parseJsonObject(content);
  if (!validate(parsed)) {
    throw new Error("AI response schema is invalid.");
  }
  return parsed;
}

async function createContentArtifact(
  input: {
    workflowKey: AiArtifact["workflowKey"];
    jobId?: string;
    noteId?: string;
    title: string;
    markdown: string;
    source: AiArtifact["source"];
    status: AiArtifact["status"];
    modelId?: string;
    promptTitle: string;
    contextSummary: string;
  },
  localStore: StoreLike
): Promise<AiArtifact> {
  const now = nowIso();
  const artifact: AiArtifact = {
    id: createId("artifact"),
    workflowKey: input.workflowKey,
    jobId: input.jobId,
    noteId: input.noteId,
    title: input.title,
    markdown: input.markdown,
    source: input.source,
    status: input.status,
    modelId: input.modelId,
    promptKey: input.workflowKey === "draft-review" || input.workflowKey === "note-writing" ? input.workflowKey : undefined,
    promptTitle: input.promptTitle,
    promptSource: "default",
    promptVersion: "xhs-content-studio-v1",
    contextSummary: input.contextSummary,
    createdAt: now,
    updatedAt: now
  };
  await localStore.update("aiArtifacts", (artifacts) => [artifact, ...artifacts]);
  return artifact;
}

function buildDraftArtifactMarkdown(draft: ContentDraft, playbook: ContentPlaybook, context: ContentContext, error?: string): string {
  return `# 小红书笔记草稿

${error ? `> AI 调用失败，当前展示本地规则版草稿。错误：${error}\n` : ""}## 基本信息

- 规则库：${playbook.name}
- 产品：${playbook.productName}
- 当前任务：${context.job ? context.job.keywords.join(" / ") : "无"}
- 来源：${draft.source === "ai" ? "AI 生成" : "本地规则"}

## 标题

${draft.title}

## 内容

${draft.body}

## 标签

${draft.tags.map((tag) => `#${tag}`).join(" ")}

## 下一步

- 已自动进入 AI 审稿员复核。
- 发布前仍需人工确认事实、体验和平台规则。`;
}

function buildReviewArtifactMarkdown(
  review: ContentReviewRun,
  playbook: ContentPlaybook,
  secondScan: ReturnType<typeof scanContentDraft>,
  error?: string
): string {
  return `# AI 审稿报告

${error ? `> AI 调用失败，当前展示本地规则版审稿。错误：${error}\n` : ""}## 审稿结论

- 规则库：${playbook.name}
- 风险等级：${riskLabel(review.risk)}
- 分数：${review.score}/100
- 命中问题：${review.issues.length}
- 修改后二次复核：${riskLabel(secondScan.risk)}，剩余问题 ${secondScan.issues.length} 个

## 问题清单

${review.issues.map((issue, index) => `${index + 1}. [${severityLabel(issue.severity)}] ${issue.category}：${issue.message}${issue.evidence ? `（命中：${issue.evidence}）` : ""}${issue.suggestion ? `\n   建议：${issue.suggestion}` : ""}`).join("\n") || "- 未发现明显风险。"}

## 修改稿标题

${review.revisedTitle}

## 修改稿正文

${review.revisedBody}

## 建议标签

${review.revisedTags.map((tag) => `#${tag}`).join(" ")}

## 人工确认点

- 核对产品事实、使用体验和素材授权。
- 避免把个人体验写成普遍功效。
- 不自动发布，发布前必须人工确认。`;
}

function addTermIssue(
  issues: ContentReviewIssue[],
  text: string,
  term: string,
  severity: ContentIssueSeverity,
  category: string,
  message: string,
  suggestion?: string
): void {
  if (!term.trim()) return;
  if (text.includes(term)) {
    issues.push(createIssue(severity, category, message, term, suggestion));
  }
}

function createIssue(
  severity: ContentIssueSeverity,
  category: string,
  message: string,
  evidence?: string,
  suggestion?: string
): ContentReviewIssue {
  return {
    id: createId("issue"),
    severity,
    category,
    message,
    evidence,
    suggestion
  };
}

function reviseText(value: string, playbook: ContentPlaybook): string {
  let next = value;
  for (const rule of playbook.replacements) {
    if (rule.from.trim()) {
      next = next.split(rule.from).join(rule.to);
    }
  }
  for (const term of [...playbook.forbiddenTerms, ...playbook.sensitiveClaims]) {
    const replacement = replacementFor(term, playbook);
    if (replacement) {
      next = next.split(term).join(replacement);
    }
  }
  return next.replace(/!{2,}|！{2,}/g, "。").trim();
}

function replacementFor(term: string, playbook: ContentPlaybook): string | undefined {
  return playbook.replacements.find((item) => item.from === term)?.to;
}

function scoreForIssues(issues: ContentReviewIssue[]): number {
  const penalty = issues.reduce((sum, issue) => {
    if (issue.severity === "blocker") return sum + 22;
    if (issue.severity === "warning") return sum + 12;
    return sum + 5;
  }, 0);
  return Math.max(0, 100 - penalty);
}

function riskForIssues(issues: ContentReviewIssue[], score: number): ContentReviewRisk {
  if (issues.some((issue) => issue.severity === "blocker") || score < 60) return "high";
  if (issues.filter((issue) => issue.severity === "warning").length >= 2 || score < 80) return "medium";
  if (issues.length) return "low";
  return "pass";
}

function riskLabel(risk: ContentReviewRisk): string {
  if (risk === "pass") return "通过";
  if (risk === "low") return "低风险";
  if (risk === "medium") return "中风险";
  return "高风险";
}

function severityLabel(severity: ContentIssueSeverity): string {
  if (severity === "blocker") return "必须修改";
  if (severity === "warning") return "建议修改";
  return "提示";
}

function countOccurrences(text: string, keyword: string): number {
  if (!keyword) return 0;
  return text.split(keyword).length - 1;
}

function normalizeList(values: string[] | undefined, fallback: string[]): string[] {
  const source = values === undefined ? fallback : values;
  return unique(source.map((item) => item.trim()).filter(Boolean));
}

function normalizeReplacements(values: ContentReplacementRule[] | undefined, fallback: ContentReplacementRule[]): ContentReplacementRule[] {
  const source = values === undefined ? fallback : values;
  return source
    .map((item) => ({
      from: item.from.trim(),
      to: item.to.trim(),
      reason: item.reason?.trim()
    }))
    .filter((item) => item.from && item.to);
}

function normalizeProjectStatus(value: ContentProjectStatus | undefined, fallback: ContentProjectStatus): ContentProjectStatus {
  return value && ["planning", "writing", "reviewing", "finalized"].includes(value) ? value : fallback;
}

function normalizeMaterialCategory(value: ContentProjectMaterialCategory | undefined): ContentProjectMaterialCategory {
  return value && ["pain", "scenario", "expression", "competitor", "general"].includes(value) ? value : "general";
}

function splitList(value: string | undefined): string[] {
  return value?.split(/[,\n，、#]/u).map((item) => item.trim()).filter(Boolean) ?? [];
}

function cleanTag(value: string): string {
  return value.replace(/^#+/u, "").trim();
}

function parseJsonObject(value: string): unknown {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/u)?.[1];
  const raw = fenced ?? value;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI response does not contain JSON.");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

function isDraftText(value: unknown): value is DraftText {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.title === "string" && typeof record.body === "string" && Array.isArray(record.tags) && record.tags.every((tag) => typeof tag === "string");
}

function isReviewRequest(message: string): boolean {
  return /审稿|审核|改稿|修改|润色/u.test(message) && !/写|撰写|生成/u.test(message);
}

function extractLineValue(message: string, key: string): string | undefined {
  const match = message.match(new RegExp(`${key}[：:]\\s*([^\\n]+)`, "u"));
  return match?.[1]?.trim();
}

function extractDraftBody(message: string): string {
  const contentMatch = message.match(/(?:内容|正文|原稿)[：:]([\s\S]+)/u);
  const body = contentMatch?.[1]?.trim() || message.trim();
  return body.length > 12 ? body : "请补充原稿内容后再进行审稿。";
}

function briefFromMessage(message: string, playbook: ContentPlaybook, jobId?: string): ContentBrief {
  return {
    playbookId: playbook.id,
    productName: extractLineValue(message, "产品") || playbook.productName,
    persona: extractLineValue(message, "身份") || firstMatched(message, playbook.personas) || playbook.personas[0] || "普通用户",
    painPoint: extractLineValue(message, "痛点") || extractLineValue(message, "便秘原因") || "日常使用场景里的小困扰",
    scenario: extractLineValue(message, "场景") || firstMatched(message, playbook.scenarios) || playbook.scenarios[0] || "日常分享",
    channel: extractLineValue(message, "了解渠道") || "朋友推荐",
    sellingPoints: splitList(extractLineValue(message, "卖点")).length
      ? splitList(extractLineValue(message, "卖点"))
      : playbook.allowedSellingPoints.slice(0, 3),
    tone: extractLineValue(message, "口吻") || playbook.toneWords.join("、") || "口语化",
    length: lengthFromMessage(message),
    keywords: splitList(extractLineValue(message, "关键词")),
    jobId
  };
}

function firstMatched(message: string, candidates: string[]): string | undefined {
  return candidates.find((item) => item && message.includes(item));
}

function lengthFromMessage(message: string): ContentDraftLength {
  if (/短|简短|100字/u.test(message)) return "short";
  if (/长|详细|完整/u.test(message)) return "long";
  return "medium";
}

function compactPlaybook(playbook: ContentPlaybook): Record<string, unknown> {
  return {
    productName: playbook.productName,
    forbiddenTerms: playbook.forbiddenTerms,
    sensitiveClaims: playbook.sensitiveClaims,
    allowedSellingPoints: playbook.allowedSellingPoints,
    toneWords: playbook.toneWords,
    personas: playbook.personas,
    scenarios: playbook.scenarios,
    tags: playbook.tags,
    replacements: playbook.replacements
  };
}

function compactNote(note: NoteRecord): Record<string, unknown> {
  return {
    title: note.title,
    desc: note.desc.slice(0, 160),
    likes: note.likedCount,
    collects: note.collectedCount,
    comments: note.commentCount
  };
}

function compactComment(comment: CommentRecord): Record<string, unknown> {
  return {
    content: comment.content.slice(0, 120),
    likes: comment.likedCount
  };
}

function summarizeContentContext(playbook: ContentPlaybook, context: ContentContext): string {
  return [
    `规则库：${playbook.name}`,
    `产品：${playbook.productName}`,
    context.job ? `任务：${context.job.keywords.join(" / ")}` : "无任务",
    `笔记：${context.notes.length}`,
    `评论：${context.comments.length}`
  ].join(" · ");
}

function keyNameForModel(id: string): string {
  return `AI_MODEL_${id.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}_KEY`;
}
