import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("backup service", () => {
  it("creates a consistent full backup from the live WAL database", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "xhs-backup-service-"));
    tempDirs.push(dir);
    const { openApplicationDatabase } = await import("../src/server/storage/database.js");
    const database = openApplicationDatabase(path.join(dir, "app.db"));
    database.connection.prepare(
      "INSERT INTO app_state (key, value_json, updated_at) VALUES (?, ?, ?)"
    ).run("rateLimit", JSON.stringify({ budgetDate: "2026-07-22", consumedToday: 2 }), "2026-07-22T08:00:00.000Z");

    const { BackupService } = await import("../src/server/storage/backupService.js");
    const service = new BackupService(database, {
      backupsDir: path.join(dir, "backups"),
      stagingDir: path.join(dir, "staging"),
      appVersion: "0.5.0",
      now: () => new Date("2026-07-22T08:00:00.000Z")
    });
    const record = await service.createBackup("manual");
    const preview = await service.previewBackup(record.id);

    expect(record).toMatchObject({ kind: "manual", schemaVersion: 3, credentialsIncluded: true });
    expect(preview.manifest.counts.rateLimit).toBe(1);
    expect(preview.database.connection.prepare(
      "SELECT value_json FROM app_state WHERE key = ?"
    ).get("rateLimit")).toMatchObject({ value_json: expect.stringContaining("consumedToday") });
    preview.database.close();
    database.close();
  });

  it("creates at most one daily backup for the same local date", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "xhs-daily-backup-"));
    tempDirs.push(dir);
    const { openApplicationDatabase } = await import("../src/server/storage/database.js");
    const database = openApplicationDatabase(path.join(dir, "app.db"));
    const { BackupService } = await import("../src/server/storage/backupService.js");
    const service = new BackupService(database, {
      backupsDir: path.join(dir, "backups"),
      stagingDir: path.join(dir, "staging"),
      appVersion: "0.5.0",
      now: () => new Date("2026-07-22T18:00:00.000Z")
    });

    const first = await service.ensureDailyBackup();
    const second = await service.ensureDailyBackup();
    const status = await service.getStatus();

    expect(first?.id).toBeTruthy();
    expect(second).toBeUndefined();
    expect(status.backups.filter((item) => item.kind === "daily")).toHaveLength(1);
    database.close();
  });

  it("keeps the newest seven daily, newest three safety, and every manual backup", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "xhs-backup-retention-"));
    tempDirs.push(dir);
    const { openApplicationDatabase } = await import("../src/server/storage/database.js");
    const database = openApplicationDatabase(path.join(dir, "app.db"));
    const { BackupService } = await import("../src/server/storage/backupService.js");
    let current = new Date("2026-07-01T08:00:00.000Z");
    const service = new BackupService(database, {
      backupsDir: path.join(dir, "backups"),
      stagingDir: path.join(dir, "staging"),
      appVersion: "0.5.0",
      now: () => current
    });

    for (let index = 0; index < 8; index += 1) {
      current = new Date(`2026-07-${String(index + 1).padStart(2, "0")}T08:00:00.000Z`);
      await service.createBackup("daily");
    }
    current = new Date("2026-07-10T08:00:00.000Z");
    await service.createBackup("pre-upgrade");
    current = new Date("2026-07-11T08:00:00.000Z");
    await service.createBackup("pre-restore");
    current = new Date("2026-07-12T08:00:00.000Z");
    await service.createBackup("pre-upgrade");
    current = new Date("2026-07-13T08:00:00.000Z");
    await service.createBackup("pre-restore");
    current = new Date("2026-07-14T08:00:00.000Z");
    await service.createBackup("manual");
    current = new Date("2026-07-15T08:00:00.000Z");
    await service.createBackup("manual");

    const status = await service.getStatus();
    expect(status.backups.filter((item) => item.kind === "daily")).toHaveLength(7);
    const safety = status.backups.filter((item) => ["pre-upgrade", "pre-restore"].includes(item.kind));
    expect(safety).toHaveLength(3);
    expect(safety.map((item) => item.createdAt)).toEqual([
      "2026-07-13T08:00:00.000Z",
      "2026-07-12T08:00:00.000Z",
      "2026-07-11T08:00:00.000Z"
    ]);
    expect(status.backups.filter((item) => item.kind === "manual")).toHaveLength(2);
    database.close();
  });

  it("exports a credential-free migration snapshot and pauses unfinished work", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "xhs-migration-package-"));
    tempDirs.push(dir);
    const { openApplicationDatabase } = await import("../src/server/storage/database.js");
    const database = openApplicationDatabase(path.join(dir, "app.db"));
    const now = "2026-07-22T08:00:00.000Z";
    database.connection.prepare(
      "INSERT INTO app_state (key, value_json, updated_at) VALUES (?, ?, ?)"
    ).run("authStatus", JSON.stringify({ connected: true, configured: true }), now);
    const credentialMarker = "D005_SECRET_CREDENTIAL_MARKER_MUST_NOT_MIGRATE";
    const pairingMarker = "D005_PAIRING_HASH_MARKER_1234567";
    database.connection.prepare(`
      INSERT INTO secure_credentials (credential_key, encrypted_value, provider, created_at, updated_at)
      VALUES (?, ?, 'electron-safe-storage', ?, ?)
    `).run("credential-fixture", Buffer.from(credentialMarker, "utf8"), now, now);
    database.connection.prepare(`
      INSERT INTO browser_extension_pairing (
        singleton_id, token_hash, extension_id, browser, paired_at, last_seen_at
      ) VALUES (1, ?, ?, 'edge', ?, ?)
    `).run(Buffer.from(pairingMarker, "utf8"), "a".repeat(32), now, now);
    const runningJob = {
      id: "job-running", keywords: ["蜂蜜露"], sort: "general", noteType: "all", pages: 1,
      commentPages: 1, status: "running", createdAt: now, updatedAt: now,
      progress: { seeded: 0, pending: 0, running: 0, done: 0, error: 0, total: 0 }
    };
    database.connection.prepare(`
      INSERT INTO search_jobs (id, status, created_at, updated_at, position, data_json)
      VALUES (?, ?, ?, ?, 0, ?)
    `).run(runningJob.id, runningJob.status, now, now, JSON.stringify(runningJob));

    const { BackupService } = await import("../src/server/storage/backupService.js");
    const service = new BackupService(database, {
      backupsDir: path.join(dir, "backups"),
      stagingDir: path.join(dir, "staging"),
      appVersion: "0.5.0",
      now: () => new Date(now)
    });
    const destination = path.join(dir, "portable.xhsmigrate");
    const result = await service.exportMigrationPackage(destination);
    const { extractDataPackage } = await import("../src/server/storage/dataPackage.js");
    const extracted = path.join(dir, "portable.db");
    const packageResult = await extractDataPackage(destination, extracted);
    const portable = openApplicationDatabase(extracted);

    expect(result.credentialsIncluded).toBe(false);
    expect(packageResult.manifest.kind).toBe("credential-free-migration");
    expect(portable.connection.prepare("SELECT COUNT(*) AS count FROM secure_credentials").get()).toEqual({ count: 0 });
    expect(portable.connection.prepare("SELECT COUNT(*) AS count FROM browser_extension_pairing").get()).toEqual({ count: 0 });
    expect(portable.connection.prepare("SELECT COUNT(*) AS count FROM app_state WHERE key = 'authStatus'").get()).toEqual({ count: 0 });
    const job = portable.connection.prepare("SELECT status, data_json FROM search_jobs WHERE id = ?").get(runningJob.id) as {
      status: string;
      data_json: string;
    };
    expect(job.status).toBe("paused");
    expect(JSON.parse(job.data_json)).toMatchObject({ status: "paused" });
    portable.close();
    const portableBytes = await readFile(extracted);
    expect(portableBytes.includes(Buffer.from(credentialMarker, "utf8"))).toBe(false);
    expect(portableBytes.includes(Buffer.from(pairingMarker, "utf8"))).toBe(false);
    database.close();
  });

  it("returns a sanitized backup error without exposing the local directory", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "xhs-backup-error-"));
    tempDirs.push(dir);
    const { openApplicationDatabase } = await import("../src/server/storage/database.js");
    const database = openApplicationDatabase(path.join(dir, "app.db"));
    const blocked = path.join(dir, "blocked-backups");
    await writeFile(blocked, "not-a-directory", "utf8");
    const { BackupService, BackupServiceError } = await import("../src/server/storage/backupService.js");
    const service = new BackupService(database, {
      backupsDir: blocked,
      stagingDir: path.join(dir, "staging"),
      appVersion: "0.5.0"
    });

    const failure = await service.createBackup("manual").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(BackupServiceError);
    expect((failure as Error).message).not.toContain(dir);
    database.close();
  });
});
