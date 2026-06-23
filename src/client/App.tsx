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
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import type {
  AiArtifact,
  AiAssistantMessage,
  AiModelConfig,
  AiPromptDetail,
  AiPromptInfo,
  AiPromptSource,
  AiReport,
  AiWorkflowDefinition,
  AiWorkflowKey,
  AnalyticsReport,
  AuthStatus,
  HealthReportRecord,
  NoteRecord,
  NoteTypeFilter,
  RedbookCapability,
  ReplyActionRecord,
  ReplyPlanRecord,
  ReplyStrategy,
  SearchJob,
  SearchSort
} from "../shared/types.js";
import { api } from "./lib/api.js";

type ModuleKey = "overview" | "research" | "notes" | "viral" | "audience" | "competitors" | "comments" | "prompts" | "ai";
type SortMode = "hot" | "likes" | "comments" | "collects" | "latest";

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
  const [cookieFields, setCookieFields] = useState({ a1: "", web_session: "", webId: "" });
  const [keywords, setKeywords] = useState("武汉相亲, 武汉脱单");
  const [sort, setSort] = useState<SearchSort>("popular");
  const [noteType, setNoteType] = useState<NoteTypeFilter>("all");
  const [pages, setPages] = useState(1);
  const [commentPages, setCommentPages] = useState(1);
  const [concurrency, setConcurrency] = useState(2);
  const [jobs, setJobs] = useState<SearchJob[]>([]);
  const [activeJobId, setActiveJobId] = useState("");
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
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantWidth, setAssistantWidth] = useState(() => readStoredNumber("xhs.aiDrawerWidth", 420));
  const [assistantMessages, setAssistantMessages] = useState<AiAssistantMessage[]>([]);
  const [assistantInput, setAssistantInput] = useState("");
  const [selectedWorkflow, setSelectedWorkflow] = useState<AiWorkflowKey>("content-planning");
  const [selectedArtifactId, setSelectedArtifactId] = useState("");
  const [selectedReportId, setSelectedReportId] = useState("");
  const [modelSettingsOpen, setModelSettingsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [authorQuery, setAuthorQuery] = useState("");
  const [minLikes, setMinLikes] = useState("");
  const [resultType, setResultType] = useState<NoteTypeFilter>("all");
  const [resultSort, setResultSort] = useState<SortMode>("hot");
  const [selectedId, setSelectedId] = useState("");
  const [replyStrategy, setReplyStrategy] = useState<ReplyStrategy>("questions");
  const [replyTemplate, setReplyTemplate] = useState("谢谢 {author} 的提问，我补充一下：");
  const [reportFocus, setReportFocus] = useState("话题机会、爆款结构、评论需求、可执行选题");
  const [modelForm, setModelForm] = useState({
    name: "",
    provider: "OpenAI-compatible",
    baseUrl: "https://api.openai.com/v1",
    model: "",
    apiKey: ""
  });
  const [modelMessages, setModelMessages] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const activeJob = jobs.find((job) => job.id === activeJobId);
  const selected = notes.find((note) => note.id === selectedId) ?? notes[0] ?? null;

  const refreshCore = useCallback(async () => {
    const [authStatus, allJobs, caps, models, workflows, prompts] = await Promise.all([
      api.authStatus(),
      api.listJobs(),
      api.capabilities(),
      api.listAiModels(),
      api.listAiWorkflows(),
      api.listAiPrompts()
    ]);
    const sortedJobs = allJobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setAuth(authStatus);
    setJobs(sortedJobs);
    setCapabilities(caps);
    setAiModels(models);
    setAiWorkflows(workflows);
    setAiPrompts(prompts);
    setError(clearRecoveredBackendError);
    if (!activeJobId && sortedJobs[0]) {
      setActiveJobId(sortedJobs[0].id);
    }
  }, [activeJobId]);

  const loadNotes = useCallback(async () => {
    const params = new URLSearchParams();
    if (activeJobId) params.set("jobId", activeJobId);
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
  }, [activeJobId, authorQuery, minLikes, notePage, notePageSize, query, resultSort, resultType, selectedId]);

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

  const loadPromptDetail = useCallback(async (key: AiWorkflowKey) => {
    const detail = await api.getAiPrompt(key);
    setSelectedPrompt(detail);
    setPromptDraft(detail.customTemplate || detail.defaultTemplate);
  }, []);

  useEffect(() => {
    setNotePage(1);
  }, [activeJobId, authorQuery, minLikes, query, resultSort, resultType]);

  useEffect(() => {
    void refreshCore().catch((err) => setError(err.message));
  }, [refreshCore]);

  useEffect(() => {
    void loadNotes().catch((err) => setError(err.message));
    void loadAnalytics().catch(() => setAnalytics(null));
    void loadOperations().catch(() => undefined);
  }, [loadAnalytics, loadNotes, loadOperations]);

  useEffect(() => {
    void loadPromptDetail(selectedPromptKey).catch((err) => setError(err.message));
  }, [loadPromptDetail, selectedPromptKey]);

  useEffect(() => {
    const timer = setInterval(() => {
      void refreshCore().catch(() => undefined);
      void loadNotes().catch(() => undefined);
      void loadAnalytics().catch(() => undefined);
      void loadOperations().catch(() => undefined);
    }, 7000);
    return () => clearInterval(timer);
  }, [loadAnalytics, loadNotes, loadOperations, refreshCore]);

  useEffect(() => {
    localStorage.setItem("xhs.aiDrawerWidth", String(assistantWidth));
  }, [assistantWidth]);

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
      setError(err instanceof Error ? err.message : String(err));
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

  async function createJob() {
    await run("job", async () => {
      const inputKeywords = keywords
        .split(/[,，\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
      const job = await api.createJob({ keywords: inputKeywords, sort, noteType, pages, commentPages, concurrency });
      setActiveJobId(job.id);
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

  async function clearCurrentNotes() {
    if (!activeJobId) return;
    await run("clear-notes", async () => {
      await api.clearNotes(activeJobId);
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

  async function saveModel() {
    await run("model", async () => {
      await api.saveAiModel({
        ...modelForm,
        isDefault: aiModels.length === 0,
        temperature: 0.4,
        maxTokens: 4000
      });
      setModelForm({ name: "", provider: "OpenAI-compatible", baseUrl: "https://api.openai.com/v1", model: "", apiKey: "" });
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

  async function createReport() {
    if (!activeJobId) return;
    await run("report", async () => {
      await api.createAiReport({ jobId: activeJobId, focus: reportFocus });
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

  async function runWorkflow(workflowKey: AiWorkflowKey, focus?: string) {
    const workflow = aiWorkflows.find((item) => item.key === workflowKey);
    if (workflow?.requires.includes("job") && !activeJobId) {
      setError("请先创建或选择一个关键词任务。");
      return;
    }
    if (workflow?.requires.includes("note") && !selected) {
      setError("请先选择一篇笔记。");
      return;
    }
    await run(`workflow-${workflowKey}`, async () => {
      const artifact = await api.runAiWorkflow({
        workflowKey,
        jobId: activeJobId || undefined,
        noteId: selected?.id,
        focus
      });
      setAiArtifacts((items) => [artifact, ...items.filter((item) => item.id !== artifact.id)]);
      setSelectedWorkflow(workflowKey);
      setSelectedArtifactId(artifact.id);
      setSelectedReportId("");
      setActiveModule("ai");
      await loadOperations();
    });
  }

  async function sendAssistantMessage() {
    const content = assistantInput.trim();
    if (!content) return;
    const userMessage: AiAssistantMessage = {
      id: `local_${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date().toISOString()
    };
    setAssistantMessages((messages) => [...messages, userMessage]);
    setAssistantInput("");
    await run("assistant-chat", async () => {
      const response = await api.assistantChat({
        message: content,
        jobId: activeJobId || undefined,
        noteId: selected?.id,
        module: activeModule
      });
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
  const defaultModel = aiModels.find((model) => model.isDefault) ?? aiModels[0];
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
          activeJob={activeJob}
          auth={auth}
          defaultModel={defaultModel}
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
            saveCookie={saveCookie}
            autoReadCookie={autoReadCookie}
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
            clearCurrentNotes={clearCurrentNotes}
            deleteSelectedNote={deleteSelectedNote}
            runWorkflow={runWorkflow}
            busy={busy}
          />
        )}
        {activeModule === "viral" && <ViralPage analytics={analytics} selected={selected} runWorkflow={runWorkflow} busy={busy} />}
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
            activeJob={activeJob}
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
        <ModelSettingsModal
          models={aiModels}
          modelForm={modelForm}
          setModelForm={setModelForm}
          saveModel={saveModel}
          testModel={testModel}
          modelMessages={modelMessages}
          busy={busy}
          onClose={() => setModelSettingsOpen(false)}
        />
      )}
      {!assistantOpen && (
        <AiAssistantEntry onOpen={() => setAssistantOpen(true)} context={activeJob ? activeJob.keywords.join(" / ") : "暂无任务"} />
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
        workflows={visibleWorkflows.length ? visibleWorkflows : aiWorkflows.slice(0, 4)}
        runWorkflow={runWorkflow}
        contextItems={[
          activeJob ? `任务：${activeJob.keywords.join(" / ")}` : "无当前任务",
          selected ? `笔记：${selected.title}` : "未选择笔记",
          `笔记数：${notesTotal}`,
          defaultModel ? `模型：${defaultModel.name}` : "未配置模型"
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

function ContextBadgeRow({ items }: { items: string[] }) {
  return (
    <div className="context-badges">
      {items.map((item) => <span key={item}>{item}</span>)}
    </div>
  );
}

function CompactTaskBar({
  moduleLabel,
  activeJob,
  auth,
  defaultModel,
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
        <strong>{activeJob ? activeJob.keywords.join(" / ") : "等待创建关键词任务"}</strong>
      </div>
      <ContextBadgeRow
        items={[
          auth.connected ? "Cookie 已连接" : auth.error ? "连接失效" : "待验证",
          defaultModel ? `模型 ${defaultModel.name}` : "未配置模型",
          activeJob ? `并发 ${activeJob.concurrency ?? 2}` : "无任务",
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
  onRun: (workflowKey: AiWorkflowKey) => Promise<void>;
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
  saveCookie,
  autoReadCookie,
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
  saveCookie: () => Promise<void>;
  autoReadCookie: () => Promise<void>;
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
    <div className="page-grid">
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
          saveCookie={saveCookie}
          autoReadCookie={autoReadCookie}
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
  runWorkflow: (workflowKey: AiWorkflowKey) => Promise<void>;
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
        <textarea value={props.keywords} onChange={(event) => props.setKeywords(event.target.value)} />
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

      <section className="surface">
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
        <div className="data-table">
          <div className="table-head">
            <span>关键词</span>
            <span>层级</span>
            <span>Top1</span>
            <span>机会分</span>
          </div>
          {props.analytics?.keywords.slice(0, 10).map((item) => (
            <div className="table-row" key={item.keyword}>
              <strong>{item.keyword}</strong>
              <span>{item.tier}</span>
              <span>{formatNumber(item.top1Likes)}</span>
              <span>{formatNumber(item.opportunityScore)}</span>
            </div>
          ))}
          {!props.analytics?.keywords.length && <EmptyState text="等待搜索数据" />}
        </div>
      </section>
      <section className="surface">
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
  clearCurrentNotes: () => Promise<void>;
  deleteSelectedNote: () => Promise<void>;
  runWorkflow: (workflowKey: AiWorkflowKey) => Promise<void>;
  busy: string;
}) {
  return (
    <div className="notes-layout">
      <section className="surface notes-panel">
        <SectionTitle
          icon={<Database size={18} />}
          title="笔记库"
          action={
            <button
              className="ghost-button compact danger"
              onClick={() => void props.clearCurrentNotes()}
              disabled={!props.activeJobId || props.busy === "clear-notes" || props.total === 0}
            >
              {props.busy === "clear-notes" ? <Loader2 className="spin" size={15} /> : <Trash2 size={15} />}
              清空当前任务
            </button>
          }
        />
        <div className="filter-row">
          <input value={props.query} onChange={(event) => { props.setPage(1); props.setQuery(event.target.value); }} placeholder="标题、正文、关键词" />
          <input value={props.authorQuery} onChange={(event) => { props.setPage(1); props.setAuthorQuery(event.target.value); }} placeholder="作者" />
          <input value={props.minLikes} onChange={(event) => { props.setPage(1); props.setMinLikes(event.target.value); }} placeholder="最低赞" />
          <select value={props.resultType} onChange={(event) => { props.setPage(1); props.setResultType(event.target.value as NoteTypeFilter); }}>
            <option value="all">全部</option>
            <option value="image">图文</option>
            <option value="video">视频</option>
          </select>
          <select value={props.resultSort} onChange={(event) => { props.setPage(1); props.setResultSort(event.target.value as SortMode); }}>
            <option value="hot">热度</option>
            <option value="likes">点赞</option>
            <option value="comments">评论</option>
            <option value="collects">收藏</option>
            <option value="latest">最新</option>
          </select>
        </div>
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
          {!props.notes.length && <EmptyState text="暂无结果" />}
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
      <NoteDetail note={props.selected} onDelete={props.deleteSelectedNote} runWorkflow={props.runWorkflow} busy={props.busy} />
    </div>
  );
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

function ViralPage({
  analytics,
  selected,
  runWorkflow,
  busy
}: {
  analytics: AnalyticsReport | null;
  selected: NoteRecord | null;
  runWorkflow: (workflowKey: AiWorkflowKey) => Promise<void>;
  busy: string;
}) {
  return (
    <div className="viral-layout">
      <section className="surface">
        <SectionTitle
          icon={<Flame size={18} />}
          title="爆款模板"
          action={
            <button className="primary-button compact" onClick={() => void runWorkflow("viral-template")} disabled={busy === "workflow-viral-template"}>
              {busy === "workflow-viral-template" ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}
              生成模板
            </button>
          }
        />
        <div className="template-list">
          {analytics?.templates.map((item) => (
            <div key={item.noteId} className="template-item">
              <strong>{item.title}</strong>
              <span>爆款分 {item.score} · {item.contentType}</span>
              <div>{item.hookPatterns.map((hook) => <em key={hook}>{hook}</em>)}</div>
            </div>
          ))}
          {!analytics?.templates.length && <EmptyState text="等待分析结果" />}
        </div>
      </section>
      <section className="surface">
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
          <div className="analysis-grid">
            <Metric label="爆款分" value={String(selected.analysis.score)} />
            <Metric label="收藏/赞" value={`${Math.round(selected.analysis.collectLikeRatio * 100)}%`} />
            <Metric label="评论/赞" value={`${Math.round(selected.analysis.commentLikeRatio * 100)}%`} />
            <Metric label="作者倍数" value={`${selected.analysis.viralMultiplier}x`} />
            <div className="theme-cloud">
              {selected.analysis.commentThemes.map((theme) => (
                <span key={theme.keyword}>{theme.keyword} · {theme.count}</span>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState text="请选择已完成分析的笔记" />
        )}
      </section>
      <section className="surface">
        <SectionTitle icon={<Bot size={18} />} title="AI 深度解释" />
        {selected?.analysis ? (
          <InsightPanel
            title="可复用结构"
            lines={[
              `标题钩子：${selected.analysis.hookPatterns.join("、") || "暂无明显钩子"}`,
              `内容类型：${selected.analysis.contentType}`,
              `互动结构：收藏/赞 ${Math.round(selected.analysis.collectLikeRatio * 100)}%，评论/赞 ${Math.round(selected.analysis.commentLikeRatio * 100)}%`,
              "复刻建议：保留标题冲突点，正文增加清单和真实案例，评论区承接高频问题。"
            ]}
          />
        ) : (
          <EmptyState text="选择一篇完成分析的笔记后查看 AI 拆解入口" />
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
  runWorkflow: (workflowKey: AiWorkflowKey) => Promise<void>;
  busy: string;
}) {
  const themes = notes.flatMap((note) => note.analysis?.commentThemes ?? []).slice(0, 18);
  const latest = artifacts.find((artifact) => artifact.workflowKey === "audience-insight");
  return (
    <div className="page-grid">
      <section className="surface">
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
        <div className="theme-cloud">
          {themes.map((theme, index) => <span key={`${theme.keyword}-${index}`}>{theme.keyword} · {theme.count}</span>)}
        </div>
      </section>
      <section className="surface">
        <SectionTitle icon={<Bot size={18} />} title="AI 人群画像" />
        {latest ? <MarkdownView content={latest.markdown} compact /> : <EmptyState text="运行受众洞察后生成画像、痛点和用户原话" />}
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
  runWorkflow: (workflowKey: AiWorkflowKey) => Promise<void>;
  busy: string;
}) {
  const latest = artifacts.find((artifact) => artifact.workflowKey === "competitor-analysis");
  return (
    <div className="page-grid">
      <section className="surface">
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
        <div className="data-table">
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
          {!analytics?.authors.length && <EmptyState text="等待作者与作者作品数据" />}
        </div>
      </section>
      <section className="surface">
        <SectionTitle icon={<Bot size={18} />} title="AI 竞品判断" />
        {latest ? <MarkdownView content={latest.markdown} compact /> : <EmptyState text="运行竞品分析后生成账号对比和追赶机会" />}
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

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      nodes.push(<code key={`code-${match.index}`}>{match[1]}</code>);
    } else if (match[2] && match[3]) {
      nodes.push(<a key={`link-${match.index}`} href={match[3]} target="_blank" rel="noreferrer">{match[2]}</a>);
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
          action={
            selectedPrompt ? (
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
            ) : undefined
          }
        />
        {selectedPrompt ? (
          <div className="prompt-editor-layout">
            <div className="prompt-status-strip">
              <span className={selectedPrompt.promptSource === "custom" ? "status-pill active" : "status-pill"}>当前：{selectedPrompt.promptSource === "custom" ? "自定义 Prompt" : "默认 Prompt"}</span>
              <span className="status-pill">{selectedPrompt.version}</span>
              <span className="status-pill">产物 {selectedPrompt.artifactCount ?? 0}</span>
            </div>
            <textarea className="prompt-editor" value={promptDraft} onChange={(event) => setPromptDraft(event.target.value)} />
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
  runWorkflow: (workflowKey: AiWorkflowKey) => Promise<void>;
  busy: string;
}) {
  const selectedArtifact = props.artifacts.find((artifact) => artifact.id === props.selectedArtifactId);
  const selectedReport = props.reports.find((report) => report.id === props.selectedReportId);
  const preview =
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
    <div className="ai-workbench-grid">
      <section className="surface ai-library-panel">
        <SectionTitle icon={<Sparkles size={18} />} title="AI 产物中心" />
        <ArtifactList
          artifacts={props.artifacts}
          selectedId={props.selectedArtifactId}
          selectArtifact={selectArtifact}
          busy={props.busy}
          deleteArtifact={props.deleteArtifact}
        />
        <div className="prompt-version-list">
          <strong>Prompt 版本</strong>
          {props.prompts.map((prompt) => (
            <button key={prompt.key} className="prompt-version-row" onClick={() => props.setSelectedArtifactId("")}>
              <span>{prompt.title}</span>
              <small>{prompt.version} · {prompt.outputSections.slice(0, 3).join(" / ")}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="surface markdown-preview">
        <SectionTitle
          icon={preview?.kind === "report" ? <FileText size={18} /> : <Bot size={18} />}
          title={preview?.title ?? "AI 阅读区"}
          action={preview ? (
            <div className="button-row">
              {selectedArtifact?.promptKey && selectedArtifact.promptKey !== "assistant" && selectedArtifact.promptKey !== "report" && (
                <button className="ghost-button compact" onClick={() => props.openPrompt(selectedArtifact.promptKey as AiWorkflowKey)}>
                  <KeyRound size={14} />
                  查看 Prompt
                </button>
              )}
              {selectedArtifactWorkflow && (
                <button className="ghost-button compact" onClick={() => void props.runWorkflow(selectedArtifactWorkflow)} disabled={props.busy === `workflow-${selectedArtifactWorkflow}`}>
                  {props.busy === `workflow-${selectedArtifactWorkflow}` ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}
                  重新生成
                </button>
              )}
              <a className="ghost-button compact" href={preview.exportUrl}>
                <Download size={14} />
                导出
              </a>
              <button className="ghost-button compact" onClick={() => { props.setSelectedArtifactId(""); props.setSelectedReportId(""); }}>
                <X size={14} />
                关闭
              </button>
            </div>
          ) : undefined}
        />
        {preview ? (
          <>
            <ContextBadgeRow items={preview.meta} />
            <MarkdownView content={preview.markdown} />
          </>
        ) : (
          <EmptyState text="选择左侧 AI 产物或下方报告后在这里阅读" />
        )}
      </section>

      <ReportsPage
        activeJob={props.activeJob}
        reports={props.reports}
        selectedReportId={props.selectedReportId}
        selectReport={selectReport}
        reportFocus={props.reportFocus}
        setReportFocus={props.setReportFocus}
        createReport={props.createReport}
        deleteReport={props.deleteReport}
        busy={props.busy}
      />
      <section className="surface artifact-context-panel">
        <SectionTitle icon={<Gauge size={18} />} title="上下文与联动" />
        {selectedArtifact ? (
          <div className="artifact-context">
            <StatusRow label="Prompt" value={selectedArtifact.promptTitle ?? "未记录"} ok={Boolean(selectedArtifact.promptTitle)} />
            <StatusRow label="来源" value={selectedArtifact.promptSource === "custom" ? "自定义" : "默认/未记录"} ok={selectedArtifact.promptSource === "custom"} />
            <StatusRow label="版本" value={selectedArtifact.promptVersion ?? "未记录"} ok={Boolean(selectedArtifact.promptVersion)} />
            <StatusRow label="状态" value={selectedArtifact.status} ok={selectedArtifact.status === "completed"} />
          </div>
        ) : (
          <EmptyState text="选择一个产物后查看 Prompt、模型和上下文信息" />
        )}
      </section>
    </div>
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
  workflows: AiWorkflowDefinition[];
  runWorkflow: (workflowKey: AiWorkflowKey) => Promise<void>;
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
  return (
    <aside className="assistant-drawer" style={{ width }}>
      <button className="assistant-resizer" onMouseDown={startResize} aria-label="调整 AI 助手宽度">
        <GripVertical size={16} />
      </button>
      <SectionTitle
        icon={<Bot size={18} />}
        title="AI 助手"
        action={
          <button className="ghost-button compact" onClick={onClose}>
            <X size={14} />
            收起
          </button>
        }
      />
      <ContextBadgeRow items={contextItems} />
      <div className="assistant-quick">
        {workflows.slice(0, 6).map((workflow) => (
          <button key={workflow.key} className="ghost-button compact" onClick={() => void runWorkflow(workflow.key)} disabled={busy === `workflow-${workflow.key}`}>
            {workflow.title}
          </button>
        ))}
      </div>
      <div className="assistant-messages">
        {messages.map((message) => (
          <div key={message.id} className={`assistant-message ${message.role}`}>
            <strong>{message.role === "user" ? "你" : "AI 助手"}</strong>
            {message.role === "assistant" ? <MarkdownView content={message.content} compact /> : <p>{message.content}</p>}
          </div>
        ))}
        {!messages.length && <EmptyState text="可以询问选题、受众、竞品、爆款拆解或评论运营建议" />}
      </div>
      <div className="assistant-input">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="问 AI：基于当前任务，我下一步该做什么？" />
        <button className="primary-button full" onClick={() => void sendMessage()} disabled={busy === "assistant-chat" || !input.trim()}>
          {busy === "assistant-chat" ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
          发送
        </button>
      </div>
    </aside>
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

function ModelSettingsModal(props: {
  models: AiModelConfig[];
  modelForm: { name: string; provider: string; baseUrl: string; model: string; apiKey: string };
  setModelForm: (value: { name: string; provider: string; baseUrl: string; model: string; apiKey: string }) => void;
  saveModel: () => Promise<void>;
  testModel: (modelId: string) => Promise<void>;
  modelMessages: Record<string, { ok: boolean; message: string }>;
  busy: string;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="model-settings-modal">
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
        <ModelsPage
          models={props.models}
          modelForm={props.modelForm}
          setModelForm={props.setModelForm}
          saveModel={props.saveModel}
          testModel={props.testModel}
          modelMessages={props.modelMessages}
          busy={props.busy}
        />
      </section>
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
    <div className="page-grid">
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
  runWorkflow,
  busy
}: {
  note: NoteRecord | null;
  onDelete: () => Promise<void>;
  runWorkflow: (workflowKey: AiWorkflowKey) => Promise<void>;
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
            <a className="ghost-button compact" href={note.webUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={15} />
              原帖
            </a>
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
  saveCookie,
  autoReadCookie,
  busy
}: {
  auth: AuthStatus;
  cookieFields: { a1: string; web_session: string; webId: string };
  setCookieFields: (value: { a1: string; web_session: string; webId: string }) => void;
  saveCookie: () => Promise<void>;
  autoReadCookie: () => Promise<void>;
  busy: string;
}) {
  return (
    <section className="surface command-surface">
      <SectionTitle icon={<ShieldCheck size={18} />} title="登录连接" />
      <div className="button-row">
        <button className="ghost-button" onClick={() => window.open("https://www.xiaohongshu.com/", "_blank")}>
          <ExternalLink size={16} />
          打开
        </button>
        <button className="ghost-button" onClick={() => void autoReadCookie()} disabled={busy === "auth"}>
          {busy === "auth" ? <Loader2 className="spin" size={16} /> : <KeyRound size={16} />}
          自动读取
        </button>
      </div>
      <input value={cookieFields.a1} onChange={(event) => setCookieFields({ ...cookieFields, a1: event.target.value })} placeholder="a1" />
      <input value={cookieFields.web_session} onChange={(event) => setCookieFields({ ...cookieFields, web_session: event.target.value })} placeholder="web_session" />
      <input value={cookieFields.webId} onChange={(event) => setCookieFields({ ...cookieFields, webId: event.target.value })} placeholder="webId（可选）" />
      <button className="primary-button full" onClick={() => void saveCookie()} disabled={busy === "auth" || !cookieFields.a1 || !cookieFields.web_session}>
        {busy === "auth" ? <Loader2 className="spin" size={16} /> : <LogIn size={16} />}
        验证
      </button>
      <StatusRow label="状态" value={auth.connected ? "已连接" : auth.error ? "连接失效" : "未连接"} ok={auth.connected} />
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

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

function formatNumber(value: number): string {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}亿`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(1)}万`;
  return String(value);
}

function readStoredNumber(key: string, fallback: number): number {
  const raw = localStorage.getItem(key);
  const value = raw ? Number(raw) : fallback;
  return Number.isFinite(value) ? Math.min(640, Math.max(360, value)) : fallback;
}

function isAiWorkflowKey(value: AiArtifact["workflowKey"]): value is AiWorkflowKey {
  return value !== "assistant";
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
