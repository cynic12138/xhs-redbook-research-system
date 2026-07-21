import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { NoteRecord, SearchJob } from "../src/shared/types.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("legacy JSON import", () => {
  it("previews only allowlisted collections and imports them in one transaction", async () => {
    const fixture = await createFixture();
    await writeJson(fixture.sourceDir, "searchJobs", [job("job-1")]);
    await writeJson(fixture.sourceDir, "notes", [note("note-1", ["job-1"])]);
    await writeFile(path.join(fixture.sourceDir, "unrelated.json"), "not-json", "utf8");

    const preview = await fixture.service.preview(fixture.sourceDir);
    expect(preview.detectedFiles).toEqual(["notes.json", "searchJobs.json"]);
    expect(preview.counts.searchJobs).toBe(1);
    expect(preview.counts.notes).toBe(1);
    expect(preview.fingerprint).toMatch(/^[a-f0-9]{64}$/);

    const result = await fixture.service.execute({
      sourceDir: fixture.sourceDir,
      fingerprint: preview.fingerprint
    });

    expect(result.imported).toBe(true);
    expect((await fixture.store.read("searchJobs")).map((item) => item.id)).toEqual(["job-1"]);
    expect((await fixture.store.read("notes")).map((item) => item.id)).toEqual(["note-1"]);
    expect(fixture.database.connection.prepare("SELECT note_id, job_id FROM note_jobs").all()).toEqual([
      { note_id: "note-1", job_id: "job-1" }
    ]);
    fixture.close();
  });

  it("rejects a changed source fingerprint and leaves the database empty", async () => {
    const fixture = await createFixture();
    await writeJson(fixture.sourceDir, "searchJobs", [job("job-1")]);
    const preview = await fixture.service.preview(fixture.sourceDir);
    await writeJson(fixture.sourceDir, "searchJobs", [job("job-2")]);

    await expect(fixture.service.execute({
      sourceDir: fixture.sourceDir,
      fingerprint: preview.fingerprint
    })).rejects.toThrow("预检后发生变化");
    expect(fixture.store.isEmpty()).toBe(true);
    fixture.close();
  });

  it("rolls back every collection when a relation is invalid and blocks repeated imports", async () => {
    const fixture = await createFixture();
    await writeJson(fixture.sourceDir, "notes", [note("orphan-note", ["missing-job"])]);
    const invalidPreview = await fixture.service.preview(fixture.sourceDir);

    await expect(fixture.service.execute({
      sourceDir: fixture.sourceDir,
      fingerprint: invalidPreview.fingerprint
    })).rejects.toThrow();
    expect(fixture.store.isEmpty()).toBe(true);
    expect(fixture.database.connection.prepare("SELECT COUNT(*) AS count FROM legacy_imports").get()).toEqual({ count: 0 });

    await writeJson(fixture.sourceDir, "searchJobs", [job("missing-job")]);
    const validPreview = await fixture.service.preview(fixture.sourceDir);
    await fixture.service.execute({ sourceDir: fixture.sourceDir, fingerprint: validPreview.fingerprint });
    await expect(fixture.service.execute({
      sourceDir: fixture.sourceDir,
      fingerprint: validPreview.fingerprint
    })).rejects.toThrow("已经完成");
    fixture.close();
  });
});

async function createFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "xhs-legacy-import-"));
  tempDirs.push(root);
  const sourceDir = path.join(root, "legacy-data");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(sourceDir, { recursive: true });
  const { openApplicationDatabase } = await import("../src/server/storage/database.js");
  const { SqliteStore } = await import("../src/server/storage/sqliteStore.js");
  const { LegacyImportService } = await import("../src/server/storage/legacyImportService.js");
  const database = openApplicationDatabase(path.join(root, "app.db"));
  const store = new SqliteStore(database);
  return {
    sourceDir,
    database,
    store,
    service: new LegacyImportService(database, store),
    close: () => database.close()
  };
}

async function writeJson(dir: string, name: string, value: unknown): Promise<void> {
  await writeFile(path.join(dir, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function job(id: string): SearchJob {
  return {
    id,
    keywords: [id],
    sort: "general",
    noteType: "all",
    pages: 1,
    commentPages: 1,
    status: "completed",
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
