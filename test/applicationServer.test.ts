import express from "express";
import net from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

const pauseActiveJobsOnStartup = vi.fn(async () => undefined);
const resumeActiveJobs = vi.fn(async () => undefined);
const requiresLegacyImport = vi.fn(() => false);
const closeRuntimeStorage = vi.fn();
const getRuntimeStorage = vi.fn(() => ({ requiresLegacyImport }));
const activateApplicationRuntime = vi.fn(async ({ resumeJobs = false }: { resumeJobs?: boolean } = {}) => {
  if (resumeJobs) await resumeActiveJobs();
  else await pauseActiveJobsOnStartup();
});
const deactivateApplicationRuntime = vi.fn(async () => undefined);

vi.mock("../src/server/routes/api.js", () => {
  const api = express.Router();
  api.get("/health", (_req, res) => res.json({ ok: true }));
  api.get("/system/credential-security", (_req, res) => res.json({ state: "encrypted" }));
  api.get("/stream", (_req, res) => {
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.write("event: ready\ndata: {}\n\n");
  });
  api.use((_req, res) => res.status(404).json({ error: "API route not found" }));
  return { api };
});

vi.mock("../src/server/services/jobService.js", () => ({
  jobs: { pauseActiveJobsOnStartup, resumeActiveJobs }
}));

vi.mock("../src/server/storage/runtimeStorage.js", () => ({
  closeRuntimeStorage,
  getRuntimeStorage
}));

vi.mock("../src/server/runtime/applicationRuntime.js", () => ({
  activateApplicationRuntime,
  deactivateApplicationRuntime
}));

afterEach(() => {
  vi.clearAllMocks();
  requiresLegacyImport.mockReturnValue(false);
  getRuntimeStorage.mockImplementation(() => ({ requiresLegacyImport }));
});

describe("application server", () => {
  it("starts the reusable application on localhost and closes it cleanly", async () => {
    const { startApplicationServer } = await import("../src/server/application.js");
    const running = await startApplicationServer({ port: 0, resumeJobs: false });
    try {
      expect(running.host).toBe("127.0.0.1");
      expect(running.port).toBeGreaterThan(0);
      expect(running.url).toBe(`http://127.0.0.1:${running.port}`);
      expect(await fetch(`${running.url}/api/health`).then((response) => response.json())).toEqual({ ok: true });
      expect(pauseActiveJobsOnStartup).toHaveBeenCalledOnce();
      expect(resumeActiveJobs).not.toHaveBeenCalled();
      expect(activateApplicationRuntime).toHaveBeenCalledWith({ resumeJobs: false });
    } finally {
      await running.close();
    }
    expect(deactivateApplicationRuntime).toHaveBeenCalledOnce();
  });

  it("resumes jobs only when explicitly requested", async () => {
    const { startApplicationServer } = await import("../src/server/application.js");
    const running = await startApplicationServer({ port: 0, resumeJobs: true });
    try {
      expect(resumeActiveJobs).toHaveBeenCalledOnce();
      expect(pauseActiveJobsOnStartup).not.toHaveBeenCalled();
    } finally {
      await running.close();
    }
  });

  it("fails startup when SQLite initialization fails instead of opening a broken app", async () => {
    getRuntimeStorage.mockImplementationOnce(() => {
      throw new Error("database migration failed");
    });
    const { startApplicationServer } = await import("../src/server/application.js");

    await expect(startApplicationServer({ port: 0, resumeJobs: false })).rejects.toThrow("database migration failed");
    expect(pauseActiveJobsOnStartup).not.toHaveBeenCalled();
    expect(resumeActiveJobs).not.toHaveBeenCalled();
  });

  it("propagates startup job preparation failures and releases the opened storage", async () => {
    pauseActiveJobsOnStartup.mockRejectedValueOnce(new Error("pause preparation failed"));
    const { startApplicationServer } = await import("../src/server/application.js");

    await expect(startApplicationServer({ port: 0, resumeJobs: false })).rejects.toThrow("pause preparation failed");
    expect(closeRuntimeStorage).toHaveBeenCalledOnce();
    expect(activateApplicationRuntime).toHaveBeenCalledOnce();
  });

  it("returns JSON for unknown API routes", async () => {
    const { startApplicationServer } = await import("../src/server/application.js");
    const running = await startApplicationServer({ port: 0, resumeJobs: false });
    try {
      const response = await fetch(`${running.url}/api/missing`);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "API route not found" });
    } finally {
      await running.close();
    }
  });

  it("blocks every business API method while legacy data still requires import", async () => {
    requiresLegacyImport.mockReturnValue(true);
    const { startApplicationServer } = await import("../src/server/application.js");
    const running = await startApplicationServer({ port: 0, resumeJobs: false });
    try {
      const response = await fetch(`${running.url}/api/health`);
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ error: expect.stringContaining("旧版 JSON") });
      expect(pauseActiveJobsOnStartup).not.toHaveBeenCalled();
      expect(resumeActiveJobs).not.toHaveBeenCalled();
      expect(activateApplicationRuntime).not.toHaveBeenCalled();
    } finally {
      await running.close();
    }
  });

  it("keeps credential security status available while legacy data requires import", async () => {
    requiresLegacyImport.mockReturnValue(true);
    const { startApplicationServer } = await import("../src/server/application.js");
    const running = await startApplicationServer({ port: 0, resumeJobs: false });
    try {
      const response = await fetch(`${running.url}/api/system/credential-security`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ state: "encrypted" });
    } finally {
      await running.close();
    }
  });

  it("closes active streaming connections during desktop shutdown", async () => {
    const { startApplicationServer } = await import("../src/server/application.js");
    const running = await startApplicationServer({ port: 0, resumeJobs: false });
    const response = await fetch(`${running.url}/api/stream`);
    const closing = running.close();
    const result = await Promise.race([
      closing.then(() => "closed" as const),
      new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 100))
    ]);

    if (result === "timeout") {
      await response.body?.cancel();
      await closing;
    }
    expect(result).toBe("closed");
  });

  it("explains a port conflict in Chinese while preserving EADDRINUSE as the cause", async () => {
    const blocker = net.createServer();
    await new Promise<void>((resolve, reject) => {
      blocker.once("error", reject);
      blocker.listen(0, "127.0.0.1", resolve);
    });
    const address = blocker.address();
    if (!address || typeof address === "string") throw new Error("test port was not allocated");

    try {
      const { startApplicationServer } = await import("../src/server/application.js");
      const failure = await startApplicationServer({ port: address.port, resumeJobs: false }).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(Error);
      expect((failure as Error).message).toContain(`端口 ${address.port} 已被占用`);
      expect(((failure as Error & { cause?: { code?: string } }).cause)?.code).toBe("EADDRINUSE");
      expect(pauseActiveJobsOnStartup).not.toHaveBeenCalled();
      expect(activateApplicationRuntime).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve, reject) => blocker.close((error) => error ? reject(error) : resolve()));
    }
  });
});
