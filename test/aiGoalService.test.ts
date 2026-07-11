import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ContentDraftBatchResult, NoteRecord, SearchJob } from "../src/shared/types.js";
import { LocalStore } from "../src/server/storage/localStore.js";
import {
  addAiGoalRunSources,
  confirmAiGoalRun,
  createAiGoalRun,
  getAiGoalRun,
  planAiGoalRun,
  retryAiGoalRun,
  runAiGoalRun
} from "../src/server/services/aiGoalService.js";

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("AI goal content workflow", () => {
  it("only plans research-backed writing goals and defaults to three outputs", async () => {
    const store = await createStore();
    expect((await planAiGoalRun({ instruction: "当前评论有什么问题？" }, store)).goalRun).toBeUndefined();
    const planned = await planAiGoalRun({ instruction: "研究巴拉巴拉宣传片的背景和影响力，帮我写几篇小红书笔记" }, store);
    expect(planned.goalRun?.status).toBe("waiting_confirmation");
    expect(planned.goalRun?.plan.outputCount).toBe(3);
    expect(planned.goalRun?.plan.subject).toBe("巴拉巴拉宣传片");
    expect(planned.goalRun?.plan.questions).toContain("公开传播数据与影响力");
  });

  it("runs XHS evidence through batch writing, review and artifact archiving", async () => {
    const store = await createStore();
    const run = await createAiGoalRun({ instruction: "研究巴拉巴拉中国小朋友宣传片的价值观、数据和创新亮点，生成3篇小红书笔记" }, store);
    const job = searchJob("job_goal");
    const note = noteRecord("note_goal", job.id);
    const generated = batchResult(3);
    const confirmed = await confirmAiGoalRun(run.id, store, { autoStart: false });
    expect(confirmed.status).toBe("running");
    const completed = await runAiGoalRun(run.id, store, {
      createJob: async () => {
        await store.write("notes", [note]);
        return job;
      },
      getJob: async () => job,
      generateBatch: async () => generated,
      pollMs: 0,
      waitTimeoutMs: 20
    });
    expect(completed.status).toBe("completed");
    expect(completed.evidence.some((item) => item.noteId === note.id)).toBe(true);
    expect(completed.dossier?.gaps).toContain("暂无公开可验证的宣传片播放量或全网传播数据。");
    expect(completed.contentBatch?.items).toHaveLength(3);
    expect(completed.contentBatch?.items.every((item) => item.reviewId)).toBe(true);
    expect(completed.artifactIds).toContain("draft-artifact-0");
    expect((await store.read("aiArtifacts")).some((item) => item.contextSummary === `goal-run:${run.id}`)).toBe(true);
  });

  it("keeps a failed step recoverable and accepts only public HTTPS sources", async () => {
    const store = await createStore();
    const run = await createAiGoalRun({ instruction: "研究一个品牌活动并生成2篇小红书笔记" }, store);
    await expect(addAiGoalRunSources(run.id, { urls: ["http://localhost/private"] }, store)).rejects.toThrow("HTTPS");
    const withSource = await addAiGoalRunSources(run.id, { urls: ["https://example.com/story"] }, store);
    expect(withSource.userSourceUrls).toEqual(["https://example.com/story"]);
    await confirmAiGoalRun(run.id, store, { autoStart: false });
    const failed = await runAiGoalRun(run.id, store, {
      createJob: async () => searchJob("job_failed", "failed"),
      getJob: async () => searchJob("job_failed", "failed"),
      pollMs: 0,
      waitTimeoutMs: 20
    });
    expect(failed.status).toBe("failed");
    expect(failed.steps.find((step) => step.key === "collect-xhs")?.status).toBe("failed");
    const retried = await retryAiGoalRun(run.id, store, { autoStart: false });
    expect(retried.status).toBe("running");
    expect((await getAiGoalRun(run.id, store))?.jobId).toBe("job_failed");
  });

  it("resumes an existing paused search job when retrying the failed collection step", async () => {
    const store = await createStore();
    const run = await createAiGoalRun({ instruction: "研究品牌活动并生成2篇小红书笔记" }, store);
    await confirmAiGoalRun(run.id, store, { autoStart: false });
    const paused = searchJob("job_paused", "paused");
    const first = await runAiGoalRun(run.id, store, {
      createJob: async () => paused,
      getJob: async () => paused,
      pollMs: 0,
      waitTimeoutMs: 20
    });
    expect(first.status).toBe("failed");
    let resumed = 0;
    await store.write("notes", [noteRecord("note_retry", paused.id)]);
    await retryAiGoalRun(run.id, store, { autoStart: false });
    const completed = await runAiGoalRun(run.id, store, {
      getJob: async () => paused,
      resumeJob: async () => {
        resumed += 1;
        return searchJob(paused.id, "running");
      },
      generateBatch: async () => batchResult(2),
      pollMs: 0,
      waitTimeoutMs: 20
    });
    expect(resumed).toBe(1);
    expect(completed.status).toBe("completed");
  });

  it("invalidates public-source dependent results when sources are added after completion", async () => {
    const store = await createStore();
    const run = await createAiGoalRun({ instruction: "研究品牌活动并生成2篇小红书笔记" }, store);
    await store.update("aiGoalRuns", (items) => items.map((item) => item.id === run.id ? {
      ...item,
      status: "completed",
      dossier: { summary: "old", verifiedClaims: [], platformObservations: [], gaps: [], evidenceIds: [] },
      contentBatch: { createdAt: item.createdAt, items: [] },
      evidence: [{
        id: "old_public", goalRunId: item.id, claim: "old", sourceTitle: "old", sourceType: "media",
        collectedAt: item.createdAt, excerpt: "old", confidence: "medium", kind: "verified-fact"
      }],
      steps: item.steps.map((step) => ({ ...step, status: "completed" }))
    } : item));
    const updated = await addAiGoalRunSources(run.id, { urls: ["https://example.com/new"] }, store);
    expect(updated.status).toBe("waiting_confirmation");
    expect(updated.evidence).toEqual([]);
    expect(updated.dossier).toBeUndefined();
    expect(updated.contentBatch).toBeUndefined();
    expect(updated.steps.find((step) => step.key === "collect-xhs")?.status).toBe("completed");
    expect(updated.steps.find((step) => step.key === "collect-public-sources")?.status).toBe("pending");
  });

  it("rejects source mutation while a goal run is active", async () => {
    const store = await createStore();
    const run = await createAiGoalRun({ instruction: "研究品牌活动并生成2篇小红书笔记" }, store);
    await confirmAiGoalRun(run.id, store, { autoStart: false });
    await expect(addAiGoalRunSources(run.id, { urls: ["https://example.com/source"] }, store)).rejects.toThrow("执行中");
  });
});

async function createStore(): Promise<LocalStore> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "xhs-goal-test-"));
  dirs.push(dir);
  return new LocalStore(dir);
}

function searchJob(id: string, status: SearchJob["status"] = "completed"): SearchJob {
  return {
    id,
    keywords: ["巴拉巴拉"],
    sort: "popular",
    noteType: "all",
    pages: 1,
    commentPages: 1,
    concurrency: 1,
    status,
    progress: { seeded: 1, pending: 0, running: 0, done: 1, error: 0, total: 1 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...(status === "failed" ? { breakerReason: "测试抓取失败" } : {})
  };
}

function noteRecord(id: string, jobId: string): NoteRecord {
  const now = new Date().toISOString();
  return {
    id, jobIds: [jobId], keywords: ["巴拉巴拉"], title: "中国小朋友宣传片讨论", desc: "用户讨论宣传片中的儿童表达和品牌故事。",
    type: "video", webUrl: `https://www.xiaohongshu.com/explore/${id}`, noteUrl: `https://www.xiaohongshu.com/explore/${id}`,
    likedCount: 100, collectedCount: 20, commentCount: 10, shareCount: 5, hotScore: 80, createdAt: now, updatedAt: now
  };
}

function batchResult(count: number): ContentDraftBatchResult {
  return {
    results: Array.from({ length: count }, (_, index) => ({
      draft: { id: `draft-${index}` },
      review: { id: `review-${index}` },
      artifact: { id: `draft-artifact-${index}` },
      reviewArtifact: { id: `review-artifact-${index}` }
    }))
  } as ContentDraftBatchResult;
}
