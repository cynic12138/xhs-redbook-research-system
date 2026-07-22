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
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import type {
  AiArtifact,
  AiAssistantMessage,
  AiCustomPrompt,
  AiCustomPromptCategory,
  AiCustomPromptInput,
  AiCustomPromptMode,
  AiCustomPromptPreview,
  AiCustomPromptRevision,
  AiGoalRun,
  AiModelConfig,
  AiOrchestration,
  AiPromptDetail,
  AiPromptGuidedConfig,
  AiPromptInfo,
  AiPromptMode,
  AiPromptPreview,
  AiPromptResetScope,
  AiPromptValidationMessage,
  AiPromptVariableInfo,
  AiReport,
  AiWorkflowDefinition,
  AiWorkflowKey,
  AnalyticsReport,
  AuthStatus,
  BrowserBridgeStatus,
  ContentDraft,
  ContentDraftLength,
  ContentPlaybook,
  ContentPlaybookInput,
  ContentPlaybookRevision,
  ContentPlaybookStats,
  ContentProject,
  ContentProjectInput,
  ContentProjectMaterial,
  ContentProjectMaterialCategory,
  ContentProjectStatus,
  ContentReviewRun,
  CredentialSecurityStatus,
  HealthReportRecord,
  NoteBulkDeletePreview,
  NoteScopeClearPreview,
  NoteScopeSummary,
  NoteRecord,
  NoteTypeFilter,
  RedbookCapability,
  ReplyActionRecord,
  ReplyPlanRecord,
  ReplyStrategy,
  SearchJob,
  SearchSort,
  StorageStatus,
  LegacyImportPreview
} from "../shared/types.js";
import { AI_MODEL_PROVIDER_PRESETS, findModelProviderPreset, type AiModelProviderKey } from "../shared/modelProviders.js";
import { WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY } from "../shared/contentReviewPolicy.js";
import { api } from "./lib/api.js";
import { credentialSecurityPresentation, shouldOpenCredentialSettings } from "./securityStatus.js";
import { generateBrowserPairingCode, hashBrowserPairingCode, pairingSecondsRemaining } from "./browserPairing.js";

type ModuleKey = "overview" | "research" | "notes" | "viral" | "audience" | "competitors" | "comments" | "content" | "prompts" | "ai";
type SortMode = "hot" | "likes" | "comments" | "collects" | "latest";
type ModelForm = { providerKey: AiModelProviderKey; name: string; provider: string; baseUrl: string; model: string; apiKey: string };
type ReaderPreview = { kind: "artifact" | "report"; title: string; markdown: string; meta: string[]; exportUrl: string };
type RunWorkflowOptions = { noteId?: string; noteIds?: string[] };
type RunWorkflow = (workflowKey: AiWorkflowKey, focus?: string, options?: RunWorkflowOptions) => Promise<AiArtifact | undefined>;
type ContentBriefForm = {
  productName: string;
  persona: string;
  painPoint: string;
  scenario: string;
  channel: string;
  sellingPoints: string;
  tone: string;
  length: ContentDraftLength;
  keywords: string;
};
export type ContentReviewForm = { title: string; body: string; tags: string };
type ContentStudioTab = "projects" | "review" | "batch" | "write" | "rules" | "results";
type PromptEditorTab = "guided" | "advanced" | "preview";
type PromptScope = "system" | "custom";
type CustomPromptTab = "guided" | "advanced" | "preview" | "versions";
export type AiResourceScope = "all" | "current";
type BatchReviewItem = { id: string; title: string; body: string; tags: string; selected: boolean };
type ContentProjectForm = {
  name: string;
  productName: string;
  targetAudience: string;
  scenarios: string;
  goals: string;
  playbookId: string;
  jobId: string;
  status: ContentProjectStatus;
};
export type ContentPlaybookForm = {
  name: string;
  productName: string;
  category: string;
  forbiddenTerms: string;
  sensitiveClaims: string;
  allowedSellingPoints: string;
  requiredSections: string;
  toneWords: string;
  personas: string;
  scenarios: string;
  tags: string;
  replacements: string;
};
export type ContentPlaybookTemplateKey = "specialty" | "general" | "maternal" | "food" | "education";
export type ContentReviewRuleSummary = {
  label: string;
  forbiddenTermCount: number;
  sensitiveClaimCount: number;
};
export const DEFAULT_CONTENT_REVIEW_RULE_LABEL = `${WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.name}（内置默认）`;
type AssistantSearchPlan = {
  instruction: string;
  keywords: string[];
};
type ContentStudioProps = {
  activeTab: ContentStudioTab;
  setActiveTab: (value: ContentStudioTab) => void;
  activeJob?: SearchJob;
  projects: ContentProject[];
  selectedProjectId: string;
  setSelectedProjectId: (value: string) => void;
  projectForm: ContentProjectForm;
  setProjectForm: (value: ContentProjectForm) => void;
  projectDirty: boolean;
  setProjectDirty: (value: boolean) => void;
  projectMaterials: ContentProjectMaterial[];
  deleteProjectMaterial: (materialId: string) => Promise<void>;
  playbooks: ContentPlaybook[];
  selectedPlaybookId: string;
  setSelectedPlaybookId: (value: string) => void;
  playbookForm: ContentPlaybookForm;
  setPlaybookForm: (value: ContentPlaybookForm) => void;
  playbookDirty: boolean;
  setPlaybookDirty: (value: boolean) => void;
  playbookRevisions: ContentPlaybookRevision[];
  playbookStats: ContentPlaybookStats | null;
  restorePlaybookRevision: (revisionId: string) => Promise<void>;
  briefForm: ContentBriefForm;
  setBriefForm: (value: ContentBriefForm) => void;
  batchDraftCount: number;
  setBatchDraftCount: (value: number) => void;
  reviewForm: ContentReviewForm;
  setReviewForm: (value: ContentReviewForm) => void;
  batchItems: BatchReviewItem[];
  setBatchItems: (value: BatchReviewItem[]) => void;
  drafts: ContentDraft[];
  reviews: ContentReviewRun[];
  artifacts: AiArtifact[];
  jobs: SearchJob[];
  createProject: () => void;
  deleteProject: () => Promise<void>;
  saveProject: () => Promise<void>;
  createPlaybook: () => void;
  deletePlaybook: () => Promise<void>;
  savePlaybookAsNew: () => Promise<void>;
  generateDraft: () => Promise<void>;
  generateDraftBatch: () => Promise<void>;
  reviewDraft: () => Promise<void>;
  reviewBatch: (items: BatchReviewItem[]) => Promise<void>;
  acceptDraftReview: (draftId: string, reviewId?: string) => Promise<void>;
  savePlaybook: () => Promise<void>;
  openArtifact: (artifactId: string) => void;
  openDraftReviewPrompt: () => void;
  loadReviewForRereview: (review: ContentReviewRun) => void;
  reviewExecutionLabel: string;
  busy: string;
};
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

const defaultContentBriefForm: ContentBriefForm = {
  productName: WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.productName,
  persona: "孕妈",
  painPoint: "孕期便秘、出门不方便",
  scenario: "日常分享",
  channel: "朋友推荐",
  sellingPoints: "细头设计, 掌心大小, 温和表达",
  tone: "口语化、真实分享、少广告感",
  length: "medium",
  keywords: "日常分享, 好物分享"
};

const defaultContentReviewForm: ContentReviewForm = {
  title: "",
  body: "",
  tags: ""
};

const defaultBatchReviewItems: BatchReviewItem[] = [createBatchReviewItem()];

const defaultCustomPromptGuidedConfig: AiPromptGuidedConfig = {
  role: "小红书运营助手",
  objective: "结合当前任务资料，输出运营用户可直接使用的分析或内容建议。",
  focusRules: ["只基于已读取资料输出结论。", "把数据依据、用户洞察和行动建议分开。", "资料不足时明确说明缺口。"],
  forbiddenRules: ["不编造数据、作者、评论或平台规则。", "不建议自动发布、自动评论、自动点赞、自动收藏。", "不输出夸大功效、医疗疗效或保证承诺。"],
  outputSections: ["核心结论", "依据", "行动建议", "风险与缺口"],
  enabledVariables: ["job", "overview", "topNotes", "topComments", "focus"]
};

const defaultCustomPromptForm: AiCustomPromptInput = {
  title: "运营分析提示词",
  description: "选择资料来源，让 AI 按团队方法输出分析、审稿或创作结果。",
  category: "general-ops",
  mode: "guided",
  guidedConfig: defaultCustomPromptGuidedConfig,
  advancedTemplate: "",
  status: "active"
};

const defaultContentProjectForm: ContentProjectForm = {
  name: "周十五蜂蜜露种草项目",
  productName: WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.productName,
  targetAudience: "孕妈, 大学生, 上班族",
  scenarios: "出门携带, 日常分享, 朋友推荐",
  goals: "生成多篇种草笔记, 批量审稿, 归档可复盘",
  playbookId: "",
  jobId: "",
  status: "planning"
};

export function createDefaultContentPlaybookForm(): ContentPlaybookForm {
  return {
    name: WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.name,
    productName: WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.productName,
    category: WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.category,
    forbiddenTerms: WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.forbiddenTerms.join(", "),
    sensitiveClaims: WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.sensitiveClaims.join(", "),
    allowedSellingPoints: WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.allowedSellingPoints.join(", "),
    requiredSections: WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.requiredSections.join(", "),
    toneWords: WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.toneWords.join(", "),
    personas: WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.personas.join(", "),
    scenarios: WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.scenarios.join(", "),
    tags: WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.tags.join(", "),
    replacements: formatReplacementRules(WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.replacements)
  };
}

const defaultPlaybookForm = createDefaultContentPlaybookForm();

const defaultStructuredPlaybookFields = {
  requiredSections: "标题, 内容, 标签",
  toneWords: "口语化, 真实分享, 生活化",
  replacements: formatReplacementRules([
    { from: "闭眼冲", to: "可以按自己的需求看看", reason: "避免强购买引导" },
    { from: "百分百有效", to: "这是我的个人使用感受", reason: "避免绝对化承诺" }
  ])
};

export const contentPlaybookTemplates: Array<{
  key: ContentPlaybookTemplateKey;
  label: string;
  description: string;
  form: ContentPlaybookForm;
}> = [
  {
    key: "specialty",
    label: "周十五蜂蜜露专项",
    description: "内置专项审稿规则，覆盖产品纠错、语气和结构化替换。",
    form: defaultPlaybookForm
  },
  {
    key: "general",
    label: "通用种草",
    description: "适合大多数生活好物、日常分享和素人种草。",
    form: {
      ...defaultPlaybookForm,
      ...defaultStructuredPlaybookFields,
      name: "通用种草审稿规则",
      productName: "产品",
      category: "小红书种草",
      forbiddenTerms: "yyds, 封神, 救命神器, 效果拉满, 绝了, 无敌, 性价比天花板, 闭眼冲, 必囤, 无限回购",
      sensitiveClaims: "治疗, 治愈, 药效, 特效, 根治, 通便特效, 杜绝依赖, 百分百有效",
      allowedSellingPoints: "真实使用感, 生活场景, 携带方便, 温和表达",
      personas: "孕妈, 大学生, 上班族",
      scenarios: "日常分享, 出门携带, 朋友推荐",
      tags: "日常分享, 好物分享, 真实体验"
    }
  },
  {
    key: "maternal",
    label: "母婴孕妈",
    description: "弱化医疗功效，强调真实体验、生活场景和温和表达。",
    form: {
      ...defaultStructuredPlaybookFields,
      name: "母婴孕妈审稿规则",
      productName: "产品",
      category: "母婴小红书种草",
      forbiddenTerms: "yyds, 封神, 救命神器, 效果拉满, 闭眼冲, 必囤, 无限回购, 性价比天花板, 宝妈必备, 孕妇必备",
      sensitiveClaims: "治疗, 治愈, 药效, 特效, 根治, 通便特效, 杜绝依赖, 宫缩风险, 早产风险, 无副作用, 百分百有效",
      allowedSellingPoints: "真实使用感, 生活场景, 携带方便, 温和表达, 个人体验, 使用前后主观感受",
      personas: "孕妈, 宝妈, 备孕人群, 新手妈妈",
      scenarios: "孕期日常, 出门携带, 家中备用, 朋友推荐, 产检路上",
      tags: "孕期好物, 母婴好物, 日常分享, 真实体验, 孕妈日常"
    }
  },
  {
    key: "food",
    label: "食品饮品",
    description: "适合食品、饮品、营养补充类内容，避免功效化和绝对健康承诺。",
    form: {
      ...defaultStructuredPlaybookFields,
      name: "食品饮品审稿规则",
      productName: "产品",
      category: "食品饮品种草",
      forbiddenTerms: "绝绝子, 封神, 闭眼冲, 必囤, 全网最低, 无限回购, 第一口惊艳, 减脂神器",
      sensitiveClaims: "治疗, 调理体质, 降糖, 降脂, 减肥, 排毒, 增强免疫, 零添加, 最健康, 无负担",
      allowedSellingPoints: "口感描述, 食用场景, 配料感受, 便携性, 饱腹感, 个人喜好",
      personas: "上班族, 学生党, 宝妈, 健身人群",
      scenarios: "早餐搭配, 办公室加餐, 宿舍备用, 运动后, 出差携带",
      tags: "食品分享, 饮品分享, 办公室好物, 日常分享, 真实体验"
    }
  },
  {
    key: "education",
    label: "教育课程",
    description: "适合课程、训练营、学习工具，避免保过、速成和焦虑营销。",
    form: {
      ...defaultStructuredPlaybookFields,
      name: "教育课程审稿规则",
      productName: "产品",
      category: "教育课程种草",
      forbiddenTerms: "逆袭神器, 保姆式, 闭眼冲, 必买, 不学后悔, 全网最强, 名师天花板",
      sensitiveClaims: "保过, 包过, 保证提分, 7天逆袭, 零基础速成, 必上岸, 稳赚, 百分百有效",
      allowedSellingPoints: "学习路径, 练习反馈, 陪伴感, 适合人群, 时间安排, 个人学习体验",
      personas: "学生党, 考证人群, 职场新人, 转行人群",
      scenarios: "备考复习, 通勤学习, 晚间自习, 周末提升, 碎片时间",
      tags: "学习分享, 备考经验, 课程体验, 自我提升, 真实体验"
    }
  }
];

const modules: Array<{ key: ModuleKey; label: string; icon: ReactNode }> = [
  { key: "overview", label: "总览", icon: <Activity size={18} /> },
  { key: "research", label: "话题研究", icon: <Compass size={18} /> },
  { key: "notes", label: "笔记库", icon: <Database size={18} /> },
  { key: "viral", label: "爆款拆解", icon: <Flame size={18} /> },
  { key: "audience", label: "受众洞察", icon: <HeartHandshake size={18} /> },
  { key: "competitors", label: "竞品分析", icon: <Layers size={18} /> },
  { key: "comments", label: "评论运营", icon: <MessageSquareReply size={18} /> },
  { key: "content", label: "内容创作台", icon: <FileText size={18} /> },
  { key: "prompts", label: "提示词", icon: <KeyRound size={18} /> },
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
  const [pairingCode, setPairingCode] = useState("");
  const [pairingClock, setPairingClock] = useState(Date.now());
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
  const [bulkDeletePreview, setBulkDeletePreview] = useState<NoteBulkDeletePreview | null>(null);
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
  const [scopedAiReports, setScopedAiReports] = useState<AiReport[]>([]);
  const [aiResourceScope, setAiResourceScope] = useState<AiResourceScope>("all");
  const [aiWorkflows, setAiWorkflows] = useState<AiWorkflowDefinition[]>([]);
  const [aiPrompts, setAiPrompts] = useState<AiPromptInfo[]>([]);
  const [aiCustomPrompts, setAiCustomPrompts] = useState<AiCustomPrompt[]>([]);
  const [selectedPromptScope, setSelectedPromptScope] = useState<PromptScope>("system");
  const [selectedPromptKey, setSelectedPromptKey] = useState<AiWorkflowKey>("content-planning");
  const [selectedPrompt, setSelectedPrompt] = useState<AiPromptDetail | null>(null);
  const [promptTab, setPromptTab] = useState<PromptEditorTab>("guided");
  const [guidedPromptDraft, setGuidedPromptDraft] = useState<AiPromptGuidedConfig | null>(null);
  const [advancedPromptDraft, setAdvancedPromptDraft] = useState("");
  const [promptPreview, setPromptPreview] = useState<AiPromptPreview | null>(null);
  const [selectedCustomPromptId, setSelectedCustomPromptId] = useState("");
  const [customPromptTab, setCustomPromptTab] = useState<CustomPromptTab>("guided");
  const [customPromptForm, setCustomPromptForm] = useState<AiCustomPromptInput>(defaultCustomPromptForm);
  const [customPromptPreview, setCustomPromptPreview] = useState<AiCustomPromptPreview | null>(null);
  const [customPromptRevisions, setCustomPromptRevisions] = useState<AiCustomPromptRevision[]>([]);
  const [aiArtifacts, setAiArtifacts] = useState<AiArtifact[]>([]);
  const [scopedAiArtifacts, setScopedAiArtifacts] = useState<AiArtifact[]>([]);
  const [openedArtifactSnapshot, setOpenedArtifactSnapshot] = useState<AiArtifact | null>(null);
  const [contentProjects, setContentProjects] = useState<ContentProject[]>([]);
  const [selectedContentProjectId, setSelectedContentProjectId] = useState("");
  const [contentProjectForm, setContentProjectForm] = useState<ContentProjectForm>(defaultContentProjectForm);
  const [contentProjectDirty, setContentProjectDirty] = useState(false);
  const [contentProjectMaterials, setContentProjectMaterials] = useState<ContentProjectMaterial[]>([]);
  const [contentPlaybooks, setContentPlaybooks] = useState<ContentPlaybook[]>([]);
  const [selectedContentPlaybookId, setSelectedContentPlaybookId] = useState("");
  const [contentPlaybookRevisions, setContentPlaybookRevisions] = useState<ContentPlaybookRevision[]>([]);
  const [contentPlaybookStats, setContentPlaybookStats] = useState<ContentPlaybookStats | null>(null);
  const [contentDrafts, setContentDrafts] = useState<ContentDraft[]>([]);
  const [contentReviews, setContentReviews] = useState<ContentReviewRun[]>([]);
  const [contentBriefForm, setContentBriefForm] = useState<ContentBriefForm>(defaultContentBriefForm);
  const [contentDraftBatchCount, setContentDraftBatchCount] = useState(3);
  const [contentReviewForm, setContentReviewForm] = useState<ContentReviewForm>(defaultContentReviewForm);
  const [contentBatchItems, setContentBatchItems] = useState<BatchReviewItem[]>(defaultBatchReviewItems);
  const [contentStudioTab, setContentStudioTab] = useState<ContentStudioTab>("review");
  const [contentPlaybookForm, setContentPlaybookForm] = useState<ContentPlaybookForm>(defaultPlaybookForm);
  const [contentPlaybookDirty, setContentPlaybookDirty] = useState(false);
  const selectedContentPlaybookIdRef = useRef("");
  const contentPlaybookDirtyRef = useRef(false);
  const selectedContentProjectIdRef = useRef("");
  const contentProjectDirtyRef = useRef(false);
  const [aiOrchestrations, setAiOrchestrations] = useState<AiOrchestration[]>([]);
  const [activeOrchestrationId, setActiveOrchestrationId] = useState("");
  const [aiGoalRuns, setAiGoalRuns] = useState<AiGoalRun[]>([]);
  const [activeGoalRunId, setActiveGoalRunId] = useState("");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantWidth, setAssistantWidth] = useState(() => readStoredNumber("xhs.aiDrawerWidth", 420));
  const [assistantMessages, setAssistantMessages] = useState<AiAssistantMessage[]>([]);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantSearchPlan, setAssistantSearchPlan] = useState<AssistantSearchPlan | null>(null);
  const [selectedModelId, setSelectedModelId] = useState(() => readStoredString("xhs.selectedModelId", ""));
  const [assistantGuideDismissed, setAssistantGuideDismissed] = useState(() => localStorage.getItem("xhs.assistantGuideDismissed") === "true");
  const [selectedWorkflow, setSelectedWorkflow] = useState<AiWorkflowKey>("content-planning");
  const [selectedArtifactId, setSelectedArtifactId] = useState("");
  const [selectedReportId, setSelectedReportId] = useState("");
  const [modelSettingsOpen, setModelSettingsOpen] = useState(false);
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [credentialSecurityStatus, setCredentialSecurityStatus] = useState<CredentialSecurityStatus | null>(null);
  const credentialSettingsAutoOpenedRef = useRef(false);
  const [legacyImportPreview, setLegacyImportPreview] = useState<LegacyImportPreview | null>(null);
  const [legacyImportSourceDir, setLegacyImportSourceDir] = useState("");
  const [modelEditorOpen, setModelEditorOpen] = useState(false);
  const [editingModelId, setEditingModelId] = useState("");
  const [query, setQuery] = useState("");
  const [authorQuery, setAuthorQuery] = useState("");
  const [minLikes, setMinLikes] = useState("");
  const [resultType, setResultType] = useState<NoteTypeFilter>("all");
  const [resultSort, setResultSort] = useState<SortMode>("hot");
  const [selectedId, setSelectedId] = useState("");
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [replyStrategy, setReplyStrategy] = useState<ReplyStrategy>("questions");
  const [replyTemplate, setReplyTemplate] = useState("谢谢 {author} 的提问，我补充一下：");
  const [reportFocus, setReportFocus] = useState("话题机会、爆款结构、评论需求、可执行选题");
  const [modelForm, setModelForm] = useState<ModelForm>(emptyModelForm);
  const [modelMessages, setModelMessages] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [busy, setBusy] = useState("");
  const busyRef = useRef("");
  const [error, setError] = useState("");
  const [assistantError, setAssistantError] = useState("");
  const setSelectedContentPlaybook = useCallback((value: string) => {
    selectedContentPlaybookIdRef.current = value;
    setSelectedContentPlaybookId(value);
  }, []);
  const setContentPlaybookDirtyState = useCallback((value: boolean) => {
    contentPlaybookDirtyRef.current = value;
    setContentPlaybookDirty(value);
  }, []);
  const setSelectedContentProject = useCallback((value: string) => {
    selectedContentProjectIdRef.current = value;
    setSelectedContentProjectId(value);
  }, []);
  const setContentProjectDirtyState = useCallback((value: boolean) => {
    contentProjectDirtyRef.current = value;
    setContentProjectDirty(value);
  }, []);

  const activeJob = jobs.find((job) => job.id === activeJobId);
  const contextJob = isContextJob(activeJob) ? activeJob : undefined;
  const selectedContentProject = contentProjects.find((project) => project.id === selectedContentProjectId);
  const contentProjectJob = selectedContentProject?.jobId ? jobs.find((job) => job.id === selectedContentProject.jobId) : undefined;
  const effectiveContentJob = contentProjectJob ?? contextJob;
  const contextJobId = contextJob?.id ?? "";
  const effectiveContentJobId = effectiveContentJob?.id ?? "";
  const selected = notes.find((note) => note.id === selectedId) ?? notes[0] ?? null;
  const defaultModel = aiModels.find((model) => model.isDefault) ?? aiModels[0];
  const selectedModel = aiModels.find((model) => model.id === selectedModelId) ?? defaultModel;
  const selectedContentPlaybook = selectedContentPlaybookId ? contentPlaybooks.find((playbook) => playbook.id === selectedContentPlaybookId) : undefined;

  const loadStorageStatus = useCallback(async () => {
    const status = await api.storageStatus();
    setStorageStatus(status);
    if (["legacy-import-required", "legacy-import-conflict"].includes(status.migrationState)) setModelSettingsOpen(true);
    return status;
  }, []);

  const loadCredentialSecurityStatus = useCallback(async () => {
    const status = await api.credentialSecurity();
    setCredentialSecurityStatus(status);
    if (shouldOpenCredentialSettings(status) && !credentialSettingsAutoOpenedRef.current) {
      credentialSettingsAutoOpenedRef.current = true;
      setModelSettingsOpen(true);
    }
    return status;
  }, []);

  const refreshCore = useCallback(async () => {
    const [authStatus, allJobs, caps, models, workflows, prompts, customPrompts, scopes, bridgeStatus, projects, playbooks, drafts, reviews] = await Promise.all([
      api.authStatus(),
      api.listJobs(),
      api.capabilities(),
      api.listAiModels(),
      api.listAiWorkflows(),
      api.listAiPrompts(),
      api.listAiCustomPrompts(),
      api.listNoteScopes(),
      api.browserBridgeStatus().catch(() => ({ connected: false, browser: "unknown", permissionStatus: "unknown" }) satisfies BrowserBridgeStatus),
      api.listContentProjects(),
      api.listContentPlaybooks(),
      api.listContentDrafts(),
      api.listContentReviews()
    ]);
    const sortedJobs = allJobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setAuth(authStatus);
    setJobs(sortedJobs);
    setCapabilities(caps);
    setAiModels(models);
    setAiWorkflows(workflows);
    setAiPrompts(prompts);
    setAiCustomPrompts(customPrompts);
    setNoteScopes(scopes);
    setContentProjects(projects);
    setContentPlaybooks(playbooks);
    setContentDrafts(drafts);
    setContentReviews(reviews);
    const projectRefreshState = resolveProjectRefreshState(projects, selectedContentProjectIdRef.current, contentProjectDirtyRef.current);
    if (projectRefreshState.applyForm && projectRefreshState.project) {
      const project = projectRefreshState.project;
      if (selectedContentProjectIdRef.current !== projectRefreshState.selectedId) setSelectedContentProject(projectRefreshState.selectedId);
      setContentProjectForm(projectToForm(project));
      setContentBriefForm((form) => ({
        ...form,
        productName: project.productName || form.productName,
        persona: form.persona === defaultContentBriefForm.persona ? project.targetAudience[0] ?? form.persona : form.persona,
        scenario: form.scenario === defaultContentBriefForm.scenario ? project.scenarios[0] ?? form.scenario : form.scenario,
        keywords: form.keywords === defaultContentBriefForm.keywords ? project.goals.join(", ") || form.keywords : form.keywords
      }));
      if (project.playbookId) setSelectedContentPlaybook(project.playbookId);
    } else if (projectRefreshState.applyForm && !projectRefreshState.project) {
      setSelectedContentProject("");
      setContentProjectForm(defaultContentProjectForm);
    }
    const refreshState = resolvePlaybookRefreshState(playbooks, selectedContentPlaybookIdRef.current, contentPlaybookDirtyRef.current);
    if (refreshState.applyForm && refreshState.playbook) {
      const playbook = refreshState.playbook;
      if (selectedContentPlaybookIdRef.current !== refreshState.selectedId) setSelectedContentPlaybook(refreshState.selectedId);
      setContentPlaybookForm(playbookToForm(playbook));
      setContentBriefForm((form) => ({
        ...form,
        productName: form.productName === defaultContentBriefForm.productName ? playbook.productName : form.productName
      }));
    } else if (refreshState.applyForm && !refreshState.playbook) {
      setSelectedContentPlaybook("");
      setContentPlaybookForm(defaultPlaybookForm);
    }
    setBrowserBridge({ ...bridgeStatus, connected: false });
    setError(clearRecoveredBackendError);
  }, [setSelectedContentPlaybook, setSelectedContentProject]);

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
    const scopedJobId = aiResourceJobId(aiResourceScope, activeJobId);
    const [plans, actions, reports, artifacts, customPrompts, projects, drafts, reviews, currentReports, currentArtifacts] = await Promise.all([
      api.listReplyPlans(),
      api.listReplyActions(),
      api.listAiReports(),
      api.listAiArtifacts(),
      api.listAiCustomPrompts(),
      api.listContentProjects(),
      api.listContentDrafts(),
      api.listContentReviews(),
      scopedJobId ? api.listAiReports(scopedJobId) : Promise.resolve(undefined),
      scopedJobId ? api.listAiArtifacts(scopedJobId) : Promise.resolve(undefined)
    ]);
    setReplyPlans(plans);
    setReplyActions(actions);
    setAiReports(reports);
    setAiArtifacts(artifacts);
    setScopedAiReports(currentReports ?? reports);
    setScopedAiArtifacts(currentArtifacts ?? artifacts);
    setAiCustomPrompts(customPrompts);
    setContentProjects(projects);
    setContentDrafts(drafts);
    setContentReviews(reviews);
  }, [activeJobId, aiResourceScope]);

  const loadOrchestrations = useCallback(async () => {
    setAiOrchestrations(await api.listAiOrchestrations());
  }, []);

  const loadGoalRuns = useCallback(async () => {
    setAiGoalRuns(await api.listAiGoalRuns());
  }, []);

  const loadPromptDetail = useCallback(async (key: AiWorkflowKey) => {
    const detail = await api.getAiPrompt(key);
    setSelectedPrompt(detail);
    setGuidedPromptDraft(detail.guidedConfig);
    setAdvancedPromptDraft(detail.advancedConfig.template || detail.defaultTemplate);
    setPromptPreview(null);
  }, []);

  const loadCustomPromptRevisions = useCallback(async (promptId: string) => {
    setCustomPromptRevisions(promptId ? await api.listAiCustomPromptRevisions(promptId) : []);
  }, []);

  const loadContentPlaybookRevisions = useCallback(async (playbookId: string) => {
    setContentPlaybookRevisions(playbookId ? await api.listContentPlaybookRevisions(playbookId) : []);
  }, []);

  const loadContentPlaybookStats = useCallback(async (playbookId: string) => {
    setContentPlaybookStats(playbookId ? await api.getContentPlaybookStats(playbookId) : null);
  }, []);

  const loadContentProjectMaterials = useCallback(async (projectId: string) => {
    setContentProjectMaterials(projectId ? await api.listContentProjectMaterials(projectId) : []);
  }, []);

  useEffect(() => {
    setNotePage(1);
  }, [activeJobId, activeKeywordScopeId, authorQuery, minLikes, query, resultSort, resultType]);

  useEffect(() => {
    const visibleNoteIds = new Set(notes.map((note) => note.id));
    setSelectedNoteIds((ids) => ids.filter((id) => visibleNoteIds.has(id)));
  }, [notes]);

  useEffect(() => {
    void loadStorageStatus().catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [loadStorageStatus]);

  useEffect(() => {
    void loadCredentialSecurityStatus().catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [loadCredentialSecurityStatus]);

  useEffect(() => {
    void refreshCore().catch((err) => setError(err.message));
  }, [refreshCore]);

  useEffect(() => {
    void loadContentPlaybookRevisions(selectedContentPlaybookId).catch(() => setContentPlaybookRevisions([]));
  }, [loadContentPlaybookRevisions, selectedContentPlaybookId]);

  useEffect(() => {
    void loadContentPlaybookStats(selectedContentPlaybookId).catch(() => setContentPlaybookStats(null));
  }, [loadContentPlaybookStats, selectedContentPlaybookId]);

  useEffect(() => {
    void loadContentProjectMaterials(selectedContentProjectId).catch(() => setContentProjectMaterials([]));
  }, [loadContentProjectMaterials, selectedContentProjectId]);

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
    void loadGoalRuns().catch(() => undefined);
  }, [loadAnalytics, loadGoalRuns, loadNotes, loadOperations, loadOrchestrations]);

  useEffect(() => {
    void loadPromptDetail(selectedPromptKey).catch((err) => setError(err.message));
  }, [loadPromptDetail, selectedPromptKey]);

  useEffect(() => {
    void loadCustomPromptRevisions(selectedCustomPromptId).catch(() => setCustomPromptRevisions([]));
  }, [loadCustomPromptRevisions, selectedCustomPromptId]);

  const promptDirty = useMemo(() => {
    if (!selectedPrompt || !guidedPromptDraft) return false;
    const savedAdvanced = selectedPrompt.advancedConfig.template || selectedPrompt.defaultTemplate;
    return JSON.stringify(guidedPromptDraft) !== JSON.stringify(selectedPrompt.guidedConfig) || advancedPromptDraft !== savedAdvanced;
  }, [advancedPromptDraft, guidedPromptDraft, selectedPrompt]);

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
      void loadGoalRuns().catch(() => undefined);
    }, 7000);
    return () => clearInterval(timer);
  }, [loadAnalytics, loadGoalRuns, loadNotes, loadOperations, loadOrchestrations, refreshCore]);

  useEffect(() => {
    if (browserBridge.pairing?.state !== "pairing") {
      setPairingCode("");
      return;
    }
    setPairingClock(Date.now());
    const timer = window.setInterval(() => setPairingClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [browserBridge.pairing?.state, browserBridge.pairing?.expiresAt]);

  useEffect(() => {
    let alive = true;
    callBrowserBridge<BrowserBridgeStatus>("ping", undefined, 1000)
      .then((status) => {
        if (alive) {
          setBrowserBridge((current) => ({
            ...current,
            ...status,
            pairing: current.pairing ?? status.pairing,
            connected: true,
            message: status.message || "浏览器助手已连接。"
          }));
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
      if (orchestration.artifactIds.length) {
        await loadOperations();
      }
      await refreshCore();
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
    if (!activeGoalRunId) return;
    let alive = true;
    let timer: number | undefined;
    let source: EventSource | undefined;
    const applyGoalRun = async (goalRun: AiGoalRun) => {
      if (!alive) return;
      setAiGoalRuns((items) => upsertById(items, goalRun));
      if (goalRun.artifactIds.length) {
        await loadOperations();
      }
      await refreshCore();
    };
    const tick = async () => {
      try {
        const goalRun = await api.getAiGoalRun(activeGoalRunId);
        await applyGoalRun(goalRun);
        if (["completed", "failed", "cancelled"].includes(goalRun.status)) return;
        timer = window.setTimeout(tick, 2500);
      } catch (err) {
        if (alive) setAssistantError(err instanceof Error ? err.message : String(err));
      }
    };
    source = new EventSource(`/api/ai/goal-runs/${activeGoalRunId}/events`);
    source.addEventListener("goal-run", (event) => {
      const goalRun = JSON.parse((event as MessageEvent<string>).data) as AiGoalRun;
      void applyGoalRun(goalRun).then(() => {
        if (["completed", "failed", "cancelled"].includes(goalRun.status)) source?.close();
      });
    });
    source.addEventListener("error", () => {
      source?.close();
      if (alive && !timer) timer = window.setTimeout(tick, 1000);
    });
    return () => {
      alive = false;
      source?.close();
      if (timer) window.clearTimeout(timer);
    };
  }, [activeGoalRunId, loadOperations, refreshCore]);

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
    const normalizedScope = normalizeAiResourceScope(aiResourceScope, activeJob?.id ?? "");
    if (normalizedScope !== aiResourceScope) {
      setAiResourceScope(normalizedScope);
    }
  }, [activeJob?.id, aiResourceScope]);

  useEffect(() => {
    const selectedArtifact = aiArtifacts.find((artifact) => artifact.id === selectedArtifactId);
    if (selectedArtifact) {
      setOpenedArtifactSnapshot(selectedArtifact);
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
    if (busyRef.current === key) {
      return undefined;
    }
    busyRef.current = key;
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
      if (busyRef.current === key) {
        busyRef.current = "";
        setBusy("");
      }
    }
  }

  async function openArtifactById(artifactId: string, artifactHint?: AiArtifact): Promise<void> {
    const artifact = await loadArtifactForOpen(aiArtifacts, artifactId, api.getAiArtifact, artifactHint).catch(() => undefined);
    if (!artifact) {
      setError("产物不存在或读取失败，请刷新后重试。");
      return;
    }
    setError("");
    setAiArtifacts((items) => upsertById(items, artifact));
    rememberSelectedArtifact(artifact);
    setActiveModule("ai");
  }

  function rememberSelectedArtifact(artifact: AiArtifact): void {
    setOpenedArtifactSnapshot(artifact);
    setSelectedArtifactId(artifact.id);
    setSelectedReportId("");
  }

  function clearSelectedArtifact(): void {
    setSelectedArtifactId("");
    setOpenedArtifactSnapshot(null);
  }

  async function saveCookie() {
    await run("auth", async () => {
      const status = await api.saveCookie(cookieFields);
      setAuth(status);
      setCookieFields({ a1: "", web_session: "", webId: "" });
      await loadCredentialSecurityStatus();
      await refreshCore();
    });
  }

  async function autoReadCookie() {
    await run("auth", async () => {
      setAuth(await api.autoReadCookie());
      await loadCredentialSecurityStatus();
      await refreshCore();
    });
  }

  async function refreshBrowserBridge() {
    setBusy("bridge-check");
    setError("");
    const savedStatus: BrowserBridgeStatus = await api.browserBridgeStatus().catch(() => ({ connected: false, browser: "unknown", permissionStatus: "unknown" }));
    try {
      const runtimeStatus = await callBrowserBridge<BrowserBridgeStatus>("ping", undefined, 1000);
      setBrowserBridge({
        ...savedStatus,
        ...runtimeStatus,
        pairing: savedStatus.pairing,
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
      await loadCredentialSecurityStatus();
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

  async function startBrowserExtensionPairing() {
    await run("bridge-pair", async () => {
      const code = generateBrowserPairingCode();
      const codeHash = await hashBrowserPairingCode(code);
      const pairing = await api.startBrowserExtensionPairing({ codeHash });
      setPairingCode(code);
      setPairingClock(Date.now());
      setBrowserBridge((current) => ({ ...current, pairing }));
    });
  }

  async function cancelBrowserExtensionPairing() {
    await run("bridge-pair", async () => {
      const pairing = await api.cancelBrowserExtensionPairing();
      setPairingCode("");
      setBrowserBridge((current) => ({ ...current, pairing }));
    });
  }

  async function revokeBrowserExtensionPairing() {
    if (!window.confirm("解除配对后，当前浏览器扩展需要重新输入配对码才能同步登录态。确定继续吗？")) return;
    await run("bridge-pair", async () => {
      const pairing = await api.revokeBrowserExtensionPairing();
      setPairingCode("");
      setBrowserBridge((current) => ({
        ...current,
        connected: false,
        pairing,
        message: "浏览器扩展配对已解除。"
      }));
    });
  }

  async function openOriginalUrl(url: string) {
    await openUrlWithBrowserFallback(
      url,
      async (targetUrl) => {
        await callBrowserBridge("openUrl", { url: targetUrl }, 1500);
      },
      async (targetUrl) => {
        await run("open-url", async () => {
          await api.openBrowserUrl({ url: targetUrl, mode: "auto" });
        });
      }
    );
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
    if (activeJob?.breakerReason && isRateLimitReason(activeJob.breakerReason)) {
      const shouldResume = window.confirm("当前任务因小红书 IP 限流暂停。建议等待 10-30 分钟，并降低抓取页数或并发后再恢复。现在仍要恢复吗？");
      if (!shouldResume) {
        return;
      }
    }
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
    if (!window.confirm(`确定删除这篇笔记？\n\n${selected.title}`)) return;
    await run("delete-note", async () => {
      await api.deleteNote(selected.id);
      setSelectedNoteIds(selectedNoteIds.filter((id) => id !== selected.id));
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
    setDatasetClearPreview(null);
    setDeleteDatasetAiArtifacts(false);
    setDatasetManagerOpen(true);
  }

  async function previewDatasetDelete(jobId: string) {
    await run("clear-preview", async () => {
      setDatasetClearPreview(await api.getNoteScopeClearPreview(jobId));
      setDeleteDatasetAiArtifacts(false);
    });
  }

  function openDatasetScope(jobId: string) {
    setNotePage(1);
    setActiveKeywordScopeId("");
    setShowHistoryData(false);
    setActiveJobId(jobId);
    setDatasetManagerOpen(false);
    setDatasetClearPreview(null);
  }

  async function clearCurrentNotes() {
    const jobId = datasetClearPreview?.jobId ?? activeJobId;
    if (!jobId) return;
    await run("clear-notes", async () => {
      await api.clearNotes(jobId, deleteDatasetAiArtifacts);
      setDatasetClearPreview(null);
      setDeleteDatasetAiArtifacts(false);
      setSelectedId("");
      setSelectedNoteIds([]);
      if (activeJobId === jobId) {
        setActiveJobId("");
        setActiveKeywordScopeId("");
        setShowHistoryData(false);
      }
      await refreshCore();
      await loadNotes();
      await loadAnalytics();
    });
  }

  async function previewSelectedNotesDelete() {
    const noteIds = selectedNoteIds.filter(Boolean);
    if (!noteIds.length) return;
    await run("bulk-delete-preview", async () => {
      setBulkDeletePreview(await api.previewDeleteNotes({ noteIds, jobId: activeJobId || undefined }));
    });
  }

  async function deleteSelectedNotesBulk() {
    if (!bulkDeletePreview?.noteIds.length) return;
    await run("bulk-delete", async () => {
      await api.deleteNotesBulk({ noteIds: bulkDeletePreview.noteIds, jobId: bulkDeletePreview.jobId });
      const removed = new Set(bulkDeletePreview.noteIds);
      setSelectedNoteIds(selectedNoteIds.filter((id) => !removed.has(id)));
      if (selectedId && removed.has(selectedId)) {
        setSelectedId("");
      }
      setBulkDeletePreview(null);
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

  function applyContentProject(project: ContentProject) {
    setSelectedContentProject(project.id);
    setContentProjectForm(projectToForm(project));
    setContentProjectDirtyState(false);
    setContentBriefForm((form) => ({
      ...form,
      productName: project.productName || form.productName,
      persona: project.targetAudience[0] ?? form.persona,
      scenario: project.scenarios[0] ?? form.scenario,
      keywords: project.goals.join(", ") || form.keywords
    }));
    if (project.playbookId) {
      setSelectedContentPlaybook(project.playbookId);
      const playbook = contentPlaybooks.find((item) => item.id === project.playbookId);
      if (playbook) {
        setContentPlaybookForm(playbookToForm(playbook));
        setContentPlaybookDirtyState(false);
      }
    }
    if (project.jobId) {
      setActiveJobId(project.jobId);
      setShowHistoryData(false);
    }
  }

  async function refreshContentProjectsAfterChange(nextSelectedId?: string) {
    const projects = await api.listContentProjects();
    setContentProjects(projects);
    const refreshState = resolveProjectRefreshState(projects, nextSelectedId ?? "", false);
    if (refreshState.project) {
      applyContentProject(refreshState.project);
    } else {
      setSelectedContentProject("");
      setContentProjectForm(defaultContentProjectForm);
      setContentProjectMaterials([]);
      setContentProjectDirtyState(false);
    }
  }

  function selectContentProjectById(id: string) {
    const project = contentProjects.find((item) => item.id === id);
    if (project) {
      applyContentProject(project);
    } else {
      setSelectedContentProject("");
      setContentProjectForm(defaultContentProjectForm);
      setContentProjectMaterials([]);
      setContentProjectDirtyState(false);
    }
  }

  function createContentProjectForm() {
    setSelectedContentProject("");
    setContentProjectForm({
      ...defaultContentProjectForm,
      productName: contentBriefForm.productName || defaultContentProjectForm.productName,
      playbookId: selectedContentPlaybookId,
      jobId: contextJobId
    });
    setContentProjectDirtyState(true);
    setContentStudioTab("projects");
  }

  async function saveContentProjectForm() {
    await run("content-project", async () => {
      const saved = await api.saveContentProject(contentProjectInputFromForm(contentProjectForm), selectedContentProjectId || undefined);
      await refreshContentProjectsAfterChange(saved.id);
    });
  }

  async function deleteContentProjectForm() {
    if (!selectedContentProjectId) return;
    await run("content-project-delete", async () => {
      await api.deleteContentProject(selectedContentProjectId);
      await refreshContentProjectsAfterChange();
    });
  }

  async function addSelectedNotesToProjectMaterials() {
    if (!selectedContentProjectId) {
      setError("请先在内容创作台选择或保存一个内容项目。");
      return;
    }
    const selectedNoteIdSet = new Set(selectedNoteIds);
    const selectedNotes = notes.filter((note) => selectedNoteIdSet.has(note.id) && note.desc.trim());
    if (!selectedNotes.length) {
      setError("请先勾选已补正文的笔记，再加入项目素材池。");
      return;
    }
    await run("content-materials-from-notes", async () => {
      const materials = await api.addContentProjectMaterialsFromNotes(selectedContentProjectId, selectedNotes.map((note) => note.id), "general");
      setContentProjectMaterials((items) => prependUniqueById(items, materials));
      setContentStudioTab("projects");
      setActiveModule("content");
      setError("");
    });
  }

  async function deleteContentProjectMaterialForm(materialId: string) {
    if (!selectedContentProjectId) return;
    await run(`content-material-delete-${materialId}`, async () => {
      await api.deleteContentProjectMaterial(selectedContentProjectId, materialId);
      setContentProjectMaterials(await api.listContentProjectMaterials(selectedContentProjectId));
    });
  }

  async function refreshContentPlaybooksAfterChange(nextSelectedId?: string) {
    const playbooks = await api.listContentPlaybooks();
    setContentPlaybooks(playbooks);
    const refreshState = resolvePlaybookRefreshState(playbooks, nextSelectedId ?? "", false);
    if (refreshState.playbook) {
      setSelectedContentPlaybook(refreshState.selectedId);
      setContentPlaybookForm(playbookToForm(refreshState.playbook));
      setContentPlaybookRevisions(await api.listContentPlaybookRevisions(refreshState.selectedId));
      setContentPlaybookStats(await api.getContentPlaybookStats(refreshState.selectedId));
    } else {
      setSelectedContentPlaybook("");
      setContentPlaybookForm(defaultPlaybookForm);
      setContentPlaybookRevisions([]);
      setContentPlaybookStats(null);
    }
    setContentPlaybookDirtyState(false);
  }

  async function saveContentPlaybookForm() {
    await run("content-playbook", async () => {
      const saved = await api.saveContentPlaybook(contentPlaybookInputFromForm(contentPlaybookForm), selectedContentPlaybookId || undefined);
      await refreshContentPlaybooksAfterChange(saved.id);
    });
  }

  async function saveContentPlaybookAsNewForm() {
    await run("content-playbook-save-as", async () => {
      const saved = await api.saveContentPlaybook(contentPlaybookInputFromForm(contentPlaybookForm));
      await refreshContentPlaybooksAfterChange(saved.id);
    });
  }

  function createContentPlaybookForm() {
    setSelectedContentPlaybook("");
    setContentPlaybookForm(createDefaultContentPlaybookForm());
    setContentPlaybookDirtyState(true);
    setContentStudioTab("rules");
  }

  async function deleteContentPlaybookForm() {
    if (!selectedContentPlaybookId) return;
    await run("content-playbook-delete", async () => {
      await api.deleteContentPlaybook(selectedContentPlaybookId);
      await refreshContentPlaybooksAfterChange();
    });
  }

  async function restoreContentPlaybookRevisionForm(revisionId: string) {
    if (!selectedContentPlaybookId) return;
    await run("content-playbook-restore", async () => {
      const restored = await api.restoreContentPlaybookRevision(selectedContentPlaybookId, revisionId);
      await refreshContentPlaybooksAfterChange(restored.id);
    });
  }

  async function generateContentDraftFromForm() {
    await run("content-draft", async () => {
      const result = await api.generateContentDraft({
        projectId: selectedContentProjectId || undefined,
        playbookId: selectedContentPlaybookId || undefined,
        jobId: effectiveContentJobId || undefined,
        modelId: selectedModel?.id,
        brief: {
          ...briefFromForm(contentBriefForm),
          projectId: selectedContentProjectId || undefined,
          playbookId: selectedContentPlaybookId || undefined,
          jobId: effectiveContentJobId || undefined
        }
      });
      setContentDrafts((drafts) => upsertById(drafts, result.draft));
      setContentReviews((reviews) => upsertById(reviews, result.review));
      setAiArtifacts((artifacts) => prependUniqueById(artifacts, [result.reviewArtifact, result.artifact]));
      rememberSelectedArtifact(result.reviewArtifact);
      setContentStudioTab("results");
      await loadOperations();
    });
  }

  async function generateContentDraftBatchFromForm() {
    await run("content-draft-batch", async () => {
      const result = await api.generateContentDraftBatch({
        projectId: selectedContentProjectId || undefined,
        playbookId: selectedContentPlaybookId || undefined,
        jobId: effectiveContentJobId || undefined,
        modelId: selectedModel?.id,
        count: contentDraftBatchCount,
        brief: {
          ...briefFromForm(contentBriefForm),
          projectId: selectedContentProjectId || undefined,
          playbookId: selectedContentPlaybookId || undefined,
          jobId: effectiveContentJobId || undefined
        }
      });
      const drafts = result.results.map((item) => item.draft);
      const reviews = result.results.map((item) => item.review);
      const artifacts = result.results.flatMap((item) => [item.reviewArtifact, item.artifact]);
      setContentDrafts((items) => prependUniqueById(items, drafts));
      setContentReviews((items) => prependUniqueById(items, reviews));
      setAiArtifacts((items) => prependUniqueById(items, artifacts));
      if (artifacts[0]) {
        rememberSelectedArtifact(artifacts[0]);
      }
      setContentStudioTab("results");
      await loadOperations();
    });
  }

  async function reviewContentDraftFromForm() {
    if (!contentReviewForm.body.trim()) {
      setError("请先粘贴需要审稿的小红书笔记正文。");
      return;
    }
    await run("content-review", async () => {
      const result = await api.reviewContentDraft({
        projectId: selectedContentProjectId || undefined,
        playbookId: selectedContentPlaybookId || undefined,
        jobId: effectiveContentJobId || undefined,
        modelId: selectedModel?.id,
        title: contentReviewForm.title,
        body: contentReviewForm.body,
        tags: splitTextList(contentReviewForm.tags),
        mode: "minimal"
      });
      setContentReviews((reviews) => upsertById(reviews, result.review));
      setAiArtifacts((artifacts) => upsertById(artifacts, result.artifact));
      rememberSelectedArtifact(result.artifact);
      setContentStudioTab("results");
      await loadOperations();
    });
  }

  async function reviewSelectedBatchItems(items: BatchReviewItem[]) {
    const selectedItems = items.filter((item) => item.selected && item.body.trim());
    if (!selectedItems.length) {
      setError("请至少勾选一条有正文的笔记。");
      return;
    }
    await run("content-batch-review", async () => {
      const result = await api.reviewContentDraftBatch({
        projectId: selectedContentProjectId || undefined,
        playbookId: selectedContentPlaybookId || undefined,
        jobId: effectiveContentJobId || undefined,
        modelId: selectedModel?.id,
        mode: "minimal",
        items: selectedItems.map((item) => ({
          id: item.id,
          title: item.title,
          body: item.body,
          tags: splitTextList(item.tags)
        }))
      });
      setContentReviews((reviews) => prependUniqueById(reviews, result.reviews));
      setAiArtifacts((artifacts) => prependUniqueById(artifacts, result.artifacts));
      if (result.artifacts[0]) {
        rememberSelectedArtifact(result.artifacts[0]);
      }
      setContentStudioTab("results");
      await loadOperations();
    });
  }

  async function acceptContentDraftReviewForm(draftId: string, reviewId?: string) {
    await run(`content-draft-accept-${draftId}`, async () => {
      const draft = await api.acceptContentDraftReview(draftId, reviewId);
      setContentDrafts((items) => upsertById(items, draft));
      setContentStudioTab("results");
      await loadOperations();
    });
  }

  function loadContentReviewForRereview(review: ContentReviewRun) {
    setContentReviewForm(contentReviewToForm(review));
    setContentStudioTab("review");
    setActiveModule("content");
  }

  function sendSelectedNotesToBatchReview() {
    const selectedNoteIdSet = new Set(selectedNoteIds);
    const selectedNotes = notes.filter((note) => selectedNoteIdSet.has(note.id) && note.desc.trim());
    if (!selectedNotes.length) {
      setError("请先勾选已补正文的笔记，再进入批量审稿。");
      return;
    }
    setContentBatchItems(selectedNotes.map(noteToBatchReviewItem));
    setContentStudioTab("batch");
    setActiveModule("content");
    setError("");
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

  async function selectLegacyDataDirectory() {
    const selected = await window.desktopStorage?.selectLegacyDataDirectory();
    if (selected) {
      setLegacyImportSourceDir(selected);
      setLegacyImportPreview(null);
    }
  }

  async function previewLegacyImport() {
    await run("storage-preview", async () => {
      const preview = await api.previewLegacyImport(legacyImportSourceDir.trim() || undefined);
      setLegacyImportSourceDir(preview.sourceDir);
      setLegacyImportPreview(preview);
    });
  }

  async function executeLegacyImport() {
    if (!legacyImportPreview) return;
    await run("storage-import", async () => {
      await api.executeLegacyImport(legacyImportPreview.sourceDir, legacyImportPreview.fingerprint);
      setLegacyImportPreview(null);
      await loadStorageStatus();
      await refreshCore();
      await loadOperations();
    });
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
      await loadCredentialSecurityStatus();
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
      await loadCredentialSecurityStatus();
      await refreshCore();
    });
  }

  async function retryCredentialSecurity() {
    await run("credential-security", async () => {
      const status = await api.retryCredentialSecurity();
      setCredentialSecurityStatus(status);
      if (!shouldOpenCredentialSettings(status)) credentialSettingsAutoOpenedRef.current = false;
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

  async function runWorkflow(workflowKey: AiWorkflowKey, focus?: string, options: RunWorkflowOptions = {}): Promise<AiArtifact | undefined> {
    const workflow = aiWorkflows.find((item) => item.key === workflowKey);
    if (workflow?.requires.includes("job") && !contextJobId) {
      setError("当前没有可用于分析的有效任务，请先创建并完成一次关键词抓取。");
      return undefined;
    }
    const workflowNoteIds = Array.from(new Set(options.noteIds ?? []));
    const workflowNoteId = options.noteIds ? options.noteId : options.noteId ?? selected?.id;
    if (workflow?.requires.includes("note") && !workflowNoteId && !workflowNoteIds.length) {
      setError("请先选择一篇笔记。");
      return undefined;
    }
    return await run(`workflow-${workflowKey}`, async () => {
      const artifact = await api.runAiWorkflow({
        workflowKey,
        jobId: contextJobId || undefined,
        noteId: workflowNoteId,
        noteIds: workflowNoteIds.length ? workflowNoteIds : undefined,
        modelId: selectedModel?.id,
        focus
      });
      setSelectedWorkflow(workflowKey);
      await openArtifactById(artifact.id, artifact);
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
    setAssistantSearchPlan(null);
    const userMessage: AiAssistantMessage = {
      id: `local_${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date().toISOString()
    };
    setAssistantMessages((messages) => [...messages, userMessage]);
    setAssistantInput("");
    const planned = await run("assistant-chat", () => api.planAiGoalRun({
      instruction: content,
      modelId: selectedModel?.id,
      playbookId: selectedContentPlaybook?.id
    }));
    if (planned?.goalRun) {
      const goalRun = planned.goalRun;
      setAiGoalRuns((items) => upsertById(items, goalRun));
      setActiveGoalRunId(goalRun.id);
      setAssistantMessages((messages) => [...messages, {
        id: `goal_plan_${goalRun.id}`,
        role: "assistant",
        content: `我已把目标整理为研究与创作任务：围绕「${goalRun.plan.subject}」研究 ${goalRun.plan.questions.join("、")}，结合小红书和公开资料，最终生成 ${goalRun.plan.outputCount} 篇笔记。请确认计划后开始。`,
        createdAt: new Date().toISOString()
      }]);
      return;
    }
    if (isContentStudioRequest(content)) {
      await run("assistant-chat", async () => {
        const response = await api.runContentAssistant({
          message: content,
          projectId: selectedContentProjectId || undefined,
          jobId: effectiveContentJobId || undefined,
          modelId: selectedModel?.id,
          playbookId: selectedContentPlaybook?.id
        });
        if (!response.message) {
          throw new Error("内容创作台返回内容为空，请稍后重试或切换模型。");
        }
        setAssistantMessages((messages) => [...messages, response.message]);
        if (response.artifact) {
          const artifact = response.artifact as AiArtifact;
          setAiArtifacts((items) => upsertById(items, artifact));
          rememberSelectedArtifact(artifact);
        }
        setActiveModule("content");
        await loadOperations();
      });
      return;
    }
    const searchPlan = parseAssistantSearchPlan(content);
    if (searchPlan) {
      setAssistantSearchPlan(searchPlan);
      setAssistantMessages((messages) => [
        ...messages,
        {
          id: `search_plan_${Date.now()}`,
          role: "assistant",
          content: `我识别到你想抓取关键词：${searchPlan.keywords.join(" / ")}。请先确认，确认后会创建抓取任务并自动进入内容分析编排。`,
          createdAt: new Date().toISOString()
        }
      ]);
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
        const artifact = response.artifact as AiArtifact;
        setAiArtifacts((items) => upsertById(items, artifact));
        rememberSelectedArtifact(artifact);
      }
      await loadOperations();
    });
  }

  async function confirmAssistantSearchPlan() {
    if (!assistantSearchPlan) return;
    const plan = assistantSearchPlan;
    await run("assistant-chat", async () => {
      const orchestration = await api.createAiOrchestration({
        instruction: plan.instruction,
        keywords: plan.keywords,
        modelId: selectedModel?.id
      });
      setAiOrchestrations((items) => upsertById(items, orchestration));
      setActiveOrchestrationId(orchestration.id);
      setAssistantSearchPlan(null);
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
  }

  async function confirmGoalRun(goalRunId: string) {
    await run("assistant-chat", async () => {
      const goalRun = await api.confirmAiGoalRun(goalRunId);
      setAiGoalRuns((items) => upsertById(items, goalRun));
      setActiveGoalRunId(goalRun.id);
    });
  }

  async function retryGoalRun(goalRunId: string) {
    await run("assistant-chat", async () => {
      const goalRun = await api.retryAiGoalRun(goalRunId);
      setAiGoalRuns((items) => upsertById(items, goalRun));
      setActiveGoalRunId(goalRun.id);
    });
  }

  async function addGoalRunSources(goalRunId: string, urls: string[]) {
    await run("assistant-chat", async () => {
      const goalRun = await api.addAiGoalRunSources(goalRunId, urls);
      setAiGoalRuns((items) => upsertById(items, goalRun));
    });
  }

  async function deleteArtifact(artifactId: string) {
    await run(`delete-artifact-${artifactId}`, async () => {
      await api.deleteAiArtifact(artifactId);
      if (selectedArtifactId === artifactId) {
        clearSelectedArtifact();
      }
      await loadOperations();
    });
  }

  function openPromptCenter(key: AiWorkflowKey) {
    if (!selectPromptKey(key)) {
      return;
    }
    setSelectedPromptScope("system");
    setActiveModule("prompts");
  }

  function confirmDiscardPromptChanges(): boolean {
    return !promptDirty || window.confirm("当前提示词修改尚未保存，确定放弃这些修改吗？");
  }

  function selectPromptKey(key: AiWorkflowKey): boolean {
    const discardConfirmed = key === selectedPromptKey || confirmDiscardPromptChanges();
    if (!canSelectPromptKey(selectedPromptKey, key, discardConfirmed)) return false;
    if (key === selectedPromptKey) return true;
    setSelectedPromptKey(key);
    setPromptPreview(null);
    return true;
  }

  function selectPromptTab(tab: PromptEditorTab) {
    if (tab === promptTab) return;
    setPromptTab(tab);
  }

  function applyPromptDetail(detail: AiPromptDetail) {
    setSelectedPrompt(detail);
    setGuidedPromptDraft(detail.guidedConfig);
    setAdvancedPromptDraft(detail.advancedConfig.template || detail.defaultTemplate);
    setPromptPreview(null);
  }

  async function saveGuidedPrompt(activate = false) {
    if (!guidedPromptDraft) return;
    await run(`prompt-guided-save-${selectedPromptKey}-${activate ? "activate" : "draft"}`, async () => {
      const detail = await api.saveAiPromptGuided(selectedPromptKey, guidedPromptDraft, activate);
      applyPromptDetail(detail);
      setAiPrompts(await api.listAiPrompts());
    });
  }

  async function saveAdvancedPrompt(activate = false) {
    await run(`prompt-advanced-save-${selectedPromptKey}-${activate ? "activate" : "draft"}`, async () => {
      const detail = await api.saveAiPromptAdvanced(selectedPromptKey, advancedPromptDraft, activate);
      applyPromptDetail(detail);
      setAiPrompts(await api.listAiPrompts());
    });
  }

  async function activatePromptMode(mode: AiPromptMode) {
    await run(`prompt-activate-${selectedPromptKey}-${mode}`, async () => {
      const detail = await api.activateAiPromptMode(selectedPromptKey, mode);
      applyPromptDetail(detail);
      setAiPrompts(await api.listAiPrompts());
    });
  }

  async function loadPromptPreview(mode: AiPromptMode) {
    await run(`prompt-preview-${selectedPromptKey}-${mode}`, async () => {
      const preview = await api.previewAiPrompt(selectedPromptKey, {
        mode,
        guidedConfig: guidedPromptDraft ?? undefined,
        advancedTemplate: advancedPromptDraft,
        jobId: activeJobId || undefined
      });
      setPromptPreview(preview);
    });
  }

  async function resetPrompt(scope: AiPromptResetScope = "active") {
    await run(`prompt-reset-${selectedPromptKey}-${scope}`, async () => {
      const detail = await api.resetAiPrompt(selectedPromptKey, scope);
      applyPromptDetail(detail);
      setAiPrompts(await api.listAiPrompts());
    });
  }

  function selectCustomPrompt(promptId: string) {
    const prompt = aiCustomPrompts.find((item) => item.id === promptId);
    setSelectedPromptScope("custom");
    setSelectedCustomPromptId(promptId);
    if (prompt) {
      setCustomPromptForm(customPromptToForm(prompt));
      setCustomPromptTab(prompt.mode);
    }
    setCustomPromptPreview(null);
  }

  function createCustomPromptDraft() {
    setSelectedPromptScope("custom");
    setSelectedCustomPromptId("");
    setCustomPromptForm(defaultCustomPromptForm);
    setCustomPromptTab("guided");
    setCustomPromptPreview(null);
    setCustomPromptRevisions([]);
  }

  async function persistCustomPrompt(): Promise<AiCustomPrompt> {
    const saved = await api.saveAiCustomPrompt(customPromptForm, selectedCustomPromptId || undefined);
    setSelectedCustomPromptId(saved.id);
    setCustomPromptForm(customPromptToForm(saved));
    setCustomPromptTab(saved.mode);
    setAiCustomPrompts(await api.listAiCustomPrompts());
    setCustomPromptRevisions(await api.listAiCustomPromptRevisions(saved.id));
    setCustomPromptPreview(null);
    return saved;
  }

  async function saveCustomPrompt(): Promise<AiCustomPrompt | undefined> {
    return await run(`custom-prompt-save-${selectedCustomPromptId || "new"}`, persistCustomPrompt);
  }

  async function ensureSavedCustomPrompt(): Promise<AiCustomPrompt | undefined> {
    return await persistCustomPrompt();
  }

  async function deleteCustomPrompt(promptId: string) {
    if (!window.confirm("确定删除这套我的提示词？相关 AI 产物会保留，但无法再从提示词中心编辑它。")) return;
    await run(`custom-prompt-delete-${promptId}`, async () => {
      await api.deleteAiCustomPrompt(promptId);
      const prompts = await api.listAiCustomPrompts();
      setAiCustomPrompts(prompts);
      const next = prompts[0];
      setSelectedCustomPromptId(next?.id ?? "");
      setCustomPromptForm(next ? customPromptToForm(next) : defaultCustomPromptForm);
      setCustomPromptRevisions([]);
      setCustomPromptPreview(null);
    });
  }

  async function copySystemPromptToCustom() {
    await run(`custom-prompt-copy-${selectedPromptKey}`, async () => {
      const prompt = await api.copyAiPromptToCustom({ workflowKey: selectedPromptKey });
      setAiCustomPrompts(await api.listAiCustomPrompts());
      setSelectedPromptScope("custom");
      setSelectedCustomPromptId(prompt.id);
      setCustomPromptForm(customPromptToForm(prompt));
      setCustomPromptTab(prompt.mode);
      setCustomPromptRevisions(await api.listAiCustomPromptRevisions(prompt.id));
      setCustomPromptPreview(null);
    });
  }

  async function previewCustomPrompt() {
    await run(`custom-prompt-preview-${selectedCustomPromptId || "new"}`, async () => {
      const prompt = await ensureSavedCustomPrompt();
      if (!prompt) return;
      const preview = await api.previewAiCustomPrompt(prompt.id, {
        jobId: activeJobId || undefined,
        noteId: selected?.id,
        focus: customPromptForm.description
      });
      setCustomPromptPreview(preview);
    });
  }

  async function runCustomPrompt(promptId = selectedCustomPromptId, focus?: string, options: RunWorkflowOptions = {}): Promise<AiArtifact | undefined> {
    return await run(`custom-prompt-run-${promptId || "new"}`, async () => {
      const prompt = promptId ? aiCustomPrompts.find((item) => item.id === promptId) : await ensureSavedCustomPrompt();
      if (!prompt) {
        setError("请先保存我的提示词后再运行。");
        return undefined;
      }
      const artifact = await api.runAiCustomPrompt(prompt.id, {
        jobId: contextJobId || undefined,
        noteId: options.noteId ?? selected?.id,
        noteIds: options.noteIds,
        modelId: selectedModel?.id,
        focus
      });
      await openArtifactById(artifact.id, artifact);
      await loadOperations();
      return artifact;
    });
  }

  async function restoreCustomPromptRevision(revisionId: string) {
    if (!selectedCustomPromptId) return;
    await run(`custom-prompt-restore-${selectedCustomPromptId}-${revisionId}`, async () => {
      const restored = await api.restoreAiCustomPromptRevision(selectedCustomPromptId, revisionId);
      setCustomPromptForm(customPromptToForm(restored));
      setCustomPromptTab(restored.mode);
      setAiCustomPrompts(await api.listAiCustomPrompts());
      setCustomPromptRevisions(await api.listAiCustomPromptRevisions(restored.id));
      setCustomPromptPreview(null);
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
            startBrowserExtensionPairing={startBrowserExtensionPairing}
            cancelBrowserExtensionPairing={cancelBrowserExtensionPairing}
            revokeBrowserExtensionPairing={revokeBrowserExtensionPairing}
            pairingCode={pairingCode}
            pairingClock={pairingClock}
            openOriginalUrl={openOriginalUrl}
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
            selectedNoteIds={selectedNoteIds}
            setSelectedNoteIds={setSelectedNoteIds}
            sendSelectedNotesToBatchReview={sendSelectedNotesToBatchReview}
            selectedContentProject={selectedContentProject}
            addSelectedNotesToProjectMaterials={addSelectedNotesToProjectMaterials}
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
            previewSelectedNotesDelete={previewSelectedNotesDelete}
            deleteSelectedNote={deleteSelectedNote}
            refreshNoteMedia={refreshSelectedNoteMedia}
            openOriginalUrl={openOriginalUrl}
            runWorkflow={runWorkflow}
            busy={busy}
          />
        )}
        {activeModule === "viral" && <ViralPage analytics={analytics} notes={notes} selected={selected} artifacts={aiArtifacts} runWorkflow={runWorkflow} busy={busy} />}
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
        {activeModule === "content" && (
          <ContentStudioPage
            activeTab={contentStudioTab}
            setActiveTab={setContentStudioTab}
            activeJob={effectiveContentJob}
            projects={contentProjects}
            selectedProjectId={selectedContentProjectId}
            setSelectedProjectId={selectContentProjectById}
            projectForm={contentProjectForm}
            setProjectForm={setContentProjectForm}
            projectDirty={contentProjectDirty}
            setProjectDirty={setContentProjectDirtyState}
            projectMaterials={contentProjectMaterials}
            deleteProjectMaterial={deleteContentProjectMaterialForm}
            playbooks={contentPlaybooks}
            selectedPlaybookId={selectedContentPlaybookId}
            setSelectedPlaybookId={(id) => {
              setSelectedContentPlaybook(id);
              const playbook = contentPlaybooks.find((item) => item.id === id);
              if (playbook) {
                setContentPlaybookForm(playbookToForm(playbook));
                setContentBriefForm((form) => ({ ...form, productName: playbook.productName }));
                setContentPlaybookDirtyState(false);
              }
            }}
            playbookForm={contentPlaybookForm}
            setPlaybookForm={setContentPlaybookForm}
            playbookDirty={contentPlaybookDirty}
            setPlaybookDirty={setContentPlaybookDirtyState}
            playbookRevisions={contentPlaybookRevisions}
            playbookStats={contentPlaybookStats}
            restorePlaybookRevision={restoreContentPlaybookRevisionForm}
            briefForm={contentBriefForm}
            setBriefForm={setContentBriefForm}
            batchDraftCount={contentDraftBatchCount}
            setBatchDraftCount={setContentDraftBatchCount}
            reviewForm={contentReviewForm}
            setReviewForm={setContentReviewForm}
            batchItems={contentBatchItems}
            setBatchItems={setContentBatchItems}
            drafts={contentDrafts}
            reviews={contentReviews}
            artifacts={aiArtifacts}
            jobs={jobs}
            createProject={createContentProjectForm}
            deleteProject={deleteContentProjectForm}
            saveProject={saveContentProjectForm}
            createPlaybook={createContentPlaybookForm}
            deletePlaybook={deleteContentPlaybookForm}
            savePlaybookAsNew={saveContentPlaybookAsNewForm}
            generateDraft={generateContentDraftFromForm}
            generateDraftBatch={generateContentDraftBatchFromForm}
            reviewDraft={reviewContentDraftFromForm}
            reviewBatch={reviewSelectedBatchItems}
            acceptDraftReview={acceptContentDraftReviewForm}
            savePlaybook={saveContentPlaybookForm}
            openDraftReviewPrompt={() => openPromptCenter("draft-review")}
            loadReviewForRereview={loadContentReviewForRereview}
            reviewExecutionLabel={selectedModel ? "将尝试 AI，失败自动本地降级" : "本地规则"}
            openArtifact={(artifactId) => void openArtifactById(artifactId)}
            busy={busy}
          />
        )}
        {activeModule === "prompts" && (
          <PromptCenterPage
            prompts={aiPrompts}
            selectedKey={selectedPromptKey}
            selectedPrompt={selectedPrompt}
            promptTab={promptTab}
            setPromptTab={selectPromptTab}
            guidedDraft={guidedPromptDraft}
            setGuidedDraft={setGuidedPromptDraft}
            advancedDraft={advancedPromptDraft}
            setAdvancedDraft={setAdvancedPromptDraft}
            promptPreview={promptPreview}
            promptDirty={promptDirty}
            setSelectedKey={selectPromptKey}
            artifacts={aiArtifacts}
            busy={busy}
            saveGuidedPrompt={saveGuidedPrompt}
            saveAdvancedPrompt={saveAdvancedPrompt}
            resetPrompt={resetPrompt}
            loadPromptPreview={loadPromptPreview}
            openArtifact={(artifactId) => void openArtifactById(artifactId)}
            customPrompts={aiCustomPrompts}
            selectedScope={selectedPromptScope}
            setSelectedScope={setSelectedPromptScope}
            selectedCustomPromptId={selectedCustomPromptId}
            customPromptForm={customPromptForm}
            setCustomPromptForm={setCustomPromptForm}
            customPromptTab={customPromptTab}
            setCustomPromptTab={setCustomPromptTab}
            customPromptPreview={customPromptPreview}
            customPromptRevisions={customPromptRevisions}
            selectCustomPrompt={selectCustomPrompt}
            createCustomPromptDraft={createCustomPromptDraft}
            saveCustomPrompt={saveCustomPrompt}
            deleteCustomPrompt={deleteCustomPrompt}
            copySystemPromptToCustom={copySystemPromptToCustom}
            previewCustomPrompt={previewCustomPrompt}
            runCustomPrompt={runCustomPrompt}
            restoreCustomPromptRevision={restoreCustomPromptRevision}
          />
        )}
        {activeModule === "ai" && (
          <AiWorkbenchPage
            activeJob={contextJob}
            hasCurrentJob={Boolean(activeJob)}
            artifacts={aiResourceScope === "current" ? scopedAiArtifacts : aiArtifacts}
            reports={aiResourceScope === "current" ? scopedAiReports : aiReports}
            resourceScope={aiResourceScope}
            setResourceScope={setAiResourceScope}
            reportFocus={reportFocus}
            setReportFocus={setReportFocus}
            createReport={createReport}
            deleteReport={deleteReport}
            deleteArtifact={deleteArtifact}
            selectedArtifactId={selectedArtifactId}
            openedArtifactSnapshot={openedArtifactSnapshot}
            openArtifact={(artifactId, artifact) => void openArtifactById(artifactId, artifact)}
            clearSelectedArtifact={clearSelectedArtifact}
            selectedReportId={selectedReportId}
            setSelectedReportId={setSelectedReportId}
            prompts={aiPrompts}
            openPrompt={openPromptCenter}
            runWorkflow={runWorkflow}
            customPrompts={aiCustomPrompts}
            openCustomPrompt={(promptId) => {
              selectCustomPrompt(promptId);
              setActiveModule("prompts");
            }}
            runCustomPrompt={runCustomPrompt}
            busy={busy}
          />
        )}
      </section>
      {modelSettingsOpen && (
        <ModelSettingsDrawer
          models={aiModels}
          storageStatus={storageStatus}
          credentialSecurityStatus={credentialSecurityStatus}
          retryCredentialSecurity={retryCredentialSecurity}
          legacyImportPreview={legacyImportPreview}
          legacyImportSourceDir={legacyImportSourceDir}
          setLegacyImportSourceDir={(value) => {
            setLegacyImportSourceDir(value);
            setLegacyImportPreview(null);
          }}
          selectLegacyDataDirectory={selectLegacyDataDirectory}
          previewLegacyImport={previewLegacyImport}
          executeLegacyImport={executeLegacyImport}
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
      {datasetManagerOpen && (
        <DatasetManagerDialog
          scopes={noteScopes}
          preview={datasetClearPreview}
          deleteAiArtifacts={deleteDatasetAiArtifacts}
          setDeleteAiArtifacts={setDeleteDatasetAiArtifacts}
          busy={busy}
          onOpenScope={openDatasetScope}
          onPreviewDelete={previewDatasetDelete}
          onConfirm={clearCurrentNotes}
          onBack={() => {
            setDatasetClearPreview(null);
            setDeleteDatasetAiArtifacts(false);
          }}
          onClose={() => {
            setDatasetManagerOpen(false);
            setDatasetClearPreview(null);
            setDeleteDatasetAiArtifacts(false);
          }}
        />
      )}
      {bulkDeletePreview && (
        <BulkDeleteNotesDialog
          preview={bulkDeletePreview}
          busy={busy}
          onConfirm={deleteSelectedNotesBulk}
          onClose={() => setBulkDeletePreview(null)}
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
        goalRuns={aiGoalRuns}
        activeGoalRunId={activeGoalRunId}
        confirmGoalRun={confirmGoalRun}
        retryGoalRun={retryGoalRun}
        addGoalRunSources={addGoalRunSources}
        pendingSearchPlan={assistantSearchPlan}
        confirmSearchPlan={confirmAssistantSearchPlan}
        dismissSearchPlan={() => setAssistantSearchPlan(null)}
        onOpenModels={() => setModelSettingsOpen(true)}
        onNewSearch={() => setActiveModule("research")}
        onOpenJob={(jobId) => {
          setActiveJobId(jobId);
          setShowHistoryData(false);
          setActiveModule("overview");
        }}
        onOpenArtifacts={(artifactId) => void openArtifactById(artifactId)}
        onRefresh={refreshCore}
        workflows={visibleWorkflows.length ? visibleWorkflows : aiWorkflows.slice(0, 4)}
        runWorkflow={runAssistantWorkflow}
        customPrompts={aiCustomPrompts}
        runCustomPrompt={runCustomPrompt}
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
  startBrowserExtensionPairing,
  cancelBrowserExtensionPairing,
  revokeBrowserExtensionPairing,
  pairingCode,
  pairingClock,
  openOriginalUrl,
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
  startBrowserExtensionPairing: () => Promise<void>;
  cancelBrowserExtensionPairing: () => Promise<void>;
  revokeBrowserExtensionPairing: () => Promise<void>;
  pairingCode: string;
  pairingClock: number;
  openOriginalUrl: (url: string) => Promise<void>;
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
          startBrowserExtensionPairing={startBrowserExtensionPairing}
          cancelBrowserExtensionPairing={cancelBrowserExtensionPairing}
          revokeBrowserExtensionPairing={revokeBrowserExtensionPairing}
          pairingCode={pairingCode}
          pairingClock={pairingClock}
          openOriginalUrl={openOriginalUrl}
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
            "点击“生成内容策划”会使用当前启用的选题策划提示词。",
            "产物会自动进入 AI 工作台，可在提示词里查看它来自哪套提示词。"
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
  selectedNoteIds: string[];
  setSelectedNoteIds: (value: string[]) => void;
  sendSelectedNotesToBatchReview: () => void;
  selectedContentProject?: ContentProject;
  addSelectedNotesToProjectMaterials: () => Promise<void>;
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
  previewSelectedNotesDelete: () => Promise<void>;
  deleteSelectedNote: () => Promise<void>;
  refreshNoteMedia: (noteId: string) => Promise<void>;
  openOriginalUrl: (url: string) => Promise<void>;
  runWorkflow: RunWorkflow;
  busy: string;
}) {
  const datasetManagerBusy = props.busy === "clear-preview" || props.busy === "clear-notes";
  const visibleNoteIds = props.notes.map((note) => note.id);
  const selectedNoteIdSet = new Set(props.selectedNoteIds);
  const allVisibleSelected = visibleNoteIds.length > 0 && visibleNoteIds.every((id) => selectedNoteIdSet.has(id));
  const selectedReviewableCount = props.notes.filter((note) => selectedNoteIdSet.has(note.id) && note.desc.trim()).length;
  const selectedCount = props.selectedNoteIds.length;
  const toggleNoteSelection = (noteId: string, selected: boolean) => {
    props.setSelectedNoteIds(selected ? Array.from(new Set([...props.selectedNoteIds, noteId])) : props.selectedNoteIds.filter((id) => id !== noteId));
  };
  const toggleVisibleSelection = () => {
    if (allVisibleSelected) {
      props.setSelectedNoteIds(props.selectedNoteIds.filter((id) => !visibleNoteIds.includes(id)));
      return;
    }
    props.setSelectedNoteIds(Array.from(new Set([...props.selectedNoteIds, ...visibleNoteIds])));
  };

  return (
    <div className="notes-layout">
      <section className="surface notes-panel">
        <SectionTitle
          icon={<Database size={18} />}
          title="笔记库"
          action={
            <div className="button-row">
              <button className="ghost-button compact" onClick={toggleVisibleSelection} disabled={!props.notes.length}>
                <Square size={15} />
                {allVisibleSelected ? "取消本页" : "全选本页"}
              </button>
              <button className="primary-button compact" onClick={props.sendSelectedNotesToBatchReview} disabled={!selectedReviewableCount}>
                <ShieldCheck size={15} />
                送审已选{selectedReviewableCount ? `（${selectedReviewableCount}）` : ""}
              </button>
              <button className="ghost-button compact" onClick={() => void props.addSelectedNotesToProjectMaterials()} disabled={!selectedReviewableCount || !props.selectedContentProject}>
                <Library size={15} />
                加入项目素材{props.selectedContentProject ? `：${props.selectedContentProject.name}` : ""}
              </button>
              <button
                className="ghost-button compact danger"
                onClick={() => void props.openDatasetManager()}
                title="集中管理空数据集、失败数据集和历史任务"
                disabled={datasetManagerBusy}
              >
                {datasetManagerBusy ? <Loader2 className="spin" size={15} /> : <Database size={15} />}
                数据集管理
              </button>
            </div>
          }
        />
        {!!selectedCount && (
          <div className="notes-bulk-bar">
            <div>
              <strong>已选 {formatNumber(selectedCount)} 条笔记</strong>
              <small>{props.activeJobId ? "将在当前数据集内处理，共用笔记只解除关联。" : "未选单个数据集时，删除会按全局笔记处理。"}</small>
            </div>
            <div className="button-row">
              <button className="ghost-button compact" onClick={() => props.setSelectedNoteIds([])}>
                <X size={14} />
                清空选择
              </button>
              <button className="ghost-button compact danger" onClick={() => void props.previewSelectedNotesDelete()} disabled={props.busy === "bulk-delete-preview"}>
                {props.busy === "bulk-delete-preview" ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />}
                删除已选
              </button>
            </div>
          </div>
        )}
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
            <div
              key={note.id}
              className={`${props.selected?.id === note.id ? "note-row active" : "note-row"} ${note.desc ? "" : "pending-body"}`}
            >
              <label className="note-select-check" title={note.desc ? "加入批量审稿" : "正文未补全，送审时会跳过"}>
                <input
                  type="checkbox"
                  checked={selectedNoteIdSet.has(note.id)}
                  onChange={(event) => toggleNoteSelection(note.id, event.target.checked)}
                />
              </label>
              <button className="note-row-main" onClick={() => props.setSelectedId(note.id)}>
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
            </div>
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

function datasetStateLabel(scope: NoteScopeSummary): string {
  if (scope.noteCount === 0 && scope.queueErrors > 0) return "失败/空数据集";
  if (scope.noteCount === 0) return "空数据集";
  if (scope.queueErrors > 0) return "有错误";
  if (scope.isDuplicate) return `重复关键词 ${scope.duplicateCount}`;
  return "正常";
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
  notes,
  selected,
  artifacts,
  runWorkflow,
  busy
}: {
  analytics: AnalyticsReport | null;
  notes: NoteRecord[];
  selected: NoteRecord | null;
  artifacts: AiArtifact[];
  runWorkflow: RunWorkflow;
  busy: string;
}) {
  const templates = analytics?.templates ?? [];
  const noteById = useMemo(() => new Map(notes.map((note) => [note.id, note])), [notes]);
  const [activeSampleId, setActiveSampleId] = useState("");
  const [compareSampleIds, setCompareSampleIds] = useState<string[]>([]);
  const currentSamplePanelRef = useRef<HTMLElement | null>(null);
  const fallbackSampleId = templates[0]?.noteId ?? selected?.id ?? "";

  useEffect(() => {
    if (activeSampleId && (templates.some((item) => item.noteId === activeSampleId) || selected?.id === activeSampleId)) {
      return;
    }
    setActiveSampleId(fallbackSampleId);
  }, [activeSampleId, fallbackSampleId, selected?.id, templates]);

  useEffect(() => {
    const validIds = new Set(templates.map((item) => item.noteId));
    setCompareSampleIds((ids) => {
      const next = ids.filter((id) => validIds.has(id));
      return next.length === ids.length ? ids : next;
    });
  }, [templates]);

  const activeTemplate = templates.find((item) => item.noteId === activeSampleId);
  const activeNote = (activeSampleId ? noteById.get(activeSampleId) : undefined) ?? (selected?.id === activeSampleId ? selected : undefined);
  const compareCount = compareSampleIds.length;
  const latestDeepDive =
    artifacts.find((artifact) => artifact.workflowKey === "viral-deep-dive" && activeSampleId && artifact.noteId === activeSampleId) ??
    artifacts.find((artifact) => artifact.workflowKey === "viral-deep-dive");
  const latestBatchDive = artifacts.find((artifact) => artifact.workflowKey === "viral-batch-deep-dive");
  const latestTemplate = artifacts.find((artifact) => artifact.workflowKey === "viral-template");
  const toggleCompareSample = (noteId: string) => {
    setCompareSampleIds((ids) => ids.includes(noteId) ? ids.filter((id) => id !== noteId) : Array.from(new Set([...ids, noteId])));
  };
  const openSample = (noteId: string) => {
    setActiveSampleId(noteId);
    requestAnimationFrame(() => currentSamplePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" }));
  };
  const runSingleDive = (noteId: string) => runWorkflow("viral-deep-dive", undefined, { noteId });
  const runBatchDive = () =>
    runWorkflow(
      "viral-batch-deep-dive",
      `对比拆解当前选中的 ${compareSampleIds.length} 篇爆款样本，输出共同结构、差异和可复用边界。`,
      { noteIds: compareSampleIds }
    );
  return (
    <div className="viral-layout">
      <section className="surface viral-template-panel">
        <SectionTitle
          icon={<Flame size={18} />}
          title="爆款样本库"
          action={
            <div className="button-row">
              <button className="ghost-button compact" onClick={() => void runBatchDive()} disabled={compareCount < 2 || busy === "workflow-viral-batch-deep-dive"}>
                {busy === "workflow-viral-batch-deep-dive" ? <Loader2 className="spin" size={14} /> : <Layers size={14} />}
                对比已选{compareCount ? `（${compareCount}）` : ""}
              </button>
              <button className="primary-button compact" onClick={() => void runWorkflow("viral-template")} disabled={busy === "workflow-viral-template"}>
                {busy === "workflow-viral-template" ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}
                生成模板库
              </button>
            </div>
          }
        />
        <p className="panel-note">按本地爆款分排序。点击样本卡片可查看本地拆解，或勾选 2 篇以上做多篇对比拆解。</p>
        <div className="template-list">
          {templates.map((item) => {
            const isActive = item.noteId === activeSampleId;
            const isCompared = compareSampleIds.includes(item.noteId);
            return (
              <div key={item.noteId} className={isActive ? "template-item active" : "template-item"}>
                <button className="template-item-main" type="button" onClick={() => openSample(item.noteId)} aria-current={isActive ? "true" : undefined}>
                  <strong>{item.title}</strong>
                  {isActive && <span className="template-current-badge">当前查看</span>}
                  <span>爆款分 {item.score} · {contentTypeLabel(item.contentType)}</span>
                  <div>{item.hookPatterns.map((hook) => <em key={hook}>{hook}</em>)}</div>
                </button>
                <div className="template-item-actions">
                  <button className="ghost-button compact" onClick={() => void runSingleDive(item.noteId)} disabled={busy === "workflow-viral-deep-dive"}>
                    {busy === "workflow-viral-deep-dive" ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}
                    AI 深度拆解
                  </button>
                  <button className={isCompared ? "ghost-button compact danger" : "ghost-button compact"} onClick={() => toggleCompareSample(item.noteId)}>
                    {isCompared ? <X size={14} /> : <CheckCircle2 size={14} />}
                    {isCompared ? "移出对比" : "加入对比"}
                  </button>
                </div>
              </div>
            );
          })}
          {!templates.length && <EmptyState text="抓取完成后，这里会列出高潜爆款样本" />}
        </div>
      </section>
      <section className="surface viral-current-panel" ref={currentSamplePanelRef}>
        <SectionTitle
          icon={<Sparkles size={18} />}
          title="当前样本拆解"
          action={
            <button className="primary-button compact" onClick={() => void runSingleDive(activeSampleId)} disabled={!activeSampleId || busy === "workflow-viral-deep-dive"}>
              {busy === "workflow-viral-deep-dive" ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}
              AI 深度拆解
            </button>
          }
        />
        {activeNote?.analysis || activeTemplate ? (
          <div className="viral-current-scroll">
            <div className="selected-note-summary">
              <span>来自爆款样本库当前选中样本</span>
              <strong>{activeNote?.title || activeTemplate?.title || "未命名笔记"}</strong>
              <small>
                {activeNote?.authorName ?? "作者待确认"} · {activeNote?.type === "video" ? "视频" : "图文/未知"} · 已选对比 {compareCount} 篇
              </small>
            </div>
            {activeNote?.analysis ? (
              <div className="analysis-grid">
                <Metric label="爆款分" value={String(activeNote.analysis.score)} />
                <Metric label="收藏/赞" value={percentLabel(activeNote.analysis.collectLikeRatio)} />
                <Metric label="评论/赞" value={percentLabel(activeNote.analysis.commentLikeRatio)} />
                <Metric label="作者倍数" value={`${activeNote.analysis.viralMultiplier}x`} />
              </div>
            ) : (
              <div className="analysis-grid">
                <Metric label="爆款分" value={String(activeTemplate?.score ?? 0)} />
                <Metric label="收藏/赞" value="待读取" />
                <Metric label="评论/赞" value="待读取" />
                <Metric label="作者倍数" value="待读取" />
              </div>
            )}
            <div className="score-explain">
              <strong>爆款分怎么算</strong>
              <p>本地规则会综合标题钩子、收藏/点赞比、评论/点赞比、相对作者过往表现、评论主题数量和正文完整度，压缩成 0-100 分。它用于筛选“值得进一步拆解”的样本，不等同于平台官方推荐分。</p>
            </div>
            <div className="insight-panel">
              <strong>结构判断</strong>
              <p>内容类型：{contentTypeLabel(activeNote?.analysis?.contentType ?? activeTemplate?.contentType)}；讨论类型：{discussionTypeLabel(activeNote?.analysis?.discussionType)}</p>
              <p>标题钩子：{(activeNote?.analysis?.hookPatterns ?? activeTemplate?.hookPatterns ?? []).join("、") || "暂无明显钩子"}</p>
              <p>复刻方向：保留用户能立即理解的冲突点，正文补足清单、步骤或真实案例，再用评论区高频问题做续篇。</p>
            </div>
            <div className="theme-cloud labeled">
              {activeNote?.analysis?.commentThemes.map((theme) => (
                <span key={theme.keyword}>{theme.keyword} · {theme.count}</span>
              ))}
              {!activeNote?.analysis?.commentThemes.length && <span>评论主题不足，建议继续抓取评论后再判断。</span>}
            </div>
          </div>
        ) : (
          <EmptyState text="从左侧爆款样本库选择一篇笔记，这里会显示它的爆款结构" />
        )}
      </section>
      <section className="surface viral-ai-panel">
        <SectionTitle icon={<Bot size={18} />} title="AI 深度拆解与对比结果" />
        {latestDeepDive ? (
          <MarkdownView content={latestDeepDive.markdown} compact />
        ) : latestBatchDive ? (
          <MarkdownView content={latestBatchDive.markdown} compact />
        ) : latestTemplate ? (
          <MarkdownView content={latestTemplate.markdown} compact />
        ) : activeSampleId ? (
          <div className="viral-ai-empty">
            <InsightPanel
              title="建议下一步"
              lines={[
                "点击“AI 深度拆解”会围绕当前页内选中的样本生成爆点、标题钩子、正文结构、评论心理和可复刻 brief。",
                "在左侧勾选 2 篇以上样本后，点击“对比已选”会生成多篇对比拆解。",
                "AI 产物会进入 AI 工作台，并标记它使用的提示词，后续可以继续编辑提示词再生成。"
              ]}
            />
          </div>
        ) : (
          <EmptyState text="选择一篇样本后，可以生成单篇深拆；选择多篇后，可以生成对比拆解" />
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

function ContentStudioPage(props: ContentStudioProps) {
  const selectedProject = props.projects.find((item) => item.id === props.selectedProjectId);
  const selectedPlaybook = props.playbooks.find((item) => item.id === props.selectedPlaybookId);
  const ruleSummary = contentReviewRuleSummary(selectedPlaybook);
  const ruleLabel = ruleSummary.label;
  const projectLabel = selectedProject?.name ?? (props.selectedProjectId ? "项目已不存在" : props.projectDirty ? `${props.projectForm.name || "新内容项目"}（未保存）` : "未选择内容项目");
  const selectedCount = props.batchItems.filter((item) => item.selected && item.body.trim()).length;
  const tabs: Array<{ key: ContentStudioTab; label: string; icon: ReactNode }> = [
    { key: "projects", label: "内容项目", icon: <Gauge size={16} /> },
    { key: "review", label: "AI 审稿员", icon: <ShieldCheck size={16} /> },
    { key: "batch", label: `批量审稿${selectedCount ? ` ${selectedCount}` : ""}`, icon: <Layers size={16} /> },
    { key: "write", label: "自动撰写", icon: <Sparkles size={16} /> },
    { key: "rules", label: "规则库", icon: <Library size={16} /> },
    { key: "results", label: "结果归档", icon: <FileText size={16} /> }
  ];
  return (
    <div className="module-frame content-studio-shell">
      <section className="surface content-studio-nav">
        <div className="content-studio-head">
          <div>
            <strong>内容创作台</strong>
            <span>{projectLabel} · {ruleLabel} · {props.activeJob ? jobKeywordLabel(props.activeJob) : "无任务上下文"}</span>
          </div>
          <div className="button-row">
            <button className="ghost-button compact" onClick={() => props.setActiveTab("projects")}>
              <Gauge size={14} />
              管理项目
            </button>
            <button className="ghost-button compact" onClick={() => props.setActiveTab("rules")}>
              <Library size={14} />
              管理规则
            </button>
            <button className="ghost-button compact" onClick={props.openDraftReviewPrompt}>
              <Eye size={14} />
              查看审稿提示词
            </button>
          </div>
        </div>
        <div className="content-tab-row" role="tablist" aria-label="内容创作台子页面">
          {tabs.map((tab) => (
            <button key={tab.key} className={props.activeTab === tab.key ? "active" : ""} onClick={() => props.setActiveTab(tab.key)}>
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </section>

      {props.activeTab === "projects" && <ContentProjectsPane {...props} />}
      {props.activeTab === "review" && <ContentReviewPane {...props} />}
      {props.activeTab === "batch" && <ContentBatchReviewPane {...props} />}
      {props.activeTab === "write" && <ContentWritingPane {...props} />}
      {props.activeTab === "rules" && <ContentRulesPane {...props} />}
      {props.activeTab === "results" && <ContentResultsPane {...props} />}
    </div>
  );
}

function ContentProjectsPane(props: Pick<ContentStudioProps, "projects" | "selectedProjectId" | "setSelectedProjectId" | "projectForm" | "setProjectForm" | "projectDirty" | "setProjectDirty" | "projectMaterials" | "deleteProjectMaterial" | "playbooks" | "jobs" | "createProject" | "deleteProject" | "saveProject" | "busy">) {
  const updateProject = (key: keyof ContentProjectForm, value: string) => {
    props.setProjectForm({ ...props.projectForm, [key]: value } as ContentProjectForm);
    props.setProjectDirty(true);
  };
  return (
    <div className="content-studio-grid projects-grid">
      <section className="surface content-side-panel">
        <SectionTitle icon={<Gauge size={18} />} title="项目列表" action={<button className="ghost-button compact" onClick={props.createProject}><FileText size={14} />新建</button>} />
        <div className="rule-card-list">
          {props.projects.map((project) => (
            <button key={project.id} className={props.selectedProjectId === project.id ? "rule-card active" : "rule-card"} onClick={() => props.setSelectedProjectId(project.id)}>
              <strong>{project.name}</strong>
              <small>{project.productName} · {contentProjectStatusLabel(project.status)}</small>
              <small>{project.targetAudience.slice(0, 3).join(" / ") || "未设置人群"}</small>
            </button>
          ))}
          {!props.projects.length && <EmptyState text="暂无内容项目，新建后可绑定产品、规则库和任务上下文。" />}
        </div>
      </section>
      <section className="surface content-primary-panel">
        <SectionTitle
          icon={<Gauge size={18} />}
          title={props.selectedProjectId ? `编辑项目${props.projectDirty ? "（未保存）" : ""}` : "新建项目（未保存）"}
          action={
            <div className="button-row">
              <button className="ghost-button compact danger" onClick={() => void props.deleteProject()} disabled={!props.selectedProjectId || props.busy === "content-project-delete"}>
                {props.busy === "content-project-delete" ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />}
                删除
              </button>
              <button className="primary-button compact" onClick={() => void props.saveProject()} disabled={props.busy === "content-project"}>
                {props.busy === "content-project" ? <Loader2 className="spin" size={14} /> : <ShieldCheck size={14} />}
                保存项目
              </button>
            </div>
          }
        />
        <div className="content-field-stack project-editor-grid">
          <label><span>项目名称</span><input value={props.projectForm.name} onChange={(event) => updateProject("name", event.target.value)} /></label>
          <label><span>产品</span><input value={props.projectForm.productName} onChange={(event) => updateProject("productName", event.target.value)} /></label>
          <label>
            <span>状态</span>
            <select value={props.projectForm.status} onChange={(event) => updateProject("status", event.target.value)}>
              <option value="planning">选题中</option>
              <option value="writing">撰写中</option>
              <option value="reviewing">审稿中</option>
              <option value="finalized">已定稿</option>
            </select>
          </label>
          <label>
            <span>规则库</span>
            <select value={props.projectForm.playbookId} onChange={(event) => updateProject("playbookId", event.target.value)}>
              <option value="">{DEFAULT_CONTENT_REVIEW_RULE_LABEL}</option>
              {props.playbooks.map((playbook) => <option key={playbook.id} value={playbook.id}>{playbook.name}</option>)}
            </select>
          </label>
          <label>
            <span>关联任务</span>
            <select value={props.projectForm.jobId} onChange={(event) => updateProject("jobId", event.target.value)}>
              <option value="">不绑定抓取任务</option>
              {props.jobs.map((job) => <option key={job.id} value={job.id}>{jobKeywordLabel(job)}</option>)}
            </select>
          </label>
          <label><span>目标人群</span><textarea value={props.projectForm.targetAudience} onChange={(event) => updateProject("targetAudience", event.target.value)} /></label>
          <label><span>内容场景</span><textarea value={props.projectForm.scenarios} onChange={(event) => updateProject("scenarios", event.target.value)} /></label>
          <label><span>项目目标</span><textarea value={props.projectForm.goals} onChange={(event) => updateProject("goals", event.target.value)} /></label>
        </div>
        <div className="project-material-panel">
          <div className="section-mini-head">
            <strong>项目素材池</strong>
            <span>{props.projectMaterials.length ? `${props.projectMaterials.length} 条素材` : "从笔记库勾选笔记加入素材池"}</span>
          </div>
          <div className="project-material-list">
            {props.projectMaterials.map((material) => (
              <div key={material.id} className="project-material-card">
                <div>
                  <strong>{material.title}</strong>
                  <small>{contentMaterialCategoryLabel(material.category)} · {material.source === "note" ? "笔记库" : "手动"}{material.authorName ? ` · ${material.authorName}` : ""}</small>
                  <p>{compactContentText(material.content, 140)}</p>
                  {material.stats && <small>赞 {formatNumber(material.stats.liked)} · 藏 {formatNumber(material.stats.collected)} · 评 {formatNumber(material.stats.comments)}</small>}
                </div>
                <button className="ghost-button compact danger" onClick={() => void props.deleteProjectMaterial(material.id)} disabled={props.busy === `content-material-delete-${material.id}`}>
                  {props.busy === `content-material-delete-${material.id}` ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />}
                  删除
                </button>
              </div>
            ))}
            {!props.projectMaterials.length && <EmptyState text="暂无项目素材。先去笔记库勾选已抓取正文的笔记，再点击加入项目素材。" />}
          </div>
        </div>
      </section>
    </div>
  );
}

function ContentReviewPane(props: Pick<ContentStudioProps, "reviewForm" | "setReviewForm" | "reviewDraft" | "busy" | "playbooks" | "selectedPlaybookId" | "setSelectedPlaybookId" | "reviews" | "openArtifact" | "openDraftReviewPrompt" | "loadReviewForRereview" | "reviewExecutionLabel">) {
  const updateReview = (key: keyof ContentReviewForm, value: string) => props.setReviewForm({ ...props.reviewForm, [key]: value });
  const ruleSummary = contentReviewRuleSummary(props.playbooks.find((playbook) => playbook.id === props.selectedPlaybookId));
  return (
    <div className="content-studio-grid review-first">
      <section className="surface content-primary-panel">
        <SectionTitle icon={<ShieldCheck size={18} />} title="AI 审稿员" />
        <div className="content-field-stack">
          <label>
            <span>使用规则</span>
            <select value={props.selectedPlaybookId} onChange={(event) => props.setSelectedPlaybookId(event.target.value)}>
              <option value="">{DEFAULT_CONTENT_REVIEW_RULE_LABEL}</option>
              {props.playbooks.map((playbook) => <option key={playbook.id} value={playbook.id}>{playbook.name}</option>)}
            </select>
          </label>
          <div className="content-preview-box">
            <strong>{ruleSummary.label}</strong>
            <small>禁用词 {ruleSummary.forbiddenTermCount} 个 · 敏感词 {ruleSummary.sensitiveClaimCount} 个</small>
            <small>执行方式：{props.reviewExecutionLabel}</small>
            <button className="ghost-button compact" onClick={props.openDraftReviewPrompt}><Eye size={14} />查看审稿提示词</button>
          </div>
          <label>
            <span>标题</span>
            <input value={props.reviewForm.title} onChange={(event) => updateReview("title", event.target.value)} />
          </label>
          <label>
            <span>正文</span>
            <textarea className="content-review-textarea xl" value={props.reviewForm.body} onChange={(event) => updateReview("body", event.target.value)} />
          </label>
          <label>
            <span>标签</span>
            <input value={props.reviewForm.tags} onChange={(event) => updateReview("tags", event.target.value)} />
          </label>
          <button className="primary-button full" onClick={() => void props.reviewDraft()} disabled={props.busy === "content-review" || !props.reviewForm.body.trim()}>
            {props.busy === "content-review" ? <Loader2 className="spin" size={16} /> : <ShieldCheck size={16} />}
            审稿并生成修改稿
          </button>
        </div>
      </section>
      <ContentReviewSidePanel reviews={props.reviews} openArtifact={props.openArtifact} loadReviewForRereview={props.loadReviewForRereview} />
    </div>
  );
}

function ContentBatchReviewPane(props: Pick<ContentStudioProps, "batchItems" | "setBatchItems" | "reviewBatch" | "busy" | "playbooks" | "selectedPlaybookId" | "setSelectedPlaybookId" | "reviews" | "openArtifact" | "openDraftReviewPrompt" | "loadReviewForRereview" | "reviewExecutionLabel">) {
  const updateItem = (id: string, patch: Partial<BatchReviewItem>) => {
    props.setBatchItems(props.batchItems.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };
  const addItem = () => props.setBatchItems([...props.batchItems, createBatchReviewItem()]);
  const removeItem = (id: string) => props.setBatchItems(props.batchItems.length > 1 ? props.batchItems.filter((item) => item.id !== id) : [createBatchReviewItem()]);
  const allSelected = props.batchItems.every((item) => item.selected);
  const selectedCount = props.batchItems.filter((item) => item.selected && item.body.trim()).length;
  const ruleSummary = contentReviewRuleSummary(props.playbooks.find((playbook) => playbook.id === props.selectedPlaybookId));
  return (
    <div className="content-studio-grid batch-grid">
      <section className="surface content-primary-panel">
        <SectionTitle
          icon={<Layers size={18} />}
          title="批量审稿"
          action={
            <div className="button-row">
              <button className="ghost-button compact" onClick={() => props.setBatchItems(props.batchItems.map((item) => ({ ...item, selected: !allSelected })))}>
                <Square size={14} />
                {allSelected ? "取消全选" : "全选"}
              </button>
              <button className="ghost-button compact" onClick={addItem}>
                <FileText size={14} />
                添加
              </button>
            </div>
          }
        />
        <div className="content-field-stack">
          <label>
            <span>使用规则</span>
            <select value={props.selectedPlaybookId} onChange={(event) => props.setSelectedPlaybookId(event.target.value)}>
              <option value="">{DEFAULT_CONTENT_REVIEW_RULE_LABEL}</option>
              {props.playbooks.map((playbook) => <option key={playbook.id} value={playbook.id}>{playbook.name}</option>)}
            </select>
          </label>
          <div className="content-preview-box">
            <strong>{ruleSummary.label}</strong>
            <small>禁用词 {ruleSummary.forbiddenTermCount} 个 · 敏感词 {ruleSummary.sensitiveClaimCount} 个</small>
            <small>执行方式：{props.reviewExecutionLabel}</small>
            <button className="ghost-button compact" onClick={props.openDraftReviewPrompt}><Eye size={14} />查看审稿提示词</button>
          </div>
          <div className="batch-review-list">
            {props.batchItems.map((item, index) => (
              <div key={item.id} className={item.selected ? "batch-review-row selected" : "batch-review-row"}>
                <label className="batch-check">
                  <input type="checkbox" checked={item.selected} onChange={(event) => updateItem(item.id, { selected: event.target.checked })} />
                  <span>{index + 1}</span>
                </label>
                <div className="batch-fields">
                  <input value={item.title} onChange={(event) => updateItem(item.id, { title: event.target.value })} placeholder="标题" />
                  <textarea value={item.body} onChange={(event) => updateItem(item.id, { body: event.target.value })} placeholder="正文" />
                  <input value={item.tags} onChange={(event) => updateItem(item.id, { tags: event.target.value })} placeholder="标签" />
                </div>
                <button className="ghost-button compact danger" onClick={() => removeItem(item.id)} aria-label="移除">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button className="primary-button full" onClick={() => void props.reviewBatch(props.batchItems)} disabled={props.busy === "content-batch-review" || selectedCount === 0}>
            {props.busy === "content-batch-review" ? <Loader2 className="spin" size={16} /> : <ShieldCheck size={16} />}
            审稿已勾选内容{selectedCount ? `（${selectedCount}）` : ""}
          </button>
        </div>
      </section>
      <ContentReviewSidePanel reviews={props.reviews} openArtifact={props.openArtifact} loadReviewForRereview={props.loadReviewForRereview} />
    </div>
  );
}

function ContentWritingPane(props: Pick<ContentStudioProps, "activeJob" | "briefForm" | "setBriefForm" | "batchDraftCount" | "setBatchDraftCount" | "generateDraft" | "generateDraftBatch" | "busy" | "drafts" | "projectMaterials" | "openArtifact">) {
  const updateBrief = (key: keyof ContentBriefForm, value: string) => props.setBriefForm({ ...props.briefForm, [key]: value } as ContentBriefForm);
  const latestDraft = props.drafts[0];
  return (
    <div className="content-studio-grid">
      <section className="surface content-primary-panel">
        <SectionTitle icon={<Sparkles size={18} />} title="自动撰写小红书笔记" />
        <div className="content-field-stack">
          <div className="section-mini-head">
            <strong>结构化 Brief</strong>
            <span>{props.activeJob ? jobKeywordLabel(props.activeJob) : "无任务上下文"}</span>
          </div>
          <div className="form-grid content-brief-grid">
            <label><span>产品</span><input value={props.briefForm.productName} onChange={(event) => updateBrief("productName", event.target.value)} /></label>
            <label><span>身份</span><input value={props.briefForm.persona} onChange={(event) => updateBrief("persona", event.target.value)} /></label>
            <label><span>痛点</span><input value={props.briefForm.painPoint} onChange={(event) => updateBrief("painPoint", event.target.value)} /></label>
            <label><span>场景</span><input value={props.briefForm.scenario} onChange={(event) => updateBrief("scenario", event.target.value)} /></label>
            <label><span>了解渠道</span><input value={props.briefForm.channel} onChange={(event) => updateBrief("channel", event.target.value)} /></label>
            <label>
              <span>篇幅</span>
              <select value={props.briefForm.length} onChange={(event) => props.setBriefForm({ ...props.briefForm, length: event.target.value as ContentDraftLength })}>
                <option value="short">短</option>
                <option value="medium">中</option>
                <option value="long">长</option>
              </select>
            </label>
            <label>
              <span>批量篇数</span>
              <input type="number" min={1} max={8} value={props.batchDraftCount} onChange={(event) => props.setBatchDraftCount(Math.min(Math.max(Number(event.target.value) || 1, 1), 8))} />
            </label>
          </div>
          <label><span>产品特点</span><textarea value={props.briefForm.sellingPoints} onChange={(event) => updateBrief("sellingPoints", event.target.value)} /></label>
          <label><span>关键词/标签</span><input value={props.briefForm.keywords} onChange={(event) => updateBrief("keywords", event.target.value)} /></label>
          <div className="button-row">
            <button className="primary-button full" onClick={() => void props.generateDraft()} disabled={props.busy === "content-draft"}>
              {props.busy === "content-draft" ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
              生成单篇并审稿
            </button>
            <button className="ghost-button full" onClick={() => void props.generateDraftBatch()} disabled={props.busy === "content-draft-batch"}>
              {props.busy === "content-draft-batch" ? <Loader2 className="spin" size={16} /> : <Layers size={16} />}
              批量生成{props.batchDraftCount}篇{props.projectMaterials.length ? ` · 素材${props.projectMaterials.length}` : ""}
            </button>
          </div>
        </div>
      </section>
      <section className="surface content-side-panel">
        <SectionTitle icon={<FileText size={18} />} title="最近草稿" />
        {latestDraft ? (
          <div className="content-preview-box">
            <strong>{latestDraft.title}</strong>
            <p>{latestDraft.body.slice(0, 260)}</p>
            <small>{latestDraft.tags.map((tag) => `#${tag}`).join(" ")}</small>
            {latestDraft.artifactId && <button className="ghost-button full" onClick={() => props.openArtifact(latestDraft.artifactId!)}><Eye size={14} />打开草稿产物</button>}
          </div>
        ) : (
          <EmptyState text="暂无草稿" />
        )}
      </section>
    </div>
  );
}

function ContentRulesPane(props: Pick<ContentStudioProps, "playbooks" | "selectedPlaybookId" | "setSelectedPlaybookId" | "playbookForm" | "setPlaybookForm" | "playbookDirty" | "setPlaybookDirty" | "playbookRevisions" | "playbookStats" | "restorePlaybookRevision" | "createPlaybook" | "deletePlaybook" | "savePlaybook" | "savePlaybookAsNew" | "busy">) {
  const updatePlaybook = (key: keyof ContentPlaybookForm, value: string) => {
    props.setPlaybookForm({ ...props.playbookForm, [key]: value });
    props.setPlaybookDirty(true);
  };
  const applyTemplate = (templateKey: ContentPlaybookTemplateKey) => {
    props.setPlaybookForm(applyContentPlaybookTemplate(props.playbookForm, templateKey));
    props.setPlaybookDirty(true);
  };
  return (
    <div className="content-studio-grid rules-grid">
      <section className="surface content-side-panel">
        <SectionTitle icon={<Library size={18} />} title="规则库列表" action={<button className="ghost-button compact" onClick={props.createPlaybook}><FileText size={14} />新建</button>} />
        <div className="rule-card-list">
          {props.playbooks.map((playbook) => (
            <button key={playbook.id} className={props.selectedPlaybookId === playbook.id ? "rule-card active" : "rule-card"} onClick={() => {
              props.setSelectedPlaybookId(playbook.id);
              props.setPlaybookForm(playbookToForm(playbook));
              props.setPlaybookDirty(false);
            }}>
              <strong>{playbook.name}</strong>
              <small>{playbook.productName} · {playbook.category}</small>
              <small>禁用 {playbook.forbiddenTerms.length} · 敏感 {playbook.sensitiveClaims.length}</small>
            </button>
          ))}
          {!props.playbooks.length && <EmptyState text="暂无已保存规则，点击新建或直接编辑右侧模板后保存" />}
        </div>
      </section>
      <section className="surface content-primary-panel">
        <SectionTitle
          icon={<ShieldCheck size={18} />}
          title={props.selectedPlaybookId ? `编辑规则${props.playbookDirty ? "（未保存）" : ""}` : "新建规则（未保存）"}
          action={
            <div className="button-row">
              <button className="ghost-button compact danger" onClick={() => void props.deletePlaybook()} disabled={!props.selectedPlaybookId || props.busy === "content-playbook-delete"}>
                {props.busy === "content-playbook-delete" ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />}
                删除
              </button>
              <button className="ghost-button compact" onClick={() => void props.savePlaybookAsNew()} disabled={props.busy === "content-playbook-save-as"}>
                {props.busy === "content-playbook-save-as" ? <Loader2 className="spin" size={14} /> : <FileText size={14} />}
                另存为新规则
              </button>
              <button className="primary-button compact" onClick={() => void props.savePlaybook()} disabled={props.busy === "content-playbook"}>
                {props.busy === "content-playbook" ? <Loader2 className="spin" size={14} /> : <ShieldCheck size={14} />}
                {props.selectedPlaybookId ? "保存修改" : "保存新规则"}
              </button>
            </div>
          }
        />
        <div className="playbook-template-panel">
          <div className="section-mini-head">
            <strong>规则模板</strong>
            <span>套用后可继续微调，再保存为规则库</span>
          </div>
          <div className="playbook-template-grid">
            {contentPlaybookTemplates.map((template) => (
              <button key={template.key} type="button" className="playbook-template-card" onClick={() => applyTemplate(template.key)}>
                <strong>{template.label}</strong>
                <small>{template.description}</small>
              </button>
            ))}
          </div>
        </div>
        {props.selectedPlaybookId && (
          <div className="playbook-version-panel">
            <div className="section-mini-head">
              <strong>版本记录</strong>
              <span>{props.playbookRevisions.length ? `最近 ${props.playbookRevisions.length} 次保存` : "保存后自动生成版本"}</span>
            </div>
            <div className="playbook-version-list">
              {props.playbookRevisions.slice(0, 6).map((revision, index) => (
                <div key={revision.id} className="playbook-version-row">
                  <div>
                    <strong>{revision.snapshot.name}</strong>
                    <small>{new Date(revision.createdAt).toLocaleString()} · 禁用 {revision.snapshot.forbiddenTerms.length} · 敏感 {revision.snapshot.sensitiveClaims.length}</small>
                  </div>
                  <button className="ghost-button compact" onClick={() => void props.restorePlaybookRevision(revision.id)} disabled={props.busy === "content-playbook-restore" || index === 0}>
                    {props.busy === "content-playbook-restore" ? <Loader2 className="spin" size={14} /> : <RefreshCw size={14} />}
                    {index === 0 ? "当前版本" : "回退"}
                  </button>
                </div>
              ))}
              {!props.playbookRevisions.length && <EmptyState text="当前规则还没有版本记录，保存后会自动生成。" />}
            </div>
          </div>
        )}
        {props.selectedPlaybookId && props.playbookStats && (
          <div className="playbook-stats-panel">
            <div className="section-mini-head">
              <strong>命中统计</strong>
              <span>来自历史审稿结果</span>
            </div>
            <div className="artifact-context">
              <StatusRow label="审稿" value={`${props.playbookStats.reviewCount}`} ok={props.playbookStats.reviewCount > 0} />
              <StatusRow label="问题" value={`${props.playbookStats.issueCount}`} ok={props.playbookStats.issueCount === 0} />
              <StatusRow label="高风险" value={`${props.playbookStats.highRiskCount}`} ok={props.playbookStats.highRiskCount === 0} />
              <StatusRow label="通过" value={`${props.playbookStats.passCount}`} ok={props.playbookStats.passCount > 0} />
            </div>
            <div className="playbook-stats-grid">
              <div>
                <strong>常见问题</strong>
                {props.playbookStats.topCategories.map((item) => <span key={item.category}>{item.category} · {item.count}</span>)}
                {!props.playbookStats.topCategories.length && <span>暂无命中分类</span>}
              </div>
              <div>
                <strong>最近命中</strong>
                {props.playbookStats.recentIssues.slice(0, 4).map((issue) => (
                  <span key={`${issue.reviewId}-${issue.category}-${issue.evidence ?? ""}`}>{severityLabel(issue.severity)} · {issue.category}{issue.evidence ? `：${issue.evidence}` : ""}</span>
                ))}
                {!props.playbookStats.recentIssues.length && <span>暂无命中记录</span>}
              </div>
            </div>
          </div>
        )}
        <div className="content-field-stack rules-editor-grid">
          <label><span>名称</span><input value={props.playbookForm.name} onChange={(event) => updatePlaybook("name", event.target.value)} /></label>
          <label><span>产品</span><input value={props.playbookForm.productName} onChange={(event) => updatePlaybook("productName", event.target.value)} /></label>
          <label><span>行业</span><input value={props.playbookForm.category} onChange={(event) => updatePlaybook("category", event.target.value)} /></label>
          <label><span>人设</span><textarea value={props.playbookForm.personas} onChange={(event) => updatePlaybook("personas", event.target.value)} /></label>
          <label><span>场景</span><textarea value={props.playbookForm.scenarios} onChange={(event) => updatePlaybook("scenarios", event.target.value)} /></label>
          <label><span>标签</span><textarea value={props.playbookForm.tags} onChange={(event) => updatePlaybook("tags", event.target.value)} /></label>
          <label><span>禁用词</span><textarea value={props.playbookForm.forbiddenTerms} onChange={(event) => updatePlaybook("forbiddenTerms", event.target.value)} /></label>
          <label><span>敏感功效</span><textarea value={props.playbookForm.sensitiveClaims} onChange={(event) => updatePlaybook("sensitiveClaims", event.target.value)} /></label>
          <label><span>可说卖点</span><textarea value={props.playbookForm.allowedSellingPoints} onChange={(event) => updatePlaybook("allowedSellingPoints", event.target.value)} /></label>
          <label><span>固定结构</span><textarea value={props.playbookForm.requiredSections} onChange={(event) => updatePlaybook("requiredSections", event.target.value)} /></label>
          <label><span>语气规则</span><textarea value={props.playbookForm.toneWords} onChange={(event) => updatePlaybook("toneWords", event.target.value)} /></label>
          <label><span>结构化替换规则（JSON：from / to / reason）</span><textarea value={props.playbookForm.replacements} onChange={(event) => updatePlaybook("replacements", event.target.value)} /></label>
        </div>
      </section>
    </div>
  );
}

function ContentResultsPane(props: Pick<ContentStudioProps, "drafts" | "reviews" | "artifacts" | "acceptDraftReview" | "openArtifact" | "loadReviewForRereview" | "busy">) {
  const contentArtifacts = getContentArtifacts(props.artifacts);
  const counts = contentResultCounts(props.drafts, props.reviews, props.artifacts);
  const reviewByDraftId = new Map(props.reviews.filter((review) => review.draftId).map((review) => [review.draftId, review]));
  return (
    <div className="content-studio-grid results-grid">
      <section className="surface content-side-panel">
        <SectionTitle icon={<Gauge size={18} />} title="结果概览" />
        <div className="content-result-stack">
          <div className="artifact-context">
            <StatusRow label="草稿" value={`${counts.drafts}`} ok={counts.drafts > 0} />
            <StatusRow label="已审稿" value={`${counts.reviews}`} ok={counts.reviews > 0} />
            <StatusRow label="高风险" value={`${counts.highRiskReviews}`} ok={counts.highRiskReviews === 0} />
            <StatusRow label="AI 产物" value={`${counts.contentArtifacts}`} ok={counts.contentArtifacts > 0} />
          </div>
          <div className="section-mini-head">
            <strong>AI 产物</strong>
            <span>{contentArtifacts.length ? "可跳转到 AI 工作台查看全文" : "生成或审稿后自动归档"}</span>
          </div>
          <div className="resource-list result-artifact-list">
            {contentArtifacts.slice(0, 8).map((artifact) => (
              <div key={artifact.id} className="resource-row">
                <button className="resource-select" onClick={() => props.openArtifact(artifact.id)}>
                  <strong>{artifact.title}</strong>
                  <small>{contentArtifactTypeLabel(artifact.workflowKey)} · {new Date(artifact.createdAt).toLocaleString()}</small>
                  <small>{compactContentText(artifact.contextSummary || artifact.markdown, 72)}</small>
                </button>
              </div>
            ))}
            {!contentArtifacts.length && <EmptyState text="暂无内容产物" />}
          </div>
        </div>
      </section>
      <section className="surface content-primary-panel">
        <SectionTitle icon={<FileText size={18} />} title="结果归档" />
        <div className="content-archive-grid">
          <div className="content-archive-section">
            <div className="section-mini-head">
              <strong>草稿</strong>
              <span>{counts.reviewedDrafts ? `${counts.reviewedDrafts} 篇已审` : "生成草稿后可继续审稿"}</span>
            </div>
            <div className="resource-list">
              {props.drafts.map((draft) => (
                <div key={draft.id} className="resource-row">
                  <button className="resource-select" onClick={() => draft.artifactId && props.openArtifact(draft.artifactId)} disabled={!draft.artifactId}>
                    <strong>{draft.title}</strong>
                    <small>{draft.source === "ai" ? "AI 生成" : "本地规则"} · {contentDraftStatusLabel(draft.status)} · {new Date(draft.createdAt).toLocaleString()}</small>
                    <small>{draft.tags.map((tag) => `#${tag}`).join(" ") || compactContentText(draft.body, 72)}</small>
                  </button>
                  <button
                    className="ghost-button compact"
                    onClick={() => void props.acceptDraftReview(draft.id, reviewByDraftId.get(draft.id)?.id)}
                    disabled={!reviewByDraftId.has(draft.id) || draft.status === "finalized" || props.busy === `content-draft-accept-${draft.id}`}
                  >
                    {props.busy === `content-draft-accept-${draft.id}` ? <Loader2 className="spin" size={14} /> : <CheckCircle2 size={14} />}
                    {draft.status === "finalized" ? "已定稿" : "接受修改稿"}
                  </button>
                </div>
              ))}
              {!props.drafts.length && <EmptyState text="暂无草稿" />}
            </div>
          </div>
          <div className="content-archive-section">
            <div className="section-mini-head">
              <strong>审稿</strong>
              <span>{counts.passedReviews ? `${counts.passedReviews} 篇通过` : "审稿后显示风险与修改稿"}</span>
            </div>
            <ContentReviewList reviews={props.reviews.slice(0, 8)} openArtifact={props.openArtifact} loadReviewForRereview={props.loadReviewForRereview} />
          </div>
        </div>
      </section>
    </div>
  );
}

function ContentReviewSidePanel({ reviews, openArtifact, loadReviewForRereview }: { reviews: ContentReviewRun[]; openArtifact: (artifactId: string) => void; loadReviewForRereview: (review: ContentReviewRun) => void }) {
  return (
    <section className="surface content-side-panel">
      <SectionTitle icon={<FileText size={18} />} title="审稿结果" />
      <div className="content-result-stack">
        <div className="artifact-context">
          <StatusRow label="审稿" value={`${reviews.length}`} ok={reviews.length > 0} />
          <StatusRow label="高风险" value={`${reviews.filter((review) => review.risk === "high").length}`} ok={!reviews.some((review) => review.risk === "high")} />
          <StatusRow label="通过" value={`${reviews.filter((review) => review.risk === "pass").length}`} ok={reviews.some((review) => review.risk === "pass")} />
        </div>
        <ContentReviewList reviews={reviews.slice(0, 10)} openArtifact={openArtifact} loadReviewForRereview={loadReviewForRereview} />
      </div>
    </section>
  );
}

function ContentReviewList({ reviews, openArtifact, loadReviewForRereview }: { reviews: ContentReviewRun[]; openArtifact: (artifactId: string) => void; loadReviewForRereview: (review: ContentReviewRun) => void }) {
  return (
    <div className="review-card-list">
      {reviews.map((review) => (
        <div key={review.id} className="review-result-card">
          <div className="review-result-head">
            <div>
              <strong>{review.revisedTitle || review.originalTitle || "AI 审稿报告"}</strong>
              <small>{new Date(review.createdAt).toLocaleString()} · {review.source === "ai" ? "AI" : "本地"} · {review.status === "completed" ? "已完成" : "失败"}</small>
            </div>
            <span className={`review-risk-pill ${review.risk}`}>{contentRiskLabel(review.risk)} · {review.score}/100</span>
          </div>
          <div className="review-diff-grid">
            <div>
              <span>原稿</span>
              <p>{compactContentText(review.originalBody, 120)}</p>
            </div>
            <div>
              <span>修改稿</span>
              <p>{compactContentText(review.revisedBody, 120)}</p>
            </div>
          </div>
          <div className="review-issue-list">
            {review.issues.slice(0, 3).map((issue) => (
              <span key={issue.id}>{severityLabel(issue.severity)} · {issue.category}{issue.evidence ? `：${issue.evidence}` : ""}</span>
            ))}
            {!review.issues.length && <span>未发现明显风险。</span>}
            {review.issues.length > 3 && <span>另有 {review.issues.length - 3} 个问题，打开报告查看完整清单。</span>}
          </div>
          <div className="button-row">
            <button className="ghost-button compact" onClick={() => review.artifactId && openArtifact(review.artifactId)} disabled={!review.artifactId}>
              <FileText size={14} />
              打开完整报告
            </button>
            <button className="ghost-button compact" onClick={() => loadReviewForRereview(review)}>
              <RefreshCw size={14} />
              载入修改稿再审
            </button>
          </div>
        </div>
      ))}
      {!reviews.length && <EmptyState text="暂无审稿结果" />}
    </div>
  );
}

function PromptCenterPage({
  prompts,
  selectedKey,
  selectedPrompt,
  promptTab,
  setPromptTab,
  guidedDraft,
  setGuidedDraft,
  advancedDraft,
  setAdvancedDraft,
  promptPreview,
  promptDirty,
  setSelectedKey,
  artifacts,
  busy,
  saveGuidedPrompt,
  saveAdvancedPrompt,
  resetPrompt,
  loadPromptPreview,
  openArtifact,
  customPrompts,
  selectedScope,
  setSelectedScope,
  selectedCustomPromptId,
  customPromptForm,
  setCustomPromptForm,
  customPromptTab,
  setCustomPromptTab,
  customPromptPreview,
  customPromptRevisions,
  selectCustomPrompt,
  createCustomPromptDraft,
  saveCustomPrompt,
  deleteCustomPrompt,
  copySystemPromptToCustom,
  previewCustomPrompt,
  runCustomPrompt,
  restoreCustomPromptRevision
}: {
  prompts: AiPromptInfo[];
  selectedKey: AiWorkflowKey;
  selectedPrompt: AiPromptDetail | null;
  promptTab: PromptEditorTab;
  setPromptTab: (value: PromptEditorTab) => void;
  guidedDraft: AiPromptGuidedConfig | null;
  setGuidedDraft: (value: AiPromptGuidedConfig) => void;
  advancedDraft: string;
  setAdvancedDraft: (value: string) => void;
  promptPreview: AiPromptPreview | null;
  promptDirty: boolean;
  setSelectedKey: (value: AiWorkflowKey) => void;
  artifacts: AiArtifact[];
  busy: string;
  saveGuidedPrompt: (activate?: boolean) => Promise<void>;
  saveAdvancedPrompt: (activate?: boolean) => Promise<void>;
  resetPrompt: (scope?: AiPromptResetScope) => Promise<void>;
  loadPromptPreview: (mode: AiPromptMode) => Promise<void>;
  openArtifact: (artifactId: string) => void;
  customPrompts: AiCustomPrompt[];
  selectedScope: PromptScope;
  setSelectedScope: (value: PromptScope) => void;
  selectedCustomPromptId: string;
  customPromptForm: AiCustomPromptInput;
  setCustomPromptForm: (value: AiCustomPromptInput) => void;
  customPromptTab: CustomPromptTab;
  setCustomPromptTab: (value: CustomPromptTab) => void;
  customPromptPreview: AiCustomPromptPreview | null;
  customPromptRevisions: AiCustomPromptRevision[];
  selectCustomPrompt: (promptId: string) => void;
  createCustomPromptDraft: () => void;
  saveCustomPrompt: () => Promise<AiCustomPrompt | undefined>;
  deleteCustomPrompt: (promptId: string) => Promise<void>;
  copySystemPromptToCustom: () => Promise<void>;
  previewCustomPrompt: () => Promise<void>;
  runCustomPrompt: (promptId?: string, focus?: string, options?: RunWorkflowOptions) => Promise<AiArtifact | undefined>;
  restoreCustomPromptRevision: (revisionId: string) => Promise<void>;
}) {
  const relatedArtifacts = artifacts.filter((artifact) => artifact.promptKey === selectedKey);
  const selectedCustomPrompt = customPrompts.find((prompt) => prompt.id === selectedCustomPromptId);
  const relatedCustomArtifacts = artifacts.filter((artifact) => artifact.customPromptId === selectedCustomPromptId);
  const activeMode = selectedPrompt?.activeMode ?? "builtin";
  const previewMode: AiPromptMode = promptTab === "guided" || promptTab === "advanced" ? promptTab : activeMode;
  const advancedValidation = selectedPrompt ? validatePromptDraft(selectedPrompt, advancedDraft) : [];
  const advancedHasErrors = advancedValidation.some((item) => item.level === "error");
  const saveBusy = busy.includes(`prompt-${promptTab}-save-${selectedKey}`) || busy.includes(`prompt-${previewMode}-save-${selectedKey}`);
  const resetScope = promptTab === "advanced" ? "advanced" : promptTab === "guided" ? "guided" : "active";
  const resetBusy = busy === `prompt-reset-${selectedKey}-${resetScope}`;
  const promptVariables = selectedPrompt?.variables ?? [];

  function updateGuidedDraft(patch: Partial<AiPromptGuidedConfig>) {
    if (!guidedDraft) return;
    setGuidedDraft({ ...guidedDraft, ...patch });
  }

  function toggleVariable(variable: AiPromptVariableInfo, enabled: boolean) {
    if (!guidedDraft || variable.tier === "required") return;
    const next = new Set(guidedDraft.enabledVariables);
    if (enabled) {
      next.add(variable.key);
    } else {
      next.delete(variable.key);
    }
    setGuidedDraft({ ...guidedDraft, enabledVariables: [...next] });
  }

  function insertAdvancedVariable(variable: AiPromptVariableInfo) {
    setAdvancedDraft(`${advancedDraft}${advancedDraft.endsWith("\n") || !advancedDraft ? "" : "\n"}{${variable.key}}`);
  }

  return (
    <div className="prompt-center-grid">
      <section className="surface prompt-list-panel">
        <SectionTitle
          icon={<KeyRound size={18} />}
          title="提示词"
          action={<button className="ghost-button compact" onClick={createCustomPromptDraft}><FileText size={14} />新建</button>}
        />
        <div className="prompt-scope-tabs">
          <button className={selectedScope === "system" ? "active" : ""} onClick={() => setSelectedScope("system")}>系统提示词</button>
          <button className={selectedScope === "custom" ? "active" : ""} onClick={() => setSelectedScope("custom")}>我的提示词</button>
        </div>
        {selectedScope === "system" ? (
          <div className="prompt-card-list">
            {prompts.map((prompt) => (
              <button
                key={prompt.key}
                className={prompt.key === selectedKey ? "prompt-card active" : "prompt-card"}
                onClick={() => setSelectedKey(prompt.key)}
              >
                <div>
                  <strong>{prompt.title}</strong>
                  <span className="prompt-card-mode">当前运行：{promptModeLabel(prompt.activeMode ?? promptSourceToMode(prompt.promptSource))}</span>
                </div>
                <small className="prompt-card-description">{prompt.description}</small>
                <small className="prompt-card-meta">{promptVersionLabel(prompt.version)} · 已生成 {prompt.artifactCount ?? 0} 个产物</small>
                <small className="prompt-card-meta">{prompt.lastUsedAt ? `最近使用 ${new Date(prompt.lastUsedAt).toLocaleString()}` : "尚未使用"}</small>
              </button>
            ))}
          </div>
        ) : (
          <div className="prompt-card-list">
            {customPrompts.map((prompt) => (
              <button
                key={prompt.id}
                className={prompt.id === selectedCustomPromptId ? "prompt-card active" : "prompt-card"}
                onClick={() => selectCustomPrompt(prompt.id)}
              >
                <div>
                  <strong>{prompt.title}</strong>
                  <span className="prompt-card-mode">{customPromptModeLabel(prompt.mode)}</span>
                </div>
                <small className="prompt-card-description">{prompt.description}</small>
                <small className="prompt-card-meta">{customPromptCategoryLabel(prompt.category)} · 已生成 {prompt.runCount} 个产物</small>
                <small className="prompt-card-meta">{prompt.lastUsedAt ? `最近使用 ${new Date(prompt.lastUsedAt).toLocaleString()}` : "尚未使用"}</small>
              </button>
            ))}
            {!customPrompts.length && <EmptyState text="还没有自定义提示词，点击新建或从系统提示词复制。" />}
          </div>
        )}
      </section>

      <section className="surface prompt-editor-panel">
        <SectionTitle
          icon={<FileText size={18} />}
          title={selectedScope === "custom" ? (selectedCustomPrompt ? "编辑自定义提示词" : "新建自定义提示词") : selectedPrompt ? `${selectedPrompt.title} · 提示词` : "提示词详情"}
        />
        {selectedScope === "custom" ? (
          <CustomPromptEditor
            prompt={selectedCustomPrompt}
            form={customPromptForm}
            setForm={setCustomPromptForm}
            tab={customPromptTab}
            setTab={setCustomPromptTab}
            preview={customPromptPreview}
            revisions={customPromptRevisions}
            variables={promptVariables}
            busy={busy}
            savePrompt={saveCustomPrompt}
            deletePrompt={deleteCustomPrompt}
            copySystemPromptToCustom={copySystemPromptToCustom}
            previewPrompt={previewCustomPrompt}
            runPrompt={runCustomPrompt}
            restoreRevision={restoreCustomPromptRevision}
          />
        ) : selectedPrompt && guidedDraft ? (
          <div className="prompt-editor-layout">
            <div className="prompt-control-panel">
              <div className="prompt-control-head">
                <div>
                  <strong>{selectedPrompt.title}</strong>
                  <span>{selectedPrompt.description}</span>
                  <span>当前实际运行：{promptModeLabel(activeMode)} · 正在编辑：{promptTabLabel(promptTab)}{promptDirty ? " · 有未保存修改" : ""}</span>
                </div>
                <div className="button-row">
                  <button className="ghost-button compact danger" onClick={() => void resetPrompt(resetScope)} disabled={resetBusy}>
                    <RefreshCw size={14} />
                    {promptResetLabel(promptTab)}
                  </button>
                  {promptTab === "guided" && (
                    <>
                      <button className="ghost-button compact" onClick={() => void saveGuidedPrompt(false)} disabled={saveBusy}>保存</button>
                      <button className="primary-button compact" onClick={() => void saveGuidedPrompt(true)} disabled={saveBusy}>
                        {saveBusy ? <Loader2 className="spin" size={14} /> : <CheckCircle2 size={14} />}
                        保存并启用
                      </button>
                    </>
                  )}
                  {promptTab === "advanced" && (
                    <>
                      <button className="ghost-button compact" onClick={() => void saveAdvancedPrompt(false)} disabled={!advancedDraft.trim() || saveBusy}>保存</button>
                      <button className="primary-button compact" onClick={() => void saveAdvancedPrompt(true)} disabled={!advancedDraft.trim() || advancedHasErrors || saveBusy}>
                        {saveBusy ? <Loader2 className="spin" size={14} /> : <CheckCircle2 size={14} />}
                        保存并启用
                      </button>
                    </>
                  )}
                  {promptTab === "preview" && (
                    <button className="primary-button compact" onClick={() => void loadPromptPreview(previewMode)} disabled={busy === `prompt-preview-${selectedKey}-${previewMode}`}>
                      {busy === `prompt-preview-${selectedKey}-${previewMode}` ? <Loader2 className="spin" size={14} /> : <Eye size={14} />}
                      生成预览
                    </button>
                  )}
                </div>
              </div>
              <div className="prompt-mode-tabs">
                {(["guided", "advanced", "preview"] as PromptEditorTab[]).map((tab) => (
                  <button key={tab} className={promptTab === tab ? "active" : ""} onClick={() => setPromptTab(tab)}>
                    {promptTabLabel(tab)}
                  </button>
                ))}
              </div>
            </div>
            {promptTab === "guided" && (
              <div className="prompt-guided-workspace">
                <section className="prompt-config-block">
                  <div className="section-mini-head">
                    <strong>工作说明</strong>
                    <span>运营用户只需要编辑业务目标，不需要维护变量。</span>
                  </div>
                  <div className="prompt-instruction-grid">
                    <label className="prompt-instruction-field">
                      <span>AI 角色</span>
                      <textarea value={guidedDraft.role} onChange={(event) => updateGuidedDraft({ role: event.target.value })} />
                    </label>
                    <label className="prompt-instruction-field">
                      <span>工作目标</span>
                      <textarea value={guidedDraft.objective} onChange={(event) => updateGuidedDraft({ objective: event.target.value })} />
                    </label>
                    <label className="prompt-instruction-field">
                      <span>重点关注</span>
                      <textarea value={guidedDraft.focusRules.join("\n")} onChange={(event) => updateGuidedDraft({ focusRules: splitLines(event.target.value) })} />
                    </label>
                    <label className="prompt-instruction-field">
                      <span>安全规则</span>
                      <textarea value={guidedDraft.forbiddenRules.join("\n")} onChange={(event) => updateGuidedDraft({ forbiddenRules: splitLines(event.target.value) })} />
                    </label>
                  </div>
                </section>
                <section className="prompt-config-block">
                  <div className="section-mini-head">
                    <strong>AI 会读取的资料</strong>
                    <span>必需资料锁定，推荐资料可按任务关闭。</span>
                  </div>
                  <div className="prompt-data-card-grid">
                    {selectedPrompt.variables.map((variable) => {
                      const checked = guidedDraft.enabledVariables.includes(variable.key) || variable.tier === "required";
                      return (
                        <label key={variable.key} className={checked ? "prompt-data-card active" : "prompt-data-card"}>
                          <input type="checkbox" checked={checked} disabled={variable.tier === "required"} onChange={(event) => toggleVariable(variable, event.target.checked)} />
                          <span><strong>{variable.label}</strong><small>{variable.description}</small></span>
                          <em>{variableTierLabel(variable.tier)}</em>
                        </label>
                      );
                    })}
                  </div>
                </section>
                <section className="prompt-config-block">
                  <div className="section-mini-head">
                    <strong>输出栏目</strong>
                    <span>每行一个栏目，AI 会按这个结构输出。</span>
                  </div>
                  <textarea className="prompt-lines-editor" value={guidedDraft.outputSections.join("\n")} onChange={(event) => updateGuidedDraft({ outputSections: splitLines(event.target.value) })} />
                </section>
              </div>
            )}
            {promptTab === "advanced" && (
              <div className="prompt-advanced-workspace">
                <section className="prompt-text-panel">
                  <div className="panel-subhead">
                    <strong>高级模板</strong>
                    <span>错误变量不能启用，普通用户建议使用工作说明。</span>
                  </div>
                  <textarea className="prompt-editor" value={advancedDraft} onChange={(event) => setAdvancedDraft(event.target.value)} />
                </section>
                <aside className="prompt-variable-panel">
                  <div className="section-mini-head">
                    <strong>可插入变量</strong>
                    <span>仅高级模板使用</span>
                  </div>
                  <div className="prompt-variable-card-list">
                    {selectedPrompt.variables.map((variable) => (
                      <button key={variable.key} className="prompt-variable-card" onClick={() => insertAdvancedVariable(variable)}>
                        <span>
                          <strong>{variable.label}</strong>
                          <code>{`{${variable.key}}`}</code>
                        </span>
                        <small>{variable.description}</small>
                        <em>{variableTierLabel(variable.tier)}</em>
                      </button>
                    ))}
                  </div>
                  <PromptValidationList messages={advancedValidation} />
                </aside>
              </div>
            )}
            {promptTab === "preview" && (
              <div className="prompt-preview-workspace">
                <div className="prompt-preview-toolbar">
                  <div><strong>最终预览</strong><span>查看当前模式最终会发给 AI 的完整内容。</span></div>
                  <div className="button-row">
                    <button className="ghost-button compact" onClick={() => void loadPromptPreview(activeMode)}>预览实际运行版本</button>
                    <button className="ghost-button compact" onClick={() => void loadPromptPreview(previewMode)}>预览正在编辑版本</button>
                  </div>
                </div>
                {promptPreview ? (
                  <>
                    <div className="prompt-preview-meta"><span>模式：{promptModeLabel(promptPreview.mode)}</span><span>{promptPreview.contextSummary}</span></div>
                    <pre className="prompt-preview-body">{promptPreview.prompt}</pre>
                  </>
                ) : (
                  <EmptyState text="点击预览按钮查看最终提示词" />
                )}
              </div>
            )}
          </div>
        ) : (
          <EmptyState text="选择一套提示词查看和编辑" />
        )}
      </section>

      <section className="surface prompt-artifacts-panel">
        <SectionTitle icon={<ShieldCheck size={18} />} title="运行检查" />
        {selectedScope === "custom" ? (
          <div className="prompt-check-stack">
            <div className="prompt-status-card">
              <strong>当前实际运行</strong>
              <span>{selectedCustomPrompt ? customPromptModeLabel(selectedCustomPrompt.mode) : "未保存"}</span>
              <small>{selectedCustomPrompt ? "运行会使用已保存版本；编辑后请先保存再运行。" : "新建提示词需要先保存，才能预览和生成产物。"}</small>
            </div>
            <div className="prompt-status-card">
              <strong>资料读取</strong>
              <span>{(customPromptForm.guidedConfig?.enabledVariables ?? []).length} 项资料启用</span>
              <small>必需资料由后端锁定；高级模板运行前会校验未知变量。</small>
            </div>
            <div className="prompt-status-card">
              <strong>分类与状态</strong>
              <span>{customPromptCategoryLabel(customPromptForm.category)} · {customPromptStatusLabel(customPromptForm.status)}</span>
              <small>归档后不会删除历史产物，但不能继续运行。</small>
            </div>
          </div>
        ) : selectedPrompt && guidedDraft ? (
          <div className="prompt-check-stack">
            <div className="prompt-status-card">
              <strong>当前实际运行</strong>
              <span>{promptModeLabel(activeMode)}</span>
              <small>{promptDirty ? "当前有未保存修改，运行仍使用已启用版本。" : "当前配置已与页面同步。"}</small>
            </div>
            <div className="prompt-status-card">
              <strong>资料读取</strong>
              <span>{guidedDraft.enabledVariables.length} 项资料启用</span>
              <small>工作说明由后端生成最终提示词，高级模板按变量替换。</small>
            </div>
            {promptTab === "advanced" && <PromptValidationList messages={advancedValidation} />}
          </div>
        ) : (
          <EmptyState text="请选择提示词" />
        )}
        <SectionTitle icon={<Bot size={18} />} title="使用记录" />
        <div className="compact-list">
          {(selectedScope === "custom" ? relatedCustomArtifacts : relatedArtifacts).slice(0, 10).map((artifact) => (
            <button key={artifact.id} className="compact-list-row" onClick={() => openArtifact(artifact.id)}>
              <strong>{artifact.title}</strong>
              <small>{promptSourceLabel(artifact.promptSource)} · {new Date(artifact.createdAt).toLocaleString()}</small>
            </button>
          ))}
          {!(selectedScope === "custom" ? relatedCustomArtifacts : relatedArtifacts).length && <EmptyState text="这套提示词还没有生成过产物" />}
        </div>
      </section>
    </div>
  );
}

function CustomPromptEditor({
  prompt,
  form,
  setForm,
  tab,
  setTab,
  preview,
  revisions,
  variables,
  busy,
  savePrompt,
  deletePrompt,
  copySystemPromptToCustom,
  previewPrompt,
  runPrompt,
  restoreRevision
}: {
  prompt?: AiCustomPrompt;
  form: AiCustomPromptInput;
  setForm: (value: AiCustomPromptInput) => void;
  tab: CustomPromptTab;
  setTab: (value: CustomPromptTab) => void;
  preview: AiCustomPromptPreview | null;
  revisions: AiCustomPromptRevision[];
  variables: AiPromptVariableInfo[];
  busy: string;
  savePrompt: () => Promise<AiCustomPrompt | undefined>;
  deletePrompt: (promptId: string) => Promise<void>;
  copySystemPromptToCustom: () => Promise<void>;
  previewPrompt: () => Promise<void>;
  runPrompt: (promptId?: string, focus?: string, options?: RunWorkflowOptions) => Promise<AiArtifact | undefined>;
  restoreRevision: (revisionId: string) => Promise<void>;
}) {
  const guidedConfig = form.guidedConfig ?? defaultCustomPromptGuidedConfig;
  const promptId = prompt?.id ?? "";
  const saveBusy = busy === `custom-prompt-save-${promptId || "new"}`;
  const previewBusy = busy === `custom-prompt-preview-${promptId || "new"}`;
  const runBusy = busy === `custom-prompt-run-${promptId || "new"}`;
  const canRun = form.status !== "archived" && Boolean(form.title.trim());
  const previewValidation = preview?.validation ?? [];

  const updateForm = (patch: Partial<AiCustomPromptInput>) => {
    setForm({ ...form, ...patch });
  };
  const updateGuided = (patch: Partial<AiPromptGuidedConfig>) => {
    setForm({ ...form, mode: "guided", guidedConfig: { ...guidedConfig, ...patch } });
  };
  const switchTab = (nextTab: CustomPromptTab) => {
    setTab(nextTab);
    if (nextTab === "guided" || nextTab === "advanced") {
      setForm({ ...form, mode: nextTab });
    }
  };
  const toggleVariable = (variable: AiPromptVariableInfo, enabled: boolean) => {
    if (variable.tier === "required") return;
    const next = new Set(guidedConfig.enabledVariables);
    if (enabled) {
      next.add(variable.key);
    } else {
      next.delete(variable.key);
    }
    updateGuided({ enabledVariables: [...next] });
  };
  const insertAdvancedVariable = (variable: AiPromptVariableInfo) => {
    const template = form.advancedTemplate ?? "";
    updateForm({
      mode: "advanced",
      advancedTemplate: `${template}${template.endsWith("\n") || !template ? "" : "\n"}{${variable.key}}`
    });
  };

  return (
    <div className="prompt-editor-layout custom-prompt-editor">
      <div className="prompt-control-panel">
        <div className="prompt-control-head">
          <div>
            <strong>{form.title || "自定义提示词"}</strong>
            <span>{form.description || "选择资料来源，让 AI 按团队方法输出可复用结果。"}</span>
            <span>
              {prompt ? `已保存 · ${new Date(prompt.updatedAt).toLocaleString()}` : "新建中 · 保存后可预览、运行和记录版本"}
              {prompt?.sourcePromptTitle ? ` · 来源：${prompt.sourcePromptTitle}` : ""}
            </span>
          </div>
          <div className="button-row">
            <button className="ghost-button compact" onClick={() => void copySystemPromptToCustom()} disabled={busy.startsWith("custom-prompt-copy")}>
              <FileText size={14} />
              复制当前系统提示词
            </button>
            {prompt && (
              <button className="ghost-button compact danger" onClick={() => void deletePrompt(prompt.id)} disabled={busy === `custom-prompt-delete-${prompt.id}`}>
                {busy === `custom-prompt-delete-${prompt.id}` ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />}
                删除
              </button>
            )}
            <button className="ghost-button compact" onClick={() => void savePrompt()} disabled={!form.title.trim() || saveBusy}>
              {saveBusy ? <Loader2 className="spin" size={14} /> : <CheckCircle2 size={14} />}
              保存
            </button>
            <button className="primary-button compact" onClick={() => void runPrompt(promptId || undefined, form.description)} disabled={!canRun || runBusy}>
              {runBusy ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}
              运行并归档
            </button>
          </div>
        </div>
        <div className="prompt-mode-tabs custom-prompt-tabs">
          {(["guided", "advanced", "preview", "versions"] as CustomPromptTab[]).map((item) => (
            <button key={item} className={tab === item ? "active" : ""} onClick={() => switchTab(item)}>
              {customPromptTabLabel(item)}
            </button>
          ))}
        </div>
      </div>

      {tab === "guided" && (
        <div className="prompt-guided-workspace">
          <section className="prompt-config-block">
            <div className="section-mini-head">
              <strong>基础信息</strong>
              <span>名称用于列表和产物标题；分类帮助后续复盘。</span>
            </div>
            <div className="custom-prompt-basic-grid">
              <label>
                <span>提示词名称</span>
                <input value={form.title} onChange={(event) => updateForm({ title: event.target.value })} />
              </label>
              <label>
                <span>适用场景</span>
                <select value={form.category ?? "general-ops"} onChange={(event) => updateForm({ category: event.target.value as AiCustomPromptCategory })}>
                  {(["content-analysis", "viral-breakdown", "comment-insight", "note-writing", "draft-review", "general-ops"] as AiCustomPromptCategory[]).map((category) => (
                    <option key={category} value={category}>{customPromptCategoryLabel(category)}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>状态</span>
                <select value={form.status ?? "active"} onChange={(event) => updateForm({ status: event.target.value as AiCustomPromptInput["status"] })}>
                  <option value="active">启用</option>
                  <option value="archived">归档</option>
                </select>
              </label>
              <label className="wide">
                <span>给团队看的说明</span>
                <input value={form.description ?? ""} onChange={(event) => updateForm({ description: event.target.value })} />
              </label>
            </div>
          </section>

          <section className="prompt-config-block">
            <div className="section-mini-head">
              <strong>工作说明</strong>
              <span>普通用户只填业务目标；系统资料会在运行时自动带入。</span>
            </div>
            <div className="prompt-instruction-grid">
              <label className="prompt-instruction-field">
                <span>AI 角色</span>
                <textarea value={guidedConfig.role} onChange={(event) => updateGuided({ role: event.target.value })} />
              </label>
              <label className="prompt-instruction-field">
                <span>工作目标</span>
                <textarea value={guidedConfig.objective} onChange={(event) => updateGuided({ objective: event.target.value })} />
              </label>
              <label className="prompt-instruction-field">
                <span>重点关注</span>
                <textarea value={guidedConfig.focusRules.join("\n")} onChange={(event) => updateGuided({ focusRules: splitLines(event.target.value) })} />
              </label>
              <label className="prompt-instruction-field">
                <span>安全规则</span>
                <textarea value={guidedConfig.forbiddenRules.join("\n")} onChange={(event) => updateGuided({ forbiddenRules: splitLines(event.target.value) })} />
              </label>
            </div>
          </section>

          <section className="prompt-config-block">
            <div className="section-mini-head">
              <strong>AI 会读取的资料</strong>
              <span>必需资料已锁定；推荐资料按任务开关。</span>
            </div>
            <div className="prompt-data-card-grid">
              {variables.map((variable) => {
                const checked = guidedConfig.enabledVariables.includes(variable.key) || variable.tier === "required";
                return (
                  <label key={variable.key} className={checked ? "prompt-data-card active" : "prompt-data-card"}>
                    <input type="checkbox" checked={checked} disabled={variable.tier === "required"} onChange={(event) => toggleVariable(variable, event.target.checked)} />
                    <span><strong>{variable.label}</strong><small>{variable.description}</small></span>
                    <em>{variableTierLabel(variable.tier)}</em>
                  </label>
                );
              })}
              {!variables.length && <EmptyState text="系统变量加载中，请稍后再编辑资料读取范围。" />}
            </div>
          </section>

          <section className="prompt-config-block">
            <div className="section-mini-head">
              <strong>输出栏目</strong>
              <span>每行一个栏目，运行后按这个结构输出。</span>
            </div>
            <textarea className="prompt-lines-editor" value={guidedConfig.outputSections.join("\n")} onChange={(event) => updateGuided({ outputSections: splitLines(event.target.value) })} />
          </section>
        </div>
      )}

      {tab === "advanced" && (
        <div className="prompt-advanced-workspace">
          <section className="prompt-text-panel">
            <div className="panel-subhead">
              <strong>高级模板</strong>
              <span>适合熟悉变量的用户；保存/运行前后端会校验变量。</span>
            </div>
            <textarea className="prompt-editor" value={form.advancedTemplate ?? ""} onChange={(event) => updateForm({ mode: "advanced", advancedTemplate: event.target.value })} />
          </section>
          <aside className="prompt-variable-panel">
            <div className="section-mini-head">
              <strong>可插入变量</strong>
              <span>点击插入到模板末尾</span>
            </div>
            <div className="prompt-variable-card-list">
              {variables.map((variable) => (
                <button key={variable.key} className="prompt-variable-card" onClick={() => insertAdvancedVariable(variable)}>
                  <span>
                    <strong>{variable.label}</strong>
                    <code>{`{${variable.key}}`}</code>
                  </span>
                  <small>{variable.description}</small>
                  <em>{variableTierLabel(variable.tier)}</em>
                </button>
              ))}
            </div>
            <PromptValidationList messages={previewValidation} />
          </aside>
        </div>
      )}

      {tab === "preview" && (
        <div className="prompt-preview-workspace">
          <div className="prompt-preview-toolbar">
            <div><strong>最终预览</strong><span>预览会先保存当前表单，再展示最终发送给 AI 的内容。</span></div>
            <div className="button-row">
              <button className="ghost-button compact" onClick={() => void previewPrompt()} disabled={!form.title.trim() || previewBusy}>
                {previewBusy ? <Loader2 className="spin" size={14} /> : <Eye size={14} />}
                生成预览
              </button>
              <button className="primary-button compact" onClick={() => void runPrompt(promptId || undefined, form.description)} disabled={!canRun || runBusy}>
                {runBusy ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}
                运行并归档
              </button>
            </div>
          </div>
          {preview ? (
            <>
              <div className="prompt-preview-meta"><span>模式：{customPromptModeLabel(preview.mode)}</span><span>{preview.contextSummary}</span></div>
              <pre className="prompt-preview-body">{preview.prompt}</pre>
            </>
          ) : (
            <EmptyState text="点击生成预览，确认 AI 会读取哪些资料、输出什么结构。" />
          )}
        </div>
      )}

      {tab === "versions" && (
        <div className="custom-prompt-version-workspace">
          <section className="prompt-config-block">
            <div className="section-mini-head">
              <strong>版本记录</strong>
              <span>每次保存都会生成记录，可恢复到旧版本。</span>
            </div>
            <div className="compact-list">
              {revisions.map((revision) => (
                <button key={revision.id} className="compact-list-row custom-version-row" onClick={() => void restoreRevision(revision.id)} disabled={busy === `custom-prompt-restore-${promptId}-${revision.id}`}>
                  <strong>{revision.snapshot.title}</strong>
                  <small>{customPromptModeLabel(revision.snapshot.mode)} · {new Date(revision.createdAt).toLocaleString()}</small>
                  <small>{revision.snapshot.description || "无说明"}</small>
                </button>
              ))}
              {!revisions.length && <EmptyState text="保存后会在这里记录历史版本。" />}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function splitLines(value: string): string[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function promptSourceToMode(source?: AiPromptInfo["promptSource"]): AiPromptMode {
  if (source === "guided") return "guided";
  if (source === "advanced" || source === "custom") return "advanced";
  return "builtin";
}

function promptModeLabel(mode?: AiPromptMode): string {
  if (mode === "guided") return "工作说明";
  if (mode === "advanced") return "高级模板";
  return "系统内置";
}

function promptTabLabel(tab: PromptEditorTab): string {
  if (tab === "advanced") return "高级模板";
  if (tab === "preview") return "最终预览";
  return "工作说明";
}

function promptResetLabel(tab: PromptEditorTab): string {
  if (tab === "advanced") return "恢复高级模板默认";
  if (tab === "preview") return "切回系统内置";
  return "恢复工作说明默认";
}

function promptSourceLabel(source?: AiArtifact["promptSource"]): string {
  if (source === "customPrompt") return "我的提示词";
  if (source === "guided") return "工作说明";
  if (source === "advanced" || source === "custom") return "高级模板";
  return "系统内置";
}

function customPromptToForm(prompt: AiCustomPrompt): AiCustomPromptInput {
  return {
    title: prompt.title,
    description: prompt.description,
    category: prompt.category,
    mode: prompt.mode,
    guidedConfig: {
      ...prompt.guidedConfig,
      focusRules: [...prompt.guidedConfig.focusRules],
      forbiddenRules: [...prompt.guidedConfig.forbiddenRules],
      outputSections: [...prompt.guidedConfig.outputSections],
      enabledVariables: [...prompt.guidedConfig.enabledVariables]
    },
    advancedTemplate: prompt.advancedTemplate,
    status: prompt.status
  };
}

function customPromptCategoryLabel(category?: AiCustomPromptCategory): string {
  if (category === "content-analysis") return "内容分析";
  if (category === "viral-breakdown") return "爆款拆解";
  if (category === "comment-insight") return "评论洞察";
  if (category === "note-writing") return "笔记撰写";
  if (category === "draft-review") return "审稿质检";
  return "通用运营";
}

function customPromptModeLabel(mode?: AiCustomPromptMode): string {
  return mode === "advanced" ? "高级模板" : "工作说明";
}

function customPromptStatusLabel(status?: AiCustomPromptInput["status"]): string {
  return status === "archived" ? "已归档" : "启用中";
}

function customPromptTabLabel(tab: CustomPromptTab): string {
  if (tab === "advanced") return "高级模板";
  if (tab === "preview") return "最终预览";
  if (tab === "versions") return "版本记录";
  return "工作说明";
}

function variableTierLabel(tier?: AiPromptVariableInfo["tier"]): string {
  if (tier === "required") return "必需";
  if (tier === "optional") return "可选";
  return "推荐";
}

function validatePromptDraft(prompt: AiPromptDetail, template: string): AiPromptValidationMessage[] {
  const messages: AiPromptValidationMessage[] = [];
  const validKeys = new Set(prompt.variables.map((variable) => variable.key));
  const usedKeys = [...new Set([...template.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map((match) => match[1]))];
  const defaultKeys = [...new Set([...prompt.defaultTemplate.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map((match) => match[1]))];

  if (!template.trim()) {
    messages.push({ level: "error", message: "高级模板不能为空。" });
  }
  if ((template.match(/\{/g)?.length ?? 0) !== (template.match(/\}/g)?.length ?? 0)) {
    messages.push({ level: "error", message: "存在未闭合的花括号，请检查变量格式。" });
  }
  for (const key of usedKeys) {
    if (!validKeys.has(key)) {
      messages.push({ level: "error", message: `未知变量：{${key}}。`, variable: key, suggestion: closestVariableKey(key, prompt.variables) });
    }
  }
  for (const key of defaultKeys) {
    if (!usedKeys.includes(key)) {
      const variable = prompt.variables.find((item) => item.key === key);
      messages.push({
        level: variable?.tier === "required" ? "error" : "warning",
        message: `当前模板未使用「${variable?.label ?? key}」，AI 可能拿不到这类资料。`,
        variable: key
      });
    }
  }
  return messages;
}

function closestVariableKey(key: string, variables: AiPromptVariableInfo[]): string | undefined {
  const normalized = key.toLowerCase();
  return variables.find((variable) => {
    const variableKey = variable.key.toLowerCase();
    return variableKey.includes(normalized) || normalized.includes(variableKey.replace(/s$/, ""));
  })?.key;
}

function PromptValidationList({ messages }: { messages: AiPromptValidationMessage[] }) {
  const errors = messages.filter((message) => message.level === "error").length;
  return (
    <div className="prompt-validation-list">
      <div className="section-mini-head">
        <strong>模板校验</strong>
        <span>{messages.length ? `${errors} 个错误 · ${messages.length - errors} 个提醒` : "可以启用"}</span>
      </div>
      {messages.length ? messages.map((message, index) => (
        <div key={`${message.message}-${index}`} className={message.level === "error" ? "validation-row error" : "validation-row"}>
          <strong>{message.level === "error" ? "错误" : "提醒"}</strong>
          <span>{message.message}{message.suggestion ? ` 建议使用：{${message.suggestion}}` : ""}</span>
        </div>
      )) : (
        <div className="validation-row ok">
          <strong>通过</strong>
          <span>未发现变量错误。</span>
        </div>
      )}
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
  hasCurrentJob: boolean;
  artifacts: AiArtifact[];
  reports: AiReport[];
  resourceScope: AiResourceScope;
  setResourceScope: (scope: AiResourceScope) => void;
  reportFocus: string;
  setReportFocus: (value: string) => void;
  createReport: () => Promise<void>;
  deleteReport: (reportId: string) => Promise<void>;
  deleteArtifact: (artifactId: string) => Promise<void>;
  selectedArtifactId: string;
  openedArtifactSnapshot: AiArtifact | null;
  openArtifact: (artifactId: string, artifact?: AiArtifact) => void;
  clearSelectedArtifact: () => void;
  selectedReportId: string;
  setSelectedReportId: (value: string) => void;
  prompts: AiPromptInfo[];
  openPrompt: (key: AiWorkflowKey) => void;
  runWorkflow: RunWorkflow;
  customPrompts: AiCustomPrompt[];
  openCustomPrompt: (promptId: string) => void;
  runCustomPrompt: (promptId: string, focus?: string, options?: RunWorkflowOptions) => Promise<AiArtifact | undefined>;
  busy: string;
}) {
  const selectedArtifact = resolveSelectedAiArtifact(props.artifacts, props.selectedArtifactId, props.openedArtifactSnapshot);
  const selectedReport = props.reports.find((report) => report.id === props.selectedReportId);
  const selectedArtifactOutsideScope = Boolean(
    selectedArtifact && props.resourceScope === "current" && !props.artifacts.some((artifact) => artifact.id === selectedArtifact.id)
  );
  const preview: ReaderPreview | undefined =
    selectedArtifact
      ? {
          kind: "artifact" as const,
          title: selectedArtifact.title,
          markdown: selectedArtifact.markdown,
          meta: [
            selectedArtifact.source === "ai" ? "AI 生成" : "本地规则",
            selectedArtifact.noteIds?.length ? `样本：${selectedArtifact.noteIds.length} 篇` : selectedArtifact.noteId ? "样本：单篇笔记" : "",
            selectedArtifact.customPromptTitle ? `我的提示词：${selectedArtifact.customPromptTitle}` : selectedArtifact.promptTitle ? `提示词：${selectedArtifact.promptTitle}` : "",
            promptSourceLabel(selectedArtifact.promptSource),
            selectedArtifact.customPromptVersion ?? (selectedArtifact.promptVersion ? promptVersionLabel(selectedArtifact.promptVersion) : ""),
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
    props.openArtifact(artifactId, props.artifacts.find((artifact) => artifact.id === artifactId));
  };
  const selectReport = (reportId: string) => {
    props.setSelectedReportId(reportId);
    props.clearSelectedArtifact();
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
              <div className="ai-resource-scope-row">
                <div className="button-row" aria-label="AI 产物范围">
                  <button className={`ghost-button compact ${props.resourceScope === "all" ? "active" : ""}`} onClick={() => props.setResourceScope("all")}>全部产物</button>
                  <button className={`ghost-button compact ${props.resourceScope === "current" ? "active" : ""}`} onClick={() => props.setResourceScope("current")} disabled={!props.hasCurrentJob}>当前任务</button>
                </div>
                <div className="resource-count-row">
                  <span>产物 {props.artifacts.length}</span>
                  <span>报告 {props.reports.length}</span>
                </div>
              </div>
            </div>
            <div className="resource-list">
              {props.artifacts.map((artifact) => (
                <div key={artifact.id} className={artifact.id === props.selectedArtifactId ? "resource-row active" : "resource-row"}>
                  <button className="resource-select" onClick={() => selectArtifact(artifact.id)}>
                    <strong>{artifact.title}</strong>
                    <small>{artifact.source === "ai" ? "AI 生成" : "本地规则"} · {new Date(artifact.createdAt).toLocaleString()}</small>
                    {artifact.promptTitle && <small>提示词 · {artifact.promptTitle}</small>}
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
              <strong>提示词</strong>
              <span>提示词 {props.prompts.length}</span>
            </div>
            <div className="prompt-mini-list">
              {props.prompts.map((prompt) => (
                <button key={prompt.key} className="prompt-version-row" onClick={() => props.openPrompt(prompt.key)}>
                  <span>{prompt.title}</span>
                  <small>{promptVersionLabel(prompt.version)} · {prompt.promptSource === "custom" ? "我的提示词" : "内置提示词"}</small>
                </button>
              ))}
              {props.customPrompts.map((prompt) => (
                <button key={prompt.id} className="prompt-version-row" onClick={() => props.openCustomPrompt(prompt.id)}>
                  <span>{prompt.title}</span>
                  <small>{customPromptCategoryLabel(prompt.category)} · {customPromptModeLabel(prompt.mode)} · 已生成 {prompt.runCount}</small>
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
        selectedArtifactOutsideScope={selectedArtifactOutsideScope}
        showAllArtifacts={() => props.setResourceScope("all")}
        openPrompt={props.openPrompt}
        runWorkflow={props.runWorkflow}
        openCustomPrompt={props.openCustomPrompt}
        runCustomPrompt={props.runCustomPrompt}
        busy={props.busy}
        close={() => {
          props.clearSelectedArtifact();
          props.setSelectedReportId("");
        }}
      />

      <section className="surface ai-side-panel">
        <SectionTitle icon={<Gauge size={18} />} title="上下文与动作" />
        <div className="side-panel-stack">
          {selectedArtifact ? (
            <div className="artifact-context">
              <StatusRow label="提示词" value={selectedArtifact.customPromptTitle ?? selectedArtifact.promptTitle ?? "未记录"} ok={Boolean(selectedArtifact.customPromptTitle ?? selectedArtifact.promptTitle)} />
              <StatusRow label="来源" value={promptSourceLabel(selectedArtifact.promptSource)} ok={selectedArtifact.promptSource === "customPrompt"} />
              <StatusRow label="模板" value={selectedArtifact.customPromptVersion ?? (selectedArtifact.promptVersion ? promptVersionLabel(selectedArtifact.promptVersion) : "未记录")} ok={Boolean(selectedArtifact.customPromptVersion ?? selectedArtifact.promptVersion)} />
              <StatusRow label="状态" value={selectedArtifact.status} ok={selectedArtifact.status === "completed"} />
            </div>
          ) : selectedReport ? (
            <div className="artifact-context">
              <StatusRow label="类型" value="Markdown 报告" ok />
              <StatusRow label="来源" value={selectedReport.source === "ai" ? "AI 深度版" : "本地规则版"} ok={selectedReport.source === "ai"} />
              <StatusRow label="状态" value={selectedReport.status} ok={selectedReport.status === "completed"} />
            </div>
          ) : (
            <EmptyState text="选择产物后查看提示词、模型和上下文信息" />
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
            {props.customPrompts.slice(0, 3).map((prompt) => (
              <button key={prompt.id} className="ghost-button compact" onClick={() => void props.runCustomPrompt(prompt.id)} disabled={props.busy === `custom-prompt-run-${prompt.id}`}>
                {props.busy === `custom-prompt-run-${prompt.id}` ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}
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
  selectedArtifactOutsideScope,
  showAllArtifacts,
  openPrompt,
  runWorkflow,
  openCustomPrompt,
  runCustomPrompt,
  busy,
  close
}: {
  preview?: ReaderPreview;
  selectedArtifact?: AiArtifact;
  selectedArtifactWorkflow?: AiWorkflowKey;
  selectedArtifactOutsideScope: boolean;
  showAllArtifacts: () => void;
  openPrompt: (key: AiWorkflowKey) => void;
  runWorkflow: RunWorkflow;
  openCustomPrompt: (promptId: string) => void;
  runCustomPrompt: (promptId: string, focus?: string, options?: RunWorkflowOptions) => Promise<AiArtifact | undefined>;
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
            {selectedArtifact?.customPromptId ? (
              <button className="ghost-button compact" onClick={() => openCustomPrompt(selectedArtifact.customPromptId!)}>
                <KeyRound size={14} />
                查看我的提示词
              </button>
            ) : selectedArtifactWorkflow ? (
              <button className="ghost-button compact" onClick={() => openPrompt(selectedArtifactWorkflow)}>
                <KeyRound size={14} />
                查看提示词
              </button>
            ) : null}
            {selectedArtifact?.customPromptId ? (
              <button
                className="ghost-button compact"
                onClick={() => void runCustomPrompt(selectedArtifact.customPromptId!, undefined, { noteId: selectedArtifact.noteId, noteIds: selectedArtifact.noteIds })}
                disabled={busy === `custom-prompt-run-${selectedArtifact.customPromptId}`}
              >
                {busy === `custom-prompt-run-${selectedArtifact.customPromptId}` ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}
                重新生成
              </button>
            ) : selectedArtifactWorkflow && (
              <button
                className="ghost-button compact"
                onClick={() => void runWorkflow(selectedArtifactWorkflow, undefined, { noteId: selectedArtifact?.noteId, noteIds: selectedArtifact?.noteIds })}
                disabled={busy === `workflow-${selectedArtifactWorkflow}`}
              >
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
          <div className="artifact-reader-context">
            {selectedArtifactOutsideScope && (
              <div className="artifact-scope-notice">
                <span>当前打开的产物不在“当前任务”范围内，正文会继续保留。</span>
                <button className="ghost-button compact" onClick={showAllArtifacts}>查看全部产物</button>
              </div>
            )}
            <ContextBadgeRow items={preview.meta} />
          </div>
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
  goalRuns,
  activeGoalRunId,
  confirmGoalRun,
  retryGoalRun,
  addGoalRunSources,
  pendingSearchPlan,
  confirmSearchPlan,
  dismissSearchPlan,
  onOpenModels,
  onNewSearch,
  onOpenJob,
  onOpenArtifacts,
  onRefresh,
  workflows,
  runWorkflow,
  customPrompts,
  runCustomPrompt,
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
  goalRuns: AiGoalRun[];
  activeGoalRunId: string;
  confirmGoalRun: (id: string) => Promise<void>;
  retryGoalRun: (id: string) => Promise<void>;
  addGoalRunSources: (id: string, urls: string[]) => Promise<void>;
  pendingSearchPlan: AssistantSearchPlan | null;
  confirmSearchPlan: () => Promise<void>;
  dismissSearchPlan: () => void;
  onOpenModels: () => void;
  onNewSearch: () => void;
  onOpenJob: (jobId: string) => void;
  onOpenArtifacts: (artifactId: string) => void;
  onRefresh: () => Promise<void>;
  workflows: AiWorkflowDefinition[];
  runWorkflow: RunWorkflow;
  customPrompts: AiCustomPrompt[];
  runCustomPrompt: (promptId: string, focus?: string, options?: RunWorkflowOptions) => Promise<AiArtifact | undefined>;
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
  const activeGoalRun =
    goalRuns.find((item) => item.id === activeGoalRunId) ??
    goalRuns.find((item) => item.status === "running" || item.status === "waiting" || item.status === "waiting_confirmation") ??
    goalRuns[0];
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
      {(notices.length > 0 || (!guideDismissed && !messages.length)) && (
        <div className="assistant-status-stack">
          {notices.map((notice) => <AssistantStateNotice key={notice.key} notice={notice} />)}
          {!guideDismissed && !messages.length && (
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
      {pendingSearchPlan && (
        <section className="assistant-search-plan" aria-label="确认关键词抓取">
          <div>
            <span>确认抓取任务</span>
            <strong>{pendingSearchPlan.keywords.join(" / ")}</strong>
            <small>确认后会创建本地抓取任务，并在有笔记入库后继续生成内容策划、爆款结构和评论需求分析。</small>
          </div>
          <div className="assistant-search-plan-actions">
            <button className="ghost-button compact" onClick={dismissSearchPlan} disabled={busy === "assistant-chat"}>
              <X size={14} />
              取消
            </button>
            <button className="primary-button compact" onClick={() => void confirmSearchPlan()} disabled={busy === "assistant-chat"}>
              {busy === "assistant-chat" ? <Loader2 className="spin" size={14} /> : <Search size={14} />}
              确认抓取
            </button>
          </div>
        </section>
      )}
      {activeGoalRun && (
        <GoalRunTimeline
          goalRun={activeGoalRun}
          busy={busy}
          onConfirm={confirmGoalRun}
          onRetry={retryGoalRun}
          onAddSources={addGoalRunSources}
          onOpenArtifacts={onOpenArtifacts}
        />
      )}
      {activeOrchestration && (
        <div className="assistant-orchestration-slot">
          <OrchestrationTimeline orchestration={activeOrchestration} onOpenJob={onOpenJob} onOpenArtifacts={onOpenArtifacts} />
        </div>
      )}
      {workflows.length > 0 && !messages.length && !pendingSearchPlan && (
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
          {customPrompts.length > 0 && (
            <div className="assistant-custom-action-stack">
              <strong>我的提示词</strong>
              <div className="assistant-suggestion-row">
                {customPrompts.slice(0, 4).map((prompt) => (
                  <button
                    key={prompt.id}
                    className="assistant-suggestion-card"
                    onClick={() => void runCustomPrompt(prompt.id)}
                    disabled={busy === `custom-prompt-run-${prompt.id}` || prompt.status === "archived"}
                    title={prompt.description}
                  >
                    {busy === `custom-prompt-run-${prompt.id}` ? <Loader2 className="spin" size={14} /> : <KeyRound size={14} />}
                    <span>{prompt.title}</span>
                    <small>{customPromptCategoryLabel(prompt.category)}</small>
                  </button>
                ))}
              </div>
            </div>
          )}
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

function GoalRunTimeline({
  goalRun,
  busy,
  onConfirm,
  onRetry,
  onAddSources,
  onOpenArtifacts
}: {
  goalRun: AiGoalRun;
  busy: string;
  onConfirm: (id: string) => Promise<void>;
  onRetry: (id: string) => Promise<void>;
  onAddSources: (id: string, urls: string[]) => Promise<void>;
  onOpenArtifacts: (artifactId: string) => void;
}) {
  const [sourceInput, setSourceInput] = useState("");
  const submitSources = async () => {
    const urls = sourceInput.split(/\s+|，|,/u).map((item) => item.trim()).filter(Boolean);
    if (!urls.length) return;
    await onAddSources(goalRun.id, urls);
    setSourceInput("");
  };
  return (
    <section className="goal-run-card" aria-label="目标任务进度">
      <div className="goal-run-head">
        <div>
          <span>目标式内容生产</span>
          <strong>{goalRun.plan.subject}</strong>
          <small>小红书 + 公开资料 · 生成 {goalRun.plan.outputCount} 篇 · {goalRunStatusLabel(goalRun.status)}</small>
        </div>
        {goalRun.status === "waiting_confirmation" && (
          <button className="primary-button compact" onClick={() => void onConfirm(goalRun.id)} disabled={busy === "assistant-chat"}>
            {busy === "assistant-chat" ? <Loader2 className="spin" size={14} /> : <Play size={14} />}
            确认并执行
          </button>
        )}
        {goalRun.status === "failed" && (
          <button className="primary-button compact" onClick={() => void onRetry(goalRun.id)} disabled={busy === "assistant-chat"}>
            <RefreshCw size={14} />
            从失败处重试
          </button>
        )}
      </div>
      <div className="goal-plan-summary">
        <span>研究问题</span>
        <p>{goalRun.plan.questions.join("、")}</p>
        <span>内容角度</span>
        <p>{goalRun.plan.angles.join("、")}</p>
      </div>
      <div className="goal-step-list">
        {goalRun.steps.map((step) => (
          <div key={step.key} className={`goal-step ${step.status}`}>
            <span className="goal-step-dot" />
            <div><strong>{step.title}</strong>{step.error && <small>{step.error}</small>}</div>
          </div>
        ))}
      </div>
      {goalRun.warning && <p className="goal-run-warning">{goalRun.warning}</p>}
      {goalRun.dossier && (
        <div className="goal-dossier-summary">
          <strong>研究结果</strong>
          <p>{goalRun.dossier.summary}</p>
          {goalRun.dossier.gaps.map((gap) => <small key={gap}>数据缺口：{gap}</small>)}
        </div>
      )}
      <div className="goal-source-row">
        <input value={sourceInput} onChange={(event) => setSourceInput(event.target.value)} placeholder="补充官网、媒体或视频资料链接" />
        <button className="ghost-button compact" onClick={() => void submitSources()} disabled={!sourceInput.trim() || busy === "assistant-chat" || goalRun.status === "running" || goalRun.status === "waiting"}>添加资料</button>
      </div>
      {goalRun.status === "completed" && goalPrimaryArtifactId(goalRun) && (
        <button className="ghost-button full" onClick={() => onOpenArtifacts(goalPrimaryArtifactId(goalRun))}>
          <FileText size={14} />
          查看研究档案与终稿
        </button>
      )}
    </section>
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
          {orchestrationLatestArtifactId(orchestration) && (
            <button className="ghost-button compact" onClick={() => onOpenArtifacts(orchestrationLatestArtifactId(orchestration))}>
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
  scopes: NoteScopeSummary[];
  preview: NoteScopeClearPreview | null;
  deleteAiArtifacts: boolean;
  setDeleteAiArtifacts: (value: boolean) => void;
  busy: string;
  onOpenScope: (jobId: string) => void;
  onPreviewDelete: (jobId: string) => Promise<void>;
  onConfirm: () => Promise<void>;
  onBack: () => void;
  onClose: () => void;
}) {
  const deleting = props.busy === "clear-notes";
  const previewing = props.busy === "clear-preview";
  const jobScopes = props.scopes.filter((scope) => scope.type === "job");
  const emptyCount = jobScopes.filter((scope) => scope.noteCount === 0).length;
  const errorCount = jobScopes.filter((scope) => scope.queueErrors > 0).length;
  const totalNotes = jobScopes.reduce((sum, scope) => sum + scope.noteCount, 0);
  if (!props.preview) {
    return (
      <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="数据集管理">
        <section className="dataset-dialog dataset-manager-dialog">
          <SectionTitle
            icon={<Database size={18} />}
            title="数据集管理"
            action={
              <button className="ghost-button compact" onClick={props.onClose} disabled={previewing}>
                <X size={14} />
                关闭
              </button>
            }
          />
          <div className="dataset-impact-grid">
            <Metric label="数据集" value={formatNumber(jobScopes.length)} />
            <Metric label="笔记" value={formatNumber(totalNotes)} />
            <Metric label="空数据集" value={formatNumber(emptyCount)} />
            <Metric label="有错误" value={formatNumber(errorCount)} />
          </div>
          <div className="dataset-manager-list">
            {jobScopes.map((scope) => (
              <div key={scope.id} className="dataset-manager-row">
                <div>
                  <strong>{scope.label}</strong>
                  <small>{noteScopeMeta(scope)}</small>
                  <span className="dataset-state">{datasetStateLabel(scope)}</span>
                </div>
                <div className="button-row">
                  <button className="ghost-button compact" onClick={() => scope.jobId && props.onOpenScope(scope.jobId)} disabled={!scope.jobId || previewing}>
                    <Eye size={14} />
                    打开
                  </button>
                  <button className="ghost-button compact danger" onClick={() => scope.jobId && void props.onPreviewDelete(scope.jobId)} disabled={!scope.jobId || previewing}>
                    {previewing ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />}
                    删除
                  </button>
                </div>
              </div>
            ))}
            {!jobScopes.length && <EmptyState text="暂无可管理的数据集" />}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="删除当前数据集">
      <section className="dataset-dialog">
        <SectionTitle
          icon={<Trash2 size={18} />}
          title="删除当前数据集"
          action={
            <div className="button-row">
              <button className="ghost-button compact" onClick={props.onBack} disabled={deleting}>
                <ChevronLeft size={14} />
                返回列表
              </button>
              <button className="ghost-button compact" onClick={props.onClose} disabled={deleting}>
                <X size={14} />
                关闭
              </button>
            </div>
          }
        />
        <div className="dataset-dialog-summary">
          <span>当前任务</span>
          <strong>{props.preview.label}</strong>
          <small>该操作会删除当前任务数据集，并移除它与笔记、队列和本地报告的关联；只有不再属于任何任务的笔记才会被真正删除。</small>
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
          <span>这是数据删除操作，不只是隐藏列表。确认后该任务会从数据范围中移除。</span>
        </div>
        <div className="dialog-actions">
          <button className="ghost-button" onClick={props.onClose} disabled={deleting}>
            取消
          </button>
          <button className="primary-button danger" onClick={() => void props.onConfirm()} disabled={deleting}>
            {deleting ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />}
            确认删除当前数据集
          </button>
        </div>
      </section>
    </div>
  );
}

function BulkDeleteNotesDialog(props: {
  preview: NoteBulkDeletePreview;
  busy: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const deleting = props.busy === "bulk-delete";
  const scoped = props.preview.mode === "scope-detach";
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="删除已选笔记">
      <section className="dataset-dialog">
        <SectionTitle
          icon={<Trash2 size={18} />}
          title="删除已选笔记"
          action={
            <button className="ghost-button compact" onClick={props.onClose} disabled={deleting}>
              <X size={14} />
              关闭
            </button>
          }
        />
        <div className="dataset-dialog-summary">
          <span>{scoped ? "当前数据集内删除" : "全局删除"}</span>
          <strong>{formatNumber(props.preview.affectedNotes)} 条笔记</strong>
          <small>{scoped ? "共用笔记只会从当前数据集中移除，孤立笔记才会被真正删除。" : "未限定单个数据集，本次会从本地笔记库中删除这些笔记。"}</small>
        </div>
        <div className="dataset-impact-grid">
          <Metric label="影响笔记" value={formatNumber(props.preview.affectedNotes)} />
          <Metric label="仅解除关联" value={formatNumber(props.preview.detachedNotes)} />
          <Metric label="真正删除笔记" value={formatNumber(props.preview.orphanNotes)} />
          <Metric label="删除评论" value={formatNumber(props.preview.commentsToDelete)} />
        </div>
        <div className="dataset-impact-list">
          <span>将删除本地分析报告：{formatNumber(props.preview.analysisReportsToDelete)} 个</span>
          <span>{scoped ? "建议：确认这是当前数据集内不需要的样本后再删除。" : "建议：如需更安全，请先切换到单个数据集后再批量删除。"}</span>
        </div>
        <div className="dataset-warning">
          <AlertTriangle size={16} />
          <span>这是批量删除操作。确认前请检查上方影响范围。</span>
        </div>
        <div className="dialog-actions">
          <button className="ghost-button" onClick={props.onClose} disabled={deleting}>
            取消
          </button>
          <button className="primary-button danger" onClick={() => void props.onConfirm()} disabled={deleting || !props.preview.affectedNotes}>
            {deleting ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />}
            确认删除已选笔记
          </button>
        </div>
      </section>
    </div>
  );
}

function ModelSettingsDrawer(props: {
  models: AiModelConfig[];
  storageStatus: StorageStatus | null;
  credentialSecurityStatus: CredentialSecurityStatus | null;
  retryCredentialSecurity: () => Promise<void>;
  legacyImportPreview: LegacyImportPreview | null;
  legacyImportSourceDir: string;
  setLegacyImportSourceDir: (value: string) => void;
  selectLegacyDataDirectory: () => Promise<void>;
  previewLegacyImport: () => Promise<void>;
  executeLegacyImport: () => Promise<void>;
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
  const previewCount = props.legacyImportPreview
    ? Object.values(props.legacyImportPreview.counts).reduce((sum, count) => sum + count, 0)
    : 0;
  const credentialSecurity = credentialSecurityPresentation(props.credentialSecurityStatus);
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
        <section className="drawer-section storage-settings-section">
          <SectionTitle icon={<ShieldCheck size={16} />} title="凭证安全" />
          <div className={credentialSecurity.warning ? "storage-status-card warning" : "storage-status-card"}>
            <strong>{credentialSecurity.title}</strong>
            <span>{credentialSecurity.description}</span>
            {props.credentialSecurityStatus && (
              <small>
                Cookie：{props.credentialSecurityStatus.cookieConfigured ? "已配置" : "未配置"}
                {" · "}模型 Key：{props.credentialSecurityStatus.modelKeyCount} 个
                {props.credentialSecurityStatus.mode === "desktop-encrypted"
                  ? ` · 已加密：${props.credentialSecurityStatus.encryptedCredentialCount} 项`
                  : ""}
              </small>
            )}
            {credentialSecurity.canRetry && (
              <button
                className="ghost-button compact"
                onClick={() => void props.retryCredentialSecurity()}
                disabled={props.busy === "credential-security"}
              >
                {props.busy === "credential-security" ? <Loader2 className="spin" size={14} /> : <RefreshCw size={14} />}
                重新检查并清理
              </button>
            )}
          </div>
        </section>
        <section className="drawer-section storage-settings-section">
          <SectionTitle icon={<Database size={16} />} title="数据存储" />
          <div className={["legacy-import-required", "legacy-import-conflict"].includes(props.storageStatus?.migrationState ?? "") ? "storage-status-card warning" : "storage-status-card"}>
            <strong>
              {props.storageStatus?.migrationState === "legacy-import-conflict"
                ? "旧数据与当前数据库发生冲突"
                : props.storageStatus?.migrationState === "legacy-import-required"
                ? "需要迁移旧版数据"
                : props.storageStatus?.migrationState === "imported"
                  ? "旧版数据已迁入 SQLite"
                  : "SQLite 数据库可用"}
            </strong>
            <span>
              {props.storageStatus
                ? `SQLite Schema v${props.storageStatus.schemaVersion}`
                : "正在读取存储状态…"}
            </span>
            {props.storageStatus?.migrationState === "legacy-import-required" && (
              <small>完成迁移前，应用不会向空数据库写入新业务数据。原 JSON 文件不会被删除或修改。</small>
            )}
            {props.storageStatus?.migrationState === "legacy-import-conflict" && (
              <small>当前 SQLite 已存在未确认数据，系统已停止业务写入以保护旧 JSON。请先备份 data 文件夹，再联系维护人员处理。</small>
            )}
            {props.storageStatus?.importedAt && <small>迁移时间：{formatDateTime(props.storageStatus.importedAt)}</small>}
          </div>
          {props.storageStatus?.migrationState !== "imported" && (
            <div className="storage-import-controls">
              <label className="field-stack compact-field">
                <span>旧版 data 文件夹</span>
                <input
                  value={props.legacyImportSourceDir}
                  onChange={(event) => props.setLegacyImportSourceDir(event.target.value)}
                  placeholder="留空使用当前默认 data 目录"
                />
              </label>
              <div className="drawer-toolbar">
                {window.desktopStorage && (
                  <button className="ghost-button compact" onClick={() => void props.selectLegacyDataDirectory()}>
                    <Library size={14} />
                    选择文件夹
                  </button>
                )}
                <button className="ghost-button compact" onClick={() => void props.previewLegacyImport()} disabled={props.busy === "storage-preview" || props.busy === "storage-import"}>
                  {props.busy === "storage-preview" ? <Loader2 className="spin" size={14} /> : <Eye size={14} />}
                  预检旧数据
                </button>
              </div>
              {props.legacyImportPreview && (
                <div className="storage-preview-card">
                  <strong>预检完成：{previewCount} 条记录</strong>
                  <small>识别到 {props.legacyImportPreview.detectedFiles.length} 个允许的 JSON 文件。</small>
                  {props.legacyImportPreview.warnings.map((warning) => <small key={warning}>{warning}</small>)}
                  {props.legacyImportPreview.detectedFiles.length > 0 && props.storageStatus?.migrationState !== "legacy-import-conflict" && (
                    <button className="primary-button full" onClick={() => void props.executeLegacyImport()} disabled={props.busy === "storage-import"}>
                      {props.busy === "storage-import" ? <Loader2 className="spin" size={16} /> : <Database size={16} />}
                      确认迁入 SQLite
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
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
  startBrowserExtensionPairing,
  cancelBrowserExtensionPairing,
  revokeBrowserExtensionPairing,
  pairingCode,
  pairingClock,
  openOriginalUrl,
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
  startBrowserExtensionPairing: () => Promise<void>;
  cancelBrowserExtensionPairing: () => Promise<void>;
  revokeBrowserExtensionPairing: () => Promise<void>;
  pairingCode: string;
  pairingClock: number;
  openOriginalUrl: (url: string) => Promise<void>;
  busy: string;
}) {
  const pairing = browserBridge.pairing ?? { state: "unpaired" as const };
  const pairingSeconds = pairingSecondsRemaining(pairing.expiresAt, pairingClock);
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
          <button className="primary-button compact" onClick={() => void syncBrowserBridgeCookie()} disabled={busy === "auth" || !browserBridge.connected || pairing.state !== "paired"}>
            {busy === "auth" ? <Loader2 className="spin" size={15} /> : <KeyRound size={15} />}
            同步登录态
          </button>
        </div>
      </div>
      <div className="browser-pairing-panel">
        {pairing.state === "paired" ? (
          <>
            <p className="muted-line">
              已配对 {pairing.browser === "edge" ? "Edge" : pairing.browser === "chrome" ? "Chrome" : "浏览器"}
              {pairing.extensionVersion ? ` · 扩展 ${pairing.extensionVersion}` : ""}
            </p>
            <button className="ghost-button compact danger" onClick={() => void revokeBrowserExtensionPairing()} disabled={busy === "bridge-pair"}>
              解除配对
            </button>
          </>
        ) : pairing.state === "pairing" ? (
          <>
            {pairingCode ? (
              <div className="pairing-code-block">
                <small>请在浏览器扩展中输入</small>
                <strong className="pairing-code">{pairingCode}</strong>
                <small>{pairingSeconds > 0 ? `${pairingSeconds} 秒后失效` : "配对码已失效，请重新生成"}</small>
              </div>
            ) : (
              <p className="muted-line">页面已刷新，临时配对码无法恢复，请重新生成。</p>
            )}
            <div className="button-row">
              <button className="primary-button compact" onClick={() => void startBrowserExtensionPairing()} disabled={busy === "bridge-pair"}>重新生成</button>
              <button className="ghost-button compact" onClick={() => void cancelBrowserExtensionPairing()} disabled={busy === "bridge-pair"}>取消配对</button>
            </div>
          </>
        ) : (
          <button className="primary-button compact" onClick={() => void startBrowserExtensionPairing()} disabled={busy === "bridge-pair"}>
            开始配对
          </button>
        )}
      </div>
      <p className="muted-line">插件使用：在 Edge 扩展页加载 browser-extension/xhs-bridge，刷新本地运营台和小红书页面，再点击“检测助手”。</p>
      <div className="button-row">
        <button className="ghost-button" onClick={() => void openOriginalUrl("https://www.xiaohongshu.com/")}>
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

export function playbookToForm(playbook: ContentPlaybook): ContentPlaybookForm {
  return {
    name: playbook.name,
    productName: playbook.productName,
    category: playbook.category,
    forbiddenTerms: playbook.forbiddenTerms.join(", "),
    sensitiveClaims: playbook.sensitiveClaims.join(", "),
    allowedSellingPoints: playbook.allowedSellingPoints.join(", "),
    requiredSections: playbook.requiredSections.join(", "),
    toneWords: playbook.toneWords.join(", "),
    personas: playbook.personas.join(", "),
    scenarios: playbook.scenarios.join(", "),
    tags: playbook.tags.join(", "),
    replacements: formatReplacementRules(playbook.replacements)
  };
}

function projectToForm(project: ContentProject): ContentProjectForm {
  return {
    name: project.name,
    productName: project.productName,
    targetAudience: project.targetAudience.join(", "),
    scenarios: project.scenarios.join(", "),
    goals: project.goals.join(", "),
    playbookId: project.playbookId ?? "",
    jobId: project.jobId ?? "",
    status: project.status
  };
}

export function applyContentPlaybookTemplate(form: ContentPlaybookForm, templateKey: ContentPlaybookTemplateKey): ContentPlaybookForm {
  const template = contentPlaybookTemplates.find((item) => item.key === templateKey) ?? contentPlaybookTemplates[0];
  const productName = template.key === "specialty" ? template.form.productName : form.productName.trim() || template.form.productName;
  return {
    ...template.form,
    productName
  };
}

export function resolveProjectRefreshState(projects: ContentProject[], selectedId: string, dirty: boolean): {
  selectedId: string;
  project?: ContentProject;
  applyForm: boolean;
} {
  if (dirty) {
    return { selectedId, applyForm: false };
  }
  const project = (selectedId ? projects.find((item) => item.id === selectedId) : undefined) ?? projects[0];
  return {
    selectedId: project?.id ?? "",
    project,
    applyForm: true
  };
}

export function resolvePlaybookRefreshState(playbooks: ContentPlaybook[], selectedId: string, dirty: boolean): {
  selectedId: string;
  playbook?: ContentPlaybook;
  applyForm: boolean;
} {
  if (dirty) {
    return { selectedId, applyForm: false };
  }
  const playbook = (selectedId ? playbooks.find((item) => item.id === selectedId) : undefined) ?? playbooks[0];
  return {
    selectedId: playbook?.id ?? "",
    playbook,
    applyForm: true
  };
}

function contentProjectInputFromForm(form: ContentProjectForm): ContentProjectInput {
  return {
    name: form.name,
    productName: form.productName,
    targetAudience: splitTextList(form.targetAudience),
    scenarios: splitTextList(form.scenarios),
    goals: splitTextList(form.goals),
    playbookId: form.playbookId || undefined,
    jobId: form.jobId || undefined,
    status: form.status
  };
}

export function contentPlaybookInputFromForm(form: ContentPlaybookForm): ContentPlaybookInput {
  return {
    name: form.name,
    productName: form.productName,
    category: form.category,
    forbiddenTerms: splitTextList(form.forbiddenTerms),
    sensitiveClaims: splitTextList(form.sensitiveClaims),
    allowedSellingPoints: splitTextList(form.allowedSellingPoints),
    requiredSections: splitTextList(form.requiredSections),
    toneWords: splitTextList(form.toneWords),
    personas: splitTextList(form.personas),
    scenarios: splitTextList(form.scenarios),
    tags: splitTextList(form.tags),
    replacements: parseReplacementRules(form.replacements)
  };
}

function formatReplacementRules(rules: ReadonlyArray<{ from: string; to: string; reason?: string }>): string {
  return JSON.stringify(rules);
}

export function parseReplacementRules(value: string): ContentPlaybookInput["replacements"] {
  if (!value.trim()) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    throw new Error("替换规则必须是合法 JSON 数组");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("替换规则必须是 JSON 数组");
  }
  return parsed.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`替换规则第 ${index + 1} 条必须包含字符串 from 和 to`);
    }
    const rule = item as { from?: unknown; to?: unknown; reason?: unknown };
    if (typeof rule.from !== "string" || typeof rule.to !== "string" || (rule.reason !== undefined && typeof rule.reason !== "string")) {
      throw new Error(`替换规则第 ${index + 1} 条必须包含字符串 from 和 to`);
    }
    return { from: rule.from, to: rule.to, ...(rule.reason === undefined ? {} : { reason: rule.reason }) };
  });
}

export function contentReviewToForm(review: Pick<ContentReviewRun, "revisedTitle" | "revisedBody" | "revisedTags">): ContentReviewForm {
  return {
    title: review.revisedTitle,
    body: review.revisedBody,
    tags: review.revisedTags.join(", ")
  };
}

export function contentReviewRuleSummary(playbook?: Pick<ContentPlaybook, "name" | "productName" | "forbiddenTerms" | "sensitiveClaims">): ContentReviewRuleSummary {
  if (playbook) {
    const usesSpecialtyPolicy = playbook.productName === WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.productName;
    return {
      label: playbook.name,
      forbiddenTermCount: usesSpecialtyPolicy
        ? new Set([...playbook.forbiddenTerms, ...WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.forbiddenTerms]).size
        : playbook.forbiddenTerms.length,
      sensitiveClaimCount: usesSpecialtyPolicy
        ? new Set([...playbook.sensitiveClaims, ...WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.sensitiveClaims]).size
        : playbook.sensitiveClaims.length
    };
  }
  return {
    label: DEFAULT_CONTENT_REVIEW_RULE_LABEL,
    forbiddenTermCount: WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.forbiddenTerms.length,
    sensitiveClaimCount: WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.sensitiveClaims.length
  };
}

export function canSelectPromptKey(currentKey: AiWorkflowKey, targetKey: AiWorkflowKey, discardConfirmed: boolean): boolean {
  return currentKey === targetKey || discardConfirmed;
}

function briefFromForm(form: ContentBriefForm) {
  return {
    productName: form.productName,
    persona: form.persona,
    painPoint: form.painPoint,
    scenario: form.scenario,
    channel: form.channel,
    sellingPoints: splitTextList(form.sellingPoints),
    tone: form.tone,
    length: form.length,
    keywords: splitTextList(form.keywords)
  };
}

function splitTextList(value: string): string[] {
  return value.split(/[,\n，、#]/u).map((item) => item.trim()).filter(Boolean);
}

function createBatchReviewItem(): BatchReviewItem {
  return {
    id: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: "",
    body: "",
    tags: "",
    selected: true
  };
}

export function noteToBatchReviewItem(note: Pick<NoteRecord, "id" | "title" | "desc" | "keywords">): BatchReviewItem {
  return {
    id: `note_${note.id}`,
    title: note.title,
    body: note.desc,
    tags: note.keywords.join(", "),
    selected: true
  };
}

function contentRiskLabel(risk: ContentReviewRun["risk"]): string {
  if (risk === "pass") return "通过";
  if (risk === "low") return "低风险";
  if (risk === "medium") return "中风险";
  return "高风险";
}

function contentProjectStatusLabel(status: ContentProjectStatus): string {
  if (status === "planning") return "选题中";
  if (status === "writing") return "撰写中";
  if (status === "reviewing") return "审稿中";
  return "已定稿";
}

function contentDraftStatusLabel(status: ContentDraft["status"]): string {
  if (status === "finalized") return "已定稿";
  if (status === "reviewed") return "已审稿";
  return "草稿";
}

function contentMaterialCategoryLabel(category: ContentProjectMaterialCategory): string {
  if (category === "pain") return "痛点";
  if (category === "scenario") return "场景";
  if (category === "expression") return "表达";
  if (category === "competitor") return "竞品";
  return "通用";
}

export function severityLabel(severity: ContentReviewRun["issues"][number]["severity"]): string {
  if (severity === "blocker") return "必须修改";
  if (severity === "warning") return "建议修改";
  return "提示";
}

export function compactContentText(value: string, maxLength: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) {
    return "暂无内容";
  }
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, Math.max(0, maxLength - 1))}…`;
}

export function getContentArtifacts<T extends Pick<AiArtifact, "workflowKey" | "createdAt">>(artifacts: T[]): T[] {
  return artifacts
    .filter((artifact) => artifact.workflowKey === "note-writing" || artifact.workflowKey === "draft-review")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function contentResultCounts(
  drafts: Array<Pick<ContentDraft, "status">>,
  reviews: Array<Pick<ContentReviewRun, "risk">>,
  artifacts: Array<Pick<AiArtifact, "workflowKey" | "createdAt">>
) {
  return {
    drafts: drafts.length,
    reviewedDrafts: drafts.filter((draft) => draft.status === "reviewed" || draft.status === "finalized").length,
    reviews: reviews.length,
    highRiskReviews: reviews.filter((review) => review.risk === "high").length,
    passedReviews: reviews.filter((review) => review.risk === "pass").length,
    contentArtifacts: getContentArtifacts(artifacts).length
  };
}

function contentArtifactTypeLabel(workflowKey: AiArtifact["workflowKey"]): string {
  if (workflowKey === "note-writing") return "小红书草稿";
  if (workflowKey === "draft-review") return "AI 审稿报告";
  return "内容产物";
}

function promptVersionLabel(version: string): string {
  if (version.includes("custom")) {
    return "我的自定义提示词";
  }
  if (version.startsWith("xhs-ops")) {
    return "内置运营模板";
  }
  if (version.startsWith("xhs-assistant")) {
    return "内置助手模板";
  }
  if (version.startsWith("xhs-report")) {
    return "内置报告模板";
  }
  if (version.startsWith("xhs-content-studio")) {
    return "内容创作模板";
  }
  if (version.startsWith("xhs-orchestration")) {
    return "自动编排模板";
  }
  return version;
}

function parseAssistantSearchPlan(content: string): AssistantSearchPlan | null {
  const text = content.trim();
  if (!/(抓取|搜索|采集|爬取)/u.test(text) || !/(关键词|关键字)/u.test(text)) {
    return null;
  }
  const keywords = extractAssistantKeywords(text);
  if (!keywords.length) {
    return null;
  }
  return {
    instruction: text,
    keywords
  };
}

function extractAssistantKeywords(text: string): string[] {
  const patterns = [
    /(?:关键词|关键字)\s*[:：]?\s*([^\n，,。；;]+)/u,
    /(?:抓取|搜索|采集|爬取)\s*(?:关键词|关键字)?\s*([^\n，,。；;]+)/u,
    /(?:通过|用|以)\s*([^\n，,。；;]+?)\s*(?:关键词|关键字)\s*(?:进行|做)?\s*(?:抓取|搜索|采集|爬取)/u
  ];
  for (const pattern of patterns) {
    const candidate = pattern.exec(text)?.[1];
    if (!candidate) {
      continue;
    }
    const keywords = splitAssistantKeywordCandidate(candidate);
    if (keywords.length) {
      return keywords;
    }
  }
  return [];
}

function splitAssistantKeywordCandidate(candidate: string): string[] {
  const cleaned = candidate
    .replace(/[“”"'`]/g, "")
    .split(/然后|并且|并|再|顺便|同时|生成|分析|这个关键词|这些关键词|该关键词|这个关键字|这些关键字|该关键字/u)[0]
    ?.replace(/^(?:帮我|请|进行|关于|围绕|抓取|搜索|采集|爬取|关键词|关键字)\s*/u, "")
    .replace(/(?:的)?(?:抓取|搜索|采集|爬取).*$/u, "")
    .trim();
  if (!cleaned) {
    return [];
  }
  return cleaned
    .split(/[\s、/|]+/u)
    .map((item) => item.trim())
    .filter((item) => item && !["这个", "这些", "该", "关键词", "关键字", "抓取", "搜索", "采集", "爬取"].includes(item));
}

function isContentStudioRequest(content: string): boolean {
  const text = content.trim();
  return /审稿|审核|改稿|润色|撰写|写一篇|写小红书|生成草稿|自动写|笔记草稿/.test(text) && /小红书|笔记|种草|草稿|文案/.test(text);
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

export async function openUrlWithBrowserFallback(
  url: string,
  openWithBridge: (url: string) => Promise<void>,
  openWithServer: (url: string) => Promise<void>
): Promise<void> {
  try {
    await openWithBridge(url);
  } catch {
    await openWithServer(url);
  }
}

export function upsertById<T extends { id: string }>(items: T[], next: T): T[] {
  return prependUniqueById(items, [next]);
}

export function prependUniqueById<T extends { id: string }>(items: T[], nextItems: T[]): T[] {
  const nextIds = new Set<string>();
  const uniqueNext = nextItems.filter((item) => {
    if (nextIds.has(item.id)) {
      return false;
    }
    nextIds.add(item.id);
    return true;
  });
  return [...uniqueNext, ...items.filter((item) => !nextIds.has(item.id))];
}

export function normalizeAiResourceScope(scope: AiResourceScope, activeJobId: string): AiResourceScope {
  return scope === "current" && !activeJobId ? "all" : scope;
}

export function aiResourceJobId(scope: AiResourceScope, activeJobId: string): string | undefined {
  return normalizeAiResourceScope(scope, activeJobId) === "current" ? activeJobId : undefined;
}

export function resolveSelectedAiArtifact(
  artifacts: AiArtifact[],
  selectedArtifactId: string,
  openedArtifactSnapshot: AiArtifact | null
): AiArtifact | undefined {
  return artifacts.find((artifact) => artifact.id === selectedArtifactId) ??
    (openedArtifactSnapshot?.id === selectedArtifactId ? openedArtifactSnapshot : undefined);
}

export async function loadArtifactForOpen(
  artifacts: AiArtifact[],
  artifactId: string,
  loadById: (artifactId: string) => Promise<AiArtifact>,
  artifactHint?: AiArtifact
): Promise<AiArtifact> {
  return artifactHint ?? artifacts.find((artifact) => artifact.id === artifactId) ?? await loadById(artifactId);
}

export function goalPrimaryArtifactId(goalRun: Pick<AiGoalRun, "artifactIds">): string {
  return goalRun.artifactIds[0] ?? "";
}

export function orchestrationLatestArtifactId(orchestration: Pick<AiOrchestration, "artifactIds">): string {
  return orchestration.artifactIds[orchestration.artifactIds.length - 1] ?? "";
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

function goalRunStatusLabel(status: AiGoalRun["status"]): string {
  if (status === "waiting_confirmation") return "等待确认";
  if (status === "running") return "执行中";
  if (status === "waiting") return "等待数据";
  if (status === "completed") return "已完成";
  if (status === "failed") return "需要处理";
  return "已取消";
}

function formatBreakerReason(reason: string): string {
  if (isRateLimitReason(reason)) {
    return "小红书返回 IP 限流（300012），任务已自动暂停。建议等待 10-30 分钟后再恢复，并降低抓取页数、评论页数或并发，避免连续触发风控。";
  }
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

function isRateLimitReason(reason: string): boolean {
  return /IP rate limit|300012|rate limit/i.test(reason);
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
