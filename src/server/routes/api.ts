import { Router, type Response } from "express";
import { z } from "zod";
import type { NotesQuery } from "../../shared/types.js";
import { nowIso } from "../../shared/utils.js";
import { store } from "../storage/localStore.js";
import { saveCookieString, getCookieString } from "../utils/env.js";
import { jobs } from "../services/jobService.js";
import { redbook } from "../services/redbookService.js";
import {
  buildExport,
  clearNotes,
  deleteNote,
  getAnalytics,
  getNoteDetail,
  getNoteScopeClearPreview,
  listNoteScopes,
  listNotesPage
} from "../services/queryService.js";
import { redbookCapabilities } from "../services/capabilities.js";
import { buildHealthCheck } from "../services/healthService.js";
import { proxyMedia, refreshNoteMedia } from "../services/mediaService.js";
import { isAuthRisk, markAuthDisconnected } from "../services/authState.js";
import { browserAuth } from "../services/browserAuthService.js";
import {
  approveReplyAction,
  createReplyPlan,
  listReplyActions,
  listReplyPlans,
  startReplyWorker
} from "../services/commentOps.js";
import {
  chatWithAssistant,
  createAiReport,
  activateAiPrompt,
  deleteAiArtifact,
  deleteAiModel,
  deleteAiReport,
  getAiArtifact,
  getAiPromptDetail,
  getAiReport,
  listAiArtifacts,
  listAiModels,
  listAiPrompts,
  listAiReports,
  listAiWorkflows,
  runAiWorkflow,
  resetAiPromptConfig,
  saveAiModel,
  saveAiPromptConfig,
  setDefaultAiModel,
  testAiModel,
  updateAiModel
} from "../services/aiService.js";
import { createAiOrchestrationWithToolsFallback, probeAiModelTools } from "../services/aiToolCallingService.js";
import { getAiOrchestration, listAiOrchestrations } from "../services/aiOrchestratorService.js";
import {
  addContentProjectMaterialsFromNotes,
  deleteContentProject,
  deleteContentProjectMaterial,
  deleteContentPlaybook,
  generateContentDraft,
  listContentDrafts,
  listContentPlaybooks,
  listContentPlaybookRevisions,
  listContentProjectMaterials,
  listContentProjects,
  listContentReviews,
  reviewContentDraftBatch,
  reviewContentDraft,
  restoreContentPlaybookRevision,
  runContentAssistant,
  saveContentProjectMaterial,
  saveContentProject,
  saveContentPlaybook
} from "../services/contentStudioService.js";

export const api = Router();
startReplyWorker();

const serverStartedAt = nowIso();

const jobInput = z.object({
  keywords: z.array(z.string()).min(1),
  sort: z.enum(["general", "popular", "latest"]).default("general"),
  noteType: z.enum(["all", "video", "image"]).default("all"),
  pages: z.number().int().min(1).max(10).default(1),
  commentPages: z.number().int().min(1).max(2).default(1),
  concurrency: z.number().int().min(1).max(2).default(2)
});

const aiModelInput = z.object({
  name: z.string().min(1),
  provider: z.string().default("OpenAI-compatible"),
  baseUrl: z.string().min(1).default("https://api.openai.com/v1"),
  model: z.string().min(1),
  apiKey: z.string().optional(),
  isDefault: z.boolean().optional(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional()
});

const replyPlanInput = z.object({
  noteId: z.string().min(1),
  strategy: z.enum(["questions", "top-engaged", "all-unanswered"]).default("questions"),
  max: z.number().int().min(1).max(30).default(10),
  template: z.string().optional()
});

const aiWorkflowInput = z.object({
  workflowKey: z.enum(["content-planning", "audience-insight", "competitor-analysis", "viral-deep-dive", "viral-template", "note-analysis", "draft-review", "note-writing"]),
  jobId: z.string().optional(),
  noteId: z.string().optional(),
  modelId: z.string().optional(),
  focus: z.string().optional()
});

const aiAssistantInput = z.object({
  message: z.string().min(1),
  jobId: z.string().optional(),
  noteId: z.string().optional(),
  modelId: z.string().optional(),
  module: z.string().optional()
});

const aiOrchestrationInput = z
  .object({
    instruction: z.string().optional(),
    message: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    modelId: z.string().optional()
  })
  .transform((value) => ({
    instruction: value.instruction ?? value.message ?? "",
    keywords: value.keywords,
    modelId: value.modelId
  }));

const aiPromptKey = z.enum(["content-planning", "audience-insight", "competitor-analysis", "viral-deep-dive", "viral-template", "note-analysis", "draft-review", "note-writing"]);

const contentReplacementInput = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  reason: z.string().optional()
});

const contentPlaybookInput = z.object({
  name: z.string().min(1),
  productName: z.string().min(1),
  category: z.string().optional(),
  forbiddenTerms: z.array(z.string()).optional(),
  sensitiveClaims: z.array(z.string()).optional(),
  allowedSellingPoints: z.array(z.string()).optional(),
  requiredSections: z.array(z.string()).optional(),
  toneWords: z.array(z.string()).optional(),
  personas: z.array(z.string()).optional(),
  scenarios: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  replacements: z.array(contentReplacementInput).optional()
});

const contentProjectStatus = z.enum(["planning", "writing", "reviewing", "finalized"]);
const contentMaterialCategory = z.enum(["pain", "scenario", "expression", "competitor", "general"]);

const contentProjectInput = z.object({
  name: z.string().min(1),
  productName: z.string().min(1),
  targetAudience: z.array(z.string()).optional(),
  scenarios: z.array(z.string()).optional(),
  goals: z.array(z.string()).optional(),
  playbookId: z.string().optional(),
  jobId: z.string().optional(),
  status: contentProjectStatus.optional()
});

const contentProjectMaterialInput = z.object({
  source: z.enum(["note", "manual"]).optional(),
  sourceId: z.string().optional(),
  category: contentMaterialCategory.optional(),
  title: z.string().min(1),
  content: z.string().min(1),
  tags: z.array(z.string()).optional(),
  authorName: z.string().optional(),
  stats: z.object({
    liked: z.number(),
    collected: z.number(),
    comments: z.number()
  }).optional()
});

const contentProjectMaterialsFromNotesInput = z.object({
  noteIds: z.array(z.string()).min(1),
  category: contentMaterialCategory.optional()
});

const contentBriefInput = z.object({
  projectId: z.string().optional(),
  playbookId: z.string().optional(),
  productName: z.string().min(1),
  persona: z.string().min(1),
  painPoint: z.string().min(1),
  scenario: z.string().min(1),
  channel: z.string().min(1),
  sellingPoints: z.array(z.string()).default([]),
  tone: z.string().min(1),
  length: z.enum(["short", "medium", "long"]).default("medium"),
  keywords: z.array(z.string()).default([]),
  jobId: z.string().optional()
});

const contentDraftInput = z.object({
  projectId: z.string().optional(),
  playbookId: z.string().optional(),
  jobId: z.string().optional(),
  modelId: z.string().optional(),
  brief: contentBriefInput
});

const contentReviewInput = z.object({
  projectId: z.string().optional(),
  playbookId: z.string().optional(),
  jobId: z.string().optional(),
  noteId: z.string().optional(),
  draftId: z.string().optional(),
  modelId: z.string().optional(),
  title: z.string().optional(),
  body: z.string().min(1),
  tags: z.array(z.string()).optional(),
  mode: z.enum(["minimal", "natural", "safe"]).optional()
});

const contentReviewBatchInput = z.object({
  projectId: z.string().optional(),
  playbookId: z.string().optional(),
  jobId: z.string().optional(),
  modelId: z.string().optional(),
  items: z.array(z.object({
    id: z.string().optional(),
    title: z.string().optional(),
    body: z.string().min(1),
    tags: z.array(z.string()).optional()
  })).min(1).max(20),
  mode: z.enum(["minimal", "natural", "safe"]).optional()
});

const contentAssistantInput = z.object({
  message: z.string().min(1),
  projectId: z.string().optional(),
  jobId: z.string().optional(),
  modelId: z.string().optional(),
  playbookId: z.string().optional()
});

const extensionCookieInput = z.object({
  a1: z.string().min(1),
  web_session: z.string().min(1),
  webId: z.string().optional(),
  browser: z.enum(["edge", "chrome", "unknown"]).default("unknown"),
  extensionVersion: z.string().optional(),
  permissionStatus: z.enum(["granted", "missing", "unknown"]).default("granted")
});

const browserOpenInput = z.object({
  url: z.string().url(),
  mode: z.enum(["auto", "current-browser", "dedicated-edge"]).default("auto")
});

api.get("/health", (_req, res) => {
  res.json({ ok: true, time: nowIso() });
});

api.get("/capabilities", (_req, res) => {
  res.json(redbookCapabilities);
});

api.get("/media", async (req, res, next) => {
  try {
    await proxyMedia(req, res);
  } catch (error) {
    next(error);
  }
});

api.post("/auth/cookie", async (req, res, next) => {
  try {
    const body = z
      .object({
        cookieString: z.string().optional(),
        a1: z.string().optional(),
        web_session: z.string().optional(),
        webId: z.string().optional()
      })
      .parse(req.body);
    const cookieString = buildCookieString(body);
    const user = await redbook.verifyCookie(cookieString);
    await saveCookieString(cookieString);
    const status = { connected: true, configured: true, user, checkedAt: nowIso() };
    await store.write("authStatus", status);
    res.json(status);
  } catch (error) {
    await markAuthDisconnected(error instanceof Error ? error.message : String(error));
    next(error);
  }
});

api.post("/auth/browser", async (_req, res, next) => {
  try {
    const { cookieString, user } = await redbook.extractChromeCookie();
    await saveCookieString(cookieString);
    const status = { connected: true, configured: true, user, checkedAt: nowIso() };
    await store.write("authStatus", status);
    res.json(status);
  } catch (error) {
    await markAuthDisconnected(error instanceof Error ? error.message : String(error));
    next(error);
  }
});

api.get("/auth/extension/status", async (_req, res) => {
  res.json(await store.read("browserBridgeStatus"));
});

api.post("/auth/extension-cookie", async (req, res, next) => {
  try {
    const body = extensionCookieInput.parse(req.body);
    const cookieString = buildCookieString(body);
    const user = await redbook.verifyCookie(cookieString);
    await saveCookieString(cookieString);
    const status = { connected: true, configured: true, user, checkedAt: nowIso() };
    await Promise.all([
      store.write("authStatus", status),
      store.write("browserBridgeStatus", {
        connected: true,
        browser: body.browser,
        extensionVersion: body.extensionVersion,
        lastSeenAt: nowIso(),
        lastSyncAt: nowIso(),
        permissionStatus: body.permissionStatus,
        message: "浏览器助手已同步当前浏览器登录态。",
        diagnostic: ""
      })
    ]);
    res.json(status);
  } catch (error) {
    await markAuthDisconnected(error instanceof Error ? error.message : String(error));
    next(error);
  }
});

api.post("/auth/browser-session", async (_req, res, next) => {
  try {
    res.status(201).json(await browserAuth.startSession());
  } catch (error) {
    next(error);
  }
});

api.post("/auth/browser-session/:id/capture", async (req, res, next) => {
  try {
    const result = await browserAuth.captureSession(req.params.id);
    if (result.status !== "verified") {
      res.json(result);
      return;
    }
    await saveCookieString(result.cookieString);
    const status = { connected: true, configured: true, user: result.user, checkedAt: nowIso() };
    await store.write("authStatus", status);
    res.json(status);
  } catch (error) {
    if (error instanceof Error && error.message.includes("登录会话不存在")) {
      res.status(404).json({ error: error.message });
      return;
    }
    next(error);
  }
});

api.delete("/auth/browser-session/:id", async (req, res, next) => {
  try {
    res.json(browserAuth.closeSession(req.params.id));
  } catch (error) {
    if (error instanceof Error && error.message.includes("登录会话不存在")) {
      res.status(404).json({ error: error.message });
      return;
    }
    next(error);
  }
});

api.post("/browser/open-url", async (req, res, next) => {
  try {
    const body = browserOpenInput.parse(req.body);
    if (body.mode === "current-browser") {
      res.status(400).json({ error: "当前浏览器打开需要浏览器助手扩展，请先安装并启用扩展。" });
      return;
    }
    res.json(await browserAuth.openUrl(body.url));
  } catch (error) {
    next(error);
  }
});

api.get("/auth/status", async (_req, res) => {
  const stored = await store.read("authStatus");
  const configured = Boolean(await getCookieString());
  const latestAuthRisk = await latestAuthRiskAfter(stored.checkedAt);
  const error = latestAuthRisk ?? stored.error;
  const needsVerification = Boolean(configured && (!stored.checkedAt || stored.checkedAt < serverStartedAt));
  const status = {
    ...stored,
    configured,
    error,
    needsVerification,
    message: needsVerification ? "已检测到本地 Cookie，等待重新验证。" : stored.message,
    connected: Boolean(stored.connected && configured && !error && !needsVerification)
  };
  if (latestAuthRisk) {
    await store.write("authStatus", { ...status, connected: false, configured });
  }
  res.json(status);
});

api.post("/auth/verify", async (_req, res) => {
  const cookieString = await getCookieString();
  if (!cookieString) {
    const status = {
      connected: false,
      configured: false,
      checkedAt: nowIso(),
      needsVerification: false,
      message: "未检测到本地 Cookie。"
    };
    await store.write("authStatus", status);
    res.json(status);
    return;
  }

  try {
    const user = await redbook.verifyCookie(cookieString);
    const status = { connected: true, configured: true, user, checkedAt: nowIso(), needsVerification: false };
    await store.write("authStatus", status);
    res.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = {
      connected: false,
      configured: true,
      error: message,
      checkedAt: nowIso(),
      needsVerification: false,
      message: "本地 Cookie 已失效或缺失，请重新同步登录态。"
    };
    await store.write("authStatus", status);
    res.json(status);
  }
});

api.post("/search-jobs", async (req, res, next) => {
  try {
    const body = jobInput.parse(req.body);
    const job = await jobs.createJob(body);
    res.status(201).json(job);
  } catch (error) {
    next(error);
  }
});

api.get("/search-jobs", async (_req, res) => {
  res.json(await jobs.listJobs());
});

api.get("/search-jobs/:id", async (req, res) => {
  const job = await jobs.getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
});

api.post("/search-jobs/:id/resume", async (req, res) => {
  const job = await jobs.resume(req.params.id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
});

api.post("/search-jobs/:id/stop", async (req, res) => {
  const job = await jobs.stop(req.params.id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
});

api.get("/notes", async (req, res) => {
  const query: NotesQuery = {
    jobId: stringQuery(req.query.jobId),
    jobIds: stringListQuery(req.query.jobIds),
    q: stringQuery(req.query.q),
    type: asNoteType(req.query.type),
    author: stringQuery(req.query.author),
    minLikes: numberQuery(req.query.minLikes),
    sort: asSort(req.query.sort)
  };
  res.json(await listNotesPage(query, numberQuery(req.query.page), numberQuery(req.query.pageSize)));
});

api.get("/note-scopes", async (_req, res) => {
  res.json(await listNoteScopes());
});

api.get("/note-scopes/:jobId/clear-preview", async (req, res) => {
  const preview = await getNoteScopeClearPreview(req.params.jobId);
  if (!preview) {
    res.status(404).json({ error: "Note scope not found" });
    return;
  }
  res.json(preview);
});

api.get("/notes/:id", async (req, res) => {
  const detail = await getNoteDetail(req.params.id);
  if (!detail) {
    res.status(404).json({ error: "Note not found" });
    return;
  }
  res.json(detail);
});

api.post("/notes/:id/media-refresh", async (req, res, next) => {
  try {
    res.json(await refreshNoteMedia(req.params.id));
  } catch (error) {
    next(error);
  }
});

api.delete("/notes", async (req, res, next) => {
  try {
    const jobId = stringQuery(req.query.jobId);
    if (jobId) {
      await jobs.stop(jobId);
    }
    res.json(await clearNotes(jobId, { deleteAiArtifacts: booleanQuery(req.query.deleteAiArtifacts) }));
  } catch (error) {
    next(error);
  }
});

api.delete("/notes/:id", async (req, res, next) => {
  try {
    res.json(await deleteNote(req.params.id));
  } catch (error) {
    next(error);
  }
});

api.get("/analytics/:jobId", async (req, res) => {
  res.json(await getAnalytics(req.params.jobId));
});

api.get("/health-check/:jobId", async (req, res, next) => {
  try {
    res.json(await buildHealthCheck(req.params.jobId));
  } catch (error) {
    next(error);
  }
});

api.get("/comment-plans", async (_req, res) => {
  res.json(await listReplyPlans());
});

api.get("/comment-actions", async (_req, res) => {
  res.json(await listReplyActions());
});

api.post("/comment-plans", async (req, res, next) => {
  try {
    res.status(201).json(await createReplyPlan(replyPlanInput.parse(req.body)));
  } catch (error) {
    next(error);
  }
});

api.post("/comment-actions/:id/approve", async (req, res, next) => {
  try {
    const body = z.object({ content: z.string().optional() }).parse(req.body ?? {});
    res.json(await approveReplyAction(req.params.id, body.content));
  } catch (error) {
    next(error);
  }
});

api.get("/content/playbooks", async (_req, res) => {
  res.json(await listContentPlaybooks());
});

api.post("/content/playbooks", async (req, res, next) => {
  try {
    res.status(201).json(await saveContentPlaybook(contentPlaybookInput.parse(req.body)));
  } catch (error) {
    next(error);
  }
});

api.put("/content/playbooks/:id", async (req, res, next) => {
  try {
    res.json(await saveContentPlaybook(contentPlaybookInput.parse(req.body), req.params.id));
  } catch (error) {
    next(error);
  }
});

api.delete("/content/playbooks/:id", async (req, res, next) => {
  try {
    res.json(await deleteContentPlaybook(req.params.id));
  } catch (error) {
    next(error);
  }
});

api.get("/content/playbooks/:id/revisions", async (req, res, next) => {
  try {
    res.json(await listContentPlaybookRevisions(req.params.id));
  } catch (error) {
    next(error);
  }
});

api.post("/content/playbooks/:id/revisions/:revisionId/restore", async (req, res, next) => {
  try {
    res.json(await restoreContentPlaybookRevision(req.params.id, req.params.revisionId));
  } catch (error) {
    next(error);
  }
});

api.get("/content/projects", async (_req, res) => {
  res.json(await listContentProjects());
});

api.post("/content/projects", async (req, res, next) => {
  try {
    res.status(201).json(await saveContentProject(contentProjectInput.parse(req.body)));
  } catch (error) {
    next(error);
  }
});

api.put("/content/projects/:id", async (req, res, next) => {
  try {
    res.json(await saveContentProject(contentProjectInput.parse(req.body), req.params.id));
  } catch (error) {
    next(error);
  }
});

api.delete("/content/projects/:id", async (req, res, next) => {
  try {
    res.json(await deleteContentProject(req.params.id));
  } catch (error) {
    next(error);
  }
});

api.get("/content/projects/:id/materials", async (req, res, next) => {
  try {
    res.json(await listContentProjectMaterials(req.params.id));
  } catch (error) {
    next(error);
  }
});

api.post("/content/projects/:id/materials", async (req, res, next) => {
  try {
    res.status(201).json(await saveContentProjectMaterial({
      ...contentProjectMaterialInput.parse(req.body),
      projectId: req.params.id
    }));
  } catch (error) {
    next(error);
  }
});

api.post("/content/projects/:id/materials/from-notes", async (req, res, next) => {
  try {
    const input = contentProjectMaterialsFromNotesInput.parse(req.body);
    res.status(201).json(await addContentProjectMaterialsFromNotes(req.params.id, input.noteIds, input.category));
  } catch (error) {
    next(error);
  }
});

api.delete("/content/projects/:id/materials/:materialId", async (req, res, next) => {
  try {
    res.json(await deleteContentProjectMaterial(req.params.id, req.params.materialId));
  } catch (error) {
    next(error);
  }
});

api.get("/content/drafts", async (_req, res) => {
  res.json(await listContentDrafts());
});

api.post("/content/drafts", async (req, res, next) => {
  try {
    res.status(201).json(await generateContentDraft(contentDraftInput.parse(req.body)));
  } catch (error) {
    next(error);
  }
});

api.get("/content/reviews", async (_req, res) => {
  res.json(await listContentReviews());
});

api.post("/content/reviews", async (req, res, next) => {
  try {
    res.status(201).json(await reviewContentDraft(contentReviewInput.parse(req.body)));
  } catch (error) {
    next(error);
  }
});

api.post("/content/reviews/batch", async (req, res, next) => {
  try {
    res.status(201).json(await reviewContentDraftBatch(contentReviewBatchInput.parse(req.body)));
  } catch (error) {
    next(error);
  }
});

api.post("/content/assistant/run", async (req, res, next) => {
  try {
    res.status(201).json(await runContentAssistant(contentAssistantInput.parse(req.body)));
  } catch (error) {
    next(error);
  }
});

api.get("/ai/models", async (_req, res) => {
  res.json(await listAiModels());
});

api.post("/ai/models", async (req, res, next) => {
  try {
    res.status(201).json(await saveAiModel(aiModelInput.parse(req.body)));
  } catch (error) {
    next(error);
  }
});

api.put("/ai/models/:id", async (req, res, next) => {
  try {
    res.json(await updateAiModel(req.params.id, aiModelInput.partial().parse(req.body)));
  } catch (error) {
    next(error);
  }
});

api.delete("/ai/models/:id", async (req, res, next) => {
  try {
    res.json(await deleteAiModel(req.params.id));
  } catch (error) {
    next(error);
  }
});

api.post("/ai/models/:id/default", async (req, res, next) => {
  try {
    res.json(await setDefaultAiModel(req.params.id));
  } catch (error) {
    next(error);
  }
});

api.post("/ai/models/test", async (req, res, next) => {
  try {
    const body = z.object({ modelId: z.string().min(1) }).parse(req.body);
    res.json(await testAiModel(body.modelId));
  } catch (error) {
    next(error);
  }
});

api.post("/ai/models/:id/tools-probe", async (req, res, next) => {
  try {
    res.json(await probeAiModelTools(req.params.id));
  } catch (error) {
    next(error);
  }
});

api.get("/ai/workflows", (_req, res) => {
  res.json(listAiWorkflows());
});

api.get("/ai/prompts", async (_req, res, next) => {
  try {
    res.json(await listAiPrompts());
  } catch (error) {
    next(error);
  }
});

api.get("/ai/prompts/:key", async (req, res, next) => {
  try {
    res.json(await getAiPromptDetail(aiPromptKey.parse(req.params.key)));
  } catch (error) {
    next(error);
  }
});

api.put("/ai/prompts/:key", async (req, res, next) => {
  try {
    const body = z.object({ customTemplate: z.string().min(1) }).parse(req.body);
    res.json(await saveAiPromptConfig(aiPromptKey.parse(req.params.key), body.customTemplate));
  } catch (error) {
    next(error);
  }
});

api.post("/ai/prompts/:key/reset", async (req, res, next) => {
  try {
    res.json(await resetAiPromptConfig(aiPromptKey.parse(req.params.key)));
  } catch (error) {
    next(error);
  }
});

api.post("/ai/prompts/:key/activate", async (req, res, next) => {
  try {
    const body = z.object({ source: z.enum(["default", "custom"]).default("default") }).parse(req.body ?? {});
    res.json(await activateAiPrompt(aiPromptKey.parse(req.params.key), body.source));
  } catch (error) {
    next(error);
  }
});

api.post("/ai/workflows/run", async (req, res, next) => {
  try {
    res.status(201).json(await runAiWorkflow(aiWorkflowInput.parse(req.body)));
  } catch (error) {
    next(error);
  }
});

api.post("/ai/assistant/chat", async (req, res, next) => {
  try {
    res.status(201).json(await chatWithAssistant(aiAssistantInput.parse(req.body)));
  } catch (error) {
    next(error);
  }
});

api.post("/ai/orchestrations", async (req, res, next) => {
  try {
    res.status(201).json(await createAiOrchestrationWithToolsFallback(aiOrchestrationInput.parse(req.body)));
  } catch (error) {
    next(error);
  }
});

api.get("/ai/orchestrations", async (_req, res) => {
  res.json(await listAiOrchestrations());
});

api.get("/ai/orchestrations/:id", async (req, res) => {
  const orchestration = await getAiOrchestration(req.params.id);
  if (!orchestration) {
    res.status(404).json({ error: "AI orchestration not found" });
    return;
  }
  res.json(orchestration);
});

api.get("/ai/orchestrations/:id/events", async (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive"
  });
  let closed = false;
  const send = async () => {
    if (closed) return;
    const orchestration = await getAiOrchestration(req.params.id);
    if (!orchestration) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: "AI orchestration not found" })}\n\n`);
      res.end();
      closed = true;
      return;
    }
    res.write(`event: orchestration\ndata: ${JSON.stringify(orchestration)}\n\n`);
    if (["completed", "failed", "cancelled"].includes(orchestration.status)) {
      res.end();
      closed = true;
    }
  };
  const timer = setInterval(() => {
    void send().catch((error) => {
      res.write(`event: error\ndata: ${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n\n`);
    });
  }, 2000);
  req.on("close", () => {
    closed = true;
    clearInterval(timer);
  });
  await send();
});

api.get("/ai/artifacts", async (req, res) => {
  res.json(await listAiArtifacts(stringQuery(req.query.jobId)));
});

api.get("/ai/artifacts/:id/export", async (req, res) => {
  await sendArtifactMarkdown(req.params.id, res);
});

api.post("/ai/artifacts/:id/export", async (req, res) => {
  await sendArtifactMarkdown(req.params.id, res);
});

api.get("/ai/artifacts/:id", async (req, res) => {
  const artifact = await getAiArtifact(req.params.id);
  if (!artifact) {
    res.status(404).json({ error: "AI artifact not found" });
    return;
  }
  res.json(artifact);
});

api.delete("/ai/artifacts/:id", async (req, res) => {
  res.json(await deleteAiArtifact(req.params.id));
});

api.get("/ai/reports", async (req, res) => {
  res.json(await listAiReports(stringQuery(req.query.jobId)));
});

api.post("/ai/reports", async (req, res, next) => {
  try {
    const body = z
      .object({
        jobId: z.string().min(1),
        modelId: z.string().optional(),
        title: z.string().optional(),
        focus: z.string().optional()
      })
      .parse(req.body);
    res.status(201).json(await createAiReport(body));
  } catch (error) {
    next(error);
  }
});

api.get("/ai/reports/:id/export", async (req, res) => {
  const report = await getAiReport(req.params.id);
  if (!report) {
    res.status(404).json({ error: "AI report not found" });
    return;
  }
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${report.id}.md"`);
  res.send(report.markdown);
});

api.get("/ai/reports/:id", async (req, res) => {
  const report = await getAiReport(req.params.id);
  if (!report) {
    res.status(404).json({ error: "AI report not found" });
    return;
  }
  res.json(report);
});

api.delete("/ai/reports/:id", async (req, res) => {
  res.json(await deleteAiReport(req.params.id));
});

api.get("/export/:jobId", async (req, res, next) => {
  try {
    const format = req.query.format === "csv" || req.query.format === "html" ? req.query.format : "json";
    const file = await buildExport(req.params.jobId, format);
    res.setHeader("Content-Type", file.type);
    res.setHeader("Content-Disposition", `attachment; filename="${file.name}"`);
    res.send(file.body);
  } catch (error) {
    next(error);
  }
});

api.get("/redbook/feed", async (req, res, next) => {
  try {
    res.json(await redbook.feed(stringQuery(req.query.category) ?? "homefeed_recommend"));
  } catch (error) {
    next(error);
  }
});

api.get("/redbook/topics", async (req, res, next) => {
  try {
    const keyword = stringQuery(req.query.keyword);
    if (!keyword) {
      res.status(400).json({ error: "keyword is required" });
      return;
    }
    res.json(await redbook.topics(keyword));
  } catch (error) {
    next(error);
  }
});

api.get("/redbook/favorites", async (req, res, next) => {
  try {
    res.json(await redbook.favorites(stringQuery(req.query.userId), req.query.all === "true"));
  } catch (error) {
    next(error);
  }
});

api.get("/redbook/boards", async (req, res, next) => {
  try {
    res.json(await redbook.boards(stringQuery(req.query.userId)));
  } catch (error) {
    next(error);
  }
});

api.get("/redbook/board", async (req, res, next) => {
  try {
    const url = stringQuery(req.query.url);
    if (!url) {
      res.status(400).json({ error: "url is required" });
      return;
    }
    res.json(await redbook.board(url));
  } catch (error) {
    next(error);
  }
});

api.get("/redbook/followers", async (req, res, next) => {
  try {
    const userId = stringQuery(req.query.userId);
    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }
    res.json(await redbook.followers(userId, req.query.all === "true"));
  } catch (error) {
    next(error);
  }
});

api.get("/redbook/following", async (req, res, next) => {
  try {
    const userId = stringQuery(req.query.userId);
    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }
    res.json(await redbook.following(userId, req.query.all === "true"));
  } catch (error) {
    next(error);
  }
});

function stringQuery(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringListQuery(value: unknown): string[] | undefined {
  if (typeof value !== "string") return undefined;
  const items = value.split(",").map((item) => item.trim()).filter(Boolean);
  return items.length ? items : undefined;
}

function numberQuery(value: unknown): number | undefined {
  const parsed = typeof value === "string" ? Number(value) : undefined;
  return parsed && Number.isFinite(parsed) ? parsed : undefined;
}

function booleanQuery(value: unknown): boolean {
  return value === true || value === "true" || value === "1" || value === "yes";
}

function asNoteType(value: unknown): NotesQuery["type"] {
  return value === "all" || value === "video" || value === "image" ? value : undefined;
}

function asSort(value: unknown): NotesQuery["sort"] {
  return value === "likes" || value === "comments" || value === "collects" || value === "latest" || value === "hot"
    ? value
    : "hot";
}

async function latestAuthRiskAfter(checkedAt?: string): Promise<string | undefined> {
  const checkedTime = checkedAt ? Date.parse(checkedAt) : 0;
  const jobs = await store.read("searchJobs");
  return jobs
    .filter((job) => job.breakerReason && isAuthRisk(job.breakerReason))
    .filter((job) => !checkedTime || Date.parse(job.updatedAt) >= checkedTime)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.breakerReason;
}

function buildCookieString(input: { cookieString?: string; a1?: string; web_session?: string; webId?: string }): string {
  if (input.cookieString?.trim()) {
    return input.cookieString.trim();
  }

  const a1 = input.a1?.trim();
  const webSession = input.web_session?.trim();
  const webId = input.webId?.trim();
  if (!a1 || !webSession) {
    throw new Error("请至少填写 a1 和 web_session。webId 如果能复制到也建议填写。");
  }

  return [
    ["a1", a1],
    ["web_session", webSession],
    ["webId", webId]
  ]
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

async function sendArtifactMarkdown(artifactId: string, res: Response): Promise<void> {
  const artifact = await getAiArtifact(artifactId);
  if (!artifact) {
    res.status(404).json({ error: "AI artifact not found" });
    return;
  }
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${artifact.id}.md"`);
  res.send(artifact.markdown);
}
