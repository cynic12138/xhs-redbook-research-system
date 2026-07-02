export type SearchSort = "general" | "popular" | "latest";
export type NoteTypeFilter = "all" | "video" | "image";
export type JobStatus = "queued" | "running" | "paused" | "completed" | "failed";
export type QueueStatus = "pending" | "running" | "done" | "error";
export type QueueKind = "read" | "comments" | "user" | "user-posts" | "analyze";
export type CapabilityStatus = "ready" | "partial" | "planned" | "guarded";
export type CapabilityRisk = "read" | "write" | "danger";
export type ReplyStrategy = "questions" | "top-engaged" | "all-unanswered";
export type ReplyPlanStatus = "draft" | "queued" | "sending" | "completed" | "paused" | "failed";
export type ReplyActionStatus = "draft" | "queued" | "sending" | "sent" | "failed" | "paused";
export type AiReportStatus = "completed" | "failed";
export type AiArtifactStatus = "completed" | "failed";
export type AiArtifactSource = "ai" | "local";
export type AiPromptSource = "default" | "custom";
export type AiOrchestrationStatus = "queued" | "running" | "waiting" | "completed" | "failed" | "cancelled";
export type AiOrchestrationStepStatus = "pending" | "running" | "completed" | "failed" | "skipped" | "cancelled";
export type AiOrchestrationStepKey =
  | "create-search-job"
  | "wait-notes"
  | "run-content-planning"
  | "run-viral-template"
  | "run-audience-insight"
  | "summarize";
export type AiWorkflowKey =
  | "content-planning"
  | "audience-insight"
  | "competitor-analysis"
  | "viral-deep-dive"
  | "viral-template"
  | "note-analysis"
  | "draft-review"
  | "note-writing";
export type ContentIssueSeverity = "info" | "warning" | "blocker";
export type ContentReviewRisk = "pass" | "low" | "medium" | "high";
export type ContentDraftLength = "short" | "medium" | "long";
export type ContentDraftStatus = "draft" | "reviewed" | "finalized";
export type ContentProjectStatus = "planning" | "writing" | "reviewing" | "finalized";
export type ContentProjectMaterialCategory = "pain" | "scenario" | "expression" | "competitor" | "general";
export type ContentProjectMaterialSource = "note" | "manual";

export interface AuthStatus {
  connected: boolean;
  configured: boolean;
  user?: UserSummary;
  error?: string;
  checkedAt?: string;
  needsVerification?: boolean;
  message?: string;
}

export interface UserSummary {
  id?: string;
  nickname?: string;
  avatar?: string;
  raw?: unknown;
}

export type BrowserAuthBrowser = "edge";
export type BrowserAuthSessionStatus = "opening" | "waiting" | "verified" | "failed" | "closed";

export interface BrowserAuthSessionInfo {
  sessionId: string;
  status: BrowserAuthSessionStatus;
  browser: BrowserAuthBrowser;
  browserName: string;
  loginUrl: string;
  message: string;
  missingKeys?: string[];
  createdAt: string;
  updatedAt: string;
  lastError?: string;
}

export type BrowserBridgeBrowser = "edge" | "chrome" | "unknown";
export type BrowserBridgePermissionStatus = "granted" | "missing" | "unknown";

export interface BrowserBridgeStatus {
  connected: boolean;
  browser: BrowserBridgeBrowser;
  extensionVersion?: string;
  lastSeenAt?: string;
  lastSyncAt?: string;
  permissionStatus: BrowserBridgePermissionStatus;
  message?: string;
  diagnostic?: string;
}

export type BrowserOpenMode = "auto" | "current-browser" | "dedicated-edge";

export interface BrowserOpenResult {
  ok: boolean;
  mode: Exclude<BrowserOpenMode, "auto">;
  url: string;
  message: string;
}

export interface SearchJob {
  id: string;
  keywords: string[];
  sort: SearchSort;
  noteType: NoteTypeFilter;
  pages: number;
  commentPages: number;
  concurrency?: number;
  status: JobStatus;
  breakerReason?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  progress: {
    seeded: number;
    pending: number;
    running: number;
    done: number;
    error: number;
    total: number;
    byKind?: Record<QueueKind, QueueKindProgress>;
  };
}

export interface QueueKindProgress {
  pending: number;
  running: number;
  done: number;
  error: number;
  total: number;
}

export interface QueueItem {
  id: string;
  jobId: string;
  kind: QueueKind;
  arg: string;
  noteId?: string;
  userId?: string;
  keyword?: string;
  status: QueueStatus;
  attempts: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteRecord {
  id: string;
  jobIds: string[];
  keywords: string[];
  title: string;
  desc: string;
  type: "normal" | "video" | "unknown";
  webUrl: string;
  noteUrl: string;
  authorId?: string;
  authorName?: string;
  coverUrl?: string;
  imageUrls?: string[];
  videoUrl?: string;
  likedCount: number;
  collectedCount: number;
  commentCount: number;
  shareCount: number;
  hotScore: number;
  publishedAt?: string;
  raw?: unknown;
  analysis?: ViralAnalysis;
  createdAt: string;
  updatedAt: string;
}

export interface CommentRecord {
  id: string;
  noteId: string;
  authorId?: string;
  authorName?: string;
  content: string;
  likedCount: number;
  raw?: unknown;
  createdAt: string;
}

export interface AuthorRecord {
  id: string;
  nickname: string;
  avatar?: string;
  desc?: string;
  fansCount: number;
  followingCount: number;
  likedCount: number;
  noteCount: number;
  raw?: unknown;
  updatedAt: string;
}

export interface AuthorPostRecord {
  id: string;
  authorId: string;
  title: string;
  type: "normal" | "video" | "unknown";
  webUrl?: string;
  likedCount: number;
  collectedCount: number;
  commentCount: number;
  raw?: unknown;
}

export interface KeywordMetric {
  keyword: string;
  top1Likes: number;
  top10AvgLikes: number;
  top1Collects: number;
  collectLikeRatio: number;
  commentLikeRatio: number;
  competitionDensity: number;
  opportunityScore: number;
  tier: "S" | "A" | "B" | "C";
  noteCount: number;
}

export interface AuthorMetric {
  authorId: string;
  nickname: string;
  fansCount: number;
  noteCount: number;
  avgLikes: number;
  medianLikes: number;
  maxLikes: number;
  breakoutRatio: number;
}

export interface AnalyticsReport {
  jobId: string;
  generatedAt: string;
  overview: {
    notes: number;
    videos: number;
    imageNotes: number;
    avgLikes: number;
    totalComments: number;
    totalCollects: number;
    totalShares: number;
  };
  keywords: KeywordMetric[];
  authors: AuthorMetric[];
  formBreakdown: Array<{
    form: "normal" | "video" | "unknown";
    noteCount: number;
    top1Likes: number;
    top10AvgLikes: number;
    collectLikeRatio: number;
  }>;
  templates: Array<{
    noteId: string;
    title: string;
    score: number;
    hookPatterns: string[];
    contentType: string;
  }>;
}

export interface ViralAnalysis {
  score: number;
  hookPatterns: string[];
  contentType: "reference" | "insight" | "entertainment";
  discussionType: "discussion" | "normal" | "passive";
  collectLikeRatio: number;
  commentLikeRatio: number;
  shareLikeRatio: number;
  questionRate: number;
  commentThemes: Array<{ keyword: string; count: number }>;
  titleLength: number;
  bodyLength: number;
  paragraphCount: number;
  authorMedianLikes: number;
  viralMultiplier: number;
  generatedAt: string;
}

export interface NotesQuery {
  jobId?: string;
  jobIds?: string[];
  q?: string;
  type?: NoteTypeFilter;
  author?: string;
  minLikes?: number;
  sort?: "hot" | "likes" | "comments" | "collects" | "latest";
}

export interface NotesPageResult {
  items: NoteRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface NoteScopeSummary {
  id: string;
  type: "all" | "keyword" | "job";
  jobId?: string;
  relatedJobIds?: string[];
  label: string;
  keywords: string[];
  status?: JobStatus;
  noteCount: number;
  queueTotal: number;
  queueErrors: number;
  aiArtifactCount: number;
  aiReportCount: number;
  createdAt?: string;
  updatedAt?: string;
  duplicateCount: number;
  isDuplicate: boolean;
  emptyReason?: string;
}

export interface NoteScopeClearPreview {
  jobId: string;
  label: string;
  affectedNotes: number;
  detachedNotes: number;
  orphanNotes: number;
  commentsToDelete: number;
  queueItemsToDelete: number;
  analysisReportsToDelete: number;
  aiArtifactsLinked: number;
  aiReportsLinked: number;
}

export interface NoteMediaRefreshResult {
  note: NoteRecord;
  refreshed: boolean;
  message: string;
}

export interface SearchJobInput {
  keywords: string[];
  sort: SearchSort;
  noteType: NoteTypeFilter;
  pages: number;
  commentPages: number;
  concurrency?: number;
}

export interface RedbookCapability {
  key: string;
  command: string;
  module: string;
  label: string;
  description: string;
  status: CapabilityStatus;
  risk: CapabilityRisk;
  route?: string;
}

export interface AiModelConfig {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  model: string;
  apiKeyMasked: string;
  hasApiKey: boolean;
  isDefault: boolean;
  temperature: number;
  maxTokens: number;
  createdAt: string;
  updatedAt: string;
}

export interface AiModelInput {
  name: string;
  provider: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  isDefault?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface AiModelToolsProbeResult {
  ok: boolean;
  supportsTools: boolean;
  message: string;
  checkedAt: string;
}

export interface AiReport {
  id: string;
  jobId: string;
  title: string;
  modelId?: string;
  source: "ai" | "local";
  status: AiReportStatus;
  markdown: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiWorkflowDefinition {
  key: AiWorkflowKey;
  title: string;
  description: string;
  module: "overview" | "research" | "notes" | "viral" | "audience" | "competitors" | "comments" | "content" | "ai";
  requires: Array<"job" | "note" | "comments" | "authors" | "analytics">;
}

export interface AiPromptInfo {
  key: AiWorkflowKey;
  title: string;
  description: string;
  version: string;
  inputRequirements: string[];
  outputSections: string[];
  promptSource?: AiPromptSource;
  isCustomized?: boolean;
  artifactCount?: number;
  lastUsedAt?: string;
  updatedAt?: string;
}

export interface AiPromptDetail extends AiPromptInfo {
  defaultTemplate: string;
  customTemplate?: string;
  activeTemplate: string;
  variables: Array<{
    key: string;
    label: string;
    description: string;
  }>;
  overview: {
    automaticInputs: Array<{
      key: string;
      label: string;
      description: string;
    }>;
    totalAutomaticInputs: number;
    deliverables: string[];
    totalDeliverables: number;
  };
  recentArtifacts: Array<{
    id: string;
    title: string;
    createdAt: string;
    source: AiArtifactSource;
  }>;
}

export interface AiPromptConfig {
  key: AiWorkflowKey;
  customTemplate?: string;
  activeSource: AiPromptSource;
  updatedAt: string;
  lastUsedAt?: string;
}

export interface AiWorkflowRunInput {
  workflowKey: AiWorkflowKey;
  jobId?: string;
  noteId?: string;
  modelId?: string;
  focus?: string;
}

export interface AiArtifact {
  id: string;
  workflowKey: AiWorkflowKey | "assistant";
  jobId?: string;
  noteId?: string;
  title: string;
  markdown: string;
  source: AiArtifactSource;
  status: AiArtifactStatus;
  modelId?: string;
  promptKey?: AiWorkflowKey | "assistant" | "report";
  promptTitle?: string;
  promptSource?: AiPromptSource;
  promptVersion?: string;
  contextSummary?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiAssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface AiAssistantChatInput {
  message: string;
  jobId?: string;
  noteId?: string;
  modelId?: string;
  module?: string;
}

export interface AiAssistantChatResponse {
  message: AiAssistantMessage;
  artifact?: AiArtifact;
}

export interface AiOrchestrationStep {
  key: AiOrchestrationStepKey;
  title: string;
  status: AiOrchestrationStepStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  output?: {
    jobId?: string;
    noteCount?: number;
    artifactId?: string;
  };
}

export interface AiOrchestration {
  id: string;
  instruction: string;
  keywords: string[];
  modelId?: string;
  jobId?: string;
  steps: AiOrchestrationStep[];
  status: AiOrchestrationStatus;
  artifactIds: string[];
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiOrchestrationCreateInput {
  instruction: string;
  keywords?: string[];
  modelId?: string;
}

export interface ContentReplacementRule {
  from: string;
  to: string;
  reason?: string;
}

export interface ContentPlaybook {
  id: string;
  name: string;
  productName: string;
  category: string;
  forbiddenTerms: string[];
  sensitiveClaims: string[];
  allowedSellingPoints: string[];
  requiredSections: string[];
  toneWords: string[];
  personas: string[];
  scenarios: string[];
  tags: string[];
  replacements: ContentReplacementRule[];
  createdAt: string;
  updatedAt: string;
}

export interface ContentPlaybookRevision {
  id: string;
  playbookId: string;
  snapshot: ContentPlaybook;
  createdAt: string;
}

export interface ContentPlaybookStats {
  playbookId: string;
  reviewCount: number;
  issueCount: number;
  highRiskCount: number;
  passCount: number;
  topCategories: Array<{
    category: string;
    count: number;
  }>;
  recentIssues: Array<{
    reviewId: string;
    title: string;
    severity: ContentIssueSeverity;
    category: string;
    evidence?: string;
    createdAt: string;
  }>;
}

export interface ContentPlaybookInput {
  name: string;
  productName: string;
  category?: string;
  forbiddenTerms?: string[];
  sensitiveClaims?: string[];
  allowedSellingPoints?: string[];
  requiredSections?: string[];
  toneWords?: string[];
  personas?: string[];
  scenarios?: string[];
  tags?: string[];
  replacements?: ContentReplacementRule[];
}

export interface ContentProject {
  id: string;
  name: string;
  productName: string;
  targetAudience: string[];
  scenarios: string[];
  goals: string[];
  playbookId?: string;
  jobId?: string;
  status: ContentProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ContentProjectInput {
  name: string;
  productName: string;
  targetAudience?: string[];
  scenarios?: string[];
  goals?: string[];
  playbookId?: string;
  jobId?: string;
  status?: ContentProjectStatus;
}

export interface ContentProjectMaterial {
  id: string;
  projectId: string;
  source: ContentProjectMaterialSource;
  sourceId?: string;
  category: ContentProjectMaterialCategory;
  title: string;
  content: string;
  tags: string[];
  authorName?: string;
  stats?: {
    liked: number;
    collected: number;
    comments: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ContentProjectMaterialInput {
  projectId: string;
  source?: ContentProjectMaterialSource;
  sourceId?: string;
  category?: ContentProjectMaterialCategory;
  title: string;
  content: string;
  tags?: string[];
  authorName?: string;
  stats?: {
    liked: number;
    collected: number;
    comments: number;
  };
}

export interface ContentBrief {
  projectId?: string;
  playbookId?: string;
  productName: string;
  persona: string;
  painPoint: string;
  scenario: string;
  channel: string;
  sellingPoints: string[];
  tone: string;
  length: ContentDraftLength;
  keywords: string[];
  jobId?: string;
}

export interface ContentDraftInput {
  projectId?: string;
  playbookId?: string;
  jobId?: string;
  modelId?: string;
  brief: ContentBrief;
}

export interface ContentDraftBatchInput extends ContentDraftInput {
  count?: number;
}

export interface ContentReviewInput {
  projectId?: string;
  playbookId?: string;
  jobId?: string;
  noteId?: string;
  draftId?: string;
  modelId?: string;
  title?: string;
  body: string;
  tags?: string[];
  mode?: "minimal" | "natural" | "safe";
}

export interface ContentReviewBatchItem {
  id?: string;
  title?: string;
  body: string;
  tags?: string[];
}

export interface ContentReviewBatchInput {
  projectId?: string;
  playbookId?: string;
  jobId?: string;
  modelId?: string;
  items: ContentReviewBatchItem[];
  mode?: "minimal" | "natural" | "safe";
}

export interface ContentReviewIssue {
  id: string;
  severity: ContentIssueSeverity;
  category: string;
  message: string;
  evidence?: string;
  suggestion?: string;
}

export interface ContentReviewRun {
  id: string;
  projectId?: string;
  playbookId?: string;
  jobId?: string;
  noteId?: string;
  draftId?: string;
  originalTitle?: string;
  originalBody: string;
  originalTags: string[];
  risk: ContentReviewRisk;
  score: number;
  issues: ContentReviewIssue[];
  revisedTitle: string;
  revisedBody: string;
  revisedTags: string[];
  artifactId?: string;
  modelId?: string;
  source: AiArtifactSource;
  status: AiArtifactStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ContentDraft {
  id: string;
  projectId?: string;
  playbookId?: string;
  jobId?: string;
  title: string;
  body: string;
  tags: string[];
  brief: ContentBrief;
  reviewId?: string;
  artifactId?: string;
  source: AiArtifactSource;
  status: ContentDraftStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ContentReviewResult {
  review: ContentReviewRun;
  artifact: AiArtifact;
}

export interface ContentDraftResult {
  draft: ContentDraft;
  review: ContentReviewRun;
  artifact: AiArtifact;
  reviewArtifact: AiArtifact;
}

export interface ContentDraftBatchResult {
  results: ContentDraftResult[];
}

export interface ContentReviewBatchResult {
  reviews: ContentReviewRun[];
  artifacts: AiArtifact[];
}

export interface ReplyCandidate {
  id: string;
  actionId: string;
  commentId: string;
  noteId: string;
  author?: string;
  content: string;
  likes: number;
  hasSubReplies: boolean;
  isQuestion: boolean;
  matchedStrategy: ReplyStrategy;
  draft: string;
}

export interface ReplyPlanRecord {
  id: string;
  noteId: string;
  webUrl: string;
  noteTitle: string;
  strategy: ReplyStrategy;
  status: ReplyPlanStatus;
  candidates: ReplyCandidate[];
  skipped: number;
  totalComments: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReplyActionRecord {
  id: string;
  planId: string;
  noteId: string;
  webUrl: string;
  commentId: string;
  content: string;
  status: ReplyActionStatus;
  error?: string;
  approvedAt?: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HealthNoteDiagnostic {
  noteId: string;
  title: string;
  level: number;
  levelLabel: string;
  levelColor: "green" | "yellow" | "red" | "gray";
  sensitiveHits: string[];
  tagCount: number;
  tagWarning: boolean;
}

export interface HealthReportRecord {
  id: string;
  jobId: string;
  generatedAt: string;
  totalNotes: number;
  notes: HealthNoteDiagnostic[];
  limitedNotes: HealthNoteDiagnostic[];
  sensitiveNotes: HealthNoteDiagnostic[];
  distribution: Record<string, number>;
}

export interface BoardRecord {
  id: string;
  userId?: string;
  name: string;
  noteCount: number;
  raw?: unknown;
  updatedAt: string;
}

export interface FavoriteNoteRecord {
  id: string;
  userId?: string;
  title: string;
  webUrl: string;
  likedCount: number;
  collectedCount: number;
  commentCount: number;
  raw?: unknown;
  updatedAt: string;
}
