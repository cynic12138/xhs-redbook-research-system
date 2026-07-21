import http from "node:http";
import express, { type Express } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("API route contracts", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("keeps the notes list query contract stable", async () => {
    const listNotesPage = vi.fn(async () => ({
      items: [],
      total: 0,
      page: 3,
      pageSize: 25,
      totalPages: 1
    }));
    mockRouteDependencies({ queryService: { listNotesPage } });
    const app = await createApp();
    const response = await requestJson(
      app,
      "/api/notes?jobId=job_1&jobIds=job_1,job_2&q=蜂蜜露&type=video&author=作者&minLikes=50&sort=latest&page=3&pageSize=25",
      { method: "GET" }
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [],
      total: 0,
      page: 3,
      pageSize: 25,
      totalPages: 1
    });
    expect(listNotesPage).toHaveBeenCalledWith(
      {
        jobId: "job_1",
        jobIds: ["job_1", "job_2"],
        q: "蜂蜜露",
        type: "video",
        author: "作者",
        minLikes: 50,
        sort: "latest"
      },
      3,
      25
    );
  });

  it("keeps the missing note detail contract stable", async () => {
    mockRouteDependencies({ queryService: { getNoteDetail: vi.fn(async () => undefined) } });
    const app = await createApp();
    const response = await requestJson(app, "/api/notes/missing_note", { method: "GET" });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Note not found" });
  });

  it("keeps the bulk note delete preview contract stable", async () => {
    const getBulkNotesDeletePreview = vi.fn(async () => ({
      noteIds: ["note_a", "note_b"],
      jobId: "job_1",
      mode: "scope-detach",
      affectedNotes: 2,
      detachedNotes: 1,
      orphanNotes: 1,
      commentsToDelete: 3,
      analysisReportsToDelete: 1
    }));
    mockRouteDependencies({ queryService: { getBulkNotesDeletePreview } });
    const app = await createApp();
    const response = await requestJson(app, "/api/notes/bulk-delete-preview", {
      method: "POST",
      body: { noteIds: ["note_a", "note_b"], jobId: "job_1" }
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      noteIds: ["note_a", "note_b"],
      jobId: "job_1",
      mode: "scope-detach",
      affectedNotes: 2,
      detachedNotes: 1,
      orphanNotes: 1,
      commentsToDelete: 3,
      analysisReportsToDelete: 1
    });
    expect(getBulkNotesDeletePreview).toHaveBeenCalledWith({ noteIds: ["note_a", "note_b"], jobId: "job_1" });
  });

  it("keeps content playbook CRUD status codes and bodies stable", async () => {
    const playbook = {
      id: "playbook_contract",
      name: "规则 A",
      productName: "产品 A",
      category: "小红书种草",
      forbiddenTerms: [],
      sensitiveClaims: [],
      allowedSellingPoints: [],
      requiredSections: [],
      toneWords: [],
      personas: [],
      scenarios: [],
      tags: [],
      replacements: [],
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z"
    };
    const saveContentPlaybook = vi.fn(async (input, id?: string) => ({ ...playbook, ...input, id: id ?? playbook.id }));
    const deleteContentPlaybook = vi.fn(async () => ({ deleted: 1 }));
    mockRouteDependencies({
      contentStudioService: {
        listContentPlaybooks: vi.fn(async () => [playbook]),
        saveContentPlaybook,
        deleteContentPlaybook
      }
    });
    const app = await createApp();

    const listResponse = await requestJson(app, "/api/content/playbooks", { method: "GET" });
    const createResponse = await requestJson(app, "/api/content/playbooks", {
      method: "POST",
      body: { name: "规则 B", productName: "产品 B" }
    });
    const updateResponse = await requestJson(app, "/api/content/playbooks/playbook_existing", {
      method: "PUT",
      body: { name: "规则 C", productName: "产品 C" }
    });
    const deleteResponse = await requestJson(app, "/api/content/playbooks/playbook_existing", { method: "DELETE" });

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual([playbook]);
    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toMatchObject({ id: "playbook_contract", name: "规则 B", productName: "产品 B" });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toMatchObject({ id: "playbook_existing", name: "规则 C", productName: "产品 C" });
    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toEqual({ deleted: 1 });
    expect(saveContentPlaybook).toHaveBeenNthCalledWith(1, expect.objectContaining({ name: "规则 B", productName: "产品 B" }));
    expect(saveContentPlaybook).toHaveBeenNthCalledWith(2, expect.objectContaining({ name: "规则 C", productName: "产品 C" }), "playbook_existing");
    expect(deleteContentPlaybook).toHaveBeenCalledWith("playbook_existing");
  });

  it("keeps content playbook revision routes stable", async () => {
    const playbook = {
      id: "playbook_contract",
      name: "规则 A",
      productName: "产品 A",
      category: "小红书种草",
      forbiddenTerms: ["封神"],
      sensitiveClaims: ["治疗"],
      allowedSellingPoints: [],
      requiredSections: [],
      toneWords: [],
      personas: [],
      scenarios: [],
      tags: [],
      replacements: [],
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z"
    };
    const revisions = [{
      id: "playbook_rev_contract",
      playbookId: playbook.id,
      snapshot: playbook,
      createdAt: "2026-07-01T01:00:00.000Z"
    }];
    const listContentPlaybookRevisions = vi.fn(async () => revisions);
    const restoreContentPlaybookRevision = vi.fn(async () => playbook);
    mockRouteDependencies({
      contentStudioService: {
        listContentPlaybookRevisions,
        restoreContentPlaybookRevision
      }
    });
    const app = await createApp();

    const listResponse = await requestJson(app, "/api/content/playbooks/playbook_contract/revisions", { method: "GET" });
    const restoreResponse = await requestJson(app, "/api/content/playbooks/playbook_contract/revisions/playbook_rev_contract/restore", { method: "POST" });

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual(revisions);
    expect(restoreResponse.status).toBe(200);
    expect(restoreResponse.body).toEqual(playbook);
    expect(listContentPlaybookRevisions).toHaveBeenCalledWith("playbook_contract");
    expect(restoreContentPlaybookRevision).toHaveBeenCalledWith("playbook_contract", "playbook_rev_contract");
  });

  it("keeps content playbook stats route stable", async () => {
    const stats = {
      playbookId: "playbook_contract",
      reviewCount: 1,
      issueCount: 2,
      highRiskCount: 1,
      passCount: 0,
      topCategories: [{ category: "敏感功效", count: 1 }],
      recentIssues: []
    };
    const getContentPlaybookStats = vi.fn(async () => stats);
    mockRouteDependencies({ contentStudioService: { getContentPlaybookStats } });
    const app = await createApp();

    const response = await requestJson(app, "/api/content/playbooks/playbook_contract/stats", { method: "GET" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(stats);
    expect(getContentPlaybookStats).toHaveBeenCalledWith("playbook_contract");
  });

  it("keeps content project CRUD status codes and bodies stable", async () => {
    const project = {
      id: "content_project_contract",
      name: "蜂蜜露种草项目",
      productName: "蜂蜜露",
      targetAudience: ["孕妈"],
      scenarios: ["出门携带"],
      goals: ["生成多篇笔记"],
      playbookId: "playbook_contract",
      jobId: "job_contract",
      status: "writing",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z"
    };
    const saveContentProject = vi.fn(async (input, id?: string) => ({ ...project, ...input, id: id ?? project.id }));
    const deleteContentProject = vi.fn(async () => ({ deleted: 1 }));
    mockRouteDependencies({
      contentStudioService: {
        listContentProjects: vi.fn(async () => [project]),
        saveContentProject,
        deleteContentProject
      }
    });
    const app = await createApp();

    const listResponse = await requestJson(app, "/api/content/projects", { method: "GET" });
    const createResponse = await requestJson(app, "/api/content/projects", {
      method: "POST",
      body: { name: "项目 B", productName: "产品 B", status: "planning" }
    });
    const updateResponse = await requestJson(app, "/api/content/projects/content_project_existing", {
      method: "PUT",
      body: { name: "项目 C", productName: "产品 C", status: "reviewing" }
    });
    const deleteResponse = await requestJson(app, "/api/content/projects/content_project_existing", { method: "DELETE" });

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual([project]);
    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toMatchObject({ id: "content_project_contract", name: "项目 B", productName: "产品 B" });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toMatchObject({ id: "content_project_existing", name: "项目 C", status: "reviewing" });
    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toEqual({ deleted: 1 });
    expect(saveContentProject).toHaveBeenNthCalledWith(1, expect.objectContaining({ name: "项目 B", productName: "产品 B" }));
    expect(saveContentProject).toHaveBeenNthCalledWith(2, expect.objectContaining({ name: "项目 C", productName: "产品 C" }), "content_project_existing");
    expect(deleteContentProject).toHaveBeenCalledWith("content_project_existing");
  });

  it("keeps content project material route contracts stable", async () => {
    const material = {
      id: "content_material_contract",
      projectId: "content_project_contract",
      source: "note",
      sourceId: "note_contract",
      category: "general",
      title: "素材标题",
      content: "素材正文",
      tags: ["好物"],
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z"
    };
    const listContentProjectMaterials = vi.fn(async () => [material]);
    const saveContentProjectMaterial = vi.fn(async (input) => ({ ...material, ...input, id: material.id }));
    const addContentProjectMaterialsFromNotes = vi.fn(async () => [material]);
    const deleteContentProjectMaterial = vi.fn(async () => ({ deleted: 1 }));
    mockRouteDependencies({
      contentStudioService: {
        listContentProjectMaterials,
        saveContentProjectMaterial,
        addContentProjectMaterialsFromNotes,
        deleteContentProjectMaterial
      }
    });
    const app = await createApp();

    const listResponse = await requestJson(app, "/api/content/projects/content_project_contract/materials", { method: "GET" });
    const createResponse = await requestJson(app, "/api/content/projects/content_project_contract/materials", {
      method: "POST",
      body: { title: "手动素材", content: "手动正文", category: "pain" }
    });
    const fromNotesResponse = await requestJson(app, "/api/content/projects/content_project_contract/materials/from-notes", {
      method: "POST",
      body: { noteIds: ["note_contract"], category: "scenario" }
    });
    const deleteResponse = await requestJson(app, "/api/content/projects/content_project_contract/materials/content_material_contract", { method: "DELETE" });

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual([material]);
    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toMatchObject({ projectId: "content_project_contract", title: "手动素材", category: "pain" });
    expect(fromNotesResponse.status).toBe(201);
    expect(fromNotesResponse.body).toEqual([material]);
    expect(deleteResponse.body).toEqual({ deleted: 1 });
    expect(listContentProjectMaterials).toHaveBeenCalledWith("content_project_contract");
    expect(addContentProjectMaterialsFromNotes).toHaveBeenCalledWith("content_project_contract", ["note_contract"], "scenario");
    expect(deleteContentProjectMaterial).toHaveBeenCalledWith("content_project_contract", "content_material_contract");
  });

  it("keeps content draft batch generation route stable", async () => {
    const generateContentDraftBatch = vi.fn(async () => ({ results: [] }));
    mockRouteDependencies({ contentStudioService: { generateContentDraftBatch } });
    const app = await createApp();

    const response = await requestJson(app, "/api/content/drafts/batch", {
      method: "POST",
      body: {
        projectId: "content_project_contract",
        count: 2,
        brief: {
          productName: "蜂蜜露",
          persona: "孕妈",
          painPoint: "出门不方便",
          scenario: "出门携带",
          channel: "朋友推荐",
          sellingPoints: ["掌心大小"],
          tone: "真实分享",
          length: "short",
          keywords: ["日常分享"]
        }
      }
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ results: [] });
    expect(generateContentDraftBatch).toHaveBeenCalledWith(expect.objectContaining({ projectId: "content_project_contract", count: 2 }));
  });

  it("keeps content draft accept-review route stable", async () => {
    const accepted = {
      id: "draft_contract",
      title: "修改稿标题",
      body: "修改稿正文",
      tags: ["好物"],
      brief: {
        productName: "蜂蜜露",
        persona: "孕妈",
        painPoint: "出门不方便",
        scenario: "出门携带",
        channel: "朋友推荐",
        sellingPoints: [],
        tone: "真实分享",
        length: "short",
        keywords: []
      },
      source: "local",
      status: "finalized",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z"
    };
    const acceptContentDraftReview = vi.fn(async () => accepted);
    mockRouteDependencies({ contentStudioService: { acceptContentDraftReview } });
    const app = await createApp();

    const response = await requestJson(app, "/api/content/drafts/draft_contract/accept-review", {
      method: "POST",
      body: { reviewId: "review_contract" }
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(accepted);
    expect(acceptContentDraftReview).toHaveBeenCalledWith("draft_contract", "review_contract");
  });

  it("keeps content playbook validation errors on the shared 400 error contract", async () => {
    const saveContentPlaybook = vi.fn();
    mockRouteDependencies({ contentStudioService: { saveContentPlaybook } });
    const app = await createApp();
    const response = await requestJson(app, "/api/content/playbooks", {
      method: "POST",
      body: { name: "缺少产品" }
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("error");
    expect(saveContentPlaybook).not.toHaveBeenCalled();
  });

  it("keeps AI orchestration message-to-instruction routing stable", async () => {
    const createAiOrchestrationWithToolsFallback = vi.fn(async (input) => ({
      id: "orch_contract",
      instruction: input.instruction,
      keywords: input.keywords ?? [],
      modelId: input.modelId,
      steps: [],
      status: "queued",
      artifactIds: [],
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z"
    }));
    mockRouteDependencies({ aiToolCallingService: { createAiOrchestrationWithToolsFallback } });
    const app = await createApp();
    const response = await requestJson(app, "/api/ai/orchestrations", {
      method: "POST",
      body: { message: "抓取关键词 蜂蜜露", keywords: ["蜂蜜露"], modelId: "model_contract" }
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: "orch_contract",
      instruction: "抓取关键词 蜂蜜露",
      keywords: ["蜂蜜露"],
      modelId: "model_contract",
      status: "queued"
    });
    expect(createAiOrchestrationWithToolsFallback).toHaveBeenCalledWith({
      instruction: "抓取关键词 蜂蜜露",
      keywords: ["蜂蜜露"],
      modelId: "model_contract"
    });
  });

  it("passes multi-note AI workflow inputs through the API route", async () => {
    const runAiWorkflow = vi.fn(async (input) => ({
      id: "artifact_contract",
      workflowKey: input.workflowKey,
      jobId: input.jobId,
      noteIds: input.noteIds,
      title: "多篇爆款对比拆解",
      markdown: "# 多篇爆款对比拆解",
      source: "local",
      status: "completed",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z"
    }));
    mockRouteDependencies({ aiService: { runAiWorkflow } });
    const app = await createApp();
    const response = await requestJson(app, "/api/ai/workflows/run", {
      method: "POST",
      body: {
        workflowKey: "viral-batch-deep-dive",
        jobId: "job_contract",
        noteIds: ["note_a", "note_b"],
        focus: "对比共同结构"
      }
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      workflowKey: "viral-batch-deep-dive",
      noteIds: ["note_a", "note_b"]
    });
    expect(runAiWorkflow).toHaveBeenCalledWith({
      workflowKey: "viral-batch-deep-dive",
      jobId: "job_contract",
      noteIds: ["note_a", "note_b"],
      focus: "对比共同结构"
    });
  });
});

function mockRouteDependencies(overrides: {
  queryService?: Record<string, unknown>;
  contentStudioService?: Record<string, unknown>;
  aiToolCallingService?: Record<string, unknown>;
  aiService?: Record<string, unknown>;
} = {}) {
  vi.doMock("../src/server/services/commentOps.js", () => ({
    approveReplyAction: vi.fn(),
    createReplyPlan: vi.fn(),
    listReplyActions: vi.fn(async () => []),
    listReplyPlans: vi.fn(async () => []),
    startReplyWorker: vi.fn()
  }));
  vi.doMock("../src/server/services/jobService.js", () => ({
    jobs: {
      createJob: vi.fn(),
      getJob: vi.fn(),
      listJobs: vi.fn(async () => []),
      resume: vi.fn(),
      stop: vi.fn()
    }
  }));
  vi.doMock("../src/server/services/queryService.js", () => ({
    buildExport: vi.fn(),
    clearNotes: vi.fn(async () => ({ deleted: 0 })),
    deleteNote: vi.fn(async () => ({ deleted: 0 })),
    deleteNotesBulk: vi.fn(async () => ({ deleted: 0, detached: 0 })),
    getAnalytics: vi.fn(),
    getBulkNotesDeletePreview: vi.fn(async () => ({
      noteIds: [],
      mode: "global-delete",
      affectedNotes: 0,
      detachedNotes: 0,
      orphanNotes: 0,
      commentsToDelete: 0,
      analysisReportsToDelete: 0
    })),
    getNoteDetail: vi.fn(),
    getNoteScopeClearPreview: vi.fn(),
    listNoteScopes: vi.fn(async () => []),
    listNotes: vi.fn(async () => []),
    listNotesPage: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 })),
    ...overrides.queryService
  }));
  vi.doMock("../src/server/services/contentStudioService.js", () => ({
    acceptContentDraftReview: vi.fn(),
    addContentProjectMaterialsFromNotes: vi.fn(async () => []),
    deleteContentProject: vi.fn(async () => ({ deleted: 0 })),
    deleteContentProjectMaterial: vi.fn(async () => ({ deleted: 0 })),
    deleteContentPlaybook: vi.fn(async () => ({ deleted: 0 })),
    generateContentDraft: vi.fn(),
    generateContentDraftBatch: vi.fn(),
    getContentPlaybookStats: vi.fn(async () => ({
      playbookId: "",
      reviewCount: 0,
      issueCount: 0,
      highRiskCount: 0,
      passCount: 0,
      topCategories: [],
      recentIssues: []
    })),
    listContentDrafts: vi.fn(async () => []),
    listContentPlaybooks: vi.fn(async () => []),
    listContentPlaybookRevisions: vi.fn(async () => []),
    listContentProjectMaterials: vi.fn(async () => []),
    listContentProjects: vi.fn(async () => []),
    listContentReviews: vi.fn(async () => []),
    reviewContentDraft: vi.fn(),
    reviewContentDraftBatch: vi.fn(),
    restoreContentPlaybookRevision: vi.fn(),
    runContentAssistant: vi.fn(),
    saveContentProjectMaterial: vi.fn(),
    saveContentProject: vi.fn(),
    saveContentPlaybook: vi.fn(),
    ...overrides.contentStudioService
  }));
  vi.doMock("../src/server/services/aiToolCallingService.js", () => ({
    createAiOrchestrationWithToolsFallback: vi.fn(),
    probeAiModelTools: vi.fn(),
    ...overrides.aiToolCallingService
  }));
  vi.doMock("../src/server/services/aiOrchestratorService.js", () => ({
    getAiOrchestration: vi.fn(),
    listAiOrchestrations: vi.fn(async () => [])
  }));
  vi.doMock("../src/server/services/aiService.js", () => ({
    activateAiPrompt: vi.fn(),
    chatWithAssistant: vi.fn(),
    createAiReport: vi.fn(),
    deleteAiArtifact: vi.fn(),
    deleteAiModel: vi.fn(),
    deleteAiReport: vi.fn(),
    getAiArtifact: vi.fn(),
    getAiPromptDetail: vi.fn(),
    getAiReport: vi.fn(),
    listAiArtifacts: vi.fn(async () => []),
    listAiModels: vi.fn(async () => []),
    listAiPrompts: vi.fn(async () => []),
    listAiReports: vi.fn(async () => []),
    listAiWorkflows: vi.fn(() => []),
    resetAiPromptConfig: vi.fn(),
    runAiWorkflow: vi.fn(),
    saveAiModel: vi.fn(),
    saveAiPromptConfig: vi.fn(),
    setDefaultAiModel: vi.fn(),
    testAiModel: vi.fn(),
    updateAiModel: vi.fn(),
    ...overrides.aiService
  }));
  vi.doMock("../src/server/services/redbookService.js", () => ({
    redbook: {
      extractChromeCookie: vi.fn(),
      feed: vi.fn(),
      verifyCookie: vi.fn()
    }
  }));
  vi.doMock("../src/server/services/browserAuthService.js", () => ({
    browserAuth: {
      captureSession: vi.fn(),
      closeSession: vi.fn(),
      openUrl: vi.fn(),
      startSession: vi.fn()
    }
  }));
  vi.doMock("../src/server/services/authState.js", () => ({
    isAuthRisk: vi.fn(() => false),
    markAuthDisconnected: vi.fn()
  }));
  vi.doMock("../src/server/services/healthService.js", () => ({ buildHealthCheck: vi.fn() }));
  vi.doMock("../src/server/services/mediaService.js", () => ({ proxyMedia: vi.fn(), refreshNoteMedia: vi.fn() }));
  vi.doMock("../src/server/services/capabilities.js", () => ({ redbookCapabilities: [] }));
  vi.doMock("../src/server/runtime/runtimeCredentialVault.js", () => ({
    readRuntimeCredential: vi.fn(async () => undefined),
    resolveRuntimeCredentialVault: vi.fn(async () => ({
      get: vi.fn(async () => undefined),
      set: vi.fn()
    }))
  }));
  vi.doMock("../src/server/storage/localStore.js", () => ({
    store: {
      read: vi.fn(async (name: string) => {
        if (name === "authStatus") return { connected: false, configured: false };
        if (name === "browserBridgeStatus") return { connected: false, browser: "unknown", permissionStatus: "unknown" };
        return [];
      }),
      update: vi.fn(async (_name: string, updater: (value: unknown[]) => unknown[]) => updater([])),
      write: vi.fn()
    }
  }));
}

async function createApp(): Promise<Express> {
  const { api } = await import("../src/server/routes/api.js");
  const app = express();
  app.use(express.json());
  app.use("/api", api);
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  });
  return app;
}

async function requestJson(
  app: Express,
  path: string,
  options: { method: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown }
): Promise<{ status: number; body: unknown }> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Test server did not expose a port.");
  }
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method: options.method,
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    return {
      status: response.status,
      body: await response.json()
    };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}
