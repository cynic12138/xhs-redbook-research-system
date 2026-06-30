import {
  Activity,
  AlertTriangle,
  Bot,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Compass,
  Database,
  Download,
  Eye,
  ExternalLink,
  FileText,
  Flame,
  Gauge,
  GripVertical,
  HeartHandshake,
  ImageIcon,
  KeyRound,
  Layers,
  Library,
  Loader2,
  LogIn,
  MessageSquareReply,
  Play,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Square,
  TrendingUp,
  Trash2,
  Video,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import type {
  AiArtifact,
  AiAssistantMessage,
  AiModelConfig,
  AiOrchestration,
  AiPromptDetail,
  AiPromptInfo,
  AiPromptSource,
  AiReport,
  AiWorkflowDefinition,
  AiWorkflowKey,
  AnalyticsReport,
  AuthStatus,
  BrowserBridgeStatus,
  HealthReportRecord,
  NoteScopeClearPreview,
  NoteScopeSummary,
  NoteRecord,
  NoteTypeFilter,
  RedbookCapability,
  ReplyActionRecord,
  ReplyPlanRecord,
  ReplyStrategy,
  SearchJob,
  SearchSort
} from "../shared/types.js";
import { AI_MODEL_PROVIDER_PRESETS, findModelProviderPreset, type AiModelProviderKey } from "../shared/modelProviders.js";
import { api } from "./lib/api.js";

type ModuleKey = "overview" | "research" | "notes" | "viral" | "audience" | "competitors" | "comments" | "prompts" | "ai";
type SortMode = "hot" | "likes" | "comments" | "collects" | "latest";
type ModelForm = { providerKey: AiModelProviderKey; name: string; provider: string; baseUrl: string; model: string; apiKey: string };
type ReaderPreview = { kind: "artifact" | "report"; title: string; markdown: string; meta: string[]; exportUrl: string };
type RunWorkflow = (workflowKey: AiWorkflowKey, focus?: string) => Promise<AiArtifact | undefined>;
type AssistantNoticeTone = "info" | "warning" | "error" | "progress";
type AssistantNotice = {
  key: string;
  tone: AssistantNoticeTone;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

const emptyModelForm: ModelForm = {
  providerKey: "deepseek",
  name: "",
  provider: "DeepSeek",
  baseUrl: "https://api.deepseek.com",
  model: "",
  apiKey: ""
};

const modules: Array<{ key: ModuleKey; label: string; icon: ReactNode }> = [
  { key: "overview", label: "总览", icon: <Activity size={18} /> },
  { key: "research", label: "话题研究", icon: <Compass size={18} /> },
  { key: "notes", label: "笔记库", icon: <Database size={18} /> },
  { key: "viral", label: "爆款拆解", icon: <Flame size={18} /> },
  { key: "audience", label: "受众洞察", icon: <HeartHandshake size={18} /> },
  { key: "competitors", label: "竞品分析", icon: <Layers size={18} /> },
  { key: "comments", label: "评论运营", icon: <MessageSquareReply size={18} /> },
  { key: "prompts", label: "Prompt 中心", icon: <KeyRound size={18} /> },
  { key: "ai", label: "AI 工作台", icon: <Bot size={18} /> }
];

function clearRecoveredBackendError(message: string): string {
  return ["后端服务暂时不可用", "Request failed: 500", "Failed to fetch", "ECONNREFUSED"].some((item) =>
    message.includes(item)
  )
    ? ""
    : message;
}

export function App() {
  const [activeModule, setActiveModule] = useState<ModuleKey>("overview");
  const [auth, setAuth] = useState<AuthStatus>({ connected: false, configured: false });
  const [authVerifyAttempted, setAuthVerifyAttempted] = useState(false);
  const [cookieFields, setCookieFields] = useState({ a1: "", web_session: "", webId: "" });
  const [browserBridge, setBrowserBridge] = useState<BrowserBridgeStatus>({ connected: false, browser: "unknown", permissionStatus: "unknown" });
  const [keywords, setKeywords] = useState("");
  const [sort, setSort] = useState<SearchSort>("popular");
  const [noteType, setNoteType] = useState<NoteTypeFilter>("all");
  const [pages, setPages] = useState(1);
  const [commentPages, setCommentPages] = useState(1);
  const [concurrency, setConcurrency] = useState(2);
  const [jobs, setJobs] = useState<SearchJob[]>([]);
  const [activeJobId, setActiveJobId] = useState("");
  const [activeKeywordScopeId, setActiveKeywordScopeId] = useState("");
  const [showHistoryData, setShowHistoryData] = useState(false);
  const [noteScopes, setNoteScopes] = useState<NoteScopeSummary[]>([]);
  const [noteScopePanelOpen, setNoteScopePanelOpen] = useState(false);
  const [datasetManagerOpen, setDatasetManagerOpen] = useState(false);
  const [datasetClearPreview, setDatasetClearPreview] = useState<NoteScopeClearPreview | null>(null);
  const [deleteDatasetAiArtifacts, setDeleteDatasetAiArtifacts] = useState(false);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [notePage, setNotePage] = useState(1);
  const [notePageSize] = useState(20);
  const [notesTotal, setNotesTotal] = useState(0);
  const [notesTotalPages, setNotesTotalPages] = useState(1);
  const [analytics, setAnalytics] = useState<AnalyticsReport | null>(null);
  const [capabilities, setCapabilities] = useState<RedbookCapability[]>([]);
  const [health, setHealth] = useState<HealthReportRecord | null>(null);
  const [replyPlans, setReplyPlans] = useState<ReplyPlanRecord[]>([]);
  const [replyActions, setReplyActions] = useState<ReplyActionRecord[]>([]);
  const [aiModels, setAiModels] = useState<AiModelConfig[]>([]);
  const [aiReports, setAiReports] = useState<AiReport[]>([]);
  const [aiWorkflows, setAiWorkflows] = useState<AiWorkflowDefinition[]>([]);
  const [aiPrompts, setAiPrompts] = useState<AiPromptInfo[]>([]);
  const [selectedPromptKey, setSelectedPromptKey] = useState<AiWorkflowKey>("content-planning");
  const [selectedPrompt, setSelectedPrompt] = useState<AiPromptDetail | null>(null);
  const [promptDraft, setPromptDraft] = useState("");
  const [aiArtifacts, setAiArtifacts] = useState<AiArtifact[]>([]);
  const [aiOrchestrations, setAiOrchestrations] = useState<AiOrchestration[]>([]);
  const [activeOrchestrationId, setActiveOrchestrationId] = useState("");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantWidth, setAssistantWidth] = useState(() => readStoredNumber("xhs.aiDrawerWidth", 420));
  const [assistantMessages, setAssistantMessages] = useState<AiAssistantMessage[]>([]);
  const [assistantInput, setAssistantInput] = useState("");
  const [selectedModelId, setSelectedModelId] = useState(() => readStoredString("xhs.selectedModelId", ""));
  const [assistantGuideDismissed, setAssistantGuideDismissed] = useState(() => localStorage.getItem("xhs.assistantGuideDismissed") === "true");
  const [selectedWorkflow, setSelectedWorkflow] = useState<AiWorkflowKey>("content-planning");
  const [selectedArtifactId, setSelectedArtifactId] = useState("");
  const [selectedReportId, setSelectedReportId] = useState("");
  const [modelSettingsOpen, setModelSettingsOpen] = useState(false);
  const [modelEditorOpen, setModelEditorOpen] = useState(false);
  const [editingModelId, setEditingModelId] = useState("");
  const [query, setQuery] = useState("");
  const [authorQuery, setAuthorQuery] = useState("");
  const [minLikes, setMinLikes] = useState("");
  const [resultType, setResultType] = useState<NoteTypeFilter>("all");
  const [resultSort, setResultSort] = useState<SortMode>("hot");
  const [selectedId, setSelectedId] = useState("");
  const [replyStrategy, setReplyStrategy] = useState<ReplyStrategy>("questions");
  const [replyTemplate, setReplyTemplate] = useState("谢谢 {author} 的提问，我补充一下：");
  const [reportFocus, setReportFocus] = useState("话题机会、爆款结构、评论需求、可执行选题");
  const [modelForm, setModelForm] = useState<ModelForm>(emptyModelForm);
  const [modelMessages, setModelMessages] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [assistantError, setAssistantError] = useState("");

  const activeJob = jobs.find((job) => job.id === activeJobId);
  const contextJob = isContextJob(activeJob) ? activeJob : undefined;
  const contextJobId = contextJob?.id ?? "";
  const selected = notes.find((note) => note.id === selectedId) ?? notes[0] ?? null;
  const defaultModel = aiModels.find((model) => model.isDefault) ?? aiModels[0];
  const selectedModel = aiModels.find((model) => model.id === selectedModelId) ?? defaultModel;

  const refreshCore = useCallback(async () => {
    const [authStatus, allJobs, caps, models, workflows, prompts, scopes, bridgeStatus] = await Promise.all([
      api.authStatus(),
      api.listJobs(),
      api.capabilities(),
      api.listAiModels(),
      api.listAiWorkflows(),
      api.listAiPrompts(),
      api.listNoteScopes(),
      api.browserBridgeStatus().catch(() => ({ connected: false, browser: "unknown", permissionStatus: "unknown" }) satisfies BrowserBridgeStatus)
    ]);
    const sortedJobs = allJobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setAuth(authStatus);
    setJobs(sortedJobs);
    setCapabilities(caps);
    setAiModels(models);
    setAiWorkflows(workflows);
    setAiPrompts(prompts);
    setNoteScopes(scopes);
    setBrowserBridge({ ...bridgeStatus, connected: false });
    setError(clearRecoveredBackendError);
  }, [activeJobId]);

  const loadNotes = useCallback(async () => {
    if (!activeJobId && !activeKeywordScopeId && !showHistoryData) {
      setNotes([]);
      setNotesTotal(0);
      setNotesTotalPages(1);
      setSelectedId("");
      return;
    }
    const params = new URLSearchParams();
    if (activeJobId) params.set("jobId", activeJobId);
    if (activeKeywordScopeId && !activeJobId) {
      const keywordScope = noteScopes.find((scope) => scope.id === activeKeywordScopeId);
      if (keywordScope?.relatedJobIds?.length) {
        params.set("jobIds", keywordScope.relatedJobIds.join(","));
      }
    }
    if (query.trim()) params.set("q", query.trim());
    if (authorQuery.trim()) params.set("author", authorQuery.trim());
    if (resultType !== "all") params.set("type", resultType);
    if (minLikes.trim()) params.set("minLikes", minLikes.trim());
    params.set("sort", resultSort);
    params.set("page", String(notePage));
    params.set("pageSize", String(notePageSize));
    const data = await api.listNotes(params);
    setNotes(data.items);
    setNotesTotal(data.total);
    setNotesTotalPages(data.totalPages);
    if (data.items.length && !data.items.some((note) => note.id === selectedId)) {
      setSelectedId(data.items[0].id);
    }
    if (!data.items.length) {
      setSelectedId("");
    }
  }, [activeJobId, activeKeywordScopeId, authorQuery, minLikes, notePage, notePageSize, noteScopes, query, resultSort, resultType, selectedId, showHistoryData]);

  const loadAnalytics = useCallback(async () => {
    if (!activeJobId) {
      setAnalytics(null);
      return;
    }
    setAnalytics(await api.getAnalytics(activeJobId));
  }, [activeJobId]);

  const loadOperations = useCallback(async () => {
    const [plans, actions, reports, artifacts] = await Promise.all([
      api.listReplyPlans(),
      api.listReplyActions(),
      api.listAiReports(activeJobId || undefined),
      api.listAiArtifacts(activeJobId || undefined)
    ]);
    setReplyPlans(plans);
    setReplyActions(actions);
    setAiReports(reports);
    setAiArtifacts(artifacts);
  }, [activeJobId]);

  const loadOrchestrations = useCallback(async () => {
    setAiOrchestrations(await api.listAiOrchestrations());
  }, []);

  const loadPromptDetail = useCallback(async (key: AiWorkflowKey) => {
    const detail = await api.getAiPrompt(key);
    setSelectedPrompt(detail);
    setPromptDraft(detail.customTemplate || detail.defaultTemplate);
  }, []);

  useEffect(() => {
    setNotePage(1);
  }, [activeJobId, activeKeywordScopeId, authorQuery, minLikes, query, resultSort, resultType]);

  useEffect(() => {
    void refreshCore().catch((err) => setError(err.message));
  }, [refreshCore]);

  useEffect(() => {
    if (!auth.needsVerification || authVerifyAttempted) {
      return;
    }
    setAuthVerifyAttempted(true);
    void run("auth-verify", async () => {
      setAuth(await api.verifyAuth());
    });
  }, [auth.needsVerification, authVerifyAttempted]);

  useEffect(() => {
    void loadNotes().catch((err) => setError(err.message));
    void loadAnalytics().catch(() => setAnalytics(null));
    void loadOperations().catch(() => undefined);
    void loadOrchestrations().catch(() => undefined);
  }, [loadAnalytics, loadNotes, loadOperations, loadOrchestrations]);

  useEffect(() => {
    void loadPromptDetail(selectedPromptKey).catch((err) => setError(err.message));
  }, [loadPromptDetail, selectedPromptKey]);

  useEffect(() => {
    const navigate = (event: Event) => {
      const nextModule = (event as CustomEvent<ModuleKey>).detail;
      if (modules.some((module) => module.key === nextModule)) {
        setActiveModule(nextModule);
      }
    };
    window.addEventListener("xhs:navigate", navigate);
    return () => window.removeEventListener("xhs:navigate", navigate);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      void refreshCore().catch(() => undefined);
      void loadNotes().catch(() => undefined);
      void loadAnalytics().catch(() => undefined);
      void loadOperations().catch(() => undefined);
      void loadOrchestrations().catch(() => undefined);
    }, 7000);
    return () => clearInterval(timer);
  }, [loadAnalytics, loadNotes, loadOperations, loadOrchestrations, refreshCore]);

  useEffect(() => {
    let alive = true;
    callBrowserBridge<BrowserBridgeStatus>("ping", undefined, 1000)
      .then((status) => {
        if (alive) {
          setBrowserBridge({ ...status, connected: true, message: status.message || "浏览器助手已连接。" });
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!activeOrchestrationId) {
      return;
    }
    let alive = true;
    let timer: number | undefined;
    let source: EventSource | undefined;
    const applyOrchestration = async (orchestration: AiOrchestration) => {
      if (!alive) return;
      setAiOrchestrations((items) => upsertById(items, orchestration));
      if (orchestration.jobId) {
        setActiveJobId(orchestration.jobId);
        setShowHistoryData(false);
      }
      if (orchestration.artifactIds.length) {
        const latestArtifactId = orchestration.artifactIds[orchestration.artifactIds.length - 1] ?? "";
        setSelectedArtifactId(latestArtifactId);
        setSelectedReportId("");
        await loadOperations();
        if (latestArtifactId) {
          const artifact = await api.getAiArtifact(latestArtifactId).catch(() => undefined);
          if (alive && artifact) {
            setAiArtifacts((items) => [artifact, ...items.filter((item) => item.id !== artifact.id)]);
          }
        }
      }
      await refreshCore();
      if (orchestration.status === "completed") {
        setActiveModule("ai");
      }
    };
    const tick = async () => {
      try {
        const orchestration = await api.getAiOrchestration(activeOrchestrationId);
        await applyOrchestration(orchestration);
        if (orchestration.status === "completed" || orchestration.status === "failed" || orchestration.status === "cancelled") {
          return;
        }
        timer = window.setTimeout(tick, 2500);
      } catch (err) {
        if (alive) {
          setAssistantError(err instanceof Error ? err.message : String(err));
        }
      }
    };
    source = new EventSource(`/api/ai/orchestrations/${activeOrchestrationId}/events`);
    source.addEventListener("orchestration", (event) => {
      const orchestration = JSON.parse((event as MessageEvent<string>).data) as AiOrchestration;
      void applyOrchestration(orchestration).then(() => {
        if (orchestration.status === "completed" || orchestration.status === "failed" || orchestration.status === "cancelled") {
          source?.close();
        }
      });
    });
    source.addEventListener("error", () => {
      source?.close();
      if (alive && !timer) {
        timer = window.setTimeout(tick, 1000);
      }
    });
    return () => {
      alive = false;
      source?.close();
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [activeOrchestrationId, loadOperations, refreshCore]);

  useEffect(() => {
    localStorage.setItem("xhs.aiDrawerWidth", String(assistantWidth));
  }, [assistantWidth]);

  useEffect(() => {
    if (!aiModels.length) {
      setSelectedModelId("");
      return;
    }
    if (selectedModelId && aiModels.some((model) => model.id === selectedModelId)) {
      return;
    }
    setSelectedModelId((aiModels.find((model) => model.isDefault) ?? aiModels[0]).id);
  }, [aiModels, selectedModelId]);

  useEffect(() => {
    if (selectedModelId) {
      localStorage.setItem("xhs.selectedModelId", selectedModelId);
    } else {
      localStorage.removeItem("xhs.selectedModelId");
    }
  }, [selectedModelId]);

  useEffect(() => {
    if (selectedArtifactId && !aiArtifacts.some((artifact) => artifact.id === selectedArtifactId)) {
      setSelectedArtifactId("");
    }
  }, [aiArtifacts, selectedArtifactId]);

  useEffect(() => {
    if (selectedReportId && !aiReports.some((report) => report.id === selectedReportId)) {
      setSelectedReportId("");
    }
  }, [aiReports, selectedReportId]);

  const metrics = useMemo(() => {
    const totalComments = notes.reduce((sum, note) => sum + note.commentCount, 0);
    const avgLikes = notes.length ? Math.round(notes.reduce((sum, note) => sum + note.likedCount, 0) / notes.length) : 0;
    return {
      total: notesTotal,
      videos: notes.filter((note) => note.type === "video").length,
      avgLikes,
      totalComments,
      totalCollects: notes.reduce((sum, note) => sum + note.collectedCount, 0)
    };
  }, [notes, notesTotal]);

  async function run<T>(key: string, task: () => Promise<T>): Promise<T | undefined> {
    setBusy(key);
    setError("");
    try {
      return await task();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      if (key === "assistant-chat") {
        setAssistantError(message);
      }
      return undefined;
    } finally {
      setBusy("");
    }
  }

  async function saveCookie() {
    await run("auth", async () => {
      const status = await api.saveCookie(cookieFields);
      setAuth(status);
      setCookieFields({ a1: "", web_session: "", webId: "" });
      await refreshCore();
    });
  }

  async function autoReadCookie() {
    await run("auth", async () => {
      setAuth(await api.autoReadCookie());
      await refreshCore();
    });
  }

  async function refreshBrowserBridge() {
    setBusy("bridge-check");
    setError("");
    const savedStatus = await api.browserBridgeStatus().catch(() => ({ connected: false, browser: "unknown", permissionStatus: "unknown" }) satisfies BrowserBridgeStatus);
    try {
      const runtimeStatus = await callBrowserBridge<BrowserBridgeStatus>("ping", undefined, 1000);
      setBrowserBridge({
        ...savedStatus,
        ...runtimeStatus,
        connected: true,
        message: `已检测到${runtimeStatus.browser === "edge" ? " Edge" : runtimeStatus.browser === "chrome" ? " Chrome" : ""} 浏览器助手。`
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setBrowserBridge({
        ...savedStatus,
        connected: false,
        message: "未检测到浏览器助手扩展。",
        diagnostic: `请确认已在当前浏览器加载 browser-extension/xhs-bridge，并刷新本地运营台页面。${message ? ` (${message})` : ""}`
      });
    } finally {
      setBusy("");
    }
  }

  async function syncBrowserBridgeCookie() {
    setBusy("auth");
    setError("");
    try {
      const status = await callBrowserBridge<AuthStatus>("syncCookie", undefined, 15000);
      setAuth(status);
      setCookieFields({ a1: "", web_session: "", webId: "" });
      setBrowserBridge((current) => ({
        ...current,
        connected: true,
        lastSeenAt: new Date().toISOString(),
        lastSyncAt: new Date().toISOString(),
        permissionStatus: "granted",
        message: "已同步并验证当前浏览器的小红书登录态。",
        diagnostic: ""
      }));
      await refreshCore();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setBrowserBridge((current) => ({
        ...current,
        message: "同步登录态失败。",
        diagnostic: message
      }));
    } finally {
      setBusy("");
    }
  }

  async function openOriginalUrl(url: string) {
    try {
      await callBrowserBridge("openUrl", { url }, 1500);
      return;
    } catch {
      // Extension is optional. Fallback keeps original-post opening available.
    }
    await run("open-url", async () => {
      await api.openBrowserUrl({ url, mode: "auto" });
    });
  }

  async function createJob() {
    await run("job", async () => {
      const inputKeywords = keywords
        .split(/[,，\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
      const job = await api.createJob({ keywords: inputKeywords, sort, noteType, pages, commentPages, concurrency });
      setActiveJobId(job.id);
      setActiveKeywordScopeId("");
      setShowHistoryData(false);
      setActiveModule("overview");
      await refreshCore();
      await loadNotes();
    });
  }

  async function resumeJob() {
    if (!activeJobId) return;
    await run("resume", async () => {
      await api.resumeJob(activeJobId);
      await refreshCore();
    });
  }

  async function stopJob() {
    if (!activeJobId) return;
    await run("stop", async () => {
      await api.stopJob(activeJobId);
      await refreshCore();
    });
  }

  async function deleteSelectedNote() {
    if (!selected) return;
    await run("delete-note", async () => {
      await api.deleteNote(selected.id);
      await loadNotes();
      await loadAnalytics();
    });
  }

  async function refreshSelectedNoteMedia(noteId: string) {
    await run("media-refresh", async () => {
      await api.refreshNoteMedia(noteId);
      await loadNotes();
    });
  }

  async function openDatasetManager() {
    if (!activeJobId) return;
    await run("clear-preview", async () => {
      setDatasetClearPreview(await api.getNoteScopeClearPreview(activeJobId));
      setDeleteDatasetAiArtifacts(false);
      setDatasetManagerOpen(true);
    });
  }

  async function clearCurrentNotes() {
    if (!activeJobId) return;
    await run("clear-notes", async () => {
      await api.clearNotes(activeJobId, deleteDatasetAiArtifacts);
      setDatasetManagerOpen(false);
      setDatasetClearPreview(null);
      setDeleteDatasetAiArtifacts(false);
      setSelectedId("");
      await refreshCore();
      await loadNotes();
      await loadAnalytics();
    });
  }

  async function runHealthCheck() {
    if (!activeJobId) return;
    await run("health", async () => setHealth(await api.healthCheck(activeJobId)));
  }

  async function createPlan() {
    if (!selected) return;
    await run("reply-plan", async () => {
      await api.createReplyPlan({
        noteId: selected.id,
        strategy: replyStrategy,
        max: 10,
        template: replyTemplate
      });
      await loadOperations();
    });
  }

  async function approveAction(action: ReplyActionRecord) {
    await run(action.id, async () => {
      await api.approveReplyAction(action.id, action.content);
      await loadOperations();
    });
  }

  function openNewModel() {
    setEditingModelId("");
    setModelForm(emptyModelForm);
    setModelEditorOpen(true);
  }

  function openEditModel(model: AiModelConfig) {
    const providerPreset = findModelProviderPreset(model.provider, model.baseUrl, model.model);
    setEditingModelId(model.id);
    setModelForm({
      providerKey: providerPreset.key,
      name: model.name,
      provider: model.provider,
      baseUrl: model.baseUrl,
      model: model.model,
      apiKey: ""
    });
    setModelEditorOpen(true);
  }

  async function saveModel() {
    await run("model", async () => {
      const { providerKey: _providerKey, ...modelInput } = modelForm;
      const input = {
        ...modelInput,
        isDefault: editingModelId ? undefined : aiModels.length === 0,
        temperature: 0.4,
        maxTokens: 4000
      };
      if (editingModelId) {
        await api.updateAiModel(editingModelId, input);
      } else {
        await api.saveAiModel(input);
      }
      setEditingModelId("");
      setModelEditorOpen(false);
      setModelForm(emptyModelForm);
      await refreshCore();
    });
  }

  async function deleteModel(modelId: string) {
    await run(`delete-model-${modelId}`, async () => {
      await api.deleteAiModel(modelId);
      if (editingModelId === modelId) {
        setEditingModelId("");
        setModelEditorOpen(false);
        setModelForm(emptyModelForm);
      }
      await refreshCore();
    });
  }

  async function setDefaultModel(modelId: string) {
    await run(`default-model-${modelId}`, async () => {
      await api.setDefaultAiModel(modelId);
      await refreshCore();
    });
  }

  async function testModel(modelId: string) {
    const result = await run(`test-${modelId}`, () => api.testAiModel(modelId));
    if (result) {
      setModelMessages((messages) => ({ ...messages, [modelId]: result }));
      setError(result.ok ? "" : result.message);
    }
  }

  async function probeModelTools(modelId: string) {
    const result = await run(`tools-probe-${modelId}`, () => api.probeAiModelTools(modelId));
    if (result) {
      setModelMessages((messages) => ({ ...messages, [modelId]: { ok: result.ok, message: result.message } }));
      setError(result.ok ? "" : result.message);
    }
  }

  async function createReport() {
    if (!contextJobId) {
      setError("当前没有可用于分析的有效任务，请先创建并完成一次关键词抓取。");
      return;
    }
    await run("report", async () => {
      await api.createAiReport({ jobId: contextJobId, focus: reportFocus });
      await loadOperations();
      setActiveModule("ai");
    });
  }

  async function deleteReport(reportId: string) {
    await run(`delete-report-${reportId}`, async () => {
      await api.deleteAiReport(reportId);
      if (selectedReportId === reportId) {
        setSelectedReportId("");
      }
      await loadOperations();
    });
  }

  async function runWorkflow(workflowKey: AiWorkflowKey, focus?: string): Promise<AiArtifact | undefined> {
    const workflow = aiWorkflows.find((item) => item.key === workflowKey);
    if (workflow?.requires.includes("job") && !contextJobId) {
      setError("当前没有可用于分析的有效任务，请先创建并完成一次关键词抓取。");
      return undefined;
    }
    if (workflow?.requires.includes("note") && !selected) {
      setError("请先选择一篇笔记。");
      return undefined;
    }
    return await run(`workflow-${workflowKey}`, async () => {
      const artifact = await api.runAiWorkflow({
        workflowKey,
        jobId: contextJobId || undefined,
        noteId: selected?.id,
        modelId: selectedModel?.id,
        focus
      });
      setAiArtifacts((items) => [artifact, ...items.filter((item) => item.id !== artifact.id)]);
      setSelectedWorkflow(workflowKey);
      setSelectedArtifactId(artifact.id);
      setSelectedReportId("");
      setActiveModule("ai");
      await loadOperations();
      return artifact;
    });
  }

  async function runAssistantWorkflow(workflowKey: AiWorkflowKey, focus?: string): Promise<AiArtifact | undefined> {
    const workflow = aiWorkflows.find((item) => item.key === workflowKey);
    const title = workflow?.title ?? workflowKey;
    setAssistantMessages((messages) => [
      ...messages,
      {
        id: `assistant_workflow_start_${Date.now()}`,
        role: "assistant",
        content: `开始生成「${title}」，会使用当前任务和已入库笔记作为上下文。`,
        createdAt: new Date().toISOString()
      }
    ]);
    const artifact = await runWorkflow(workflowKey, focus);
    if (artifact) {
      setAssistantMessages((messages) => [
        ...messages,
        {
          id: `assistant_workflow_done_${artifact.id}`,
          role: "assistant",
          content: `「${artifact.title}」已生成，结果已放入 AI 工作台并自动打开。`,
          createdAt: new Date().toISOString()
        }
      ]);
    }
    return artifact;
  }

  async function sendAssistantMessage() {
    const content = assistantInput.trim();
    if (!content) return;
    setAssistantError("");
    const userMessage: AiAssistantMessage = {
      id: `local_${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date().toISOString()
    };
    setAssistantMessages((messages) => [...messages, userMessage]);
    setAssistantInput("");
    if (isControlledOrchestrationRequest(content)) {
      await run("assistant-chat", async () => {
        const orchestration = await api.createAiOrchestration({
          instruction: content,
          modelId: selectedModel?.id
        });
        setAiOrchestrations((items) => upsertById(items, orchestration));
        setActiveOrchestrationId(orchestration.id);
        setAssistantMessages((messages) => [
          ...messages,
          {
            id: `orch_msg_${orchestration.id}`,
            role: "assistant",
            content: `已创建 AI 编排会话：${orchestration.keywords.join(" / ")}。我会按步骤抓取关键词、等待笔记入库，并生成内容规划、爆款结构和评论需求分析。`,
            createdAt: new Date().toISOString()
          }
        ]);
        await loadOrchestrations();
      });
      return;
    }
    await run("assistant-chat", async () => {
      const response = await api.assistantChat({
        message: content,
        jobId: contextJobId || undefined,
        noteId: contextJobId ? selected?.id : undefined,
        modelId: selectedModel?.id,
        module: activeModule
      });
      if (!response.message) {
        throw new Error("AI 返回内容为空，请稍后重试或切换模型。");
      }
      setAssistantMessages((messages) => [...messages, response.message]);
      if (response.artifact) {
        setAiArtifacts((items) => [response.artifact as AiArtifact, ...items.filter((item) => item.id !== response.artifact?.id)]);
        setSelectedArtifactId(response.artifact.id);
        setSelectedReportId("");
      }
      await loadOperations();
    });
  }

  async function deleteArtifact(artifactId: string) {
    await run(`delete-artifact-${artifactId}`, async () => {
      await api.deleteAiArtifact(artifactId);
      if (selectedArtifactId === artifactId) {
        setSelectedArtifactId("");
      }
      await loadOperations();
    });
  }

  function openPromptCenter(key: AiWorkflowKey) {
    setSelectedPromptKey(key);
    setActiveModule("prompts");
  }

  async function savePrompt() {
    await run(`prompt-save-${selectedPromptKey}`, async () => {
      const detail = await api.saveAiPrompt(selectedPromptKey, promptDraft);
      setSelectedPrompt(detail);
      setPromptDraft(detail.customTemplate || detail.defaultTemplate);
      setAiPrompts(await api.listAiPrompts());
    });
  }

  async function resetPrompt() {
    await run(`prompt-reset-${selectedPromptKey}`, async () => {
      const detail = await api.resetAiPrompt(selectedPromptKey);
      setSelectedPrompt(detail);
      setPromptDraft(detail.defaultTemplate);
      setAiPrompts(await api.listAiPrompts());
    });
  }

  async function activatePrompt(source: AiPromptSource) {
    await run(`prompt-activate-${selectedPromptKey}-${source}`, async () => {
      const detail = await api.activateAiPrompt(selectedPromptKey, source);
      setSelectedPrompt(detail);
      setPromptDraft(detail.customTemplate || detail.defaultTemplate);
      setAiPrompts(await api.listAiPrompts());
    });
  }

  const visibleWorkflows = workflowsForModule(aiWorkflows, activeModule);
  const appStyle = { "--assistant-width": `${assistantWidth}px` } as CSSProperties;

  return (
    <main className={`ops-app ${assistantOpen ? "assistant-open" : ""}`} style={appStyle}>
      <aside className="side-nav">
        <div className="brand-lockup">
          <div className="brand-mark">小</div>
          <div>
            <strong>小红书运营台</strong>
            <span>redbook 深度抓取与分析</span>
          </div>
        </div>
        <nav className="module-list">
          {modules.map((item) => (
            <button
              key={item.key}
              className={activeModule === item.key ? "active" : ""}
              onClick={() => setActiveModule(item.key)}
              aria-label={item.label}
              aria-current={activeModule === item.key ? "page" : undefined}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className={`connection-card ${auth.connected ? "ok" : "warn"}`}>
          {auth.connected ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <div>
            <strong>{auth.connected ? auth.user?.nickname ?? "已连接" : auth.error ? "连接失效" : auth.configured ? "待验证" : "未连接"}</strong>
            <span>{auth.error ? formatAuthError(auth.error) : auth.checkedAt ? new Date(auth.checkedAt).toLocaleString() : "等待登录"}</span>
          </div>
        </div>
      </aside>

      <section className="workbench">
        <CompactTaskBar
          moduleLabel={modules.find((item) => item.key === activeModule)?.label ?? "工作台"}
          activeJob={contextJob}
          auth={auth}
          defaultModel={selectedModel}
          models={aiModels}
          selectedModelId={selectedModel?.id ?? ""}
          setSelectedModelId={setSelectedModelId}
          notesTotal={notesTotal}
          onRefresh={refreshCore}
          onOpenModels={() => setModelSettingsOpen(true)}
          onToggleAssistant={() => setAssistantOpen((open) => !open)}
          assistantOpen={assistantOpen}
          onNewSearch={() => setActiveModule("research")}
        />

        {error && (
          <div className="error-line">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {activeModule === "overview" && (
          <OverviewPage
            auth={auth}
            metrics={metrics}
            activeJob={activeJob}
            capabilities={capabilities}
            aiReports={aiReports}
            cookieFields={cookieFields}
            setCookieFields={setCookieFields}
            browserBridge={browserBridge}
            saveCookie={saveCookie}
            autoReadCookie={autoReadCookie}
            refreshBrowserBridge={refreshBrowserBridge}
            syncBrowserBridgeCookie={syncBrowserBridgeCookie}
            onResume={resumeJob}
            onStop={stopJob}
            busy={busy}
          />
        )}
        {activeModule === "research" && (
          <ResearchPage
            keywords={keywords}
            setKeywords={setKeywords}
            sort={sort}
            setSort={setSort}
            noteType={noteType}
            setNoteType={setNoteType}
            pages={pages}
            setPages={setPages}
            commentPages={commentPages}
            setCommentPages={setCommentPages}
            concurrency={concurrency}
            setConcurrency={setConcurrency}
            createJob={createJob}
            busy={busy}
            analytics={analytics}
            runWorkflow={runWorkflow}
          />
        )}
        {activeModule === "notes" && (
          <NotesPage
            jobs={jobs}
            noteScopes={noteScopes}
            notes={notes}
            selected={selected}
            query={query}
            setQuery={setQuery}
            authorQuery={authorQuery}
            setAuthorQuery={setAuthorQuery}
            minLikes={minLikes}
            setMinLikes={setMinLikes}
            resultType={resultType}
            setResultType={setResultType}
            resultSort={resultSort}
            setResultSort={setResultSort}
            setSelectedId={setSelectedId}
            page={notePage}
            total={notesTotal}
            totalPages={notesTotalPages}
            setPage={setNotePage}
            activeJobId={activeJobId}
            setActiveJobId={setActiveJobId}
            activeKeywordScopeId={activeKeywordScopeId}
            setActiveKeywordScopeId={setActiveKeywordScopeId}
            showHistoryData={showHistoryData}
            setShowHistoryData={setShowHistoryData}
            noteScopePanelOpen={noteScopePanelOpen}
            setNoteScopePanelOpen={setNoteScopePanelOpen}
            openDatasetManager={openDatasetManager}
            deleteSelectedNote={deleteSelectedNote}
            refreshNoteMedia={refreshSelectedNoteMedia}
            openOriginalUrl={openOriginalUrl}
            runWorkflow={runWorkflow}
            busy={busy}
          />
        )}
        {activeModule === "viral" && <ViralPage analytics={analytics} selected={selected} artifacts={aiArtifacts} runWorkflow={runWorkflow} busy={busy} />}
        {activeModule === "audience" && (
          <AudiencePage analytics={analytics} notes={notes} artifacts={aiArtifacts} runWorkflow={runWorkflow} busy={busy} />
        )}
        {activeModule === "competitors" && (
          <CompetitorsPage analytics={analytics} artifacts={aiArtifacts} runWorkflow={runWorkflow} busy={busy} />
        )}
        {activeModule === "comments" && (
          <CommentsPage
            notes={notes}
            selected={selected}
            setSelectedId={setSelectedId}
            replyStrategy={replyStrategy}
            setReplyStrategy={setReplyStrategy}
            replyTemplate={replyTemplate}
            setReplyTemplate={setReplyTemplate}
            createPlan={createPlan}
            replyPlans={replyPlans}
            replyActions={replyActions}
            approveAction={approveAction}
            busy={busy}
          />
        )}
        {activeModule === "prompts" && (
          <PromptCenterPage
            prompts={aiPrompts}
            selectedKey={selectedPromptKey}
            selectedPrompt={selectedPrompt}
            promptDraft={promptDraft}
            setPromptDraft={setPromptDraft}
            setSelectedKey={setSelectedPromptKey}
            artifacts={aiArtifacts}
            busy={busy}
            savePrompt={savePrompt}
            resetPrompt={resetPrompt}
            activatePrompt={activatePrompt}
            openArtifact={(artifactId) => {
              setSelectedArtifactId(artifactId);
              setSelectedReportId("");
              setActiveModule("ai");
            }}
          />
        )}
        {activeModule === "ai" && (
          <AiWorkbenchPage
            activeJob={contextJob}
            artifacts={aiArtifacts}
            reports={aiReports}
            reportFocus={reportFocus}
            setReportFocus={setReportFocus}
            createReport={createReport}
            deleteReport={deleteReport}
            deleteArtifact={deleteArtifact}
            selectedArtifactId={selectedArtifactId}
            setSelectedArtifactId={setSelectedArtifactId}
            selectedReportId={selectedReportId}
            setSelectedReportId={setSelectedReportId}
            prompts={aiPrompts}
            openPrompt={openPromptCenter}
            runWorkflow={runWorkflow}
            busy={busy}
          />
        )}
      </section>
      {modelSettingsOpen && (
        <ModelSettingsDrawer
          models={aiModels}
          modelForm={modelForm}
          setModelForm={setModelForm}
          editorOpen={modelEditorOpen}
          editingModelId={editingModelId}
          openNewModel={openNewModel}
          openEditModel={openEditModel}
          closeEditor={() => {
            setModelEditorOpen(false);
            setEditingModelId("");
            setModelForm(emptyModelForm);
          }}
          saveModel={saveModel}
          deleteModel={deleteModel}
          setDefaultModel={setDefaultModel}
          testModel={testModel}
          probeModelTools={probeModelTools}
          modelMessages={modelMessages}
          busy={busy}
          onClose={() => setModelSettingsOpen(false)}
        />
      )}
      {datasetManagerOpen && datasetClearPreview && (
        <DatasetManagerDialog
          preview={datasetClearPreview}
          deleteAiArtifacts={deleteDatasetAiArtifacts}
          setDeleteAiArtifacts={setDeleteDatasetAiArtifacts}
          busy={busy}
          onConfirm={clearCurrentNotes}
          onClose={() => {
            setDatasetManagerOpen(false);
            setDatasetClearPreview(null);
            setDeleteDatasetAiArtifacts(false);
          }}
        />
      )}
      {!assistantOpen && (
        <AiAssistantEntry onOpen={() => setAssistantOpen(true)} context={contextJob ? jobKeywordLabel(contextJob) : "先创建任务"} />
      )}
      <AiAssistantDrawer
        open={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        width={assistantWidth}
        setWidth={setAssistantWidth}
        messages={assistantMessages}
        input={assistantInput}
        setInput={setAssistantInput}
        sendMessage={sendAssistantMessage}
        models={aiModels}
        selectedModelId={selectedModel?.id ?? ""}
        setSelectedModelId={setSelectedModelId}
        guideDismissed={assistantGuideDismissed}
        dismissGuide={() => {
          setAssistantGuideDismissed(true);
          localStorage.setItem("xhs.assistantGuideDismissed", "true");
        }}
        activeJob={contextJob}
        hasContextJob={Boolean(contextJobId)}
        notesTotal={notesTotal}
        assistantError={assistantError}
        orchestrations={aiOrchestrations}
        activeOrchestrationId={activeOrchestrationId}
        onOpenModels={() => setModelSettingsOpen(true)}
        onNewSearch={() => setActiveModule("research")}
        onOpenJob={(jobId) => {
          setActiveJobId(jobId);
          setShowHistoryData(false);
          setActiveModule("overview");
        }}
        onOpenArtifacts={(artifactId) => {
          setSelectedArtifactId(artifactId);
          setSelectedReportId("");
          setActiveModule("ai");
        }}
        onRefresh={refreshCore}
        workflows={visibleWorkflows.length ? visibleWorkflows : aiWorkflows.slice(0, 4)}
        runWorkflow={runAssistantWorkflow}
        contextItems={[
          contextJob ? `任务：${jobKeywordLabel(contextJob)}` : "无有效任务",
          contextJob && selected ? `笔记：${selected.title}` : "未选择笔记",
          `笔记数：${notesTotal}`,
          selectedModel ? `模型：${selectedModel.name}` : "未配置模型"
        ]}
        busy={busy}
      />
    </main>
  );
}

function workflowsForModule(workflows: AiWorkflowDefinition[], module: ModuleKey): AiWorkflowDefinition[] {
  if (module === "overview") {
    return workflows.filter((workflow) => ["content-planning", "audience-insight", "competitor-analysis"].includes(workflow.key));
  }
  if (module === "ai") {
    return workflows.slice(0, 4);
  }
  return workflows.filter((workflow) => workflow.module === module);
}

function isContextJob(job?: SearchJob): job is SearchJob {
  if (!job) return false;
  if (job.status === "queued" || job.status === "running") return true;
  return job.progress.seeded > 0 || job.progress.total > 0 || job.progress.done > 0 || job.progress.pending > 0 || job.progress.error > 0;
}

function jobKeywordLabel(job: SearchJob): string {
  return job.keywords.filter(Boolean).join(" / ") || "未命名任务";
}

function ContextBadgeRow({ items }: { items: string[] }) {
  return (
    <div className="context-badges">
      {items.map((item) => <span key={item}>{item}</span>)}
    </div>
  );
}

function ModelPicker({
  models,
  selectedModelId,
  setSelectedModelId,
  label
}: {
  models: AiModelConfig[];
  selectedModelId: string;
  setSelectedModelId: (modelId: string) => void;
  label: string;
}) {
  return (
    <label className="model-picker">
      <span>{label}</span>
      <select value={selectedModelId} onChange={(event) => setSelectedModelId(event.target.value)} disabled={!models.length}>
        {!models.length && <option value="">未配置模型</option>}
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name} · {model.model}
          </option>
        ))}
      </select>
    </label>
  );
}

function CompactTaskBar({
  moduleLabel,
  activeJob,
  auth,
  defaultModel,
  models,
  selectedModelId,
  setSelectedModelId,
  notesTotal,
  onRefresh,
  onOpenModels,
  onToggleAssistant,
  assistantOpen,
  onNewSearch
}: {
  moduleLabel: string;
  activeJob?: SearchJob;
  auth: AuthStatus;
  defaultModel?: AiModelConfig;
  models: AiModelConfig[];
  selectedModelId: string;
  setSelectedModelId: (modelId: string) => void;
  notesTotal: number;
  onRefresh: () => Promise<void>;
  onOpenModels: () => void;
  onToggleAssistant: () => void;
  assistantOpen: boolean;
  onNewSearch: () => void;
}) {
  return (
    <header className="compact-taskbar">
      <div className="taskbar-title">
        <span>{moduleLabel}</span>
        <strong>{activeJob ? jobKeywordLabel(activeJob) : "未选择有效任务"}</strong>
      </div>
      <ContextBadgeRow
        items={[
          auth.connected ? "Cookie 已连接" : auth.error ? "连接失效" : "待验证",
          defaultModel ? `模型 ${defaultModel.name}` : "未配置模型",
          activeJob ? `并发 ${activeJob.concurrency ?? 2}` : "无有效任务",
          `笔记 ${notesTotal}`
        ]}
      />
      <div className="top-actions">
        <button className="ghost-button compact" onClick={() => void onRefresh()}>
          <RefreshCw size={15} />
          刷新
        </button>
        <button className="ghost-button compact" onClick={onOpenModels}>
          <Settings size={15} />
          模型设置
        </button>
        <ModelPicker models={models} selectedModelId={selectedModelId} setSelectedModelId={setSelectedModelId} label="模型" />
        <button className="ghost-button compact" onClick={onToggleAssistant}>
          <Sparkles size={15} />
          {assistantOpen ? "收起 AI" : "AI 助手"}
        </button>
        <button className="primary-button compact" onClick={onNewSearch}>
          <Search size={15} />
          新搜索
        </button>
      </div>
    </header>
  );
}

function WorkflowActionBar({
  workflows,
  busy,
  selectedWorkflow,
  onRun
}: {
  workflows: AiWorkflowDefinition[];
  busy: string;
  selectedWorkflow: AiWorkflowKey;
  onRun: RunWorkflow;
}) {
  return (
    <section className="workflow-bar">
      <div>
        <Sparkles size={16} />
        <strong>AI 快捷工作流</strong>
      </div>
      <div className="workflow-actions">
        {workflows.map((workflow) => (
          <button
            key={workflow.key}
            className={workflow.key === selectedWorkflow ? "ghost-button compact active" : "ghost-button compact"}
            onClick={() => void onRun(workflow.key)}
            disabled={busy === `workflow-${workflow.key}`}
          >
            {busy === `workflow-${workflow.key}` ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}
            {workflow.title}
          </button>
        ))}
      </div>
    </section>
  );
}

function OverviewPage({
  auth,
  metrics,
  activeJob,
  capabilities,
  aiReports,
  cookieFields,
  setCookieFields,
  browserBridge,
  saveCookie,
  autoReadCookie,
  refreshBrowserBridge,
  syncBrowserBridgeCookie,
  onResume,
  onStop,
  busy
}: {
  auth: AuthStatus;
  metrics: { total: number; videos: number; avgLikes: number; totalComments: number; totalCollects: number };
  activeJob?: SearchJob;
  capabilities: RedbookCapability[];
  aiReports: AiReport[];
  cookieFields: { a1: string; web_session: string; webId: string };
  setCookieFields: (value: { a1: string; web_session: string; webId: string }) => void;
  browserBridge: BrowserBridgeStatus;
  saveCookie: () => Promise<void>;
  autoReadCookie: () => Promise<void>;
  refreshBrowserBridge: () => Promise<void>;
  syncBrowserBridgeCookie: () => Promise<void>;
  onResume: () => Promise<void>;
  onStop: () => Promise<void>;
  busy: string;
}) {
  const progressAction =
    activeJob?.status === "running" ? (
      <button className="ghost-button compact danger" onClick={() => void onStop()} disabled={busy === "stop"}>
        {busy === "stop" ? <Loader2 className="spin" size={15} /> : <Square size={15} />}
        停止
      </button>
    ) : activeJob?.status === "paused" ? (
      <button className="ghost-button compact" onClick={() => void onResume()} disabled={busy === "resume"}>
        {busy === "resume" ? <Loader2 className="spin" size={15} /> : <Play size={15} />}
        恢复
      </button>
    ) : null;

  return (
    <div className="overview-frame">
      <section className="metric-row">
        <Metric icon={<Database size={18} />} label="笔记" value={formatNumber(metrics.total)} />
        <Metric icon={<Video size={18} />} label="视频" value={formatNumber(metrics.videos)} />
        <Metric icon={<TrendingUp size={18} />} label="平均点赞" value={formatNumber(metrics.avgLikes)} />
        <Metric icon={<MessageSquareReply size={18} />} label="总评论" value={formatNumber(metrics.totalComments)} />
        <Metric icon={<Library size={18} />} label="总收藏" value={formatNumber(metrics.totalCollects)} />
      </section>

      <section className="split-grid">
        <div className="surface">
          <SectionTitle icon={<Activity size={18} />} title="任务进度" action={progressAction} />
          {activeJob ? (
            <div className="job-progress">
              <div className="progress-line">
                <span>{activeJob.status}</span>
                <strong>{activeJob.progress.done}/{activeJob.progress.total}</strong>
              </div>
              <div className="progress-track">
                <span style={{ width: `${activeJob.progress.total ? (activeJob.progress.done / activeJob.progress.total) * 100 : 0}%` }} />
              </div>
              <div className="status-grid">
                <small>待处理 {activeJob.progress.pending}</small>
                <small>运行中 {activeJob.progress.running}</small>
                <small>错误 {activeJob.progress.error}</small>
                <small>并发 {activeJob.concurrency ?? 2}</small>
              </div>
              <ProgressBreakdown byKind={activeJob.progress.byKind} />
              {activeJob.breakerReason && <p className="risk-text">{formatBreakerReason(activeJob.breakerReason)}</p>}
            </div>
          ) : (
            <EmptyState text="还没有搜索任务" />
          )}
        </div>

        <AuthPanel
          auth={auth}
          cookieFields={cookieFields}
          setCookieFields={setCookieFields}
          browserBridge={browserBridge}
          saveCookie={saveCookie}
          autoReadCookie={autoReadCookie}
          refreshBrowserBridge={refreshBrowserBridge}
          syncBrowserBridgeCookie={syncBrowserBridgeCookie}
          busy={busy}
        />
      </section>

      <section className="split-grid wide">
        <div className="surface">
          <SectionTitle icon={<Layers size={18} />} title="redbook 功能接入" />
          <div className="capability-grid">
            {capabilities.slice(0, 9).map((item) => (
              <div key={item.key} className={`capability ${item.status}`}>
                <strong>{item.label}</strong>
                <span>{item.module}</span>
                <small>{statusLabel(item.status)}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="surface">
          <SectionTitle icon={<FileText size={18} />} title="最近报告" />
          <div className="report-list compact-list">
            {aiReports.slice(0, 4).map((report) => (
              <a key={report.id} href={`/api/ai/reports/${report.id}/export`}>
                <span>{report.title}</span>
                <small>{report.source === "ai" ? "AI" : "本地"} · {report.status}</small>
              </a>
            ))}
            {!aiReports.length && <EmptyState text="暂无报告" />}
          </div>
        </div>
      </section>
    </div>
  );
}

function ProgressBreakdown({ byKind }: { byKind?: SearchJob["progress"]["byKind"] }) {
  const rows = [
    ["read", "正文"],
    ["comments", "评论"],
    ["user", "作者"],
    ["user-posts", "作者作品"],
    ["analyze", "本地分析"]
  ] as const;

  if (!byKind) {
    return null;
  }

  return (
    <div className="progress-breakdown">
      <div className="progress-breakdown-head">
        <span>类型</span>
        <span>待</span>
        <span>运行</span>
        <span>完成</span>
        <span>错误</span>
        <span>总数</span>
      </div>
      {rows.map(([kind, label]) => {
        const item = byKind[kind] ?? { pending: 0, running: 0, done: 0, error: 0, total: 0 };
        return (
          <div className="progress-breakdown-row" key={kind}>
            <strong>{label}</strong>
            <span>{item.pending}</span>
            <span>{item.running}</span>
            <span>{item.done}</span>
            <span>{item.error}</span>
            <span>{item.total}</span>
          </div>
        );
      })}
    </div>
  );
}

function ResearchPage(props: {
  keywords: string;
  setKeywords: (value: string) => void;
  sort: SearchSort;
  setSort: (value: SearchSort) => void;
  noteType: NoteTypeFilter;
  setNoteType: (value: NoteTypeFilter) => void;
  pages: number;
  setPages: (value: number) => void;
  commentPages: number;
  setCommentPages: (value: number) => void;
  concurrency: number;
  setConcurrency: (value: number) => void;
  createJob: () => Promise<void>;
  busy: string;
  analytics: AnalyticsReport | null;
  runWorkflow: RunWorkflow;
}) {
  return (
    <div className="research-grid">
      <section className="surface command-surface">
        <SectionTitle
          icon={<Search size={18} />}
          title="关键词搜索"
          action={
            <button className="primary-button compact" onClick={() => void props.createJob()} disabled={props.busy === "job"}>
              {props.busy === "job" ? <Loader2 className="spin" size={15} /> : <Play size={15} />}
              开始抓取
            </button>
          }
        />
        <label className="field-stack">
          <span>关键词</span>
          <textarea value={props.keywords} onChange={(event) => props.setKeywords(event.target.value)} placeholder="请输入你想研究的小红书关键词，例如品牌名、产品词、场景词或人群词；可用逗号或换行分隔。" />
        </label>
        <div className="form-grid">
          <Select label="排序" value={props.sort} onChange={(value) => props.setSort(value as SearchSort)} options={[["popular", "热门"], ["general", "综合"], ["latest", "最新"]]} />
          <Select label="类型" value={props.noteType} onChange={(value) => props.setNoteType(value as NoteTypeFilter)} options={[["all", "全部"], ["image", "图文"], ["video", "视频"]]} />
          <NumberField label="页数" value={props.pages} min={1} max={10} onChange={props.setPages} />
          <NumberField label="评论页" value={props.commentPages} min={1} max={2} onChange={props.setCommentPages} />
          <NumberField label="并发" value={props.concurrency} min={1} max={2} onChange={props.setConcurrency} />
        </div>
        <div className="research-hints">
          <span>先搜索种子笔记，再按队列抓取正文、评论、作者和本地分析。</span>
          <span>建议并发 2，降低触发验证概率。</span>
        </div>
      </section>

      <section className="surface research-matrix-panel">
        <SectionTitle
          icon={<TrendingUp size={18} />}
          title="关键词矩阵"
          action={
            <button className="primary-button compact" onClick={() => void props.runWorkflow("content-planning")} disabled={props.busy === "workflow-content-planning"}>
              {props.busy === "workflow-content-planning" ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}
              生成内容策划
            </button>
          }
        />
        {props.analytics?.keywords.length ? (
          <div className="data-table">
            <div className="table-head">
              <span>关键词</span>
              <span>层级</span>
              <span>Top1</span>
              <span>机会分</span>
            </div>
            {props.analytics.keywords.slice(0, 10).map((item) => (
              <div className="table-row" key={item.keyword}>
                <strong>{item.keyword}</strong>
                <span>{item.tier}</span>
                <span>{formatNumber(item.top1Likes)}</span>
                <span>{formatNumber(item.opportunityScore)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="research-empty-guide">
            <strong>关键词矩阵会在抓取后生成</strong>
            <p>它用来判断每个关键词的热度、竞争密度和机会分。先在左侧输入关键词并开始抓取，系统会先拿搜索结果，再补正文、评论、作者和本地分析。</p>
            <div className="guide-steps">
              <span>1. 搜索关键词</span>
              <span>2. 抓取正文评论</span>
              <span>3. 看机会分</span>
              <span>4. 生成内容策划</span>
            </div>
          </div>
        )}
      </section>
      <section className="surface content-planning-panel">
        <SectionTitle icon={<Sparkles size={18} />} title="内容策划入口" />
        <div className="status-grid">
          <Metric label="样本笔记" value={String(props.analytics?.overview.notes ?? 0)} />
          <Metric label="平均点赞" value={formatNumber(props.analytics?.overview.avgLikes ?? 0)} />
          <Metric label="总评论" value={formatNumber(props.analytics?.overview.totalComments ?? 0)} />
        </div>
        <InsightPanel
          title="下一步"
          lines={[
            "抓取完成后优先看关键词机会分和收藏/点赞比。",
            "点击“生成内容策划”会使用当前启用的内容策划 Prompt。",
            "产物会自动进入 AI 工作台，可在 Prompt 中心查看它来自哪个 Prompt。"
          ]}
        />
      </section>
    </div>
  );
}

function NotesPage(props: {
  jobs: SearchJob[];
  noteScopes: NoteScopeSummary[];
  notes: NoteRecord[];
  selected: NoteRecord | null;
  query: string;
  setQuery: (value: string) => void;
  authorQuery: string;
  setAuthorQuery: (value: string) => void;
  minLikes: string;
  setMinLikes: (value: string) => void;
  resultType: NoteTypeFilter;
  setResultType: (value: NoteTypeFilter) => void;
  resultSort: SortMode;
  setResultSort: (value: SortMode) => void;
  setSelectedId: (value: string) => void;
  page: number;
  total: number;
  totalPages: number;
  setPage: (value: number) => void;
  activeJobId: string;
  setActiveJobId: (value: string) => void;
  activeKeywordScopeId: string;
  setActiveKeywordScopeId: (value: string) => void;
  showHistoryData: boolean;
  setShowHistoryData: (value: boolean) => void;
  noteScopePanelOpen: boolean;
  setNoteScopePanelOpen: (value: boolean) => void;
  openDatasetManager: () => Promise<void>;
  deleteSelectedNote: () => Promise<void>;
  refreshNoteMedia: (noteId: string) => Promise<void>;
  openOriginalUrl: (url: string) => Promise<void>;
  runWorkflow: RunWorkflow;
  busy: string;
}) {
  const clearDisabled = !props.activeJobId || props.busy === "clear-notes" || props.total === 0;
  const clearLabel = props.activeJobId ? "清空当前任务" : props.showHistoryData || props.activeKeywordScopeId ? "先选择单个任务" : "请选择任务";

  return (
    <div className="notes-layout">
      <section className="surface notes-panel">
        <SectionTitle
          icon={<Database size={18} />}
          title="笔记库"
          action={
            <button
              className="ghost-button compact danger"
              onClick={() => void props.openDatasetManager()}
              title={props.activeJobId ? "只清空当前选中任务关联的笔记" : "全部历史视图不能直接清空，请先选择单个任务"}
              disabled={clearDisabled}
            >
              {props.busy === "clear-notes" ? <Loader2 className="spin" size={15} /> : <Trash2 size={15} />}
              {props.activeJobId ? "管理当前数据集" : clearLabel}
            </button>
          }
        />
        <div className="filter-row">
          <label className="field-stack compact-field">
            <span>搜索</span>
            <input value={props.query} onChange={(event) => { props.setPage(1); props.setQuery(event.target.value); }} placeholder="标题、正文、关键词" />
          </label>
          <label className="field-stack compact-field">
            <span>作者</span>
            <input value={props.authorQuery} onChange={(event) => { props.setPage(1); props.setAuthorQuery(event.target.value); }} placeholder="作者昵称" />
          </label>
          <label className="field-stack compact-field">
            <span>最低赞</span>
            <input value={props.minLikes} onChange={(event) => { props.setPage(1); props.setMinLikes(event.target.value); }} placeholder="最低赞" />
          </label>
          <label className="field-stack compact-field">
            <span>类型</span>
            <select value={props.resultType} onChange={(event) => { props.setPage(1); props.setResultType(event.target.value as NoteTypeFilter); }}>
              <option value="all">全部</option>
              <option value="image">图文</option>
              <option value="video">视频</option>
            </select>
          </label>
          <label className="field-stack compact-field">
            <span>排序</span>
            <select value={props.resultSort} onChange={(event) => { props.setPage(1); props.setResultSort(event.target.value as SortMode); }}>
              <option value="hot">热度</option>
              <option value="likes">点赞</option>
              <option value="comments">评论</option>
              <option value="collects">收藏</option>
              <option value="latest">最新</option>
            </select>
          </label>
        </div>
        <NoteScopePicker
          scopes={props.noteScopes}
          jobs={props.jobs}
          activeJobId={props.activeJobId}
          setActiveJobId={props.setActiveJobId}
          activeKeywordScopeId={props.activeKeywordScopeId}
          setActiveKeywordScopeId={props.setActiveKeywordScopeId}
          showHistoryData={props.showHistoryData}
          setShowHistoryData={props.setShowHistoryData}
          pageReset={() => props.setPage(1)}
          open={props.noteScopePanelOpen}
          setOpen={props.setNoteScopePanelOpen}
        />
        <div className="note-list">
          {props.notes.map((note) => (
            <button
              key={note.id}
              className={`${props.selected?.id === note.id ? "note-row active" : "note-row"} ${note.desc ? "" : "pending-body"}`}
              onClick={() => props.setSelectedId(note.id)}
            >
              <NoteMediaThumb note={note} />
              <span className="note-main">
                <span className="note-type">{note.type === "video" ? "视频" : "图文"}</span>
                <strong>{note.title}</strong>
              </span>
              <small>{note.authorName ?? "未知作者"}</small>
              <span className="note-stats">
                {note.desc ? "已正文" : "待正文"} · 赞 {formatNumber(note.likedCount)} · 藏 {formatNumber(note.collectedCount)} · 评 {formatNumber(note.commentCount)}
              </span>
            </button>
          ))}
          {!props.notes.length && (
            <EmptyState
              title="当前筛选没有匹配笔记"
              text="可以调整标题/正文关键词、作者、最低赞或类型筛选；如果当前任务还没抓取完成，请先回到总览查看任务进度。"
              actionLabel="去话题研究新建任务"
              onAction={() => window.dispatchEvent(new CustomEvent("xhs:navigate", { detail: "research" }))}
            />
          )}
        </div>
        <div className="pagination-row">
          <span>共 {props.total} 条 · 第 {props.page}/{props.totalPages} 页</span>
          <div>
            <button className="ghost-button compact" onClick={() => props.setPage(Math.max(1, props.page - 1))} disabled={props.page <= 1}>
              <ChevronLeft size={15} />
              上一页
            </button>
            <button className="ghost-button compact" onClick={() => props.setPage(Math.min(props.totalPages, props.page + 1))} disabled={props.page >= props.totalPages}>
              下一页
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </section>
      <NoteDetail
        note={props.selected}
        onDelete={props.deleteSelectedNote}
        refreshNoteMedia={props.refreshNoteMedia}
        openOriginalUrl={props.openOriginalUrl}
        runWorkflow={props.runWorkflow}
        busy={props.busy}
      />
    </div>
  );
}

function NoteScopePicker(props: {
  scopes: NoteScopeSummary[];
  jobs: SearchJob[];
  activeJobId: string;
  setActiveJobId: (value: string) => void;
  activeKeywordScopeId: string;
  setActiveKeywordScopeId: (value: string) => void;
  showHistoryData: boolean;
  setShowHistoryData: (value: boolean) => void;
  pageReset: () => void;
  open: boolean;
  setOpen: (value: boolean) => void;
}) {
  const scopes = props.scopes.length ? props.scopes : buildFallbackNoteScopes(props.jobs);
  const allScope = scopes.find((scope) => scope.type === "all") ?? buildAllNoteScope(0);
  const keywordScopes = scopes.filter((scope) => scope.type === "keyword");
  const jobScopes = scopes.filter((scope) => scope.type === "job");
  const filledScopes = jobScopes.filter((scope) => scope.noteCount > 0);
  const emptyScopes = jobScopes.filter((scope) => scope.noteCount === 0);
  const currentScope = props.activeJobId
    ? jobScopes.find((scope) => scope.jobId === props.activeJobId)
    : props.activeKeywordScopeId
      ? keywordScopes.find((scope) => scope.id === props.activeKeywordScopeId)
    : props.showHistoryData
      ? allScope
      : undefined;
  const currentLabel = currentScope?.label ?? "暂不打开历史数据";
  const currentMeta = currentScope ? noteScopeMeta(currentScope) : "不会加载历史笔记，适合从新任务开始";

  const chooseNone = () => {
    props.pageReset();
    props.setActiveJobId("");
    props.setActiveKeywordScopeId("");
    props.setShowHistoryData(false);
    props.setOpen(false);
  };

  const chooseAll = () => {
    props.pageReset();
    props.setActiveJobId("");
    props.setActiveKeywordScopeId("");
    props.setShowHistoryData(true);
    props.setOpen(false);
  };

  const chooseKeyword = (scopeId: string) => {
    props.pageReset();
    props.setActiveJobId("");
    props.setActiveKeywordScopeId(scopeId);
    props.setShowHistoryData(false);
    props.setOpen(false);
  };

  const chooseJob = (jobId: string) => {
    props.pageReset();
    props.setActiveKeywordScopeId("");
    props.setShowHistoryData(false);
    props.setActiveJobId(jobId);
    props.setOpen(false);
  };

  return (
    <div className="note-scope-bar">
      <div className="note-scope-current">
        <button className="note-scope-trigger" type="button" onClick={() => props.setOpen(!props.open)} aria-expanded={props.open}>
          <span>数据范围</span>
          <strong>{currentLabel}</strong>
          <small>{currentMeta}</small>
        </button>
        <div className="note-scope-actions">
          <button className="ghost-button compact" type="button" onClick={chooseNone}>
            暂不打开历史
          </button>
          <button className="ghost-button compact" type="button" onClick={chooseAll}>
            全部历史 {formatNumber(allScope.noteCount)}
          </button>
        </div>
      </div>
      {!props.activeJobId && !props.activeKeywordScopeId && !props.showHistoryData && (
        <p className="muted-line">历史笔记默认收起。选择某个任务可查看其入库笔记，选择全部历史可跨任务检索。</p>
      )}
      {props.open && (
        <div className="note-scope-popover" role="dialog" aria-label="选择笔记数据范围">
          <div className="note-scope-section">
            <span className="scope-section-title">常用范围</span>
            <ScopeOption scope={allScope} active={props.showHistoryData && !props.activeJobId} onClick={chooseAll} />
          </div>
          <div className="note-scope-section">
            <span className="scope-section-title">有笔记的历史任务</span>
            <div className="note-scope-list">
              {filledScopes.map((scope) => (
                <ScopeOption key={scope.id} scope={scope} active={scope.jobId === props.activeJobId} onClick={() => scope.jobId && chooseJob(scope.jobId)} />
              ))}
              {!filledScopes.length && <span className="scope-empty-line">暂无已入库的历史任务</span>}
            </div>
          </div>
          {!!keywordScopes.length && (
            <div className="note-scope-section">
              <span className="scope-section-title">重复关键词组</span>
              <div className="note-scope-list">
                {keywordScopes.map((scope) => (
                  <ScopeOption key={scope.id} scope={scope} active={scope.id === props.activeKeywordScopeId} onClick={() => chooseKeyword(scope.id)} />
                ))}
              </div>
            </div>
          )}
          {!!emptyScopes.length && (
            <details className="note-scope-empty-group">
              <summary>空任务 / 抓取失败任务 {emptyScopes.length}</summary>
              <div className="note-scope-list compact">
                {emptyScopes.map((scope) => (
                  <ScopeOption key={scope.id} scope={scope} active={scope.jobId === props.activeJobId} onClick={() => scope.jobId && chooseJob(scope.jobId)} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function ScopeOption(props: { scope: NoteScopeSummary; active: boolean; onClick: () => void }) {
  return (
    <button className={`note-scope-option ${props.active ? "active" : ""}`} type="button" onClick={props.onClick}>
      <span>
        <strong>{props.scope.label}</strong>
        <small>{noteScopeMeta(props.scope)}</small>
      </span>
      <span className="scope-badges">
        {props.scope.isDuplicate && <em>重复 {props.scope.duplicateCount}</em>}
        {props.scope.status && <em>{jobStatusLabel(props.scope.status)}</em>}
        {props.active && <CheckCircle2 size={15} />}
      </span>
      {props.scope.emptyReason && <small className="scope-reason">{props.scope.emptyReason}</small>}
    </button>
  );
}

function buildFallbackNoteScopes(jobs: SearchJob[]): NoteScopeSummary[] {
  return [
    buildAllNoteScope(0),
    ...jobs.map((job) => ({
      id: job.id,
      type: "job" as const,
      jobId: job.id,
      label: jobKeywordLabel(job),
      keywords: job.keywords,
      status: job.status,
      noteCount: 0,
      queueTotal: job.progress.total,
      queueErrors: job.progress.error,
      aiArtifactCount: 0,
      aiReportCount: 0,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      duplicateCount: 1,
      isDuplicate: false,
      emptyReason: "等待范围摘要加载"
    }))
  ];
}

function buildAllNoteScope(noteCount: number): NoteScopeSummary {
  return {
    id: "__all__",
    type: "all",
    label: "全部历史笔记",
    keywords: [],
    noteCount,
    queueTotal: 0,
    queueErrors: 0,
    aiArtifactCount: 0,
    aiReportCount: 0,
    duplicateCount: 0,
    isDuplicate: false
  };
}

function noteScopeMeta(scope: NoteScopeSummary): string {
  const parts = [`${formatNumber(scope.noteCount)} 条笔记`];
  if (scope.queueErrors) parts.push(`${formatNumber(scope.queueErrors)} 个错误`);
  const aiCount = scope.aiArtifactCount + scope.aiReportCount;
  if (aiCount) parts.push(`${formatNumber(aiCount)} 个 AI 产物`);
  if (scope.updatedAt) parts.push(formatDateTime(scope.updatedAt));
  return parts.join(" · ");
}

function jobStatusLabel(status: SearchJob["status"]): string {
  const labels: Record<SearchJob["status"], string> = {
    queued: "等待",
    running: "运行中",
    paused: "暂停",
    completed: "完成",
    failed: "失败"
  };
  return labels[status];
}

function NoteMediaThumb({ note }: { note: NoteRecord }) {
  const imageUrl = noteMediaImages(note)[0];
  if (note.videoUrl) {
    return (
      <span className="note-thumb video-thumb">
        <video src={mediaProxyUrl(note.videoUrl, note.id, "video")} poster={mediaProxyUrl(note.coverUrl || imageUrl, note.id, "image", 0)} preload="metadata" muted playsInline />
        <Video size={16} />
      </span>
    );
  }
  if (imageUrl) {
    return (
      <span className="note-thumb">
        <img src={mediaProxyUrl(imageUrl, note.id, "image", 0)} alt="" loading="lazy" />
      </span>
    );
  }
  return (
    <span className="note-thumb empty-thumb">
      <ImageIcon size={18} />
    </span>
  );
}

function noteMediaImages(note: NoteRecord): string[] {
  return [...new Set([...(note.imageUrls ?? []), note.coverUrl].filter(isDisplayImageUrl))];
}

function mediaProxyUrl(url: string | undefined, noteId?: string, kind?: "image" | "video", index?: number): string | undefined {
  const trimmed = url?.trim();
  if (!trimmed) {
    return undefined;
  }
  const params = new URLSearchParams({ url: trimmed });
  if (noteId) {
    params.set("noteId", noteId);
  }
  if (kind) {
    params.set("kind", kind);
  }
  if (index !== undefined) {
    params.set("index", String(index));
  }
  return `/api/media?${params.toString()}`;
}

function isDisplayImageUrl(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim()) && !isVideoMediaUrl(value);
}

function isVideoMediaUrl(url: string): boolean {
  return /\.(mp4|m3u8|mov)(\?|#|$)/i.test(url) || /\/stream\//i.test(url);
}

function contentTypeLabel(type?: string): string {
  if (type === "reference") return "资料收藏型";
  if (type === "insight") return "观点洞察型";
  if (type === "entertainment") return "情绪传播型";
  return "未归类";
}

function discussionTypeLabel(type?: string): string {
  if (type === "discussion") return "高讨论型";
  if (type === "normal") return "普通讨论型";
  if (type === "passive") return "低讨论型";
  return "未归类";
}

function percentLabel(value?: number): string {
  return `${Math.round((value ?? 0) * 100)}%`;
}

function ViralPage({
  analytics,
  selected,
  artifacts,
  runWorkflow,
  busy
}: {
  analytics: AnalyticsReport | null;
  selected: NoteRecord | null;
  artifacts: AiArtifact[];
  runWorkflow: RunWorkflow;
  busy: string;
}) {
  const latestDeepDive = artifacts.find((artifact) => artifact.workflowKey === "viral-deep-dive");
  const latestTemplate = artifacts.find((artifact) => artifact.workflowKey === "viral-template");
  return (
    <div className="viral-layout">
      <section className="surface viral-template-panel">
        <SectionTitle
          icon={<Flame size={18} />}
          title="爆款样本库"
          action={
            <button className="primary-button compact" onClick={() => void runWorkflow("viral-template")} disabled={busy === "workflow-viral-template"}>
              {busy === "workflow-viral-template" ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}
              生成模板库
            </button>
          }
        />
        <p className="panel-note">按本地爆款分排序，先找值得拆的样本，再让 AI 提炼可复用标题公式和正文框架。</p>
        <div className="template-list">
          {analytics?.templates.map((item) => (
            <div key={item.noteId} className="template-item">
              <strong>{item.title}</strong>
              <span>爆款分 {item.score} · {contentTypeLabel(item.contentType)}</span>
              <div>{item.hookPatterns.map((hook) => <em key={hook}>{hook}</em>)}</div>
            </div>
          ))}
          {!analytics?.templates.length && <EmptyState text="抓取完成后，这里会列出高潜爆款样本" />}
        </div>
      </section>
      <section className="surface viral-current-panel">
        <SectionTitle
          icon={<Sparkles size={18} />}
          title="当前笔记拆解"
          action={
            <button className="primary-button compact" onClick={() => void runWorkflow("viral-deep-dive")} disabled={!selected || busy === "workflow-viral-deep-dive"}>
              {busy === "workflow-viral-deep-dive" ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}
              AI 深度拆解
            </button>
          }
        />
        {selected?.analysis ? (
          <div className="viral-current-scroll">
            <div className="selected-note-summary">
              <span>来自笔记库当前选中笔记</span>
              <strong>{selected.title || "未命名笔记"}</strong>
              <small>{selected.authorName ?? "未知作者"} · {selected.type === "video" ? "视频" : "图文"}</small>
            </div>
            <div className="analysis-grid">
              <Metric label="爆款分" value={String(selected.analysis.score)} />
              <Metric label="收藏/赞" value={percentLabel(selected.analysis.collectLikeRatio)} />
              <Metric label="评论/赞" value={percentLabel(selected.analysis.commentLikeRatio)} />
              <Metric label="作者倍数" value={`${selected.analysis.viralMultiplier}x`} />
            </div>
            <div className="score-explain">
              <strong>爆款分怎么算</strong>
              <p>本地规则会综合标题钩子、收藏/点赞比、评论/点赞比、相对作者过往表现、评论主题数量和正文完整度，压缩成 0-100 分。它用于筛选“值得进一步拆解”的样本，不等同于平台官方推荐分。</p>
            </div>
            <div className="insight-panel">
              <strong>结构判断</strong>
              <p>内容类型：{contentTypeLabel(selected.analysis.contentType)}；讨论类型：{discussionTypeLabel(selected.analysis.discussionType)}</p>
              <p>标题钩子：{selected.analysis.hookPatterns.join("、") || "暂无明显钩子"}</p>
              <p>复刻方向：保留用户能立即理解的冲突点，正文补足清单、步骤或真实案例，再用评论区高频问题做续篇。</p>
            </div>
            <div className="theme-cloud labeled">
              {selected.analysis.commentThemes.map((theme) => (
                <span key={theme.keyword}>{theme.keyword} · {theme.count}</span>
              ))}
              {!selected.analysis.commentThemes.length && <span>评论主题不足，建议继续抓取评论后再判断。</span>}
            </div>
          </div>
        ) : (
          <EmptyState text="先在笔记库选择一篇已抓取正文和评论的笔记，这里会显示它的爆款结构" />
        )}
      </section>
      <section className="surface viral-ai-panel">
        <SectionTitle icon={<Bot size={18} />} title="AI 深度拆解与大模板" />
        {latestDeepDive ? (
          <MarkdownView content={latestDeepDive.markdown} compact />
        ) : latestTemplate ? (
          <MarkdownView content={latestTemplate.markdown} compact />
        ) : selected?.analysis ? (
          <div className="viral-ai-empty">
            <InsightPanel
              title="建议下一步"
              lines={[
                "点击“AI 深度拆解”会围绕当前选中笔记生成爆点、标题钩子、正文结构、评论心理和可复刻 brief。",
                "点击“生成模板库”会从多篇高分样本里提炼标题公式、正文框架和选题复用方式。",
                "AI 产物会进入 AI 工作台，并标记它使用的 Prompt，后续可以继续编辑 Prompt 再生成。"
              ]}
            />
          </div>
        ) : (
          <EmptyState text="选择一篇笔记后，可以生成单篇深拆或整组爆款模板" />
        )}
      </section>
    </div>
  );
}

function AudiencePage({
  analytics,
  notes,
  artifacts,
  runWorkflow,
  busy
}: {
  analytics: AnalyticsReport | null;
  notes: NoteRecord[];
  artifacts: AiArtifact[];
  runWorkflow: RunWorkflow;
  busy: string;
}) {
  const themes = notes.flatMap((note) => note.analysis?.commentThemes ?? []).slice(0, 18);
  const latest = artifacts.find((artifact) => artifact.workflowKey === "audience-insight");
  const topQuestions = themes.slice(0, 8);
  return (
    <div className="module-frame audience-layout">
      <section className="surface audience-signal-panel">
        <SectionTitle
          icon={<HeartHandshake size={18} />}
          title="受众需求信号"
          action={
            <button className="primary-button compact" onClick={() => void runWorkflow("audience-insight")} disabled={busy === "workflow-audience-insight"}>
              {busy === "workflow-audience-insight" ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}
              生成洞察
            </button>
          }
        />
        <div className="status-grid">
          <Metric label="样本笔记" value={String(analytics?.overview.notes ?? notes.length)} />
          <Metric label="总评论" value={formatNumber(analytics?.overview.totalComments ?? 0)} />
          <Metric label="高频主题" value={String(themes.length)} />
        </div>
        <div className="audience-signal-grid">
          <div className="signal-card">
            <strong>高频痛点</strong>
            <div className="theme-cloud compact-cloud">
              {topQuestions.map((theme, index) => <span key={`${theme.keyword}-${index}`}>{theme.keyword} · {theme.count}</span>)}
              {!topQuestions.length && <span>等待评论主题</span>}
            </div>
          </div>
          <div className="signal-card">
            <strong>运营怎么用</strong>
            <p>把高频词拆成 FAQ、避坑、对比和经验复盘四类选题；评论越集中，越适合做系列内容。</p>
          </div>
          <div className="signal-card">
            <strong>下一步</strong>
            <p>生成受众洞察后，右侧会输出用户画像、痛点聚类、用户原话和人工回复策略。</p>
          </div>
        </div>
      </section>
      <section className="surface analysis-report-panel">
        <SectionTitle icon={<Bot size={18} />} title="AI 人群画像" />
        <div className="analysis-report-body">
          {latest ? <MarkdownView content={latest.markdown} /> : <EmptyState text="运行受众洞察后生成画像、痛点、用户原话和内容机会" />}
        </div>
      </section>
    </div>
  );
}

function CompetitorsPage({
  analytics,
  artifacts,
  runWorkflow,
  busy
}: {
  analytics: AnalyticsReport | null;
  artifacts: AiArtifact[];
  runWorkflow: RunWorkflow;
  busy: string;
}) {
  const latest = artifacts.find((artifact) => artifact.workflowKey === "competitor-analysis");
  const hasAuthors = Boolean(analytics?.authors.length);
  return (
    <div className="module-frame competitor-layout">
      <section className="surface competitor-list-panel">
        <SectionTitle
          icon={<Layers size={18} />}
          title="竞品作者榜"
          action={
            <button className="primary-button compact" onClick={() => void runWorkflow("competitor-analysis")} disabled={busy === "workflow-competitor-analysis"}>
              {busy === "workflow-competitor-analysis" ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}
              生成竞品报告
            </button>
          }
        />
        <p className="panel-note">优先看“粉丝规模 + 最高赞 + 爆发倍数”，不要只按单篇爆款判断账号能力。</p>
        {hasAuthors ? (
          <div className="data-table competitor-table">
            <div className="table-head author-table">
              <span>作者</span>
              <span>粉丝</span>
              <span>作品</span>
              <span>最高赞</span>
              <span>爆发倍数</span>
            </div>
            {analytics?.authors.slice(0, 12).map((author) => (
              <div className="table-row author-table" key={author.authorId}>
                <strong>{author.nickname}</strong>
                <span>{formatNumber(author.fansCount)}</span>
                <span>{author.noteCount}</span>
                <span>{formatNumber(author.maxLikes)}</span>
                <span>{author.breakoutRatio}x</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="research-empty-guide">
            <strong>等待作者与作者作品数据</strong>
            <p>完成搜索与详情抓取后，这里会按作者维度汇总粉丝、作品数、最高赞和爆发倍数，用来判断头部作者、腰部机会和新号切入空间。</p>
            <div className="guide-steps">
              <span>1. 抓取笔记</span>
              <span>2. 补作者信息</span>
              <span>3. 看作者榜</span>
              <span>4. 生成竞品报告</span>
            </div>
          </div>
        )}
      </section>
      <section className="surface analysis-report-panel">
        <SectionTitle icon={<Bot size={18} />} title="AI 竞品判断" />
        <div className="analysis-report-body">
          {latest ? <MarkdownView content={latest.markdown} /> : <EmptyState text="运行竞品分析后生成账号分层、内容支柱、爆款差异和追赶机会" />}
        </div>
      </section>
    </div>
  );
}

function InsightPanel({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="insight-panel">
      <strong>{title}</strong>
      {lines.map((line) => <p key={line}>{line}</p>)}
    </div>
  );
}

function MarkdownView({ content, compact = false }: { content: string; compact?: boolean }) {
  const lines = content.split(/\r?\n/);
  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.trimStart().startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? "").trimStart().startsWith("```")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }
      index += 1;
      nodes.push(<pre key={`code-${index}`}><code>{codeLines.join("\n")}</code></pre>);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      nodes.push(renderHeading(heading[1].length, heading[2], `heading-${index}`));
      index += 1;
      continue;
    }

    if (isTableLine(line) && isTableSeparator(lines[index + 1] ?? "")) {
      const tableLines = [line];
      index += 2;
      while (index < lines.length && isTableLine(lines[index] ?? "")) {
        tableLines.push(lines[index] ?? "");
        index += 1;
      }
      nodes.push(renderMarkdownTable(tableLines, `table-${index}`));
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quotes: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index] ?? "")) {
        quotes.push((lines[index] ?? "").replace(/^>\s?/, ""));
        index += 1;
      }
      nodes.push(<blockquote key={`quote-${index}`}>{quotes.map((quote, quoteIndex) => <p key={quoteIndex}>{renderInline(quote)}</p>)}</blockquote>);
      continue;
    }

    if (/^\s*([-*])\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (index < lines.length) {
        const current = lines[index] ?? "";
        const match = ordered ? current.match(/^\s*\d+\.\s+(.+)$/) : current.match(/^\s*[-*]\s+(.+)$/);
        if (!match) break;
        items.push(match[1]);
        index += 1;
      }
      const children = items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>);
      nodes.push(ordered ? <ol key={`list-${index}`}>{children}</ol> : <ul key={`list-${index}`}>{children}</ul>);
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length && lines[index]?.trim() && !isMarkdownBlockStart(lines[index] ?? "", lines[index + 1] ?? "")) {
      paragraph.push(lines[index] ?? "");
      index += 1;
    }
    nodes.push(<p key={`paragraph-${index}`}>{renderInline(paragraph.join(" "))}</p>);
  }

  return <div className={compact ? "markdown-view compact" : "markdown-view"}>{nodes.length ? nodes : <p>暂无内容</p>}</div>;
}

function renderHeading(level: number, text: string, key: string): ReactNode {
  const children = renderInline(text);
  if (level === 1) return <h1 key={key}>{children}</h1>;
  if (level === 2) return <h2 key={key}>{children}</h2>;
  if (level === 3) return <h3 key={key}>{children}</h3>;
  return <h4 key={key}>{children}</h4>;
}

function renderMarkdownTable(lines: string[], key: string): ReactNode {
  const rows = lines.map(parseTableCells).filter((cells) => cells.length > 0);
  const [head = [], ...body] = rows;
  return (
    <div className="markdown-table-wrap" key={key}>
      <table>
        <thead>
          <tr>{head.map((cell, index) => <th key={index}>{renderInline(cell)}</th>)}</tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{renderInline(cell)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function renderInline(text: string): ReactNode[] {
  return renderInlineTokens(text, "inline");
}

function renderInlineTokens(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)|\*\*([^*\n]+?)\*\*|__([^_\n]+?)__|~~([^~\n]+?)~~|\*([^*\n]+?)\*|(?<![A-Za-z0-9])_([^_\n]+?)_(?![A-Za-z0-9])/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      nodes.push(<code key={`${keyPrefix}-code-${match.index}`}>{match[1]}</code>);
    } else if (match[2] && match[3]) {
      nodes.push(<a key={`${keyPrefix}-link-${match.index}`} href={match[3]} target="_blank" rel="noreferrer">{renderInlineTokens(match[2], `${keyPrefix}-link-${match.index}`)}</a>);
    } else if (match[4] || match[5]) {
      nodes.push(<strong key={`${keyPrefix}-strong-${match.index}`}>{renderInlineTokens(match[4] ?? match[5] ?? "", `${keyPrefix}-strong-${match.index}`)}</strong>);
    } else if (match[6]) {
      nodes.push(<del key={`${keyPrefix}-del-${match.index}`}>{renderInlineTokens(match[6], `${keyPrefix}-del-${match.index}`)}</del>);
    } else if (match[7] || match[8]) {
      nodes.push(<em key={`${keyPrefix}-em-${match.index}`}>{renderInlineTokens(match[7] ?? match[8] ?? "", `${keyPrefix}-em-${match.index}`)}</em>);
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes.length ? nodes : [text];
}

function isMarkdownBlockStart(line: string, nextLine: string): boolean {
  return Boolean(
    line.trimStart().startsWith("```") ||
      /^(#{1,6})\s+/.test(line) ||
      /^>\s?/.test(line) ||
      /^\s*([-*])\s+/.test(line) ||
      /^\s*\d+\.\s+/.test(line) ||
      (isTableLine(line) && isTableSeparator(nextLine))
  );
}

function isTableLine(line: string): boolean {
  return line.includes("|") && line.split("|").filter((cell) => cell.trim()).length >= 2;
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function parseTableCells(line: string): string[] {
  return line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((cell) => cell.trim());
}

function PromptCenterPage({
  prompts,
  selectedKey,
  selectedPrompt,
  promptDraft,
  setPromptDraft,
  setSelectedKey,
  artifacts,
  busy,
  savePrompt,
  resetPrompt,
  activatePrompt,
  openArtifact
}: {
  prompts: AiPromptInfo[];
  selectedKey: AiWorkflowKey;
  selectedPrompt: AiPromptDetail | null;
  promptDraft: string;
  setPromptDraft: (value: string) => void;
  setSelectedKey: (value: AiWorkflowKey) => void;
  artifacts: AiArtifact[];
  busy: string;
  savePrompt: () => Promise<void>;
  resetPrompt: () => Promise<void>;
  activatePrompt: (source: AiPromptSource) => Promise<void>;
  openArtifact: (artifactId: string) => void;
}) {
  const relatedArtifacts = artifacts.filter((artifact) => artifact.promptKey === selectedKey);
  return (
    <div className="prompt-center-grid">
      <section className="surface prompt-list-panel">
        <SectionTitle icon={<KeyRound size={18} />} title="Prompt 中心" />
        <div className="prompt-card-list">
          {prompts.map((prompt) => (
            <button
              key={prompt.key}
              className={prompt.key === selectedKey ? "prompt-card active" : "prompt-card"}
              onClick={() => setSelectedKey(prompt.key)}
            >
              <div>
                <strong>{prompt.title}</strong>
                <span>{prompt.promptSource === "custom" ? "自定义启用" : "默认启用"}</span>
              </div>
              <small>{prompt.version} · 产物 {prompt.artifactCount ?? 0}</small>
              <small>{prompt.lastUsedAt ? `最近使用 ${new Date(prompt.lastUsedAt).toLocaleString()}` : "尚未使用"}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="surface prompt-editor-panel">
        <SectionTitle
          icon={<FileText size={18} />}
          title={selectedPrompt ? `${selectedPrompt.title} Prompt` : "Prompt 详情"}
        />
        {selectedPrompt ? (
          <div className="prompt-editor-layout">
            <div className="prompt-control-panel">
              <div className="prompt-control-head">
                <div>
                  <strong>{selectedPrompt.title}</strong>
                  <span>当前：{selectedPrompt.promptSource === "custom" ? "自定义 Prompt" : "默认 Prompt"} · {selectedPrompt.version} · 产物 {selectedPrompt.artifactCount ?? 0}</span>
                </div>
                <div className="button-row">
                  <button className="ghost-button compact" onClick={() => void activatePrompt("default")} disabled={busy.startsWith("prompt-activate")}>
                    默认启用
                  </button>
                  <button className="ghost-button compact" onClick={() => void activatePrompt("custom")} disabled={!selectedPrompt.customTemplate || busy.startsWith("prompt-activate")}>
                    自定义启用
                  </button>
                  <button className="ghost-button compact danger" onClick={() => void resetPrompt()} disabled={busy === `prompt-reset-${selectedKey}`}>
                    <RefreshCw size={14} />
                    恢复默认
                  </button>
                  <button className="primary-button compact" onClick={() => void savePrompt()} disabled={!promptDraft.trim() || busy === `prompt-save-${selectedKey}`}>
                    {busy === `prompt-save-${selectedKey}` ? <Loader2 className="spin" size={14} /> : <CheckCircle2 size={14} />}
                    保存
                  </button>
                </div>
              </div>
              <div className="prompt-helper-grid">
                <div>
                  <strong>可用变量</strong>
                  <div className="variable-list">
                    {selectedPrompt.variables.map((variable) => (
                      <span key={variable.key} title={variable.description}>{`{${variable.key}}`} · {variable.label}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <strong>输出结构</strong>
                  <div className="variable-list">
                    {selectedPrompt.outputSections.map((section) => <span key={section}>{section}</span>)}
                  </div>
                </div>
              </div>
            </div>
            <div className="prompt-text-panel">
              <div className="panel-subhead">
                <strong>Prompt 正文</strong>
                <span>修改后点击保存，再选择自定义启用。</span>
              </div>
              <textarea className="prompt-editor" value={promptDraft} onChange={(event) => setPromptDraft(event.target.value)} />
            </div>
          </div>
        ) : (
          <EmptyState text="选择一个 Prompt 查看和编辑" />
        )}
      </section>

      <section className="surface prompt-artifacts-panel">
        <SectionTitle icon={<Bot size={18} />} title="关联 AI 产物" />
        <div className="compact-list">
          {relatedArtifacts.slice(0, 10).map((artifact) => (
            <button key={artifact.id} className="compact-list-row" onClick={() => openArtifact(artifact.id)}>
              <strong>{artifact.title}</strong>
              <small>{artifact.promptSource === "custom" ? "自定义 Prompt" : "默认 Prompt"} · {new Date(artifact.createdAt).toLocaleString()}</small>
            </button>
          ))}
          {!relatedArtifacts.length && <EmptyState text="这个 Prompt 暂无关联产物" />}
        </div>
      </section>
    </div>
  );
}

function ArtifactList({
  artifacts,
  selectedId,
  selectArtifact,
  busy,
  deleteArtifact
}: {
  artifacts: AiArtifact[];
  selectedId: string;
  selectArtifact: (artifactId: string) => void;
  busy: string;
  deleteArtifact: (artifactId: string) => Promise<void>;
}) {
  return (
    <div className="artifact-list">
      {artifacts.map((artifact) => (
        <div key={artifact.id} className={artifact.id === selectedId ? "artifact-row active" : "artifact-row"}>
          <div>
            <strong>{artifact.title}</strong>
            <small>{artifact.source === "ai" ? "AI 生成" : "本地规则"} · {new Date(artifact.createdAt).toLocaleString()}</small>
            {artifact.contextSummary && <small>{artifact.contextSummary}</small>}
          </div>
          <button className="ghost-button compact" onClick={() => selectArtifact(artifact.id)}>
            <Eye size={14} />
            查看
          </button>
          <a className="ghost-button compact" href={`/api/ai/artifacts/${artifact.id}/export`}>
            <Download size={14} />
            导出
          </a>
          <button className="ghost-button compact danger" onClick={() => void deleteArtifact(artifact.id)} disabled={busy === `delete-artifact-${artifact.id}`}>
            {busy === `delete-artifact-${artifact.id}` ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />}
            删除
          </button>
        </div>
      ))}
      {!artifacts.length && <EmptyState text="暂无 AI 产物" />}
    </div>
  );
}

function AiWorkbenchPage(props: {
  activeJob?: SearchJob;
  artifacts: AiArtifact[];
  reports: AiReport[];
  reportFocus: string;
  setReportFocus: (value: string) => void;
  createReport: () => Promise<void>;
  deleteReport: (reportId: string) => Promise<void>;
  deleteArtifact: (artifactId: string) => Promise<void>;
  selectedArtifactId: string;
  setSelectedArtifactId: (value: string) => void;
  selectedReportId: string;
  setSelectedReportId: (value: string) => void;
  prompts: AiPromptInfo[];
  openPrompt: (key: AiWorkflowKey) => void;
  runWorkflow: RunWorkflow;
  busy: string;
}) {
  const selectedArtifact = props.artifacts.find((artifact) => artifact.id === props.selectedArtifactId);
  const selectedReport = props.reports.find((report) => report.id === props.selectedReportId);
  const preview: ReaderPreview | undefined =
    selectedArtifact
      ? {
          kind: "artifact" as const,
          title: selectedArtifact.title,
          markdown: selectedArtifact.markdown,
          meta: [
            selectedArtifact.source === "ai" ? "AI 生成" : "本地规则",
            selectedArtifact.promptTitle ? `Prompt ${selectedArtifact.promptTitle}` : "",
            selectedArtifact.promptSource === "custom" ? "自定义 Prompt" : selectedArtifact.promptSource === "default" ? "默认 Prompt" : "",
            selectedArtifact.promptVersion ? `Prompt ${selectedArtifact.promptVersion}` : "",
            selectedArtifact.contextSummary ?? ""
          ].filter(Boolean),
          exportUrl: `/api/ai/artifacts/${selectedArtifact.id}/export`
        }
      : selectedReport
        ? {
            kind: "report" as const,
            title: selectedReport.title,
            markdown: selectedReport.markdown,
            meta: [selectedReport.source === "ai" ? "AI 深度版" : "本地规则版", new Date(selectedReport.createdAt).toLocaleString()],
            exportUrl: `/api/ai/reports/${selectedReport.id}/export`
          }
        : undefined;
  const selectArtifact = (artifactId: string) => {
    props.setSelectedArtifactId(artifactId);
    props.setSelectedReportId("");
  };
  const selectReport = (reportId: string) => {
    props.setSelectedReportId(reportId);
    props.setSelectedArtifactId("");
  };
  const selectedArtifactWorkflow = selectedArtifact && isAiWorkflowKey(selectedArtifact.workflowKey) ? selectedArtifact.workflowKey : undefined;
  return (
    <div className="module-frame ai-workbench-frame">
      <section className="surface ai-resource-panel">
        <SectionTitle icon={<Sparkles size={18} />} title="AI 产物与报告" />
        <div className="ai-left-split">
          <div className="ai-left-section">
            <div className="section-mini-head">
              <strong>产物与报告</strong>
              <div className="resource-count-row">
                <span>产物 {props.artifacts.length}</span>
                <span>报告 {props.reports.length}</span>
              </div>
            </div>
            <div className="resource-list">
              {props.artifacts.map((artifact) => (
                <div key={artifact.id} className={artifact.id === props.selectedArtifactId ? "resource-row active" : "resource-row"}>
                  <button className="resource-select" onClick={() => selectArtifact(artifact.id)}>
                    <strong>{artifact.title}</strong>
                    <small>{artifact.source === "ai" ? "AI 生成" : "本地规则"} · {new Date(artifact.createdAt).toLocaleString()}</small>
                    {artifact.promptTitle && <small>Prompt · {artifact.promptTitle}</small>}
                  </button>
                  <div className="resource-actions">
                    <a className="ghost-button compact" href={`/api/ai/artifacts/${artifact.id}/export`} aria-label={`导出 ${artifact.title}`}>
                      <Download size={14} />
                    </a>
                    <button className="ghost-button compact danger" onClick={() => void props.deleteArtifact(artifact.id)} disabled={props.busy === `delete-artifact-${artifact.id}`} aria-label={`删除 ${artifact.title}`}>
                      {props.busy === `delete-artifact-${artifact.id}` ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              ))}
              {props.reports.map((report) => (
                <div key={report.id} className={report.id === props.selectedReportId ? "resource-row active" : "resource-row"}>
                  <button className="resource-select" onClick={() => selectReport(report.id)}>
                    <strong>{report.title}</strong>
                    <small>{report.source === "ai" ? "AI 深度版" : "本地规则版"} · {new Date(report.createdAt).toLocaleString()}</small>
                    <small>Markdown 报告</small>
                  </button>
                  <div className="resource-actions">
                    <a className="ghost-button compact" href={`/api/ai/reports/${report.id}/export`} aria-label={`导出 ${report.title}`}>
                      <Download size={14} />
                    </a>
                    <button className="ghost-button compact danger" onClick={() => void props.deleteReport(report.id)} disabled={props.busy === `delete-report-${report.id}`} aria-label={`删除 ${report.title}`}>
                      {props.busy === `delete-report-${report.id}` ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              ))}
              {!props.artifacts.length && !props.reports.length && <EmptyState text="暂无 AI 产物或报告，先从右侧生成一份报告" />}
            </div>
          </div>
          <div className="ai-left-section">
            <div className="section-mini-head">
              <strong>Prompt 快速入口</strong>
              <span>Prompt {props.prompts.length}</span>
            </div>
            <div className="prompt-mini-list">
              {props.prompts.map((prompt) => (
                <button key={prompt.key} className="prompt-version-row" onClick={() => props.openPrompt(prompt.key)}>
                  <span>{prompt.title}</span>
                  <small>{prompt.version} · {prompt.promptSource === "custom" ? "自定义启用" : "默认启用"}</small>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <ArtifactReader
        preview={preview}
        selectedArtifact={selectedArtifact}
        selectedArtifactWorkflow={selectedArtifactWorkflow}
        openPrompt={props.openPrompt}
        runWorkflow={props.runWorkflow}
        busy={props.busy}
        close={() => {
          props.setSelectedArtifactId("");
          props.setSelectedReportId("");
        }}
      />

      <section className="surface ai-side-panel">
        <SectionTitle icon={<Gauge size={18} />} title="上下文与动作" />
        <div className="side-panel-stack">
          {selectedArtifact ? (
            <div className="artifact-context">
              <StatusRow label="Prompt" value={selectedArtifact.promptTitle ?? "未记录"} ok={Boolean(selectedArtifact.promptTitle)} />
              <StatusRow label="来源" value={selectedArtifact.promptSource === "custom" ? "自定义" : "默认/未记录"} ok={selectedArtifact.promptSource === "custom"} />
              <StatusRow label="版本" value={selectedArtifact.promptVersion ?? "未记录"} ok={Boolean(selectedArtifact.promptVersion)} />
              <StatusRow label="状态" value={selectedArtifact.status} ok={selectedArtifact.status === "completed"} />
            </div>
          ) : selectedReport ? (
            <div className="artifact-context">
              <StatusRow label="类型" value="Markdown 报告" ok />
              <StatusRow label="来源" value={selectedReport.source === "ai" ? "AI 深度版" : "本地规则版"} ok={selectedReport.source === "ai"} />
              <StatusRow label="状态" value={selectedReport.status} ok={selectedReport.status === "completed"} />
            </div>
          ) : (
            <EmptyState text="选择产物后查看 Prompt、模型和上下文信息" />
          )}
          <div className="report-generator-card">
            <strong>生成 Markdown 报告</strong>
            <textarea value={props.reportFocus} onChange={(event) => props.setReportFocus(event.target.value)} />
            <button className="primary-button full" disabled={!props.activeJob || props.busy === "report"} onClick={() => void props.createReport()}>
              {props.busy === "report" ? <Loader2 className="spin" size={16} /> : <FileText size={16} />}
              生成报告
            </button>
          </div>
          <div className="side-action-list">
            <strong>常用工作流</strong>
            {props.prompts.slice(0, 4).map((prompt) => (
              <button key={prompt.key} className="ghost-button compact" onClick={() => props.openPrompt(prompt.key)}>
                <KeyRound size={14} />
                {prompt.title}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function ArtifactReader({
  preview,
  selectedArtifact,
  selectedArtifactWorkflow,
  openPrompt,
  runWorkflow,
  busy,
  close
}: {
  preview?: ReaderPreview;
  selectedArtifact?: AiArtifact;
  selectedArtifactWorkflow?: AiWorkflowKey;
  openPrompt: (key: AiWorkflowKey) => void;
  runWorkflow: RunWorkflow;
  busy: string;
  close: () => void;
}) {
  return (
    <section className="surface artifact-reader">
      <SectionTitle
        icon={preview?.kind === "report" ? <FileText size={18} /> : <Bot size={18} />}
        title={preview?.title ?? "AI 阅读区"}
        action={preview ? (
          <div className="button-row">
            {selectedArtifact?.promptKey && selectedArtifact.promptKey !== "assistant" && selectedArtifact.promptKey !== "report" && (
              <button className="ghost-button compact" onClick={() => openPrompt(selectedArtifact.promptKey as AiWorkflowKey)}>
                <KeyRound size={14} />
                查看 Prompt
              </button>
            )}
            {selectedArtifactWorkflow && (
              <button className="ghost-button compact" onClick={() => void runWorkflow(selectedArtifactWorkflow)} disabled={busy === `workflow-${selectedArtifactWorkflow}`}>
                {busy === `workflow-${selectedArtifactWorkflow}` ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}
                重新生成
              </button>
            )}
            <a className="ghost-button compact" href={preview.exportUrl}>
              <Download size={14} />
              导出
            </a>
            <button className="ghost-button compact" onClick={close}>
              <X size={14} />
              关闭
            </button>
          </div>
        ) : undefined}
      />
      {preview ? (
        <>
          <ContextBadgeRow items={preview.meta} />
          <div className="artifact-reader-body">
            <MarkdownView content={preview.markdown} />
          </div>
        </>
      ) : (
        <div className="reader-empty-state">
          <EmptyState text="选择左侧 AI 产物或报告后在这里阅读；也可以从右侧生成新的 Markdown 报告" />
        </div>
      )}
    </section>
  );
}

function AiAssistantDrawer({
  open,
  onClose,
  width,
  setWidth,
  messages,
  input,
  setInput,
  sendMessage,
  models,
  selectedModelId,
  setSelectedModelId,
  guideDismissed,
  dismissGuide,
  activeJob,
  hasContextJob,
  notesTotal,
  assistantError,
  orchestrations,
  activeOrchestrationId,
  onOpenModels,
  onNewSearch,
  onOpenJob,
  onOpenArtifacts,
  onRefresh,
  workflows,
  runWorkflow,
  contextItems,
  busy
}: {
  open: boolean;
  onClose: () => void;
  width: number;
  setWidth: (value: number) => void;
  messages: AiAssistantMessage[];
  input: string;
  setInput: (value: string) => void;
  sendMessage: () => Promise<void>;
  models: AiModelConfig[];
  selectedModelId: string;
  setSelectedModelId: (modelId: string) => void;
  guideDismissed: boolean;
  dismissGuide: () => void;
  activeJob?: SearchJob;
  hasContextJob: boolean;
  notesTotal: number;
  assistantError: string;
  orchestrations: AiOrchestration[];
  activeOrchestrationId: string;
  onOpenModels: () => void;
  onNewSearch: () => void;
  onOpenJob: (jobId: string) => void;
  onOpenArtifacts: (artifactId: string) => void;
  onRefresh: () => Promise<void>;
  workflows: AiWorkflowDefinition[];
  runWorkflow: RunWorkflow;
  contextItems: string[];
  busy: string;
}) {
  if (!open) {
    return null;
  }
  const startResize = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    const onMove = (moveEvent: MouseEvent) => {
      const next = Math.min(640, Math.max(360, startWidth + startX - moveEvent.clientX));
      setWidth(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (input.trim() && busy !== "assistant-chat") {
        void sendMessage();
      }
    }
  };
  const notices: AssistantNotice[] = [];
  if (assistantError) {
    notices.push({
      key: "assistant-error",
      tone: "error",
      title: "AI 调用失败",
      message: assistantError,
      actionLabel: "切换模型",
      onAction: onOpenModels
    });
  }
  if (busy === "assistant-chat") {
    notices.push({
      key: "assistant-generating",
      tone: "progress",
      title: "AI 正在生成",
      message: "请稍候，生成完成前会暂时禁用重复发送。"
    });
  }
  if (!models.length) {
    notices.push({
      key: "no-model",
      tone: "warning",
      title: "尚未配置 AI 模型",
      message: "当前仍可发送问题，但只会使用本地规则版结果。",
      actionLabel: "配置模型",
      onAction: onOpenModels
    });
  }
  if (!hasContextJob) {
    notices.push({
      key: "no-job",
      tone: "info",
      title: "当前无有效任务",
      message: "本次提问不会引用历史任务。可新建搜索或直接询问通用运营问题。",
      actionLabel: "新建搜索",
      onAction: onNewSearch
    });
  } else if (activeJob?.status === "running") {
    notices.push({
      key: "job-running",
      tone: "progress",
      title: "任务抓取中",
      message: `已完成 ${activeJob.progress.done}/${activeJob.progress.total}，待处理 ${activeJob.progress.pending}，已入库笔记 ${notesTotal} 条。`,
      actionLabel: "刷新进度",
      onAction: () => void onRefresh()
    });
  } else if (notesTotal === 0) {
    notices.push({
      key: "no-notes",
      tone: "warning",
      title: "当前任务暂无入库笔记",
      message: "AI 暂时缺少可分析样本，可以等待抓取完成或切换任务。",
      actionLabel: "刷新",
      onAction: () => void onRefresh()
    });
  }
  const activeOrchestration =
    orchestrations.find((item) => item.id === activeOrchestrationId) ??
    orchestrations.find((item) => item.status === "running" || item.status === "waiting" || item.status === "queued") ??
    orchestrations[0];
  return (
    <aside className="assistant-drawer" style={{ width }}>
      <button className="assistant-resizer" onMouseDown={startResize} aria-label="调整 AI 助手宽度">
        <GripVertical size={16} />
      </button>
      <div className="assistant-header-row">
        <div className="assistant-heading">
          <Bot size={18} />
          <strong>AI 助手</strong>
        </div>
        <div className="assistant-header-actions">
          <ModelPicker models={models} selectedModelId={selectedModelId} setSelectedModelId={setSelectedModelId} label="模型" />
          <button className="ghost-button compact" onClick={onClose} aria-label="关闭 AI 助手">
            <X size={14} />
            收起
          </button>
        </div>
      </div>
      <ContextBadgeRow items={contextItems} />
      {(notices.length > 0 || !guideDismissed) && (
        <div className="assistant-status-stack">
          {notices.map((notice) => <AssistantStateNotice key={notice.key} notice={notice} />)}
          {!guideDismissed && (
            <div className="assistant-guide">
              <div>
                <strong>首次使用 AI 助手</strong>
                <p>有任务时会结合当前任务、笔记和评论回答；无有效任务时只回答通用运营问题，不会自动引用历史任务。</p>
              </div>
              <button className="ghost-button compact" onClick={dismissGuide}>知道了</button>
            </div>
          )}
        </div>
      )}
      {activeOrchestration && (
        <div className="assistant-orchestration-slot">
          <OrchestrationTimeline orchestration={activeOrchestration} onOpenJob={onOpenJob} onOpenArtifacts={onOpenArtifacts} />
        </div>
      )}
      {workflows.length > 0 && (
        <section className="assistant-next-actions compact-actions" aria-label="AI 建议动作">
          <div className="assistant-next-actions-head">
            <span>快捷动作</span>
            <small>基于当前上下文生成产物</small>
          </div>
          <div className="assistant-suggestion-row">
            {workflows.slice(0, 4).map((workflow) => (
              <button
                key={workflow.key}
                className="assistant-suggestion-card"
                onClick={() => void runWorkflow(workflow.key)}
                disabled={busy === `workflow-${workflow.key}`}
                title={workflow.description}
              >
                {busy === `workflow-${workflow.key}` ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}
                <span>{workflow.title}</span>
                <small>{workflow.description}</small>
              </button>
            ))}
          </div>
        </section>
      )}
      <div className="assistant-body-scroll">
        <div className="assistant-messages">
          {messages.map((message) => (
            <div key={message.id} className={`assistant-message ${message.role}`}>
              <strong>{message.role === "user" ? "你" : "AI 助手"}</strong>
              {message.role === "assistant" ? <MarkdownView content={message.content} compact /> : <p>{message.content}</p>}
            </div>
          ))}
          {busy === "assistant-chat" && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="assistant-message assistant pending" aria-live="polite">
              <strong>AI 助手</strong>
              <p>
                <Loader2 className="spin" size={14} />
                正在生成回复...
              </p>
            </div>
          )}
          {!messages.length && (
            <div className="assistant-welcome-card">
              <div>
                <strong>可以这样开始</strong>
                <p>直接提问，或让助手串联“抓取关键词 → 等待笔记入库 → 生成分析产物”。</p>
              </div>
              <div className="assistant-example-list">
                <button type="button" onClick={() => setInput("抓取关键词 [在这里输入你的关键词]，并生成话题机会、爆款结构、评论需求、可执行选题")}>
                  抓取关键词并分析
                </button>
                <button type="button" onClick={() => setInput("基于当前任务，给我下一步最值得做的内容策划方向")}>
                  推荐下一步动作
                </button>
                <button type="button" onClick={() => setInput("帮我总结当前评论里的用户痛点和选题机会")}>
                  分析评论需求
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="assistant-input assistant-composer" onKeyDown={handleInputKeyDown}>
        <label className="sr-only" htmlFor="assistant-input">AI 助手输入</label>
        <textarea id="assistant-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="问 AI：基于当前任务，我下一步该做什么？" />
        <button className="primary-button full" onClick={() => void sendMessage()} disabled={busy === "assistant-chat" || !input.trim()}>
          {busy === "assistant-chat" ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
          发送
        </button>
      </div>
    </aside>
  );
}

function AssistantStateNotice({ notice }: { notice: AssistantNotice }) {
  return (
    <div className={`assistant-state ${notice.tone}`}>
      <div>
        <strong>{notice.title}</strong>
        <p>{notice.message}</p>
      </div>
      {notice.actionLabel && notice.onAction && (
        <button className="ghost-button compact" onClick={notice.onAction}>
          {notice.actionLabel}
        </button>
      )}
    </div>
  );
}

function OrchestrationTimeline({
  orchestration,
  onOpenJob,
  onOpenArtifacts
}: {
  orchestration: AiOrchestration;
  onOpenJob: (jobId: string) => void;
  onOpenArtifacts: (artifactId: string) => void;
}) {
  return (
    <section className="orchestration-timeline" aria-label="AI 编排进度">
      <div className="orchestration-head">
        <div>
          <strong>{orchestration.keywords.join(" / ") || "AI 编排任务"}</strong>
          <span>{orchestrationStatusLabel(orchestration.status)}</span>
        </div>
        <span className={`orchestration-status ${orchestration.status}`}>{orchestrationStatusLabel(orchestration.status)}</span>
        <div className="button-row">
          {orchestration.jobId && (
            <button className="ghost-button compact" onClick={() => onOpenJob(orchestration.jobId!)}>
              查看任务
            </button>
          )}
          {orchestration.artifactIds.length > 0 && (
            <button className="ghost-button compact" onClick={() => onOpenArtifacts(orchestration.artifactIds[orchestration.artifactIds.length - 1]!)}>
              打开产物
            </button>
          )}
        </div>
      </div>
      <div className="timeline-steps">
        {orchestration.steps.map((step) => (
          <div key={step.key} className={`orchestration-step ${step.status}`}>
            <span className="orchestration-dot" />
            <div>
              <strong>{step.title}</strong>
              <p>{step.status === "failed" ? step.error || "执行失败" : step.status}</p>
            </div>
          </div>
        ))}
      </div>
      {orchestration.error && <p className="orchestration-error">{orchestration.error}</p>}
    </section>
  );
}

function AiAssistantEntry({ onOpen, context }: { onOpen: () => void; context: string }) {
  const [position, setPosition] = useState(() => readStoredPosition("xhs.aiFabPosition", { x: 24, y: 24 }));
  const startDrag = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const startPosition = position;
    let moved = false;
    const onMove = (moveEvent: MouseEvent) => {
      moved = true;
      const next = clampFloatingPosition({
        x: startPosition.x + startX - moveEvent.clientX,
        y: startPosition.y + startY - moveEvent.clientY
      });
      setPosition(next);
      localStorage.setItem("xhs.aiFabPosition", JSON.stringify(next));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (!moved) {
        onOpen();
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  return (
    <button
      className="assistant-floating-pill"
      onMouseDown={startDrag}
      style={{ right: position.x, bottom: position.y }}
      aria-label="打开 AI 助手"
    >
      <Bot size={17} />
      <span>AI 助手</span>
      <small>{context}</small>
    </button>
  );
}

function DatasetManagerDialog(props: {
  preview: NoteScopeClearPreview;
  deleteAiArtifacts: boolean;
  setDeleteAiArtifacts: (value: boolean) => void;
  busy: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const deleting = props.busy === "clear-notes";
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="管理当前数据集">
      <section className="dataset-dialog">
        <SectionTitle
          icon={<Trash2 size={18} />}
          title="管理当前数据集"
          action={
            <button className="ghost-button compact" onClick={props.onClose} disabled={deleting}>
              <X size={14} />
              关闭
            </button>
          }
        />
        <div className="dataset-dialog-summary">
          <span>当前任务</span>
          <strong>{props.preview.label}</strong>
          <small>该操作会移除当前任务与笔记的关联；只有不再属于任何任务的笔记才会被真正删除。</small>
        </div>
        <div className="dataset-impact-grid">
          <Metric label="影响笔记" value={formatNumber(props.preview.affectedNotes)} />
          <Metric label="仅解除关联" value={formatNumber(props.preview.detachedNotes)} />
          <Metric label="真正删除笔记" value={formatNumber(props.preview.orphanNotes)} />
          <Metric label="删除评论" value={formatNumber(props.preview.commentsToDelete)} />
        </div>
        <div className="dataset-impact-list">
          <span>将清理队列：{formatNumber(props.preview.queueItemsToDelete)} 条</span>
          <span>将删除本地分析报告：{formatNumber(props.preview.analysisReportsToDelete)} 个</span>
          <span>关联 AI 产物：{formatNumber(props.preview.aiArtifactsLinked)} 个</span>
          <span>关联 AI 报告：{formatNumber(props.preview.aiReportsLinked)} 个</span>
        </div>
        <label className="dataset-checkbox">
          <input
            type="checkbox"
            checked={props.deleteAiArtifacts}
            onChange={(event) => props.setDeleteAiArtifacts(event.target.checked)}
            disabled={deleting || (!props.preview.aiArtifactsLinked && !props.preview.aiReportsLinked)}
          />
          <span>同时删除该任务关联的 AI 产物和 AI 报告</span>
        </label>
        <div className="dataset-warning">
          <AlertTriangle size={16} />
          <span>这是数据清理操作，不只是隐藏列表。确认前请检查上方影响范围。</span>
        </div>
        <div className="dialog-actions">
          <button className="ghost-button" onClick={props.onClose} disabled={deleting}>
            取消
          </button>
          <button className="primary-button danger" onClick={() => void props.onConfirm()} disabled={deleting}>
            {deleting ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />}
            确认清理当前数据集
          </button>
        </div>
      </section>
    </div>
  );
}

function ModelSettingsDrawer(props: {
  models: AiModelConfig[];
  modelForm: ModelForm;
  setModelForm: (value: ModelForm) => void;
  editorOpen: boolean;
  editingModelId: string;
  openNewModel: () => void;
  openEditModel: (model: AiModelConfig) => void;
  closeEditor: () => void;
  saveModel: () => Promise<void>;
  deleteModel: (modelId: string) => Promise<void>;
  setDefaultModel: (modelId: string) => Promise<void>;
  testModel: (modelId: string) => Promise<void>;
  probeModelTools: (modelId: string) => Promise<void>;
  modelMessages: Record<string, { ok: boolean; message: string }>;
  busy: string;
  onClose: () => void;
}) {
  const defaultModel = props.models.find((model) => model.isDefault) ?? props.models[0];
  const selectedPreset = AI_MODEL_PROVIDER_PRESETS.find((preset) => preset.key === props.modelForm.providerKey) ?? AI_MODEL_PROVIDER_PRESETS[0];
  const update = (key: keyof ModelForm, value: string) => props.setModelForm({ ...props.modelForm, [key]: value });
  const selectProvider = (providerKey: AiModelProviderKey) => {
    const preset = AI_MODEL_PROVIDER_PRESETS.find((item) => item.key === providerKey) ?? AI_MODEL_PROVIDER_PRESETS[0];
    props.setModelForm({
      ...props.modelForm,
      providerKey: preset.key,
      provider: preset.provider,
      baseUrl: preset.baseUrl,
      name: props.modelForm.name || preset.name
    });
  };
  return (
    <div className="settings-drawer-backdrop" role="dialog" aria-modal="true">
      <aside className="settings-drawer">
        <SectionTitle
          icon={<Settings size={18} />}
          title="模型设置"
          action={
            <button className="ghost-button compact" onClick={props.onClose}>
              <X size={14} />
              关闭
            </button>
          }
        />
        <div className="drawer-summary model-default-card">
          <span>默认模型</span>
          <strong>{defaultModel ? `${defaultModel.name} · ${defaultModel.model}` : "未配置"}</strong>
          <small>{defaultModel ? `${findModelProviderPreset(defaultModel.provider, defaultModel.baseUrl, defaultModel.model).name} · ${defaultModel.apiKeyMasked || "未配置 Key"}` : "新增模型后即可用于 AI 助手、AI 工作流和报告生成。"}</small>
        </div>
        <div className="drawer-toolbar">
          <button className="primary-button compact" onClick={props.openNewModel}>
            <KeyRound size={14} />
            新增模型
          </button>
          {props.editorOpen && (
            <button className="ghost-button compact" onClick={props.closeEditor}>
              <X size={14} />
              收起表单
            </button>
          )}
        </div>

        {props.editorOpen && (
          <section className="model-editor-card">
            <div className="model-editor-head">
              <strong>{props.editingModelId ? "编辑模型" : "新增模型"}</strong>
              <small>{props.editingModelId ? "不填写 API Key 时保留原密钥。" : "选择厂商后自动填入接口地址，只需补充 API Key 和模型名称。"}</small>
            </div>
            <div className="provider-preset-grid" aria-label="模型厂商">
              {AI_MODEL_PROVIDER_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  className={props.modelForm.providerKey === preset.key ? "provider-preset active" : "provider-preset"}
                  onClick={() => selectProvider(preset.key)}
                >
                  <strong>{preset.name}</strong>
                  <small>{preset.description}</small>
                </button>
              ))}
            </div>
            {selectedPreset.regionOptions && (
              <label className="field-stack compact-field">
                <span>区域</span>
                <select value={props.modelForm.baseUrl} onChange={(event) => update("baseUrl", event.target.value)}>
                  {selectedPreset.regionOptions.map((option) => (
                    <option key={option.baseUrl} value={option.baseUrl}>{option.label}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="field-stack compact-field">
              <span>名称</span>
              <input value={props.modelForm.name} onChange={(event) => update("name", event.target.value)} placeholder={`例如 ${selectedPreset.name}`} />
            </label>
            <label className="field-stack compact-field">
              <span>模型名称</span>
              <input value={props.modelForm.model} onChange={(event) => update("model", event.target.value)} placeholder={selectedPreset.modelPlaceholder} />
            </label>
            <label className="field-stack compact-field">
              <span>API Key</span>
              <input value={props.modelForm.apiKey} onChange={(event) => update("apiKey", event.target.value)} placeholder={props.editingModelId ? "留空则保留原 API Key" : selectedPreset.apiKeyHint} type="password" />
            </label>
            <details className="model-advanced-settings" open={props.modelForm.providerKey === "custom"}>
              <summary>高级设置</summary>
              <label className="field-stack compact-field">
                <span>Provider</span>
                <input value={props.modelForm.provider} onChange={(event) => update("provider", event.target.value)} placeholder="OpenAI-compatible" />
              </label>
              <label className="field-stack compact-field">
                <span>Base URL</span>
                <input value={props.modelForm.baseUrl} onChange={(event) => update("baseUrl", event.target.value)} placeholder="https://api.openai.com/v1" />
              </label>
            </details>
            <button
              className="primary-button full"
              disabled={!props.modelForm.name || !props.modelForm.model || !props.modelForm.baseUrl || props.busy === "model"}
              onClick={() => void props.saveModel()}
            >
              {props.busy === "model" ? <Loader2 className="spin" size={16} /> : <CheckCircle2 size={16} />}
              保存模型
            </button>
          </section>
        )}

        <section className="drawer-section">
          <SectionTitle icon={<Settings size={16} />} title="已配置模型" />
          <div className="drawer-model-list">
            {props.models.map((model) => {
              const preset = findModelProviderPreset(model.provider, model.baseUrl, model.model);
              const message = props.modelMessages[model.id];
              return (
                <div key={model.id} className={model.isDefault ? "drawer-model-row active" : "drawer-model-row"}>
                  <div className="drawer-model-main">
                    <span className="provider-badge">{preset.name}{model.isDefault ? " · 默认" : ""}</span>
                    <strong>{model.name}</strong>
                    <span>{model.model}</span>
                    <small>{model.apiKeyMasked || "未配置 Key"}</small>
                    {message && (
                      <small className={message.ok ? "model-test ok" : "model-test warn"}>
                        {message.message}
                      </small>
                    )}
                  </div>
                  <div className="drawer-model-actions">
                    {!model.isDefault && (
                      <button className="ghost-button compact" onClick={() => void props.setDefaultModel(model.id)} disabled={props.busy === `default-model-${model.id}`}>
                        默认
                      </button>
                    )}
                    <button className="ghost-button compact" onClick={() => props.openEditModel(model)}>
                      编辑
                    </button>
                    <button className="ghost-button compact" onClick={() => void props.testModel(model.id)} disabled={props.busy === `test-${model.id}`}>
                      {props.busy === `test-${model.id}` ? <Loader2 className="spin" size={14} /> : <CheckCircle2 size={14} />}
                      测试
                    </button>
                    <button className="ghost-button compact" onClick={() => void props.probeModelTools(model.id)} disabled={props.busy === `tools-probe-${model.id}`}>
                      {props.busy === `tools-probe-${model.id}` ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}
                      工具检测
                    </button>
                    <button className="ghost-button compact danger" onClick={() => void props.deleteModel(model.id)} disabled={props.busy === `delete-model-${model.id}`} aria-label={`删除 ${model.name}`}>
                      {props.busy === `delete-model-${model.id}` ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              );
            })}
            {!props.models.length && <EmptyState text="暂无模型，点击上方新增模型开始接入" />}
          </div>
        </section>
      </aside>
    </div>
  );
}

function CommentsPage(props: {
  notes: NoteRecord[];
  selected: NoteRecord | null;
  setSelectedId: (value: string) => void;
  replyStrategy: ReplyStrategy;
  setReplyStrategy: (value: ReplyStrategy) => void;
  replyTemplate: string;
  setReplyTemplate: (value: string) => void;
  createPlan: () => Promise<void>;
  replyPlans: ReplyPlanRecord[];
  replyActions: ReplyActionRecord[];
  approveAction: (action: ReplyActionRecord) => Promise<void>;
  busy: string;
}) {
  const currentActions = props.replyActions.filter((action) => props.replyPlans.some((plan) => plan.id === action.planId));
  return (
    <div className="module-frame two-column-frame">
      <section className="surface command-surface">
        <SectionTitle icon={<MessageSquareReply size={18} />} title="回复计划" />
        <label>
          笔记
          <select value={props.selected?.id ?? ""} onChange={(event) => props.setSelectedId(event.target.value)}>
            {props.notes.map((note) => <option key={note.id} value={note.id}>{note.title}</option>)}
          </select>
        </label>
        <Select
          label="策略"
          value={props.replyStrategy}
          onChange={(value) => props.setReplyStrategy(value as ReplyStrategy)}
          options={[["questions", "问题优先"], ["top-engaged", "高赞优先"], ["all-unanswered", "未回复优先"]]}
        />
        <textarea value={props.replyTemplate} onChange={(event) => props.setReplyTemplate(event.target.value)} />
        <button className="primary-button full" onClick={() => void props.createPlan()} disabled={!props.selected || props.busy === "reply-plan"}>
          {props.busy === "reply-plan" ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
          生成候选
        </button>
      </section>

      <section className="surface">
        <SectionTitle icon={<ShieldCheck size={18} />} title="人工确认队列" />
        <div className="reply-list">
          {currentActions.slice(0, 16).map((action) => (
            <div key={action.id} className={`reply-action ${action.status}`}>
              <span>{action.status}</span>
              <p>{action.content}</p>
              <button className="ghost-button compact" disabled={action.status !== "draft" || props.busy === action.id} onClick={() => void props.approveAction(action)}>
                {props.busy === action.id ? <Loader2 className="spin" size={14} /> : <CheckCircle2 size={14} />}
                确认
              </button>
            </div>
          ))}
          {!currentActions.length && <EmptyState text="暂无回复候选" />}
        </div>
      </section>
    </div>
  );
}

function CollectionsPage({ capabilities }: { capabilities: RedbookCapability[] }) {
  const items = capabilities.filter((item) => item.module === "收藏与专辑" || item.module === "内容发现");
  return (
    <div className="page-grid">
      <section className="surface">
        <SectionTitle icon={<Library size={18} />} title="收藏与专辑" />
        <div className="capability-grid large">
          {items.map((item) => (
            <div className="capability ready" key={item.key}>
              <strong>{item.label}</strong>
              <span>{item.description}</span>
              <small>{item.command}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function HealthPage({
  health,
  runHealthCheck,
  activeJob,
  busy
}: {
  health: HealthReportRecord | null;
  runHealthCheck: () => Promise<void>;
  activeJob?: SearchJob;
  busy: string;
}) {
  return (
    <div className="page-grid">
      <section className="surface">
        <SectionTitle
          icon={<Gauge size={18} />}
          title="限流检测"
          action={
            <button className="primary-button compact" onClick={() => void runHealthCheck()} disabled={!activeJob || busy === "health"}>
              {busy === "health" ? <Loader2 className="spin" size={15} /> : <ShieldCheck size={15} />}
              检测
            </button>
          }
        />
        {health ? (
          <div className="health-list">
            <div className="status-grid">
              <Metric label="检测笔记" value={String(health.totalNotes)} />
              <Metric label="限流风险" value={String(health.limitedNotes.length)} />
              <Metric label="敏感词" value={String(health.sensitiveNotes.length)} />
            </div>
            {health.notes.slice(0, 20).map((item) => (
              <div key={item.noteId} className={`health-row ${item.levelColor}`}>
                <strong>{item.title}</strong>
                <span>{item.levelLabel}</span>
                <small>{item.sensitiveHits.join("、") || "无敏感词"} · 标签 {item.tagCount}</small>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="尚未生成限流报告" />
        )}
      </section>
    </div>
  );
}

function ReportsPage(props: {
  activeJob?: SearchJob;
  reports: AiReport[];
  selectedReportId: string;
  selectReport: (reportId: string) => void;
  reportFocus: string;
  setReportFocus: (value: string) => void;
  createReport: () => Promise<void>;
  deleteReport: (reportId: string) => Promise<void>;
  busy: string;
}) {
  return (
    <div className="reports-layout">
      <section className="surface command-surface">
        <SectionTitle icon={<Bot size={18} />} title="生成 Markdown 报告" />
        <textarea value={props.reportFocus} onChange={(event) => props.setReportFocus(event.target.value)} />
        <button className="primary-button full" disabled={!props.activeJob || props.busy === "report"} onClick={() => void props.createReport()}>
          {props.busy === "report" ? <Loader2 className="spin" size={16} /> : <FileText size={16} />}
          生成报告
        </button>
      </section>
      <section className="surface">
        <SectionTitle icon={<FileText size={18} />} title="报告列表" />
        <div className="report-list">
          {props.reports.map((report) => (
            <div key={report.id} className={props.selectedReportId === report.id ? "report-row active" : "report-row"}>
              <button className="report-select-button" onClick={() => props.selectReport(report.id)}>
                <span>{report.title}</span>
                <small>{report.source === "ai" ? "AI 深度版" : "本地规则版"} · {new Date(report.createdAt).toLocaleString()}</small>
              </button>
              <a className="ghost-button compact" href={`/api/ai/reports/${report.id}/export`}>
                <Download size={14} />
                导出
              </a>
              <button className="ghost-button compact danger" onClick={() => void props.deleteReport(report.id)} disabled={props.busy === `delete-report-${report.id}`}>
                {props.busy === `delete-report-${report.id}` ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />}
                删除
              </button>
            </div>
          ))}
          {!props.reports.length && <EmptyState text="暂无报告" />}
        </div>
      </section>
    </div>
  );
}

function ModelsPage(props: {
  models: AiModelConfig[];
  modelForm: { name: string; provider: string; baseUrl: string; model: string; apiKey: string };
  setModelForm: (value: { name: string; provider: string; baseUrl: string; model: string; apiKey: string }) => void;
  saveModel: () => Promise<void>;
  testModel: (modelId: string) => Promise<void>;
  modelMessages: Record<string, { ok: boolean; message: string }>;
  busy: string;
}) {
  const update = (key: keyof typeof props.modelForm, value: string) => props.setModelForm({ ...props.modelForm, [key]: value });
  return (
    <div className="page-grid">
      <section className="surface command-surface">
        <SectionTitle icon={<KeyRound size={18} />} title="模型接入" />
        <input value={props.modelForm.name} onChange={(event) => update("name", event.target.value)} placeholder="名称，例如 DeepSeek" />
        <input value={props.modelForm.provider} onChange={(event) => update("provider", event.target.value)} placeholder="供应商" />
        <input value={props.modelForm.baseUrl} onChange={(event) => update("baseUrl", event.target.value)} placeholder="Base URL" />
        <input value={props.modelForm.model} onChange={(event) => update("model", event.target.value)} placeholder="模型名" />
        <input value={props.modelForm.apiKey} onChange={(event) => update("apiKey", event.target.value)} placeholder="API Key" type="password" />
        <button className="primary-button full" disabled={!props.modelForm.name || !props.modelForm.model || props.busy === "model"} onClick={() => void props.saveModel()}>
          {props.busy === "model" ? <Loader2 className="spin" size={16} /> : <LogIn size={16} />}
          保存模型
        </button>
      </section>
      <section className="surface">
        <SectionTitle icon={<Settings size={18} />} title="已配置模型" />
        <div className="model-list">
          {props.models.map((model) => (
            <div key={model.id} className="model-row">
              <strong>{model.name}</strong>
              <span>{model.provider} · {model.model}</span>
              <small>{model.apiKeyMasked || "未配置 Key"}</small>
              <button className="ghost-button compact" onClick={() => void props.testModel(model.id)} disabled={props.busy === `test-${model.id}`}>
                {props.busy === `test-${model.id}` ? <Loader2 className="spin" size={14} /> : <CheckCircle2 size={14} />}
                测试
              </button>
              {props.modelMessages[model.id] && (
                <small className={props.modelMessages[model.id].ok ? "model-test ok" : "model-test warn"}>
                  {props.modelMessages[model.id].message}
                </small>
              )}
            </div>
          ))}
          {!props.models.length && <EmptyState text="暂无模型" />}
        </div>
      </section>
    </div>
  );
}

function NoteDetail({
  note,
  onDelete,
  refreshNoteMedia,
  openOriginalUrl,
  runWorkflow,
  busy
}: {
  note: NoteRecord | null;
  onDelete: () => Promise<void>;
  refreshNoteMedia: (noteId: string) => Promise<void>;
  openOriginalUrl: (url: string) => Promise<void>;
  runWorkflow: RunWorkflow;
  busy: string;
}) {
  if (!note) {
    return (
      <section className="surface detail-panel">
        <EmptyState text="选择一篇笔记查看详情" />
      </section>
    );
  }
  const mediaImages = noteMediaImages(note);
  const hasMedia = Boolean(note.videoUrl || mediaImages.length);
  return (
    <section className="surface detail-panel">
      <SectionTitle
        icon={<FileText size={18} />}
        title="正文详情"
        action={
          <div className="detail-actions">
            <button className="ghost-button compact" onClick={() => void runWorkflow("note-analysis")} disabled={busy === "workflow-note-analysis"}>
              {busy === "workflow-note-analysis" ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />}
              AI 分析
            </button>
            <button className="ghost-button compact" onClick={() => void openOriginalUrl(note.webUrl)} disabled={busy === "open-url"}>
              <ExternalLink size={15} />
              智能打开原帖
            </button>
            <button className="ghost-button compact danger" onClick={() => void onDelete()} disabled={busy === "delete-note"}>
              {busy === "delete-note" ? <Loader2 className="spin" size={15} /> : <Trash2 size={15} />}
              删除
            </button>
          </div>
        }
      />
      {note.videoUrl && (
        <video className="media-video" src={mediaProxyUrl(note.videoUrl, note.id, "video")} poster={mediaProxyUrl(note.coverUrl, note.id, "image", 0)} preload="metadata" controls playsInline />
      )}
      {mediaImages.length > 0 && (
        <div className="media-grid">
          {mediaImages.map((url, index) => (
            <img key={url} src={mediaProxyUrl(url, note.id, "image", index)} alt="" loading="lazy" />
          ))}
        </div>
      )}
      {!note.videoUrl && mediaImages.length === 0 && (
        <div className="media-empty">
          <ImageIcon size={18} />
          暂无可加载媒体
        </div>
      )}
      <div className={`media-health-card ${hasMedia ? "info" : "warn"}`}>
        <ImageIcon size={16} />
        <div>
          <strong>{hasMedia ? "历史媒体可能会过期" : "媒体暂不可用"}</strong>
          <span>
            {hasMedia
              ? "如果图片或视频显示异常，可以刷新媒体；文本、评论和互动数据仍可继续用于分析。"
              : "可能是历史媒体链接过期、CDN 防盗链或登录态变化。可尝试刷新媒体，也可以打开原帖查看。"}
          </span>
        </div>
        <button className="ghost-button compact" onClick={() => void refreshNoteMedia(note.id)} disabled={busy === "media-refresh"}>
          {busy === "media-refresh" ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />}
          刷新媒体
        </button>
      </div>
      <h2>{note.title}</h2>
      {note.desc ? (
        <p className="body-text">{note.desc}</p>
      ) : (
        <div className="pending-body-box">
          <strong>正文待抓取</strong>
          <span>当前记录来自搜索列表，搜索接口通常只返回标题、作者和热度。等待后台 read 详情任务处理到这篇笔记后，正文会自动补齐。</span>
        </div>
      )}
      <div className="status-grid">
        <Metric label="点赞" value={formatNumber(note.likedCount)} />
        <Metric label="收藏" value={formatNumber(note.collectedCount)} />
        <Metric label="评论" value={formatNumber(note.commentCount)} />
      </div>
      <div className="tag-row">
        {note.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}
      </div>
    </section>
  );
}

function AuthPanel({
  auth,
  cookieFields,
  setCookieFields,
  browserBridge,
  saveCookie,
  autoReadCookie,
  refreshBrowserBridge,
  syncBrowserBridgeCookie,
  busy
}: {
  auth: AuthStatus;
  cookieFields: { a1: string; web_session: string; webId: string };
  setCookieFields: (value: { a1: string; web_session: string; webId: string }) => void;
  browserBridge: BrowserBridgeStatus;
  saveCookie: () => Promise<void>;
  autoReadCookie: () => Promise<void>;
  refreshBrowserBridge: () => Promise<void>;
  syncBrowserBridgeCookie: () => Promise<void>;
  busy: string;
}) {
  return (
    <section className="surface command-surface auth-surface">
      <SectionTitle icon={<ShieldCheck size={18} />} title="登录连接" />
      <div className={`browser-bridge-card ${browserBridge.connected ? "ok" : "pending"}`}>
        <div>
          <strong>浏览器助手 Bridge</strong>
          <p>
            {browserBridge.message ||
              (browserBridge.connected
                ? `已连接 ${browserBridge.browser === "edge" ? "Edge" : browserBridge.browser === "chrome" ? "Chrome" : "浏览器"}，可同步当前浏览器登录态。`
                : "推荐安装本项目浏览器助手扩展，登录当前浏览器的小红书后即可同步 Cookie。")}
          </p>
          {(browserBridge.lastSyncAt || browserBridge.lastSeenAt) && (
            <small>{browserBridge.lastSyncAt ? "最近同步" : "最近检测"}：{formatDateTime(browserBridge.lastSyncAt || browserBridge.lastSeenAt || "")}</small>
          )}
          {browserBridge.diagnostic && <small className="bridge-diagnostic">{browserBridge.diagnostic}</small>}
        </div>
        <div className="button-row">
          <button className="ghost-button compact" onClick={() => void refreshBrowserBridge()} disabled={busy === "bridge-check"}>
            {busy === "bridge-check" ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />}
            检测助手
          </button>
          <button className="primary-button compact" onClick={() => void syncBrowserBridgeCookie()} disabled={busy === "auth" || !browserBridge.connected}>
            {busy === "auth" ? <Loader2 className="spin" size={15} /> : <KeyRound size={15} />}
            同步登录态
          </button>
        </div>
      </div>
      <p className="muted-line">插件使用：在 Edge 扩展页加载 browser-extension/xhs-bridge，刷新本地运营台和小红书页面，再点击“检测助手”。</p>
      <div className="button-row">
        <button className="ghost-button" onClick={() => window.open("https://www.xiaohongshu.com/", "_blank")}>
          <ExternalLink size={16} />
          打开小红书
        </button>
        <button className="ghost-button" onClick={() => void autoReadCookie()} disabled={busy === "auth"}>
          {busy === "auth" ? <Loader2 className="spin" size={16} /> : <KeyRound size={16} />}
          读取本机浏览器（兼容）
        </button>
      </div>
      <label className="field-stack compact-field">
        <span>a1</span>
        <input value={cookieFields.a1} onChange={(event) => setCookieFields({ ...cookieFields, a1: event.target.value })} placeholder="从小红书 Cookies 复制 a1" />
      </label>
      <label className="field-stack compact-field">
        <span>web_session</span>
        <input value={cookieFields.web_session} onChange={(event) => setCookieFields({ ...cookieFields, web_session: event.target.value })} placeholder="从小红书 Cookies 复制 web_session" />
      </label>
      <label className="field-stack compact-field">
        <span>webId（可选）</span>
        <input value={cookieFields.webId} onChange={(event) => setCookieFields({ ...cookieFields, webId: event.target.value })} placeholder="有 webId 时再填写" />
      </label>
      <button className="primary-button full" onClick={() => void saveCookie()} disabled={busy === "auth" || !cookieFields.a1 || !cookieFields.web_session}>
        {busy === "auth" ? <Loader2 className="spin" size={16} /> : <LogIn size={16} />}
        验证
      </button>
      <StatusRow label="状态" value={auth.connected ? "已连接" : auth.error ? "连接失效" : auth.needsVerification ? "待验证" : "未连接"} ok={auth.connected} />
      {auth.error && <p className="risk-text">{formatAuthError(auth.error)}</p>}
    </section>
  );
}

function Metric({ icon, label, value }: { icon?: ReactNode; label: string; value: string }) {
  return (
    <div className="metric-card">
      {icon}
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function SectionTitle({ icon, title, action }: { icon: ReactNode; title: string; action?: ReactNode }) {
  return (
    <div className="section-title">
      <div>{icon}<strong>{title}</strong></div>
      {action}
    </div>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="status-row">
      <span>{label}</span>
      <strong className={ok ? "ok" : "warn"}>{value}</strong>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <label>
      {label}
      <input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function EmptyState({
  title,
  text,
  actionLabel,
  onAction
}: {
  title?: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      {title && <strong>{title}</strong>}
      <span>{text}</span>
      {actionLabel && onAction && (
        <button className="ghost-button compact" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function formatNumber(value: number): string {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}亿`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(1)}万`;
  return String(value);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function readStoredNumber(key: string, fallback: number): number {
  const raw = localStorage.getItem(key);
  const value = raw ? Number(raw) : fallback;
  return Number.isFinite(value) ? Math.min(640, Math.max(360, value)) : fallback;
}

function readStoredString(key: string, fallback: string): string {
  return localStorage.getItem(key) || fallback;
}

function isAiWorkflowKey(value: AiArtifact["workflowKey"]): value is AiWorkflowKey {
  return value !== "assistant";
}

function isControlledOrchestrationRequest(content: string): boolean {
  const text = content.trim();
  return /抓取|搜索/.test(text) && /关键词/.test(text) && /话题|机会|爆款|评论|选题|分析/.test(text);
}

function callBrowserBridge<T = unknown>(action: string, payload?: unknown, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const requestId = `xhs_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error("浏览器助手未响应，请确认扩展已安装并启用。"));
    }, timeoutMs);
    function onMessage(event: MessageEvent) {
      if (event.source !== window || event.data?.source !== "XHS_BRIDGE" || event.data?.requestId !== requestId) {
        return;
      }
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      if (event.data.ok) {
        resolve((event.data.result ?? event.data.data) as T);
      } else {
        reject(new Error(event.data.error || "浏览器助手调用失败。"));
      }
    }
    window.addEventListener("message", onMessage);
    window.postMessage({ source: "XHS_APP", type: "XHS_BRIDGE_REQUEST", requestId, action, payload }, window.location.origin);
  });
}

function upsertById<T extends { id: string }>(items: T[], next: T): T[] {
  return [next, ...items.filter((item) => item.id !== next.id)];
}

function readStoredPosition(key: string, fallback: { x: number; y: number }): { x: number; y: number } {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown };
    const x = typeof parsed.x === "number" ? parsed.x : fallback.x;
    const y = typeof parsed.y === "number" ? parsed.y : fallback.y;
    return clampFloatingPosition({ x, y });
  } catch {
    return fallback;
  }
}

function clampFloatingPosition(position: { x: number; y: number }): { x: number; y: number } {
  const maxX = Math.max(16, window.innerWidth - 260);
  const maxY = Math.max(16, window.innerHeight - 90);
  return {
    x: Math.min(maxX, Math.max(16, position.x)),
    y: Math.min(maxY, Math.max(16, position.y))
  };
}

function statusLabel(status: RedbookCapability["status"]): string {
  if (status === "ready") return "已接入";
  if (status === "partial") return "部分接入";
  if (status === "guarded") return "需确认";
  return "规划中";
}

function orchestrationStatusLabel(status: AiOrchestration["status"]): string {
  if (status === "queued") return "排队中";
  if (status === "running") return "执行中";
  if (status === "waiting") return "等待数据";
  if (status === "completed") return "已完成";
  if (status === "failed") return "失败";
  return "已取消";
}

function formatBreakerReason(reason: string): string {
  if (reason.includes("Daily detail-read budget reached")) {
    const match = reason.match(/\((\d+)\)/);
    const budget = match?.[1] ?? "当前";
    return `今日小红书读取额度已达上限（${budget}）。可明天继续，或在 .env.local 调整 XHS_DAILY_READ_BUDGET 后重启。`;
  }
  if (reason.includes("Empty response")) {
    return "小红书返回空响应，可能是 xsec_token 过期或触发了风控。建议重新登录/刷新 Cookie 后再恢复任务。";
  }
  if (reason.includes("NeedVerify") || reason.toLowerCase().includes("captcha")) {
    return "小红书要求验证，任务已暂停。请先在浏览器完成验证，再恢复任务。";
  }
  if (reason.includes("cookie") || reason.includes("Session")) {
    return "登录 Cookie 失效或缺失，请重新验证登录连接。";
  }
  return reason;
}

function formatAuthError(reason: string): string {
  if (reason.includes("NeedVerify") || reason.toLowerCase().includes("captcha")) {
    return "小红书要求验证，请先在浏览器完成验证，再重新验证登录连接。";
  }
  if (reason.toLowerCase().includes("cookie") || reason.includes("Session")) {
    return "登录 Cookie 失效或缺失，请重新粘贴 a1 / web_session 后验证。";
  }
  return reason;
}
