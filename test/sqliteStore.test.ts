import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { NoteRecord, SearchJob } from "../src/shared/types.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("SQLite repository store", () => {
  it("preserves singleton defaults and saved values", async () => {
    const { store, close } = await createStore();

    expect(await store.read("authStatus")).toEqual({ connected: false, configured: false });
    await store.write("authStatus", {
      connected: true,
      configured: true,
      user: { id: "user-1", nickname: "测试用户" }
    });
    expect(await store.read("authStatus")).toEqual({
      connected: true,
      configured: true,
      user: { id: "user-1", nickname: "测试用户" }
    });
    close();
  });

  it("stores entity rows in stable array order and updates atomically", async () => {
    const { store, close } = await createStore();
    const first = job("job-1", "queued");
    const second = job("job-2", "completed");

    await store.write("searchJobs", [first, second]);
    await store.update("searchJobs", (jobs) => [jobs[1]!, { ...jobs[0]!, status: "paused" }]);

    expect((await store.read("searchJobs")).map((item) => [item.id, item.status])).toEqual([
      ["job-2", "completed"],
      ["job-1", "paused"]
    ]);
    expect(store.database.connection.prepare("SELECT id, position FROM search_jobs ORDER BY position").all()).toEqual([
      { id: "job-2", position: 0 },
      { id: "job-1", position: 1 }
    ]);
    close();
  });

  it("maintains note-to-job relations and rolls back invalid writes", async () => {
    const { store, close } = await createStore();
    await store.write("searchJobs", [job("job-1", "completed"), job("job-2", "completed")]);
    await store.write("notes", [note("note-1", ["job-2", "job-1"])]);

    expect(store.database.connection.prepare(
      "SELECT note_id, job_id, position FROM note_jobs ORDER BY position"
    ).all()).toEqual([
      { note_id: "note-1", job_id: "job-2", position: 0 },
      { note_id: "note-1", job_id: "job-1", position: 1 }
    ]);

    await expect(store.write("notes", [note("invalid-note", ["missing-job"])])).rejects.toThrow();
    expect((await store.read("notes")).map((item) => item.id)).toEqual(["note-1"]);
    close();
  });
});

async function createStore() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "xhs-sqlite-store-"));
  tempDirs.push(dir);
  const { openApplicationDatabase } = await import("../src/server/storage/database.js");
  const { SqliteStore } = await import("../src/server/storage/sqliteStore.js");
  const database = openApplicationDatabase(path.join(dir, "app.db"));
  return {
    store: new SqliteStore(database),
    close: () => database.close()
  };
}

function job(id: string, status: SearchJob["status"]): SearchJob {
  return {
    id,
    keywords: [id],
    sort: "general",
    noteType: "all",
    pages: 1,
    commentPages: 1,
    concurrency: 1,
    status,
    createdAt: "2026-07-21T00:00:00.000Z",
    updatedAt: "2026-07-21T00:00:00.000Z",
    progress: { seeded: 0, pending: 0, running: 0, done: 0, error: 0, total: 0 }
  };
}

function note(id: string, jobIds: string[]): NoteRecord {
  return {
    id,
    jobIds,
    keywords: [],
    title: id,
    desc: "content",
    type: "normal",
    webUrl: `https://www.xiaohongshu.com/explore/${id}`,
    noteUrl: `https://www.xiaohongshu.com/explore/${id}`,
    likedCount: 0,
    collectedCount: 0,
    commentCount: 0,
    shareCount: 0,
    hotScore: 0,
    createdAt: "2026-07-21T00:00:00.000Z",
    updatedAt: "2026-07-21T00:00:00.000Z"
  };
}
