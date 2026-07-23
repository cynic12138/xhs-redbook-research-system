import express from "express";
import { describe, expect, it } from "vitest";

describe("runtime quiescence", () => {
  it("blocks new background runs and waits for the active run", async () => {
    const { BackgroundRunGate } = await import("../src/server/runtime/backgroundRunGate.js");
    const gate = new BackgroundRunGate("运行时正在停止。");
    let release!: () => void;
    const active = new Promise<void>((resolve) => {
      release = resolve;
    });
    gate.track("run-1", active);

    const quiescing = gate.quiesce(1_000);
    expect(() => gate.ensureAccepting()).toThrow("运行时正在停止");
    release();
    await expect(quiescing).resolves.toBeUndefined();
    gate.resume();
    expect(() => gate.ensureAccepting()).not.toThrow();
  });

  it("waits for an in-flight mutation and rejects new mutations until resumed", async () => {
    const activity = await import("../src/server/runtime/apiMutationActivity.js");
    activity.resumeApiMutations();
    const app = express();
    app.use(activity.createApiMutationActivityMiddleware());
    let release!: () => void;
    let started!: () => void;
    const didStart = new Promise<void>((resolve) => {
      started = resolve;
    });
    app.post("/api/work", async (_req, res) => {
      started();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      res.json({ ok: true });
    });
    app.get("/api/status-that-may-write", (_req, res) => res.json({ ok: true }));
    app.get("/api/ai/goal-runs/goal-1/events", (_req, res) => res.json({ stream: true }));
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("test server unavailable");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      const activeRequest = fetch(`${baseUrl}/api/work`, { method: "POST" });
      await didStart;
      const quiescing = activity.quiesceApiMutations(1_000);
      const rejected = await fetch(`${baseUrl}/api/work`, { method: "POST" });
      expect(rejected.status).toBe(409);
      const rejectedGet = await fetch(`${baseUrl}/api/status-that-may-write`);
      expect(rejectedGet.status).toBe(409);
      const allowedEventStream = await fetch(`${baseUrl}/api/ai/goal-runs/goal-1/events`);
      expect(allowedEventStream.status).toBe(200);
      release();
      await expect(quiescing).resolves.toBeUndefined();
      expect((await activeRequest).status).toBe(200);
      activity.resumeApiMutations();
    } finally {
      activity.resumeApiMutations();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
