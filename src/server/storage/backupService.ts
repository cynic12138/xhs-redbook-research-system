import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { backup as sqliteBackup } from "node:sqlite";
import type { BackupKind, BackupRecord, BackupStatus } from "../../shared/types.js";
import type { MigrationPackageResult } from "../../shared/types.js";
import type { ApplicationDatabase } from "./database.js";
import { openApplicationDatabase } from "./database.js";
import { extractDataPackage, readDataPackageManifest, writeDataPackage, type DataPackageManifest } from "./dataPackage.js";
import { inspectDatabaseFile } from "./databaseInspection.js";

const DAILY_RETENTION = 7 as const;
const SAFETY_RETENTION = 3 as const;

export interface BackupServiceOptions {
  backupsDir: string;
  stagingDir: string;
  appVersion: string;
  now?: () => Date;
}

export interface BackupPreviewHandle {
  manifest: DataPackageManifest;
  fingerprint: string;
  database: ApplicationDatabase;
}

export class BackupServiceError extends Error {
  constructor(message: string, readonly statusCode: 400 | 422, options?: ErrorOptions) {
    super(message, options);
    this.name = "BackupServiceError";
  }
}

export class BackupService {
  private readonly now: () => Date;
  private warning: string | undefined;

  constructor(
    readonly database: ApplicationDatabase,
    readonly options: BackupServiceOptions
  ) {
    this.now = options.now ?? (() => new Date());
  }

  async createBackup(kind: BackupKind): Promise<BackupRecord> {
    const createdAt = this.now();
    const directory = this.directoryFor(kind);
    const id = `${kind}-${formatFileTimestamp(createdAt)}-${randomUUID().slice(0, 8)}.xhsbackup`;
    const packageFile = path.join(directory, id);
    const snapshotFile = path.join(this.options.stagingDir, `${randomUUID()}.db`);
    const verificationFile = path.join(this.options.stagingDir, `verify-${randomUUID()}.db`);
    try {
      await Promise.all([mkdir(directory, { recursive: true }), mkdir(this.options.stagingDir, { recursive: true })]);
      await sqliteBackup(this.database.connection, snapshotFile);
      const inspected = inspectSnapshot(snapshotFile);
      await writeDataPackage({
        sourceDatabaseFile: snapshotFile,
        destinationFile: packageFile,
        kind: "full-backup",
        appVersion: this.options.appVersion,
        schemaVersion: inspected.schemaVersion,
        counts: inspected.counts,
        credentialsIncluded: true,
        createdAt: createdAt.toISOString()
      });
      await verifyWrittenPackage(packageFile, verificationFile, {
        kind: "full-backup",
        schemaVersion: inspected.schemaVersion,
        counts: inspected.counts,
        credentialsIncluded: true
      });
      const fileStat = await stat(packageFile);
      this.warning = undefined;
      await this.enforceRetention(kind);
      return {
        id,
        kind,
        createdAt: createdAt.toISOString(),
        appVersion: this.options.appVersion,
        schemaVersion: inspected.schemaVersion,
        sizeBytes: fileStat.size,
        credentialsIncluded: true
      };
    } catch (error) {
      await rm(packageFile, { force: true }).catch(() => undefined);
      if (error instanceof BackupServiceError) throw error;
      throw new BackupServiceError("备份创建失败，请检查可用磁盘空间后重试。", 422, { cause: error });
    } finally {
      await Promise.all([
        rm(snapshotFile, { force: true }),
        rm(verificationFile, { force: true })
      ]).catch(() => undefined);
    }
  }

  async ensureDailyBackup(): Promise<BackupRecord | undefined> {
    const dateKey = formatLocalDate(this.now());
    const existing = (await this.listBackups()).some(
      (item) => item.kind === "daily" && formatLocalDate(new Date(item.createdAt)) === dateKey
    );
    if (existing) return undefined;
    try {
      return await this.createBackup("daily");
    } catch {
      this.warning = "今日自动备份失败，请在数据存储中点击“立即备份”重试。";
      return undefined;
    }
  }

  async exportMigrationPackage(destinationFile: string): Promise<MigrationPackageResult> {
    if (!destinationFile.toLowerCase().endsWith(".xhsmigrate")) {
      throw new BackupServiceError("迁移包文件名必须以 .xhsmigrate 结尾。", 400);
    }
    const snapshotFile = path.join(this.options.stagingDir, `migration-${randomUUID()}.db`);
    try {
      await mkdir(this.options.stagingDir, { recursive: true });
      await sqliteBackup(this.database.connection, snapshotFile);
      sanitizeMigrationSnapshot(snapshotFile, this.now().toISOString());
      const inspected = inspectSnapshot(snapshotFile);
      await writeDataPackage({
        sourceDatabaseFile: snapshotFile,
        destinationFile,
        kind: "credential-free-migration",
        appVersion: this.options.appVersion,
        schemaVersion: inspected.schemaVersion,
        counts: inspected.counts,
        credentialsIncluded: false,
        createdAt: this.now().toISOString()
      });
      const extracted = path.join(this.options.stagingDir, `verify-${randomUUID()}.db`);
      try {
        const verification = await verifyWrittenPackage(destinationFile, extracted, {
          kind: "credential-free-migration",
          schemaVersion: inspected.schemaVersion,
          counts: inspected.counts,
          credentialsIncluded: false
        });
        const packageStat = await stat(destinationFile);
        return {
          fileName: path.basename(destinationFile),
          sizeBytes: packageStat.size,
          sha256: verification.fingerprint,
          counts: inspected.counts,
          credentialsIncluded: false
        };
      } finally {
        await rm(extracted, { force: true }).catch(() => undefined);
      }
    } catch (error) {
      if (error instanceof BackupServiceError) throw error;
      throw new BackupServiceError("迁移包导出失败，请检查目标位置和可用磁盘空间后重试。", 422, { cause: error });
    } finally {
      await rm(snapshotFile, { force: true }).catch(() => undefined);
    }
  }

  async getStatus(): Promise<BackupStatus> {
    try {
      const backups = await this.listBackups();
      return {
        state: this.warning ? "warning" : "ready",
        lastAutomaticBackupAt: backups.find((item) => item.kind === "daily")?.createdAt,
        warning: this.warning,
        retention: { daily: DAILY_RETENTION, safety: SAFETY_RETENTION },
        backups
      };
    } catch (error) {
      throw new BackupServiceError("备份状态读取失败，请稍后重试。", 422, { cause: error });
    }
  }

  async previewBackup(id: string): Promise<BackupPreviewHandle> {
    const packageFile = await this.resolveBackupFile(id);
    await mkdir(this.options.stagingDir, { recursive: true });
    const extracted = path.join(this.options.stagingDir, `preview-${randomUUID()}.db`);
    const result = await extractDataPackage(packageFile, extracted);
    const database = openApplicationDatabase(extracted);
    validateConnection(database);
    return { manifest: result.manifest, fingerprint: result.fingerprint, database };
  }

  async resolveBackupFile(id: string): Promise<string> {
    if (!/^[a-z-]+-[0-9TZ-]+-[a-f0-9]{8}\.xhsbackup$/.test(id) || path.basename(id) !== id) {
      throw new Error("备份标识无效。");
    }
    for (const directory of [this.directoryFor("daily"), this.directoryFor("manual"), this.directoryFor("pre-restore")]) {
      const candidate = path.join(directory, id);
      if (existsSync(candidate)) return candidate;
    }
    throw new Error("备份不存在或已被移动。");
  }

  private async listBackups(): Promise<BackupRecord[]> {
    const records: BackupRecord[] = [];
    for (const [directory, fallbackKind] of [
      [this.directoryFor("daily"), "daily"],
      [this.directoryFor("manual"), "manual"],
      [this.directoryFor("pre-restore"), "pre-restore"]
    ] as const) {
      await mkdir(directory, { recursive: true });
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(".xhsbackup")) continue;
        try {
          const file = path.join(directory, entry.name);
          const [header, fileStat] = await Promise.all([readDataPackageManifest(file), stat(file)]);
          const parsedKind = parseBackupKind(entry.name) ?? fallbackKind;
          records.push({
            id: entry.name,
            kind: parsedKind,
            createdAt: header.manifest.createdAt,
            appVersion: header.manifest.appVersion,
            schemaVersion: header.manifest.schemaVersion,
            sizeBytes: fileStat.size,
            credentialsIncluded: header.manifest.credentialsIncluded
          });
        } catch {
          this.warning = "检测到无法读取的备份文件，请打开备份目录检查。";
        }
      }
    }
    return records.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  private directoryFor(kind: BackupKind): string {
    if (kind === "daily") return path.join(this.options.backupsDir, "daily");
    if (kind === "manual") return path.join(this.options.backupsDir, "manual");
    return path.join(this.options.backupsDir, "safety");
  }

  private async enforceRetention(kind: BackupKind): Promise<void> {
    if (kind === "manual") return;
    const limit = kind === "daily" ? DAILY_RETENTION : SAFETY_RETENTION;
    const directory = this.directoryFor(kind);
    const files = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".xhsbackup"))
      .map((entry) => entry.name);
    const datedFiles = (await Promise.all(files.map(async (file) => {
      try {
        const header = await readDataPackageManifest(path.join(directory, file));
        return { file, createdAt: header.manifest.createdAt };
      } catch {
        return undefined;
      }
    }))).filter((item): item is { file: string; createdAt: string } => Boolean(item));
    datedFiles.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    for (const item of datedFiles.slice(limit)) {
      await rm(path.join(directory, item.file), { force: true });
    }
  }
}

async function verifyWrittenPackage(
  packageFile: string,
  extractedFile: string,
  expected: Pick<DataPackageManifest, "kind" | "schemaVersion" | "counts" | "credentialsIncluded">
): Promise<{ fingerprint: string }> {
  const verification = await extractDataPackage(packageFile, extractedFile);
  const inspection = inspectDatabaseFile(extractedFile);
  if (
    verification.manifest.kind !== expected.kind
    || verification.manifest.schemaVersion !== expected.schemaVersion
    || verification.manifest.credentialsIncluded !== expected.credentialsIncluded
    || JSON.stringify(verification.manifest.counts) !== JSON.stringify(expected.counts)
    || JSON.stringify(inspection.counts) !== JSON.stringify(expected.counts)
    || (expected.kind === "credential-free-migration" && (
      inspection.encryptedCredentialCount > 0
      || inspection.extensionPairingCount > 0
      || inspection.machineAuthStateCount > 0
    ))
  ) {
    throw new Error("数据包写入后校验失败。");
  }
  return { fingerprint: verification.fingerprint };
}

function inspectSnapshot(file: string): { schemaVersion: number; counts: Record<string, number> } {
  const inspection = inspectDatabaseFile(file);
  return { schemaVersion: inspection.schemaVersion, counts: inspection.counts };
}

function validateConnection(database: ApplicationDatabase): void {
  const quick = database.connection.prepare("PRAGMA quick_check").all() as Array<{ quick_check: string }>;
  if (quick.length !== 1 || quick[0]?.quick_check !== "ok") throw new Error("SQLite 完整性校验失败。");
  const foreignKeys = database.connection.prepare("PRAGMA foreign_key_check").all();
  if (foreignKeys.length) throw new Error("SQLite 外键校验失败。");
}

function sanitizeMigrationSnapshot(file: string, timestamp: string): void {
  const database = openApplicationDatabase(file);
  const connection = database.connection;
  connection.exec("PRAGMA secure_delete = ON");
  connection.exec("BEGIN IMMEDIATE");
  try {
    connection.exec(`
      DELETE FROM secure_credentials;
      DELETE FROM browser_extension_pairing;
      DELETE FROM app_state WHERE key IN ('authStatus', 'browserBridgeStatus');
      UPDATE legacy_imports SET source_label = 'credential-free-migration-package';
    `);
    transformStatusRows(connection, "search_jobs", ["running"], "paused", timestamp, (value) => ({
      ...value,
      status: "paused",
      breakerReason: "迁移包导出时任务尚未完成，已安全暂停。",
      updatedAt: timestamp
    }));
    transformStatusRows(connection, "queue_items", ["running"], "pending", timestamp, (value) => ({
      ...value,
      status: "pending",
      updatedAt: timestamp
    }));
    transformStatusRows(connection, "reply_actions", ["queued", "sending"], "paused", timestamp, (value) => ({
      ...value,
      status: "paused",
      error: "迁移包导出时操作尚未完成，已安全暂停。",
      updatedAt: timestamp
    }));
    transformStatusRows(connection, "reply_plans", ["sending"], "paused", timestamp, (value) => ({
      ...value,
      status: "paused",
      updatedAt: timestamp
    }));
    transformStatusRows(connection, "ai_goal_runs", ["waiting_confirmation", "running", "waiting"], "cancelled", timestamp, (value) => ({
      ...value,
      status: "cancelled",
      error: "迁移包导出时任务尚未完成，已取消。",
      updatedAt: timestamp
    }));
    transformStatusRows(connection, "ai_orchestrations", ["queued", "running", "waiting"], "cancelled", timestamp, (value) => ({
      ...value,
      status: "cancelled",
      error: "迁移包导出时编排尚未完成，已取消。",
      updatedAt: timestamp
    }));
    connection.exec("COMMIT");
  } catch (error) {
    connection.exec("ROLLBACK");
    database.close();
    throw error;
  }
  try {
    connection.exec("VACUUM");
    connection.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  } finally {
    database.close();
  }
}

function transformStatusRows(
  connection: ApplicationDatabase["connection"],
  table: string,
  sourceStatuses: string[],
  targetStatus: string,
  timestamp: string,
  transform: (value: Record<string, unknown>) => Record<string, unknown>
): void {
  const placeholders = sourceStatuses.map(() => "?").join(", ");
  const rows = connection.prepare(
    `SELECT id, data_json FROM ${table} WHERE status IN (${placeholders})`
  ).all(...sourceStatuses) as Array<{ id: string; data_json: string }>;
  const update = connection.prepare(
    `UPDATE ${table} SET status = ?, updated_at = ?, data_json = ? WHERE id = ?`
  );
  for (const row of rows) {
    const value = JSON.parse(row.data_json) as Record<string, unknown>;
    update.run(targetStatus, timestamp, JSON.stringify(transform(value)), row.id);
  }
}

function formatFileTimestamp(value: Date): string {
  return value.toISOString().replace(/[:.]/g, "-");
}

function formatLocalDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseBackupKind(fileName: string): BackupKind | undefined {
  return (["pre-upgrade", "pre-restore", "daily", "manual"] as BackupKind[])
    .find((kind) => fileName.startsWith(`${kind}-`));
}
