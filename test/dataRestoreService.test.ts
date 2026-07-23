import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("data restore service", () => {
  it("previews and prepares a verified migration package without exposing its path", async () => {
    const fixture = await createRestoreFixture();
    const { DataRestoreService } = await import("../src/server/storage/dataRestoreService.js");
    const service = new DataRestoreService(fixture.backupService, {
      databaseFile: fixture.databaseFile,
      stagingDir: fixture.stagingDir,
      supportedSchemaVersion: 3,
      now: () => new Date("2026-07-22T09:00:00.000Z")
    });
    const preview = await service.preview({ kind: "migration-package", filePath: fixture.migrationFile });
    const prepared = await service.prepare({
      source: { kind: "migration-package", filePath: fixture.migrationFile },
      fingerprint: preview.fingerprint
    });

    expect(preview).toMatchObject({
      sourceKind: "migration-package",
      credentialsIncluded: false,
      requiresRestart: true
    });
    expect(JSON.stringify(preview)).not.toContain(fixture.dir);
    expect(prepared.restoreId).toMatch(/^[a-f0-9-]{36}$/);
    expect(prepared.expiresAt).toBe("2026-07-22T09:15:00.000Z");
    expect(await readFile(service.getPreparedRestore(prepared.restoreId).candidateDatabaseFile)).toBeTruthy();
    fixture.database.close();
  });

  it("rejects a package changed after preview", async () => {
    const fixture = await createRestoreFixture();
    const { DataRestoreService } = await import("../src/server/storage/dataRestoreService.js");
    const service = new DataRestoreService(fixture.backupService, {
      databaseFile: fixture.databaseFile,
      stagingDir: fixture.stagingDir,
      supportedSchemaVersion: 3
    });
    const preview = await service.preview({ kind: "migration-package", filePath: fixture.migrationFile });
    const bytes = await readFile(fixture.migrationFile);
    bytes[bytes.length - 1] ^= 0x01;
    await writeFile(fixture.migrationFile, bytes);

    await expect(service.prepare({
      source: { kind: "migration-package", filePath: fixture.migrationFile },
      fingerprint: preview.fingerprint
    })).rejects.toThrow(/发生变化|损坏/);
    fixture.database.close();
  });

  it("reports a valid package changed after preview as a conflict", async () => {
    const fixture = await createRestoreFixture();
    const { DataRestoreError, DataRestoreService } = await import("../src/server/storage/dataRestoreService.js");
    const service = new DataRestoreService(fixture.backupService, {
      databaseFile: fixture.databaseFile,
      stagingDir: fixture.stagingDir,
      supportedSchemaVersion: 3
    });
    const preview = await service.preview({ kind: "migration-package", filePath: fixture.migrationFile });
    fixture.database.connection.prepare(
      "INSERT INTO app_state (key, value_json, updated_at) VALUES (?, ?, ?)"
    ).run("rateLimit", JSON.stringify({ consumedToday: 1 }), "2026-07-22T09:00:00.000Z");
    const changedPackage = path.join(fixture.dir, "changed.xhsmigrate");
    await fixture.backupService.exportMigrationPackage(changedPackage);
    await copyFile(changedPackage, fixture.migrationFile);

    const failure = await service.prepare({
      source: { kind: "migration-package", filePath: fixture.migrationFile },
      fingerprint: preview.fingerprint
    }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(DataRestoreError);
    expect((failure as Error & { statusCode: number }).statusCode).toBe(409);
    fixture.database.close();
  });

  it("does not replace the live database when the candidate is invalid", async () => {
    const fixture = await createRestoreFixture();
    const invalidCandidate = path.join(fixture.dir, "invalid.db");
    await writeFile(invalidCandidate, "invalid database", "utf8");
    fixture.database.close();

    const { replaceDatabaseFromPreparedRestore } = await import("../src/server/storage/dataRestoreService.js");
    await expect(replaceDatabaseFromPreparedRestore({
      databaseFile: fixture.databaseFile,
      candidateDatabaseFile: invalidCandidate,
      stagingDir: fixture.stagingDir,
      sourceKind: "migration-package"
    })).rejects.toThrow();

    const { openApplicationDatabase } = await import("../src/server/storage/database.js");
    const live = openApplicationDatabase(fixture.databaseFile);
    expect(live.connection.prepare("PRAGMA quick_check").get()).toEqual({ quick_check: "ok" });
    live.close();
  });

  it("does not expose a local source path when a package cannot be read", async () => {
    const fixture = await createRestoreFixture();
    const { DataRestoreError, DataRestoreService } = await import("../src/server/storage/dataRestoreService.js");
    const service = new DataRestoreService(fixture.backupService, {
      databaseFile: fixture.databaseFile,
      stagingDir: fixture.stagingDir,
      supportedSchemaVersion: 3
    });
    const missingFile = path.join(fixture.dir, "missing.xhsmigrate");

    const failure = await service.preview({
      kind: "migration-package",
      filePath: missingFile
    }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(DataRestoreError);
    expect((failure as Error & { statusCode: number }).statusCode).toBe(422);
    expect((failure as Error).message).not.toContain(fixture.dir);
    fixture.database.close();
  });

  it("releases a cancelled prepared restore so the user can retry immediately", async () => {
    const fixture = await createRestoreFixture();
    const { DataRestoreService } = await import("../src/server/storage/dataRestoreService.js");
    const service = new DataRestoreService(fixture.backupService, {
      databaseFile: fixture.databaseFile,
      stagingDir: fixture.stagingDir,
      supportedSchemaVersion: 3
    });
    const preview = await service.preview({ kind: "migration-package", filePath: fixture.migrationFile });
    const first = await service.prepare({
      source: { kind: "migration-package", filePath: fixture.migrationFile },
      fingerprint: preview.fingerprint
    });

    await service.discardPreparedRestore(first.restoreId);
    const second = await service.prepare({
      source: { kind: "migration-package", filePath: fixture.migrationFile },
      fingerprint: preview.fingerprint
    });
    expect(second.restoreId).not.toBe(first.restoreId);
    fixture.database.close();
  });

  it("ignores a damaged restore journal when the live database is still valid", async () => {
    const fixture = await createRestoreFixture();
    fixture.database.close();
    await mkdir(fixture.stagingDir, { recursive: true });
    const journal = path.join(fixture.stagingDir, "restore-journal.json");
    await writeFile(journal, "{incomplete", "utf8");

    const { recoverInterruptedDatabaseRestore } = await import("../src/server/storage/dataRestoreService.js");
    await expect(recoverInterruptedDatabaseRestore(fixture.stagingDir, fixture.databaseFile)).resolves.toBeUndefined();
    await expect(readFile(journal, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    const { openApplicationDatabase } = await import("../src/server/storage/database.js");
    const live = openApplicationDatabase(fixture.databaseFile);
    expect(live.connection.prepare("PRAGMA quick_check").get()).toEqual({ quick_check: "ok" });
    live.close();
  });

  it("rolls back the previous database after interruption between the two renames", async () => {
    const fixture = await createRestoreFixture();
    fixture.database.close();
    await mkdir(fixture.stagingDir, { recursive: true });
    const previous = path.join(fixture.stagingDir, "previous-interrupted.db");
    const candidate = path.join(fixture.stagingDir, "restore-interrupted.db");
    const { rename } = await import("node:fs/promises");
    await rename(fixture.databaseFile, previous);
    await writeFile(path.join(fixture.stagingDir, "restore-journal.json"), JSON.stringify({
      databaseFile: fixture.databaseFile,
      candidateDatabaseFile: candidate,
      previousDatabaseFile: previous
    }), "utf8");

    const { recoverInterruptedDatabaseRestore } = await import("../src/server/storage/dataRestoreService.js");
    await recoverInterruptedDatabaseRestore(fixture.stagingDir, fixture.databaseFile);
    const { openApplicationDatabase } = await import("../src/server/storage/database.js");
    const restored = openApplicationDatabase(fixture.databaseFile);
    expect(restored.connection.prepare("PRAGMA quick_check").get()).toEqual({ quick_check: "ok" });
    restored.close();
  });

  it("keeps a valid candidate already moved into place and removes the previous database", async () => {
    const fixture = await createRestoreFixture();
    fixture.database.close();
    await mkdir(fixture.stagingDir, { recursive: true });
    const previous = path.join(fixture.stagingDir, "previous-completed.db");
    const candidate = path.join(fixture.stagingDir, "restore-completed.db");
    await copyFile(fixture.databaseFile, previous);
    await writeFile(path.join(fixture.stagingDir, "restore-journal.json"), JSON.stringify({
      databaseFile: fixture.databaseFile,
      candidateDatabaseFile: candidate,
      previousDatabaseFile: previous
    }), "utf8");

    const { recoverInterruptedDatabaseRestore } = await import("../src/server/storage/dataRestoreService.js");
    await recoverInterruptedDatabaseRestore(fixture.stagingDir, fixture.databaseFile);
    await expect(readFile(previous)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("atomically replaces the closed database and keeps a recoverable journal", async () => {
    const fixture = await createRestoreFixture();
    const replacement = path.join(fixture.dir, "replacement.db");
    const { openApplicationDatabase } = await import("../src/server/storage/database.js");
    const candidate = openApplicationDatabase(replacement);
    candidate.connection.prepare(
      "INSERT INTO app_state (key, value_json, updated_at) VALUES (?, ?, ?)"
    ).run("rateLimit", JSON.stringify({ budgetDate: "2026-07-22", consumedToday: 9 }), "2026-07-22T09:00:00.000Z");
    candidate.close();
    fixture.database.close();

    const { replaceDatabaseFromPreparedRestore } = await import("../src/server/storage/dataRestoreService.js");
    await replaceDatabaseFromPreparedRestore({
      databaseFile: fixture.databaseFile,
      candidateDatabaseFile: replacement,
      stagingDir: fixture.stagingDir,
      sourceKind: "migration-package"
    });

    const restored = openApplicationDatabase(fixture.databaseFile);
    expect(restored.connection.prepare("SELECT value_json FROM app_state WHERE key = 'rateLimit'").get())
      .toMatchObject({ value_json: expect.stringContaining("consumedToday") });
    restored.close();
  });
});

async function createRestoreFixture() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "xhs-restore-service-"));
  tempDirs.push(dir);
  const databaseFile = path.join(dir, "app.db");
  const stagingDir = path.join(dir, "staging");
  const migrationFile = path.join(dir, "portable.xhsmigrate");
  const { openApplicationDatabase } = await import("../src/server/storage/database.js");
  const database = openApplicationDatabase(databaseFile);
  const { BackupService } = await import("../src/server/storage/backupService.js");
  const backupService = new BackupService(database, {
    backupsDir: path.join(dir, "backups"),
    stagingDir,
    appVersion: "0.5.0",
    now: () => new Date("2026-07-22T08:00:00.000Z")
  });
  await backupService.exportMigrationPackage(migrationFile);
  return { dir, databaseFile, stagingDir, migrationFile, database, backupService };
}
