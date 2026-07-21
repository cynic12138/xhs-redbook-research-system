import express from "express";
import net from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

const pauseActiveJobsOnStartup = vi.fn(async () => undefined);
const resumeActiveJobs = vi.fn(async () => undefined);

vi.mock("../src/server/routes/api.js", () => {
  const api = express.Router();
  api.get("/health", (_req, res) => res.json({ ok: true }));
  api.use((_req, res) => res.status(404).json({ error: "API route not found" }));
  return { api };
});

vi.mock("../src/server/services/jobService.js", () => ({
  jobs: { pauseActiveJobsOnStartup, resumeActiveJobs }
}));

afterEach(() => {
  vi.clearAllMocks();
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
    } finally {
      await running.close();
    }
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
    } finally {
      await new Promise<void>((resolve, reject) => blocker.close((error) => error ? reject(error) : resolve()));
    }
  });
});
