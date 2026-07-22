import { afterEach, describe, expect, it, vi } from "vitest";

const reply = vi.fn();
const markAuthDisconnected = vi.fn();
let actions: Array<Record<string, any>> = [];
let plans: Array<Record<string, any>> = [];

const store = {
  read: vi.fn(async (name: string) => name === "replyActions" ? actions : name === "replyPlans" ? plans : []),
  update: vi.fn(async (name: string, updater: (value: any[]) => any[] | Promise<any[]>) => {
    const current = name === "replyActions" ? actions : plans;
    const next = await updater(current);
    if (name === "replyActions") actions = next;
    if (name === "replyPlans") plans = next;
    return next;
  })
};

vi.mock("../src/server/storage/runtimeStorage.js", () => ({ store }));
vi.mock("../src/server/services/redbookService.js", () => ({ redbook: { reply } }));
vi.mock("../src/server/services/authState.js", () => ({ markAuthDisconnected }));

afterEach(async () => {
  const { stopReplyWorker } = await import("../src/server/services/commentOps.js");
  await stopReplyWorker();
  vi.useRealTimers();
  vi.clearAllMocks();
  actions = [];
  plans = [];
});

describe("reply worker lifecycle", () => {
  it("waits for an in-flight reply before shutdown completes", async () => {
    vi.useFakeTimers();
    let finishReply!: () => void;
    reply.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finishReply = resolve;
    }));
    actions = [{
      id: "reply-action-1",
      planId: "reply-plan-1",
      noteId: "note-1",
      webUrl: "https://www.xiaohongshu.com/explore/note-1",
      commentId: "comment-1",
      content: "测试回复",
      status: "queued",
      approvedAt: "2026-07-21T00:00:00.000Z",
      createdAt: "2026-07-21T00:00:00.000Z",
      updatedAt: "2026-07-21T00:00:00.000Z"
    }];
    plans = [{ id: "reply-plan-1", status: "queued", updatedAt: "2026-07-21T00:00:00.000Z" }];

    const { startReplyWorker, stopReplyWorker } = await import("../src/server/services/commentOps.js");
    startReplyWorker();
    vi.advanceTimersByTime(30_000);
    await vi.waitFor(() => expect(reply).toHaveBeenCalledOnce());

    let stopped = false;
    const stopping = stopReplyWorker().then(() => {
      stopped = true;
    });
    await Promise.resolve();
    expect(stopped).toBe(false);

    finishReply();
    await stopping;
    expect(stopped).toBe(true);
    expect(actions[0]?.status).toBe("sent");
  });

  it("times out instead of waiting forever for an in-flight reply", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T00:00:00.000Z"));
    let finishReply!: () => void;
    reply.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finishReply = resolve;
    }));
    actions = [{
      id: "reply-action-timeout",
      planId: "reply-plan-timeout",
      noteId: "note-timeout",
      webUrl: "https://www.xiaohongshu.com/explore/note-timeout",
      commentId: "comment-timeout",
      content: "测试超时",
      status: "queued",
      approvedAt: "2026-07-21T00:00:00.000Z",
      createdAt: "2026-07-21T00:00:00.000Z",
      updatedAt: "2026-07-21T00:00:00.000Z"
    }];
    plans = [{ id: "reply-plan-timeout", status: "queued", updatedAt: "2026-07-21T00:00:00.000Z" }];

    const { startReplyWorker, stopReplyWorker } = await import("../src/server/services/commentOps.js");
    startReplyWorker();
    vi.advanceTimersByTime(30_000);
    await vi.waitFor(() => expect(reply).toHaveBeenCalledOnce());

    const stopping = stopReplyWorker(100);
    const timedOut = expect(stopping).rejects.toThrow("等待回复任务停止超时");
    await vi.advanceTimersByTimeAsync(100);
    await timedOut;
    finishReply();
    await Promise.resolve();
  });
});
