import type {
  AnalyticsReport,
  AiArtifact,
  AiGoalRun,
  AiAssistantMessage,
  AiCustomPrompt,
  AiCustomPromptRevision,
  AiModelConfig,
  AiOrchestration,
  AiPromptConfig,
  AiReport,
  AuthStatus,
  AuthorPostRecord,
  AuthorRecord,
  BrowserBridgeStatus,
  BoardRecord,
  CommentRecord,
  ContentDraft,
  ContentPlaybook,
  ContentPlaybookRevision,
  ContentProject,
  ContentProjectMaterial,
  ContentReviewRun,
  FavoriteNoteRecord,
  HealthReportRecord,
  NoteRecord,
  QueueItem,
  ReplyActionRecord,
  ReplyPlanRecord,
  SearchJob
} from "../../shared/types.js";

export const collectionNames = [
  "authStatus",
  "browserBridgeStatus",
  "searchJobs",
  "queueItems",
  "notes",
  "comments",
  "authors",
  "authorPosts",
  "analysisReports",
  "aiModels",
  "aiReports",
  "aiArtifacts",
  "aiPromptConfigs",
  "aiCustomPrompts",
  "aiCustomPromptRevisions",
  "aiOrchestrations",
  "aiGoalRuns",
  "aiMessages",
  "replyPlans",
  "replyActions",
  "healthReports",
  "boards",
  "favoriteNotes",
  "contentPlaybooks",
  "contentPlaybookRevisions",
  "contentProjects",
  "contentProjectMaterials",
  "contentDrafts",
  "contentReviews",
  "rateLimit"
] as const;

export type CollectionName = (typeof collectionNames)[number];

export interface CollectionValue {
  authStatus: AuthStatus;
  browserBridgeStatus: BrowserBridgeStatus;
  searchJobs: SearchJob[];
  queueItems: QueueItem[];
  notes: NoteRecord[];
  comments: CommentRecord[];
  authors: AuthorRecord[];
  authorPosts: AuthorPostRecord[];
  analysisReports: AnalyticsReport[];
  aiModels: AiModelConfig[];
  aiReports: AiReport[];
  aiArtifacts: AiArtifact[];
  aiPromptConfigs: AiPromptConfig[];
  aiCustomPrompts: AiCustomPrompt[];
  aiCustomPromptRevisions: AiCustomPromptRevision[];
  aiOrchestrations: AiOrchestration[];
  aiGoalRuns: AiGoalRun[];
  aiMessages: AiAssistantMessage[];
  replyPlans: ReplyPlanRecord[];
  replyActions: ReplyActionRecord[];
  healthReports: HealthReportRecord[];
  boards: BoardRecord[];
  favoriteNotes: FavoriteNoteRecord[];
  contentPlaybooks: ContentPlaybook[];
  contentPlaybookRevisions: ContentPlaybookRevision[];
  contentProjects: ContentProject[];
  contentProjectMaterials: ContentProjectMaterial[];
  contentDrafts: ContentDraft[];
  contentReviews: ContentReviewRun[];
  rateLimit: {
    budgetDate: string;
    consumedToday: number;
  };
}

const defaults: CollectionValue = {
  authStatus: { connected: false, configured: false },
  browserBridgeStatus: { connected: false, browser: "unknown", permissionStatus: "unknown" },
  searchJobs: [],
  queueItems: [],
  notes: [],
  comments: [],
  authors: [],
  authorPosts: [],
  analysisReports: [],
  aiModels: [],
  aiReports: [],
  aiArtifacts: [],
  aiPromptConfigs: [],
  aiCustomPrompts: [],
  aiCustomPromptRevisions: [],
  aiOrchestrations: [],
  aiGoalRuns: [],
  aiMessages: [],
  replyPlans: [],
  replyActions: [],
  healthReports: [],
  boards: [],
  favoriteNotes: [],
  contentPlaybooks: [],
  contentPlaybookRevisions: [],
  contentProjects: [],
  contentProjectMaterials: [],
  contentDrafts: [],
  contentReviews: [],
  rateLimit: {
    budgetDate: new Date().toISOString().slice(0, 10),
    consumedToday: 0
  }
};

export function getCollectionDefault<K extends CollectionName>(name: K): CollectionValue[K] {
  return structuredClone(defaults[name]);
}

export function createCollectionDefaults(): CollectionValue {
  return structuredClone(defaults);
}

export interface StoreLike {
  read<K extends CollectionName>(name: K): Promise<CollectionValue[K]>;
  write<K extends CollectionName>(name: K, value: CollectionValue[K]): Promise<void>;
  update<K extends CollectionName>(
    name: K,
    updater: (value: CollectionValue[K]) => CollectionValue[K] | Promise<CollectionValue[K]>
  ): Promise<CollectionValue[K]>;
}
