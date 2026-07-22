import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("startup data protection", () => {
  it("creates a verified pre-upgrade backup before an older schema is migrated", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "xhs-pre-upgrade-"));
    tempDirs.push(dir);
    const databaseFile = path.join(dir, "app.db");
    const legacy = new DatabaseSync(databaseFile);
    const { databaseMigrations } = await import("../src/server/storage/migrations.js");
    const versions = databaseMigrations.filter((migration) => migration.version <= 2);
    legacy.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);
    for (const migration of versions) {
      legacy.exec(migration.sql);
      legacy.prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)")
        .run(migration.version, migration.name, "2026-07-22T00:00:00.000Z");
    }
    legacy.close();

    const { prepareDatabaseStartup } = await import("../src/server/storage/startupDataProtection.js");
    await prepareDatabaseStartup({
      databaseFile,
      backupsDir: path.join(dir, "backups"),
      stagingDir: path.join(dir, "staging"),
      appVersion: "0.5.0",
      now: () => new Date("2026-07-22T10:00:00.000Z")
    });

    const safetyFiles = await readdir(path.join(dir, "backups", "safety"));
    expect(safetyFiles).toHaveLength(1);
    expect(safetyFiles[0]).toMatch(/^pre-upgrade-.*\.xhsbackup$/);
    const { readDataPackageManifest } = await import("../src/server/storage/dataPackage.js");
    const packaged = await readDataPackageManifest(path.join(dir, "backups", "safety", safetyFiles[0]));
    expect(packaged.manifest.schemaVersion).toBe(2);
    const unchanged = new DatabaseSync(databaseFile, { readOnly: true });
    expect(unchanged.prepare("SELECT MAX(version) AS version FROM schema_migrations").get()).toEqual({ version: 2 });
    unchanged.close();
  });
});
