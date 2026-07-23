import type {
  AiArtifact,
  AiGoalRun,
  AiGoalRunCreateInput,
  AiAssistantChatInput,
  AiAssistantChatResponse,
  AiCustomPrompt,
  AiCustomPromptCopyInput,
  AiCustomPromptInput,
  AiCustomPromptPreview,
  AiCustomPromptRevision,
  AiCustomPromptRunInput,
  AiModelConfig,
  AiModelInput,
  AiModelToolsProbeResult,
  AiOrchestration,
  AiOrchestrationCreateInput,
  AiPromptDetail,
  AiPromptGuidedConfig,
  AiPromptInfo,
  AiPromptMode,
  AiPromptPreview,
  AiPromptResetScope,
  AiPromptSource,
  AiReport,
  AiWorkflowDefinition,
  AiWorkflowKey,
  AiWorkflowRunInput,
  AnalyticsReport,
  AuthStatus,
  BrowserBridgeStatus,
  BrowserExtensionPairingStatus,
  StartExtensionPairingInput,
  BrowserAuthSessionInfo,
  BrowserOpenMode,
  BrowserOpenResult,
  ContentDraft,
  ContentDraftBatchInput,
  ContentDraftBatchResult,
  ContentDraftInput,
  ContentDraftResult,
  ContentPlaybook,
  ContentPlaybookInput,
  ContentPlaybookRevision,
  ContentPlaybookStats,
  ContentProject,
  ContentProjectInput,
  ContentProjectMaterial,
  ContentProjectMaterialCategory,
  ContentProjectMaterialInput,
  ContentReviewBatchInput,
  ContentReviewBatchResult,
  ContentReviewInput,
  ContentReviewResult,
  CredentialSecurityStatus,
  ContentReviewRun,
  HealthReportRecord,
  NoteBulkDeleteInput,
  NoteBulkDeletePreview,
  NoteBulkDeleteResult,
  NoteMediaRefreshResult,
  NoteScopeClearPreview,
  NoteScopeSummary,
  NoteRecord,
  NotesPageResult,
  RedbookCapability,
  ReplyActionRecord,
  ReplyPlanRecord,
  ReplyStrategy,
  SearchJob,
  SearchJobInput,
  StorageStatus,
  BackupRecord,
  BackupStatus,
  DataRestorePreview,
  PreparedDataRestore,
  MigrationPackageResult,
  LegacyImportPreview,
  LegacyImportResult
} from "../../shared/types.js";

export interface CookieFields {
  a1: string;
  web_session: string;
  webId: string;
}

export type BrowserAuthCaptureResponse = AuthStatus | BrowserAuthSessionInfo;

export async function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
}

export async function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}

export const api = {
  storageStatus: () => apiGet<StorageStatus>("/api/system/storage-status"),
  backupStatus: () => apiGet<BackupStatus>("/api/system/backups"),
  createBackup: () => apiPost<BackupRecord>("/api/system/backups"),
  exportMigrationPackage: (destinationPath: string) =>
    apiPost<MigrationPackageResult>("/api/system/migration-package/export", { destinationPath }),
  previewDataRestore: (source: { kind: "backup"; backupId: string } | { kind: "migration-package"; filePath: string }) =>
    apiPost<DataRestorePreview>("/api/system/data-restore/preview", source),
  prepareDataRestore: (
    source: { kind: "backup"; backupId: string } | { kind: "migration-package"; filePath: string },
    fingerprint: string
  ) => apiPost<PreparedDataRestore>("/api/system/data-restore/prepare", { source, fingerprint }),
  credentialSecurity: () => apiGet<CredentialSecurityStatus>("/api/system/credential-security"),
  retryCredentialSecurity: () => apiPost<CredentialSecurityStatus>("/api/system/credential-security/retry"),
  previewLegacyImport: (sourceDir?: string) =>
    apiPost<LegacyImportPreview>("/api/system/legacy-import/preview", sourceDir ? { sourceDir } : {}),
  executeLegacyImport: (sourceDir: string, fingerprint: string) =>
    apiPost<LegacyImportResult>("/api/system/legacy-import/execute", { sourceDir, fingerprint }),
  authStatus: () => apiGet<AuthStatus>("/api/auth/status"),
  verifyAuth: () => apiPost<AuthStatus>("/api/auth/verify"),
  browserBridgeStatus: () => apiGet<BrowserBridgeStatus>("/api/auth/extension/status"),
  startBrowserExtensionPairing: (input: StartExtensionPairingInput) =>
    apiPost<BrowserExtensionPairingStatus>("/api/auth/extension/pairing/start", input),
  cancelBrowserExtensionPairing: () =>
    apiPost<BrowserExtensionPairingStatus>("/api/auth/extension/pairing/cancel"),
  revokeBrowserExtensionPairing: () =>
    apiDelete<BrowserExtensionPairingStatus>("/api/auth/extension/pairing"),
  saveCookie: (fields: CookieFields) => apiPost<AuthStatus>("/api/auth/cookie", fields),
  autoReadCookie: () => apiPost<AuthStatus>("/api/auth/browser"),
  startAuthBrowserSession: () => apiPost<BrowserAuthSessionInfo>("/api/auth/browser-session"),
  captureAuthBrowserSession: (sessionId: string) =>
    apiPost<BrowserAuthCaptureResponse>(`/api/auth/browser-session/${encodeURIComponent(sessionId)}/capture`),
  closeAuthBrowserSession: (sessionId: string) =>
    apiDelete<BrowserAuthSessionInfo>(`/api/auth/browser-session/${encodeURIComponent(sessionId)}`),
  openBrowserUrl: (input: { url: string; mode?: BrowserOpenMode }) => apiPost<BrowserOpenResult>("/api/browser/open-url", input),
  createJob: (input: SearchJobInput) => apiPost<SearchJob>("/api/search-jobs", input),
  listJobs: () => apiGet<SearchJob[]>("/api/search-jobs"),
  getJob: (jobId: string) => apiGet<SearchJob>(`/api/search-jobs/${jobId}`),
  resumeJob: (jobId: string) => apiPost<SearchJob>(`/api/search-jobs/${jobId}/resume`),
  stopJob: (jobId: string) => apiPost<SearchJob>(`/api/search-jobs/${jobId}/stop`),
  listNotes: (params: URLSearchParams) => apiGet<NotesPageResult>(`/api/notes?${params.toString()}`),
  listNoteScopes: () => apiGet<NoteScopeSummary[]>("/api/note-scopes"),
  getNoteScopeClearPreview: (jobId: string) => apiGet<NoteScopeClearPreview>(`/api/note-scopes/${encodeURIComponent(jobId)}/clear-preview`),
  deleteNote: (noteId: string) => apiDelete<{ deleted: number }>(`/api/notes/${encodeURIComponent(noteId)}`),
  previewDeleteNotes: (input: NoteBulkDeleteInput) => apiPost<NoteBulkDeletePreview>("/api/notes/bulk-delete-preview", input),
  deleteNotesBulk: (input: NoteBulkDeleteInput) => apiPost<NoteBulkDeleteResult>("/api/notes/bulk-delete", input),
  refreshNoteMedia: (noteId: string) => apiPost<NoteMediaRefreshResult>(`/api/notes/${encodeURIComponent(noteId)}/media-refresh`),
  clearNotes: (jobId?: string, deleteAiArtifacts = false) =>
    apiDelete<{ deleted: number }>(
      `/api/notes${jobId ? `?jobId=${encodeURIComponent(jobId)}${deleteAiArtifacts ? "&deleteAiArtifacts=true" : ""}` : ""}`
    ),
  getAnalytics: (jobId: string) => apiGet<AnalyticsReport>(`/api/analytics/${jobId}`),
  capabilities: () => apiGet<RedbookCapability[]>("/api/capabilities"),
  healthCheck: (jobId: string) => apiGet<HealthReportRecord>(`/api/health-check/${jobId}`),
  listReplyPlans: () => apiGet<ReplyPlanRecord[]>("/api/comment-plans"),
  listReplyActions: () => apiGet<ReplyActionRecord[]>("/api/comment-actions"),
  createReplyPlan: (input: { noteId: string; strategy: ReplyStrategy; max: number; template?: string }) =>
    apiPost<ReplyPlanRecord>("/api/comment-plans", input),
  approveReplyAction: (actionId: string, content?: string) =>
    apiPost<ReplyActionRecord>(`/api/comment-actions/${actionId}/approve`, { content }),
  listContentPlaybooks: () => apiGet<ContentPlaybook[]>("/api/content/playbooks"),
  saveContentPlaybook: (input: ContentPlaybookInput, id?: string) =>
    id ? apiPut<ContentPlaybook>(`/api/content/playbooks/${encodeURIComponent(id)}`, input) : apiPost<ContentPlaybook>("/api/content/playbooks", input),
  deleteContentPlaybook: (id: string) => apiDelete<{ deleted: number }>(`/api/content/playbooks/${encodeURIComponent(id)}`),
  listContentPlaybookRevisions: (id: string) =>
    apiGet<ContentPlaybookRevision[]>(`/api/content/playbooks/${encodeURIComponent(id)}/revisions`),
  getContentPlaybookStats: (id: string) =>
    apiGet<ContentPlaybookStats>(`/api/content/playbooks/${encodeURIComponent(id)}/stats`),
  restoreContentPlaybookRevision: (id: string, revisionId: string) =>
    apiPost<ContentPlaybook>(`/api/content/playbooks/${encodeURIComponent(id)}/revisions/${encodeURIComponent(revisionId)}/restore`),
  listContentProjects: () => apiGet<ContentProject[]>("/api/content/projects"),
  saveContentProject: (input: ContentProjectInput, id?: string) =>
    id ? apiPut<ContentProject>(`/api/content/projects/${encodeURIComponent(id)}`, input) : apiPost<ContentProject>("/api/content/projects", input),
  deleteContentProject: (id: string) => apiDelete<{ deleted: number }>(`/api/content/projects/${encodeURIComponent(id)}`),
  listContentProjectMaterials: (projectId: string) =>
    apiGet<ContentProjectMaterial[]>(`/api/content/projects/${encodeURIComponent(projectId)}/materials`),
  saveContentProjectMaterial: (projectId: string, input: Omit<ContentProjectMaterialInput, "projectId">) =>
    apiPost<ContentProjectMaterial>(`/api/content/projects/${encodeURIComponent(projectId)}/materials`, input),
  addContentProjectMaterialsFromNotes: (projectId: string, noteIds: string[], category?: ContentProjectMaterialCategory) =>
    apiPost<ContentProjectMaterial[]>(`/api/content/projects/${encodeURIComponent(projectId)}/materials/from-notes`, { noteIds, category }),
  deleteContentProjectMaterial: (projectId: string, materialId: string) =>
    apiDelete<{ deleted: number }>(`/api/content/projects/${encodeURIComponent(projectId)}/materials/${encodeURIComponent(materialId)}`),
  listContentDrafts: () => apiGet<ContentDraft[]>("/api/content/drafts"),
  generateContentDraft: (input: ContentDraftInput) => apiPost<ContentDraftResult>("/api/content/drafts", input),
  generateContentDraftBatch: (input: ContentDraftBatchInput) => apiPost<ContentDraftBatchResult>("/api/content/drafts/batch", input),
  acceptContentDraftReview: (draftId: string, reviewId?: string) =>
    apiPost<ContentDraft>(`/api/content/drafts/${encodeURIComponent(draftId)}/accept-review`, { reviewId }),
  listContentReviews: () => apiGet<ContentReviewRun[]>("/api/content/reviews"),
  reviewContentDraft: (input: ContentReviewInput) => apiPost<ContentReviewResult>("/api/content/reviews", input),
  reviewContentDraftBatch: (input: ContentReviewBatchInput) => apiPost<ContentReviewBatchResult>("/api/content/reviews/batch", input),
  runContentAssistant: (input: { message: string; projectId?: string; jobId?: string; modelId?: string; playbookId?: string }) =>
    apiPost<AiAssistantChatResponse>("/api/content/assistant/run", input),
  listAiModels: () => apiGet<AiModelConfig[]>("/api/ai/models"),
  saveAiModel: (input: AiModelInput) => apiPost<AiModelConfig>("/api/ai/models", input),
  updateAiModel: (modelId: string, input: Partial<AiModelInput>) =>
    apiPut<AiModelConfig>(`/api/ai/models/${encodeURIComponent(modelId)}`, input),
  deleteAiModel: (modelId: string) => apiDelete<{ deleted: number }>(`/api/ai/models/${encodeURIComponent(modelId)}`),
  setDefaultAiModel: (modelId: string) => apiPost<AiModelConfig>(`/api/ai/models/${encodeURIComponent(modelId)}/default`),
  testAiModel: (modelId: string) => apiPost<{ ok: boolean; message: string }>("/api/ai/models/test", { modelId }),
  probeAiModelTools: (modelId: string) => apiPost<AiModelToolsProbeResult>(`/api/ai/models/${encodeURIComponent(modelId)}/tools-probe`),
  listAiWorkflows: () => apiGet<AiWorkflowDefinition[]>("/api/ai/workflows"),
  listAiCustomPrompts: () => apiGet<AiCustomPrompt[]>("/api/ai/custom-prompts"),
  saveAiCustomPrompt: (input: AiCustomPromptInput, id?: string) =>
    id ? apiPut<AiCustomPrompt>(`/api/ai/custom-prompts/${encodeURIComponent(id)}`, input) : apiPost<AiCustomPrompt>("/api/ai/custom-prompts", input),
  deleteAiCustomPrompt: (id: string) => apiDelete<{ deleted: number }>(`/api/ai/custom-prompts/${encodeURIComponent(id)}`),
  copyAiPromptToCustom: (input: AiCustomPromptCopyInput) => apiPost<AiCustomPrompt>("/api/ai/custom-prompts/from-system", input),
  listAiCustomPromptRevisions: (id: string) =>
    apiGet<AiCustomPromptRevision[]>(`/api/ai/custom-prompts/${encodeURIComponent(id)}/revisions`),
  restoreAiCustomPromptRevision: (id: string, revisionId: string) =>
    apiPost<AiCustomPrompt>(`/api/ai/custom-prompts/${encodeURIComponent(id)}/revisions/${encodeURIComponent(revisionId)}/restore`),
  previewAiCustomPrompt: (id: string, input: Omit<AiCustomPromptRunInput, "promptId">) =>
    apiPost<AiCustomPromptPreview>(`/api/ai/custom-prompts/${encodeURIComponent(id)}/preview`, input),
  runAiCustomPrompt: (id: string, input: Omit<AiCustomPromptRunInput, "promptId">) =>
    apiPost<AiArtifact>(`/api/ai/custom-prompts/${encodeURIComponent(id)}/run`, input),
  listAiPrompts: () => apiGet<AiPromptInfo[]>("/api/ai/prompts"),
  getAiPrompt: (key: AiWorkflowKey) => apiGet<AiPromptDetail>(`/api/ai/prompts/${key}`),
  saveAiPrompt: (key: AiWorkflowKey, customTemplate: string) => apiPut<AiPromptDetail>(`/api/ai/prompts/${key}`, { customTemplate }),
  saveAiPromptGuided: (key: AiWorkflowKey, config: AiPromptGuidedConfig, activate?: boolean) =>
    apiPut<AiPromptDetail>(`/api/ai/prompts/${key}/guided`, { config, activate }),
  saveAiPromptAdvanced: (key: AiWorkflowKey, template: string, activate?: boolean) =>
    apiPut<AiPromptDetail>(`/api/ai/prompts/${key}/advanced`, { template, activate }),
  resetAiPrompt: (key: AiWorkflowKey, scope?: AiPromptResetScope) =>
    apiPost<AiPromptDetail>(`/api/ai/prompts/${key}/reset`, scope ? { scope } : undefined),
  activateAiPrompt: (key: AiWorkflowKey, source: AiPromptSource) => apiPost<AiPromptDetail>(`/api/ai/prompts/${key}/activate`, { source }),
  activateAiPromptMode: (key: AiWorkflowKey, mode: AiPromptMode) => apiPost<AiPromptDetail>(`/api/ai/prompts/${key}/activate`, { mode }),
  previewAiPrompt: (key: AiWorkflowKey, input: { mode?: AiPromptMode; guidedConfig?: AiPromptGuidedConfig; advancedTemplate?: string; jobId?: string; noteId?: string; noteIds?: string[]; focus?: string }) =>
    apiPost<AiPromptPreview>(`/api/ai/prompts/${key}/preview`, input),
  runAiWorkflow: (input: AiWorkflowRunInput) => apiPost<AiArtifact>("/api/ai/workflows/run", input),
  assistantChat: (input: AiAssistantChatInput) => apiPost<AiAssistantChatResponse>("/api/ai/assistant/chat", input),
  createAiGoalRun: (input: AiGoalRunCreateInput) => apiPost<AiGoalRun>("/api/ai/goal-runs", input),
  planAiGoalRun: (input: AiGoalRunCreateInput) => apiPost<{ goalRun?: AiGoalRun }>("/api/ai/goal-runs/plan", input),
  listAiGoalRuns: () => apiGet<AiGoalRun[]>("/api/ai/goal-runs"),
  getAiGoalRun: (id: string) => apiGet<AiGoalRun>(`/api/ai/goal-runs/${encodeURIComponent(id)}`),
  confirmAiGoalRun: (id: string) => apiPost<AiGoalRun>(`/api/ai/goal-runs/${encodeURIComponent(id)}/confirm`),
  retryAiGoalRun: (id: string) => apiPost<AiGoalRun>(`/api/ai/goal-runs/${encodeURIComponent(id)}/retry`),
  addAiGoalRunSources: (id: string, urls: string[]) => apiPost<AiGoalRun>(`/api/ai/goal-runs/${encodeURIComponent(id)}/sources`, { urls }),
  listAiGoalRunEvidence: (id: string) => apiGet<AiGoalRun["evidence"]>(`/api/ai/goal-runs/${encodeURIComponent(id)}/evidence`),
  listAiGoalRunArtifacts: (id: string) => apiGet<AiArtifact[]>(`/api/ai/goal-runs/${encodeURIComponent(id)}/artifacts`),
  createAiOrchestration: (input: AiOrchestrationCreateInput) => apiPost<AiOrchestration>("/api/ai/orchestrations", input),
  listAiOrchestrations: () => apiGet<AiOrchestration[]>("/api/ai/orchestrations"),
  getAiOrchestration: (id: string) => apiGet<AiOrchestration>(`/api/ai/orchestrations/${encodeURIComponent(id)}`),
  listAiArtifacts: (jobId?: string) => apiGet<AiArtifact[]>(`/api/ai/artifacts${jobId ? `?jobId=${encodeURIComponent(jobId)}` : ""}`),
  getAiArtifact: (artifactId: string) => apiGet<AiArtifact>(`/api/ai/artifacts/${encodeURIComponent(artifactId)}`),
  deleteAiArtifact: (artifactId: string) => apiDelete<{ deleted: number }>(`/api/ai/artifacts/${encodeURIComponent(artifactId)}`),
  listAiReports: (jobId?: string) => apiGet<AiReport[]>(`/api/ai/reports${jobId ? `?jobId=${encodeURIComponent(jobId)}` : ""}`),
  createAiReport: (input: { jobId: string; modelId?: string; title?: string; focus?: string }) =>
    apiPost<AiReport>("/api/ai/reports", input),
  deleteAiReport: (reportId: string) => apiDelete<{ deleted: number }>(`/api/ai/reports/${encodeURIComponent(reportId)}`)
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(path, init);
    return parseResponse<T>(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("后端服务暂时不可用，请确认 npm run dev 已同时启动前端 5173 和后端 8787。");
    }
    throw error;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();
  const data = raw ? parseJson(raw) : {};
  if (!response.ok) {
    const message = typeof data.error === "string" ? data.error : raw.trim();
    if (message) {
      throw new Error(message);
    }
    if (response.status === 500) {
      throw new Error("后端服务暂时不可用，请确认 8787 端口服务已启动。");
    }
    throw new Error(`Request failed: ${response.status}`);
  }
  return data as T;
}

function parseJson(raw: string): { error?: string } {
  try {
    return JSON.parse(raw) as { error?: string };
  } catch {
    return {};
  }
}
