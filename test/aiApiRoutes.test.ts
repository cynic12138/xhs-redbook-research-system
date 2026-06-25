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
  options: { method: "GET" | "POST"; body?: unknown }
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
