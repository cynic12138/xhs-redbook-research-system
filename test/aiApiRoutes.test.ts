import http from "node:http";
import express, { type Express } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("AI API routes", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("creates an orchestration through the API route", async () => {
    vi.doMock("../src/server/services/aiToolCallingService.js", () => ({
      createAiOrchestrationWithToolsFallback: vi.fn(async (input) => ({
        id: "orch_route",
        instruction: input.instruction,
        keywords: ["路由关键词"],
        modelId: input.modelId,
        steps: [],
        status: "queued",
        artifactIds: [],
        createdAt: "2026-06-24T00:00:00.000Z",
        updatedAt: "2026-06-24T00:00:00.000Z"
      })),
      probeAiModelTools: vi.fn()
    }));
    const app = await createApp();
    const response = await requestJson(app, "/api/ai/orchestrations", {
      method: "POST",
      body: { instruction: "抓取关键词 路由关键词", modelId: "model1" }
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: "orch_route",
      modelId: "model1",
      keywords: ["路由关键词"],
      status: "queued"
    });
  });

  it("probes tool support through the API route", async () => {
    vi.doMock("../src/server/services/aiToolCallingService.js", () => ({
      createAiOrchestrationWithToolsFallback: vi.fn(),
      probeAiModelTools: vi.fn(async (modelId: string) => ({
        ok: true,
        supportsTools: true,
        message: `tools ok for ${modelId}`,
        checkedAt: "2026-06-24T00:00:00.000Z"
      }))
    }));
    const app = await createApp();
    const response = await requestJson(app, "/api/ai/models/model1/tools-probe", { method: "POST" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      supportsTools: true,
      message: "tools ok for model1",
      checkedAt: "2026-06-24T00:00:00.000Z"
    });
  });
});

describe("browser auth API routes", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("marks stored auth as needing verification after server start", async () => {
    vi.doMock("../src/server/utils/env.js", () => ({
      getCookieString: vi.fn(async () => "a1=old; web_session=old"),
      saveCookieString: vi.fn()
    }));
    vi.doMock("../src/server/storage/localStore.js", () => ({
      store: {
        read: vi.fn(async (name: string) => {
          if (name === "authStatus") {
            return { connected: true, configured: true, checkedAt: "2000-01-01T00:00:00.000Z" };
          }
          if (name === "searchJobs") {
            return [];
          }
          return { connected: false, configured: false };
        }),
        write: vi.fn(),
        update: vi.fn()
      }
    }));
    const app = await createApp();
    const response = await requestJson(app, "/api/auth/status", { method: "GET" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      connected: false,
      configured: true,
      needsVerification: true
    });
  });

  it("verifies auth as unconfigured when no local cookie exists", async () => {
    const storeWrite = vi.fn();
    vi.doMock("../src/server/utils/env.js", () => ({
      getCookieString: vi.fn(async () => undefined),
      saveCookieString: vi.fn()
    }));
    vi.doMock("../src/server/storage/localStore.js", () => ({
      store: {
        read: vi.fn(async () => ({ connected: false, configured: false })),
        write: storeWrite,
        update: vi.fn()
      }
    }));
    const app = await createApp();
    const response = await requestJson(app, "/api/auth/verify", { method: "POST" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      connected: false,
      configured: false,
      needsVerification: false
    });
    expect(storeWrite).toHaveBeenCalledWith("authStatus", expect.objectContaining({ connected: false, configured: false }));
  });

  it("starts a dedicated browser auth session", async () => {
    vi.doMock("../src/server/services/browserAuthService.js", () => ({
      browserAuth: {
        startSession: vi.fn(async () => ({
          sessionId: "browser_auth_test",
          status: "waiting",
          loginUrl: "https://www.xiaohongshu.com/",
          message: "waiting for login",
          createdAt: "2026-06-25T00:00:00.000Z",
          updatedAt: "2026-06-25T00:00:00.000Z"
        })),
        captureSession: vi.fn(),
        closeSession: vi.fn()
      }
    }));
    const app = await createApp();
    const response = await requestJson(app, "/api/auth/browser-session", { method: "POST" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      sessionId: "browser_auth_test",
      status: "waiting",
      loginUrl: "https://www.xiaohongshu.com/"
    });
  });

  it("returns waiting capture result without exposing cookies", async () => {
    vi.doMock("../src/server/services/browserAuthService.js", () => ({
      browserAuth: {
        startSession: vi.fn(),
        captureSession: vi.fn(async () => ({
          sessionId: "browser_auth_test",
          status: "waiting",
          loginUrl: "https://www.xiaohongshu.com/",
          message: "missing required cookies",
          missingKeys: ["a1", "web_session"],
          createdAt: "2026-06-25T00:00:00.000Z",
          updatedAt: "2026-06-25T00:00:00.000Z"
        })),
        closeSession: vi.fn()
      }
    }));
    const app = await createApp();
    const response = await requestJson(app, "/api/auth/browser-session/browser_auth_test/capture", { method: "POST" });

    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain("cookieSecret");
    expect(response.body).toMatchObject({
      status: "waiting",
      missingKeys: ["a1", "web_session"]
    });
  });

  it("saves verified capture result as auth status without returning cookie string", async () => {
    const saveCookieString = vi.fn();
    const storeWrite = vi.fn();
    vi.doMock("../src/server/utils/env.js", () => ({
      getCookieString: vi.fn(async () => undefined),
      saveCookieString
    }));
    vi.doMock("../src/server/storage/localStore.js", () => ({
      store: {
        read: vi.fn(async () => ({ connected: false, configured: false })),
        write: storeWrite,
        update: vi.fn()
      }
    }));
    vi.doMock("../src/server/services/browserAuthService.js", () => ({
      browserAuth: {
        startSession: vi.fn(),
        captureSession: vi.fn(async () => ({
          status: "verified",
          cookieString: "a1=cookieSecret; web_session=sessionSecret",
          user: { id: "u1", nickname: "测试用户" },
          session: {
            sessionId: "browser_auth_test",
            status: "verified",
            loginUrl: "https://www.xiaohongshu.com/",
            message: "verified",
            createdAt: "2026-06-25T00:00:00.000Z",
            updatedAt: "2026-06-25T00:00:00.000Z"
          }
        })),
        closeSession: vi.fn()
      }
    }));
    const app = await createApp();
    const response = await requestJson(app, "/api/auth/browser-session/browser_auth_test/capture", { method: "POST" });

    expect(response.status).toBe(200);
    expect(saveCookieString).toHaveBeenCalledWith("a1=cookieSecret; web_session=sessionSecret");
    expect(storeWrite).toHaveBeenCalledWith("authStatus", expect.objectContaining({ connected: true, configured: true }));
    expect(JSON.stringify(response.body)).not.toContain("cookieSecret");
    expect(response.body).toMatchObject({
      connected: true,
      configured: true,
      user: { id: "u1", nickname: "测试用户" }
    });
  });

  it("returns 404 for missing browser auth session", async () => {
    vi.doMock("../src/server/services/browserAuthService.js", () => ({
      browserAuth: {
        startSession: vi.fn(),
        captureSession: vi.fn(async () => {
          throw new Error("登录会话不存在或已关闭。");
        }),
        closeSession: vi.fn()
      }
    }));
    const app = await createApp();
    const response = await requestJson(app, "/api/auth/browser-session/missing/capture", { method: "POST" });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ error: "登录会话不存在或已关闭。" });
  });

  it("closes a browser auth session", async () => {
    vi.doMock("../src/server/services/browserAuthService.js", () => ({
      browserAuth: {
        startSession: vi.fn(),
        captureSession: vi.fn(),
        closeSession: vi.fn(() => ({
          sessionId: "browser_auth_test",
          status: "closed",
          loginUrl: "https://www.xiaohongshu.com/",
          message: "专用登录窗口已关闭。",
          createdAt: "2026-06-25T00:00:00.000Z",
          updatedAt: "2026-06-25T00:00:01.000Z"
        }))
      }
    }));
    const app = await createApp();
    const response = await requestJson(app, "/api/auth/browser-session/browser_auth_test", { method: "DELETE" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      sessionId: "browser_auth_test",
      status: "closed"
    });
  });
});

describe("browser bridge API routes", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("returns browser bridge status", async () => {
    vi.doMock("../src/server/storage/localStore.js", () => ({
      store: {
        read: vi.fn(async (name: string) =>
          name === "browserBridgeStatus"
            ? { connected: true, browser: "edge", permissionStatus: "granted", extensionVersion: "0.1.0" }
            : { connected: false, configured: false }
        ),
        write: vi.fn(),
        update: vi.fn()
      }
    }));
    const app = await createApp();
    const response = await requestJson(app, "/api/auth/extension/status", { method: "GET" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      connected: true,
      browser: "edge",
      permissionStatus: "granted"
    });
  });

  it("saves extension cookie sync without returning cookie values", async () => {
    const saveCookieString = vi.fn();
    const storeWrite = vi.fn();
    vi.doMock("../src/server/utils/env.js", () => ({
      getCookieString: vi.fn(async () => undefined),
      saveCookieString
    }));
    vi.doMock("../src/server/storage/localStore.js", () => ({
      store: {
        read: vi.fn(async () => ({ connected: false, configured: false })),
        write: storeWrite,
        update: vi.fn()
      }
    }));
    vi.doMock("../src/server/services/redbookService.js", () => ({
      redbook: {
        verifyCookie: vi.fn(async () => ({ id: "u1", nickname: "bridge user" })),
        extractChromeCookie: vi.fn()
      }
    }));
    const app = await createApp();
    const response = await requestJson(app, "/api/auth/extension-cookie", {
      method: "POST",
      body: {
        a1: "a1Secret",
        web_session: "sessionSecret",
        webId: "webIdSecret",
        browser: "edge",
        extensionVersion: "0.1.0"
      }
    });

    expect(response.status).toBe(200);
    expect(saveCookieString).toHaveBeenCalledWith("a1=a1Secret; web_session=sessionSecret; webId=webIdSecret");
    expect(storeWrite).toHaveBeenCalledWith("authStatus", expect.objectContaining({ connected: true, configured: true }));
    expect(storeWrite).toHaveBeenCalledWith("browserBridgeStatus", expect.objectContaining({ connected: true, browser: "edge" }));
    expect(JSON.stringify(response.body)).not.toContain("Secret");
  });

  it("opens xiaohongshu URLs through the dedicated browser fallback", async () => {
    const openUrl = vi.fn(async (url: string) => ({
      ok: true,
      mode: "dedicated-edge",
      url,
      message: "opened"
    }));
    vi.doMock("../src/server/services/browserAuthService.js", () => ({
      browserAuth: {
        startSession: vi.fn(),
        captureSession: vi.fn(),
        closeSession: vi.fn(),
        openUrl
      }
    }));
    const app = await createApp();
    const response = await requestJson(app, "/api/browser/open-url", {
      method: "POST",
      body: { url: "https://www.xiaohongshu.com/explore/note1", mode: "auto" }
    });

    expect(response.status).toBe(200);
    expect(openUrl).toHaveBeenCalledWith("https://www.xiaohongshu.com/explore/note1");
    expect(response.body).toMatchObject({ ok: true, mode: "dedicated-edge" });
  });
});

describe("content studio API routes", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("creates a content review through the API route", async () => {
    vi.doMock("../src/server/services/contentStudioService.js", () => ({
      addContentProjectMaterialsFromNotes: vi.fn(),
      deleteContentProject: vi.fn(),
      deleteContentProjectMaterial: vi.fn(),
      listContentPlaybooks: vi.fn(),
      listContentPlaybookRevisions: vi.fn(),
      listContentProjectMaterials: vi.fn(),
      listContentProjects: vi.fn(),
      saveContentPlaybook: vi.fn(),
      deleteContentPlaybook: vi.fn(),
      listContentDrafts: vi.fn(),
      generateContentDraft: vi.fn(),
      listContentReviews: vi.fn(),
      runContentAssistant: vi.fn(),
      saveContentProjectMaterial: vi.fn(),
      saveContentProject: vi.fn(),
      restoreContentPlaybookRevision: vi.fn(),
      reviewContentDraftBatch: vi.fn(async (input) => ({
        reviews: input.items.map((item: { id?: string; title?: string; body: string; tags?: string[] }, index: number) => ({
          id: `review_batch_${index}`,
          originalTitle: item.title,
          originalBody: item.body,
          originalTags: item.tags ?? [],
          risk: index === 0 ? "medium" : "pass",
          score: index === 0 ? 76 : 92,
          issues: [],
          revisedTitle: item.title ?? "修改稿",
          revisedBody: item.body,
          revisedTags: item.tags ?? [],
          source: "local",
          status: "completed",
          artifactId: `artifact_batch_${index}`,
          createdAt: "2026-06-30T00:00:00.000Z",
          updatedAt: "2026-06-30T00:00:00.000Z"
        })),
        artifacts: input.items.map((_item: unknown, index: number) => ({
          id: `artifact_batch_${index}`,
          workflowKey: "draft-review",
          title: "AI 审稿报告",
          markdown: "# AI 审稿报告",
          source: "local",
          status: "completed",
          createdAt: "2026-06-30T00:00:00.000Z",
          updatedAt: "2026-06-30T00:00:00.000Z"
        }))
      })),
      reviewContentDraft: vi.fn(async (input) => ({
        review: {
          id: "review_route",
          originalBody: input.body,
          originalTags: input.tags ?? [],
          risk: "medium",
          score: 76,
          issues: [],
          revisedTitle: input.title ?? "修改稿",
          revisedBody: input.body,
          revisedTags: input.tags ?? [],
          source: "local",
          status: "completed",
          createdAt: "2026-06-30T00:00:00.000Z",
          updatedAt: "2026-06-30T00:00:00.000Z"
        },
        artifact: {
          id: "artifact_review_route",
          workflowKey: "draft-review",
          title: "AI 审稿报告",
          markdown: "# AI 审稿报告",
          source: "local",
          status: "completed",
          createdAt: "2026-06-30T00:00:00.000Z",
          updatedAt: "2026-06-30T00:00:00.000Z"
        }
      }))
    }));
    const app = await createApp();
    const response = await requestJson(app, "/api/content/reviews", {
      method: "POST",
      body: { title: "测试标题", body: "这是一篇需要审稿的小红书笔记。", tags: ["好物"] }
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      review: { id: "review_route", risk: "medium" },
      artifact: { workflowKey: "draft-review" }
    });
  });

  it("creates batch content reviews through the API route", async () => {
    vi.doMock("../src/server/services/contentStudioService.js", () => ({
      addContentProjectMaterialsFromNotes: vi.fn(),
      deleteContentProject: vi.fn(),
      deleteContentProjectMaterial: vi.fn(),
      listContentPlaybooks: vi.fn(),
      listContentPlaybookRevisions: vi.fn(),
      listContentProjectMaterials: vi.fn(),
      listContentProjects: vi.fn(),
      saveContentPlaybook: vi.fn(),
      deleteContentPlaybook: vi.fn(),
      listContentDrafts: vi.fn(),
      generateContentDraft: vi.fn(),
      listContentReviews: vi.fn(),
      runContentAssistant: vi.fn(),
      saveContentProjectMaterial: vi.fn(),
      saveContentProject: vi.fn(),
      reviewContentDraft: vi.fn(),
      restoreContentPlaybookRevision: vi.fn(),
      reviewContentDraftBatch: vi.fn(async (input) => ({
        reviews: input.items.map((item: { title?: string; body: string }, index: number) => ({
          id: `review_batch_${index}`,
          originalTitle: item.title,
          originalBody: item.body,
          originalTags: [],
          risk: "medium",
          score: 80,
          issues: [],
          revisedTitle: item.title ?? "修改稿",
          revisedBody: item.body,
          revisedTags: [],
          source: "local",
          status: "completed",
          artifactId: `artifact_batch_${index}`,
          createdAt: "2026-06-30T00:00:00.000Z",
          updatedAt: "2026-06-30T00:00:00.000Z"
        })),
        artifacts: input.items.map((_item: unknown, index: number) => ({
          id: `artifact_batch_${index}`,
          workflowKey: "draft-review",
          title: "AI 审稿报告",
          markdown: "# AI 审稿报告",
          source: "local",
          status: "completed",
          createdAt: "2026-06-30T00:00:00.000Z",
          updatedAt: "2026-06-30T00:00:00.000Z"
        }))
      }))
    }));
    const app = await createApp();
    const response = await requestJson(app, "/api/content/reviews/batch", {
      method: "POST",
      body: {
        items: [
          { title: "第一篇", body: "这是一篇需要审稿的小红书笔记。" },
          { title: "第二篇", body: "这是另一篇需要审稿的小红书笔记。" }
        ]
      }
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      reviews: [{ id: "review_batch_0" }, { id: "review_batch_1" }],
      artifacts: [{ workflowKey: "draft-review" }, { workflowKey: "draft-review" }]
    });
  });
});

async function createApp(): Promise<Express> {
  const { api } = await import("../src/server/routes/api.js");
  const app = express();
  app.use(express.json());
  app.use("/api", api);
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  });
  return app;
}

async function requestJson(
  app: Express,
  path: string,
  options: { method: "GET" | "POST" | "DELETE"; body?: unknown }
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
