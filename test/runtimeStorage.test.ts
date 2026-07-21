import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("application SQLite storage", () => {
  it("reports a legacy import requirement without writing to the empty database", async () => {
    const root = await createTempDir();
    const dataDir = path.join(root, "data");
    const { mkdir } = await import("node:fs/promises");
    await mkdir(dataDir, { recursive: true });
    await writeFile(path.join(dataDir, "searchJobs.json"), "[]\n", "utf8");
    const { ApplicationStorage } = await import("../src/server/storage/runtimeStorage.js");
    const storage = new ApplicationStorage(path.join(dataDir, "app.db"), dataDir);

    expect(storage.requiresLegacyImport()).toBe(true);
    expect(await storage.status()).toMatchObject({
      engine: "sqlite",
      schemaVersion: 2,
      migrationState: "legacy-import-required",
      legacyDataDetected: true
    });
    expect(storage.store.isEmpty()).toBe(true);
    storage.close();
  });

  it("reports ready for a fresh installation and imported after migration", async () => {
    const root = await createTempDir();
    const dataDir = path.join(root, "data");
    const { mkdir } = await import("node:fs/promises");
    await mkdir(dataDir, { recursive: true });
    const { ApplicationStorage } = await import("../src/server/storage/runtimeStorage.js");
    const storage = new ApplicationStorage(path.join(dataDir, "app.db"), dataDir);
    expect(storage.requiresLegacyImport()).toBe(false);
    expect((await storage.status()).migrationState).toBe("ready");

    await writeFile(path.join(dataDir, "searchJobs.json"), "[]\n", "utf8");
    const preview = await storage.legacyImport.preview(dataDir);
    await storage.legacyImport.execute({ sourceDir: dataDir, fingerprint: preview.fingerprint });
    expect(await storage.status()).toMatchObject({
      migrationState: "imported",
      legacyDataDetected: true,
      importedAt: expect.any(String)
    });
    storage.close();
  });

  it("keeps business APIs blocked when legacy JSON exists beside a non-empty unimported database", async () => {
    const root = await createTempDir();
    const dataDir = path.join(root, "data");
    const { mkdir } = await import("node:fs/promises");
    await mkdir(dataDir, { recursive: true });
    await writeFile(path.join(dataDir, "searchJobs.json"), "[]\n", "utf8");
    const { ApplicationStorage } = await import("../src/server/storage/runtimeStorage.js");
    const storage = new ApplicationStorage(path.join(dataDir, "app.db"), dataDir);
    await storage.store.write("searchJobs", [{
      id: "accidental-write",
      keywords: [],
      sort: "general",
      noteType: "all",
      pages: 1,
      commentPages: 1,
      status: "paused",
      createdAt: "2026-07-21T00:00:00.000Z",
      updatedAt: "2026-07-21T00:00:00.000Z",
      progress: { seeded: 0, pending: 0, running: 0, done: 0, error: 0, total: 0 }
    }]);

    expect(storage.requiresLegacyImport()).toBe(true);
    expect((await storage.status()).migrationState).toBe("legacy-import-conflict");
    storage.close();
  });
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "xhs-runtime-storage-"));
  tempDirs.push(dir);
  return dir;
}
