import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AiArtifact, AiReport, NoteRecord, QueueItem, SearchJob } from "../src/shared/types.js";
import { LocalStore } from "../src/server/storage/localStore.js";
import { listNoteScopes } from "../src/server/services/queryService.js";

describe("note scope summaries", () => {
  it("summarizes all notes, duplicate keyword jobs, empty jobs, and AI artifact counts", async () => {
    const store = new LocalStore(await createTempDataDir());
    await store.write("searchJobs", [
      searchJob("job-newer", ["same keyword"], "failed", "2026-06-20T10:00:00.000Z"),
      searchJob("job-older", ["same keyword"], "completed", "2026-06-19T10:00:00.000Z")
    ]);
    await store.write("notes", [note("note1", ["job-older"])]);
    await store.write("queueItems", [
      queueItem("queue1", "job-newer", "error"),
      queueItem("queue2", "job-older", "done")
    ]);
    await store.write("aiArtifacts", [artifact("artifact1", "job-older")]);
    await store.write("aiReports", [report("report1", "job-older")]);

    const scopes = await listNoteScopes(store);
    const allScope = scopes.find((scope) => scope.type === "all");
    const olderScope = scopes.find((scope) => scope.jobId === "job-older");
    const newerScope = scopes.find((scope) => scope.jobId === "job-newer");

    expect(allScope?.noteCount).toBe(1);
    expect(allScope?.queueErrors).toBe(1);
    expect(olderScope?.noteCount).toBe(1);
    expect(olderScope?.aiArtifactCount).toBe(1);
    expect(olderScope?.aiReportCount).toBe(1);
    expect(olderScope?.isDuplicate).toBe(true);
    expect(olderScope?.duplicateCount).toBe(2);
    expect(newerScope?.noteCount).toBe(0);
    expect(newerScope?.queueErrors).toBe(1);
    expect(newerScope?.emptyReason).toBeTruthy();
  });
});

function createTempDataDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "xhs-note-scopes-"));
}

function searchJob(id: string, keywords: string[], status: SearchJob["status"], updatedAt: string): SearchJob {
  return {
    id,
    keywords,
    sort: "popular",
    noteType: "all",
    pages: 1,
    commentPages: 1,
    concurrency: 2,
    status,
    createdAt: updatedAt,
    updatedAt,
    progress: { seeded: 0, pending: 0, running: 0, done: 0, error: 0, total: 0 }
  };
}

function note(id: string, jobIds: string[]): NoteRecord {
  return {
    id,
    jobIds,
    keywords: ["same keyword"],
    title: "Sample note",
    desc: "body",
    type: "normal",
    webUrl: "https://www.xiaohongshu.com/explore/sample",
    noteUrl: "https://www.xiaohongshu.com/explore/sample",
    authorName: "author",
    likedCount: 10,
    collectedCount: 3,
    commentCount: 2,
    shareCount: 1,
    hotScore: 16,
    createdAt: "2026-06-20T10:00:00.000Z",
    updatedAt: "2026-06-20T10:00:00.000Z"
  };
}

function queueItem(id: string, jobId: string, status: QueueItem["status"]): QueueItem {
  return {
    id,
    jobId,
    kind: "read",
    arg: id,
    status,
    attempts: status === "error" ? 1 : 0,
    createdAt: "2026-06-20T10:00:00.000Z",
    updatedAt: "2026-06-20T10:00:00.000Z"
  };
}

function artifact(id: string, jobId: string): AiArtifact {
  return {
    id,
    workflowKey: "content-planning",
    jobId,
    title: "Artifact",
    markdown: "# Artifact",
    source: "ai",
    status: "completed",
    createdAt: "2026-06-20T10:00:00.000Z",
    updatedAt: "2026-06-20T10:00:00.000Z"
  };
}

function report(id: string, jobId: string): AiReport {
  return {
    id,
    jobId,
    title: "Report",
    source: "ai",
    status: "completed",
    markdown: "# Report",
    createdAt: "2026-06-20T10:00:00.000Z",
    updatedAt: "2026-06-20T10:00:00.000Z"
  };
}
