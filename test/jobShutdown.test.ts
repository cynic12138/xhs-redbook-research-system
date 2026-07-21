import type { QueueItem, SearchJob } from "../src/shared/types.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  searchJobs: [] as SearchJob[],
  queueItems: [] as QueueItem[],
  notes: [] as unknown[]
}));

const store = vi.hoisted(() => ({
  read: vi.fn(async (name: keyof typeof testState) => structuredClone(testState[name])),
  write: vi.fn(async (name: keyof typeof testState, value: unknown[]) => {
    (testState[name] as unknown[]) = structuredClone(value);
  }),
  update: vi.fn(async (name: keyof typeof testState, updater: (value: unknown[]) => unknown[] | Promise<unknown[]>) => {
    const next = await updater(structuredClone(testState[name]) as unknown[]);
    (testState[name] as unknown[]) = structuredClone(next);
    return structuredClone(next);
  })
}));

vi.mock("../src/server/storage/runtimeStorage.js", () => ({ store }));
vi.mock("../src/server/services/redbookService.js", () => ({ redbook: {} }));
vi.mock("../src/server/services/authState.js", () => ({ markAuthDisconnected: vi.fn(async () => undefined) }));
vi.mock("../src/server/utils/env.js", () => ({
  getDailyReadBudget: () => 0,
  getDetailIntervalSec: () => 60,
  getDetailJitterPct: () => 0,
  getJobConcurrency: () => 1,
  getMaxJobConcurrency: () => 2,
  getSearchIntervalSec: () => 15,
  getSearchJitterPct: () => 0,
  getWorkerStaggerSec: () => 12
}));

const shutdownReason = "应用退出时已安全暂停，可在下次启动后恢复。";

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  testState.searchJobs = [runningJob()];
  testState.queueItems = [runningQueueItem()];
  testState.notes = [];
});

describe("job service desktop shutdown", () => {
  it("detects running jobs and persists a resumable paused state", async () => {
    const { JobService } = await import("../src/server/services/jobService.js");
    const service = new JobService();

    expect(await service.hasRunningJobs()).toBe(true);
    await service.prepareForShutdown(100);

    expect(testState.queueItems[0]).toMatchObject({ status: "pending" });
    expect(testState.searchJobs[0]).toMatchObject({ status: "paused", breakerReason: shutdownReason });
    expect(await service.hasRunningJobs()).toBe(false);
  });

  it("does not schedule a new worker after shutdown preparation starts", async () => {
    const { JobService } = await import("../src/server/services/jobService.js");
    const service = new JobService();
    await service.prepareForShutdown(100);
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");

    service.start("job_running");
    await Promise.resolve();
    await Promise.resolve();

    expect(timeoutSpy).not.toHaveBeenCalled();
    timeoutSpy.mockRestore();
  });

  it("persists the paused state before reporting a worker shutdown timeout", async () => {
    const { JobService } = await import("../src/server/services/jobService.js");
    const service = new JobService();
    let releaseWorker!: () => void;
    const workerGate = new Promise<boolean>((resolve) => {
      releaseWorker = () => resolve(false);
    });
    const privateService = service as unknown as {
      processNext(jobId: string): Promise<boolean>;
      runWorker(jobId: string): Promise<void>;
    };
    privateService.processNext = vi.fn(() => workerGate);
    const worker = privateService.runWorker("job_running");

    try {
      await expect(service.prepareForShutdown(5)).rejects.toThrow("等待后台任务停止超时");
      expect(testState.queueItems[0]).toMatchObject({ status: "pending" });
      expect(testState.searchJobs[0]).toMatchObject({ status: "paused", breakerReason: shutdownReason });
    } finally {
      releaseWorker();
      await worker;
    }
  });
});

function runningJob(): SearchJob {
  const now = new Date().toISOString();
  return {
    id: "job_running",
    keywords: ["蜂蜜露"],
    sort: "general",
    noteType: "all",
    pages: 1,
    commentPages: 1,
    concurrency: 1,
    status: "running",
    createdAt: now,
    updatedAt: now,
    progress: {
      seeded: 0,
      pending: 0,
      running: 1,
      done: 0,
      error: 0,
      total: 1,
      byKind: {
        read: { pending: 0, running: 1, done: 0, error: 0, total: 1 },
        comments: { pending: 0, running: 0, done: 0, error: 0, total: 0 },
        user: { pending: 0, running: 0, done: 0, error: 0, total: 0 },
        "user-posts": { pending: 0, running: 0, done: 0, error: 0, total: 0 },
        analyze: { pending: 0, running: 0, done: 0, error: 0, total: 0 }
      }
    }
  };
}

function runningQueueItem(): QueueItem {
  const now = new Date().toISOString();
  return {
    id: "queue_running",
    jobId: "job_running",
    kind: "read",
    arg: "https://www.xiaohongshu.com/explore/test",
    status: "running",
    attempts: 1,
    createdAt: now,
    updatedAt: now
  };
}
