import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AiArtifact, AiReport, NoteRecord, QueueItem, SearchJob } from "../src/shared/types.js";
import { LocalStore } from "../src/server/storage/localStore.js";
import { clearNotes, deleteNotesBulk, getBulkNotesDeletePreview, getNoteScopeClearPreview, listNoteScopes, listNotes } from "../src/server/services/queryService.js";

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
    const keywordScope = scopes.find((scope) => scope.type === "keyword");
    const olderScope = scopes.find((scope) => scope.jobId === "job-older");
    const newerScope = scopes.find((scope) => scope.jobId === "job-newer");

    expect(allScope?.noteCount).toBe(1);
    expect(allScope?.queueErrors).toBe(1);
    expect(olderScope?.noteCount).toBe(1);
    expect(olderScope?.aiArtifactCount).toBe(1);
    expect(olderScope?.aiReportCount).toBe(1);
    expect(keywordScope?.relatedJobIds).toEqual(["job-newer", "job-older"]);
    expect(keywordScope?.noteCount).toBe(1);
    expect(await listNotes({ jobIds: keywordScope?.relatedJobIds, sort: "hot" }, store)).toHaveLength(1);
    expect(olderScope?.isDuplicate).toBe(true);
    expect(olderScope?.duplicateCount).toBe(2);
    expect(newerScope?.noteCount).toBe(0);
    expect(newerScope?.queueErrors).toBe(1);
    expect(newerScope?.emptyReason).toBeTruthy();
  });

  it("previews dataset cleanup impact and only deletes AI artifacts when requested", async () => {
    const store = new LocalStore(await createTempDataDir());
    await store.write("searchJobs", [searchJob("job1", ["keyword"], "completed", "2026-06-20T10:00:00.000Z")]);
    await store.write("notes", [note("orphan-note", ["job1"]), note("shared-note", ["job1", "job2"])]);
    await store.write("comments", [
      { id: "comment1", noteId: "orphan-note", content: "comment", likedCount: 1, createdAt: "2026-06-20T10:00:00.000Z" },
      { id: "comment2", noteId: "shared-note", content: "comment", likedCount: 1, createdAt: "2026-06-20T10:00:00.000Z" }
    ]);
    await store.write("queueItems", [queueItem("queue1", "job1", "done")]);
    await store.write("analysisReports", [
      {
        jobId: "job1",
        generatedAt: "2026-06-20T10:00:00.000Z",
        overview: { notes: 1, videos: 0, imageNotes: 1, avgLikes: 1, totalComments: 1, totalCollects: 1, totalShares: 0 },
        keywords: [],
        authors: [],
        formBreakdown: [],
        templates: []
      }
    ]);
    await store.write("aiArtifacts", [artifact("artifact1", "job1")]);
    await store.write("aiReports", [report("report1", "job1")]);

    const preview = await getNoteScopeClearPreview("job1", store);
    expect(preview?.affectedNotes).toBe(2);
    expect(preview?.detachedNotes).toBe(1);
    expect(preview?.orphanNotes).toBe(1);
    expect(preview?.commentsToDelete).toBe(1);
    expect(preview?.aiArtifactsLinked).toBe(1);
    expect(preview?.aiReportsLinked).toBe(1);

    await clearNotes("job1", {}, store);
    expect(await store.read("aiArtifacts")).toHaveLength(1);
    expect(await store.read("aiReports")).toHaveLength(1);

    await store.write("notes", [note("orphan-note", ["job1"])]);
    await clearNotes("job1", { deleteAiArtifacts: true }, store);
    expect(await store.read("aiArtifacts")).toHaveLength(0);
    expect(await store.read("aiReports")).toHaveLength(0);
  });

  it("deletes empty failed datasets and removes them from note scopes", async () => {
    const store = new LocalStore(await createTempDataDir());
    await store.write("searchJobs", [searchJob("empty-failed", ["empty keyword"], "failed", "2026-06-20T10:00:00.000Z")]);
    await store.write("notes", []);
    await store.write("queueItems", [queueItem("queue-error", "empty-failed", "error")]);

    const preview = await getNoteScopeClearPreview("empty-failed", store);
    expect(preview?.affectedNotes).toBe(0);
    expect(preview?.queueItemsToDelete).toBe(1);

    await clearNotes("empty-failed", {}, store);

    expect(await store.read("searchJobs")).toHaveLength(0);
    expect(await store.read("queueItems")).toHaveLength(0);
    expect((await listNoteScopes(store)).some((scope) => scope.jobId === "empty-failed")).toBe(false);
  });

  it("bulk deletes selected notes safely within the active dataset", async () => {
    const store = new LocalStore(await createTempDataDir());
    await store.write("searchJobs", [
      searchJob("job1", ["keyword"], "completed", "2026-06-20T10:00:00.000Z"),
      searchJob("job2", ["other"], "completed", "2026-06-20T10:00:00.000Z")
    ]);
    await store.write("notes", [note("orphan-note", ["job1"]), note("shared-note", ["job1", "job2"])]);
    await store.write("comments", [
      { id: "comment1", noteId: "orphan-note", content: "comment", likedCount: 1, createdAt: "2026-06-20T10:00:00.000Z" },
      { id: "comment2", noteId: "shared-note", content: "comment", likedCount: 1, createdAt: "2026-06-20T10:00:00.000Z" }
    ]);

    const preview = await getBulkNotesDeletePreview({ noteIds: ["orphan-note", "shared-note"], jobId: "job1" }, store);
    expect(preview.mode).toBe("scope-detach");
    expect(preview.affectedNotes).toBe(2);
    expect(preview.detachedNotes).toBe(1);
    expect(preview.orphanNotes).toBe(1);
    expect(preview.commentsToDelete).toBe(1);

    const result = await deleteNotesBulk({ noteIds: ["orphan-note", "shared-note"], jobId: "job1" }, store);
    const notes = await store.read("notes");

    expect(result).toEqual({ deleted: 1, detached: 1 });
    expect(notes.map((item) => item.id)).toEqual(["shared-note"]);
    expect(notes[0]?.jobIds).toEqual(["job2"]);
    expect(await store.read("comments")).toEqual([{ id: "comment2", noteId: "shared-note", content: "comment", likedCount: 1, createdAt: "2026-06-20T10:00:00.000Z" }]);
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
