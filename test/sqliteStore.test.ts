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

  it("persists the specialty review and artifact through the production SQLite store", async () => {
    const { store, close } = await createStore();
    const { reviewContentDraft } = await import("../src/server/services/contentStudioService.js");

    const result = await reviewContentDraft({
      title: "周十五蜂露封神",
      body: "周十五蜂露是通便特效药，闭眼冲。",
      tags: ["周十五蜂露", "孕期日常"]
    }, store);

    expect(result.review.revisedTitle).toContain("周十五蜂蜜露");
    expect(result.review.revisedBody).not.toContain("通便特效药");
    expect(result.review.revisedTags).toEqual(["周十五蜂蜜露", "孕期日常"]);
    expect((await store.read("contentReviews")).map((item) => item.id)).toEqual([result.review.id]);
    expect((await store.read("aiArtifacts")).map((item) => item.id)).toEqual([result.artifact.id]);
    close();
  });

  it("executes the production project delete workflow with SQLite cascade cleanup", async () => {
    const { store, close } = await createStore();
    const {
      deleteContentProject,
      saveContentProject,
      saveContentProjectMaterial
    } = await import("../src/server/services/contentStudioService.js");
    const project = await saveContentProject({
      name: "迁移验收项目",
      productName: "周十五蜂蜜露",
      targetAudience: [],
      scenarios: [],
      goals: []
    }, undefined, store);
    await saveContentProjectMaterial({
      projectId: project.id,
      source: "manual",
      category: "general",
      title: "素材",
      content: "用于验证 SQLite 外键级联。",
      tags: []
    }, store);

    await expect(deleteContentProject(project.id, store)).resolves.toEqual({ deleted: 1 });
    expect(await store.read("contentProjects")).toEqual([]);
    expect(await store.read("contentProjectMaterials")).toEqual([]);
    expect(store.database.connection.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
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
