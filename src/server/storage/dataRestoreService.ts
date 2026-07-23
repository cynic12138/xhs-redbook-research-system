import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DataRestorePreview, PreparedDataRestore } from "../../shared/types.js";
import type { BackupService } from "./backupService.js";
import { extractDataPackage } from "./dataPackage.js";
import { inspectDatabaseFile } from "./databaseInspection.js";

export type DataRestoreSource =
  | { kind: "backup"; backupId: string }
  | { kind: "migration-package"; filePath: string };

export interface PreparedRestoreHandle {
  restoreId: string;
  candidateDatabaseFile: string;
  sourceKind: DataRestorePreview["sourceKind"];
  expiresAt: string;
}

export class DataRestoreError extends Error {
  constructor(message: string, readonly statusCode: 409 | 422, options?: ErrorOptions) {
    super(message, options);
    this.name = "DataRestoreError";
  }
}

export class DataRestoreService {
  private readonly now: () => Date;
  private readonly prepared = new Map<string, PreparedRestoreHandle>();

  constructor(
    readonly backups: BackupService,
    readonly options: {
      databaseFile: string;
      stagingDir: string;
      supportedSchemaVersion: number;
      now?: () => Date;
    }
  ) {
    this.now = options.now ?? (() => new Date());
  }

  async preview(source: DataRestoreSource): Promise<DataRestorePreview> {
    await mkdir(this.options.stagingDir, { recursive: true });
    const candidate = path.join(this.options.stagingDir, `preview-${randomUUID()}.db`);
    try {
      return await this.inspectSource(source, candidate);
    } finally {
      await removeDatabaseFiles(candidate);
    }
  }

  async prepare(input: { source: DataRestoreSource; fingerprint: string }): Promise<PreparedDataRestore> {
    this.removeExpiredPlans();
    if (this.prepared.size) throw new DataRestoreError("已有恢复任务等待执行，请先完成或重启应用后再试。", 409);
    await mkdir(this.options.stagingDir, { recursive: true });
    const candidateDatabaseFile = path.join(this.options.stagingDir, `restore-${randomUUID()}.db`);
    try {
      const preview = await this.inspectSource(input.source, candidateDatabaseFile);
      if (preview.fingerprint !== input.fingerprint) {
        throw new DataRestoreError("数据包在预检后发生变化，请重新预检。", 409);
      }
      const restoreId = randomUUID();
      const expiresAt = new Date(this.now().getTime() + 15 * 60_000).toISOString();
      this.prepared.set(restoreId, {
        restoreId,
        candidateDatabaseFile,
        sourceKind: preview.sourceKind,
        expiresAt
      });
      return { restoreId, expiresAt, preview };
    } catch (error) {
      await removeDatabaseFiles(candidateDatabaseFile);
      throw error;
    }
  }

  getPreparedRestore(restoreId: string): PreparedRestoreHandle {
    this.removeExpiredPlans();
    const plan = this.prepared.get(restoreId);
    if (!plan) throw new Error("恢复任务不存在或已过期，请重新预检。");
    return plan;
  }

  consumePreparedRestore(restoreId: string): PreparedRestoreHandle {
    const plan = this.getPreparedRestore(restoreId);
    this.prepared.delete(restoreId);
    return plan;
  }

  async discardPreparedRestore(restoreId: string): Promise<void> {
    const plan = this.prepared.get(restoreId);
    if (!plan) return;
    this.prepared.delete(restoreId);
    await removeDatabaseFiles(plan.candidateDatabaseFile);
  }

  private async inspectSource(source: DataRestoreSource, candidate: string): Promise<DataRestorePreview> {
    try {
      const packageFile = source.kind === "backup"
        ? await this.backups.resolveBackupFile(source.backupId)
        : source.filePath;
      const extracted = await extractDataPackage(packageFile, candidate);
      const inspection = inspectDatabaseFile(candidate);
      const expectedKind = source.kind === "backup" ? "full-backup" : "credential-free-migration";
      if (extracted.manifest.kind !== expectedKind) throw new Error("数据包类型与当前恢复入口不一致。");
      if (inspection.schemaVersion > this.options.supportedSchemaVersion) {
        throw new Error("数据包数据库版本高于当前应用支持版本，请先升级应用。");
      }
      if (JSON.stringify(inspection.counts) !== JSON.stringify(extracted.manifest.counts)) {
        throw new Error("数据包记录数量校验失败，文件可能已损坏。");
      }
      if (source.kind === "migration-package" && (
        inspection.encryptedCredentialCount > 0
        || inspection.extensionPairingCount > 0
        || inspection.machineAuthStateCount > 0
        || extracted.manifest.credentialsIncluded
      )) {
        throw new Error("迁移包包含本机凭证或账号状态，已拒绝导入。");
      }
      return {
        sourceKind: source.kind,
        createdAt: extracted.manifest.createdAt,
        appVersion: extracted.manifest.appVersion,
        schemaVersion: inspection.schemaVersion,
        sizeBytes: extracted.packageBytes,
        counts: inspection.counts,
        credentialsIncluded: extracted.manifest.credentialsIncluded,
        fingerprint: extracted.fingerprint,
        warnings: source.kind === "backup"
          ? ["本机完整备份可能包含仅当前 Windows 用户可解密的凭证。", "恢复会完整替换当前数据库并重启应用。"]
          : ["迁移包不包含登录凭证，导入后需要重新连接小红书并配置模型 Key。", "恢复会完整替换当前数据库并重启应用。"],
        requiresRestart: true
      };
    } catch (error) {
      if (error instanceof DataRestoreError) throw error;
      const message = safeRestorePackageErrorMessage(error);
      throw new DataRestoreError(message, 422, { cause: error });
    }
  }

  private removeExpiredPlans(): void {
    const now = this.now().getTime();
    for (const [id, plan] of this.prepared) {
      if (new Date(plan.expiresAt).getTime() > now) continue;
      this.prepared.delete(id);
      void removeDatabaseFiles(plan.candidateDatabaseFile);
    }
  }
}

function safeRestorePackageErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const safePrefixes = [
    "所选文件不是有效的",
    "数据包",
    "SQLite ",
    "迁移包",
    "备份标识无效",
    "备份不存在或已被移动"
  ];
  return safePrefixes.some((prefix) => message.startsWith(prefix))
    ? message
    : "数据包损坏、不可读取或不符合当前版本要求。";
}

export async function replaceDatabaseFromPreparedRestore(input: {
  databaseFile: string;
  candidateDatabaseFile: string;
  stagingDir: string;
  sourceKind: DataRestorePreview["sourceKind"];
}): Promise<void> {
  inspectDatabaseFile(input.candidateDatabaseFile);
  await mkdir(input.stagingDir, { recursive: true });
  const previousDatabaseFile = path.join(input.stagingDir, `previous-${randomUUID()}.db`);
  const journalFile = path.join(input.stagingDir, "restore-journal.json");
  const journal = {
    databaseFile: input.databaseFile,
    candidateDatabaseFile: input.candidateDatabaseFile,
    previousDatabaseFile,
    sourceKind: input.sourceKind,
    phase: "prepared"
  };
  await writeRestoreJournal(journalFile, journal);
  await removeSidecars(input.databaseFile);
  let previousMoved = false;
  try {
    if (existsSync(input.databaseFile)) {
      await rename(input.databaseFile, previousDatabaseFile);
      previousMoved = true;
    }
    await rename(input.candidateDatabaseFile, input.databaseFile);
    inspectDatabaseFile(input.databaseFile);
    await rm(journalFile, { force: true }).catch(() => undefined);
    await removeDatabaseFiles(previousDatabaseFile);
  } catch (error) {
    await removeDatabaseFiles(input.databaseFile);
    if (previousMoved && existsSync(previousDatabaseFile)) {
      await rename(previousDatabaseFile, input.databaseFile);
    }
    await rm(journalFile, { force: true }).catch(() => undefined);
    throw new Error("数据库恢复失败，原数据库已保留。", { cause: error });
  }
}

export async function recoverInterruptedDatabaseRestore(stagingDir: string, databaseFile: string): Promise<void> {
  const journalFile = path.join(stagingDir, "restore-journal.json");
  if (!existsSync(journalFile)) return;
  let journal: {
    databaseFile: string;
    candidateDatabaseFile: string;
    previousDatabaseFile: string;
  };
  try {
    journal = JSON.parse(await readFile(journalFile, "utf8")) as typeof journal;
    if (!isSafeRestoreJournal(journal, stagingDir, databaseFile)) {
      throw new Error("恢复日志路径无效。");
    }
  } catch (error) {
    if (existsSync(databaseFile)) {
      inspectDatabaseFile(databaseFile);
      await rm(journalFile, { force: true });
      return;
    }
    throw new Error("检测到损坏的数据恢复日志，且当前数据库不可用，请从备份目录手动恢复。", { cause: error });
  }
  try {
    if (existsSync(journal.databaseFile)) {
      inspectDatabaseFile(journal.databaseFile);
      await removeDatabaseFiles(journal.previousDatabaseFile);
      await removeDatabaseFiles(journal.candidateDatabaseFile);
      await rm(journalFile, { force: true });
      return;
    }
  } catch {
    await removeDatabaseFiles(journal.databaseFile);
  }
  if (!existsSync(journal.previousDatabaseFile)) {
    throw new Error("检测到未完成的数据恢复，但原数据库不可用，请从备份目录手动恢复。");
  }
  await rename(journal.previousDatabaseFile, journal.databaseFile);
  inspectDatabaseFile(journal.databaseFile);
  await removeDatabaseFiles(journal.candidateDatabaseFile);
  await rm(journalFile, { force: true });
}

async function writeRestoreJournal(file: string, value: object): Promise<void> {
  const temporaryFile = `${file}.partial-${process.pid}-${randomUUID()}`;
  try {
    await writeFile(temporaryFile, JSON.stringify(value), { encoding: "utf8", flag: "wx" });
    await rename(temporaryFile, file);
  } catch (error) {
    await rm(temporaryFile, { force: true }).catch(() => undefined);
    throw error;
  }
}

function isSafeRestoreJournal(
  journal: { databaseFile: string; candidateDatabaseFile: string; previousDatabaseFile: string },
  stagingDir: string,
  databaseFile: string
): boolean {
  const resolvedStaging = path.resolve(stagingDir);
  const isStagedDatabase = (file: string, prefix: string) =>
    path.dirname(path.resolve(file)) === resolvedStaging
    && path.basename(file).startsWith(prefix)
    && path.basename(file).endsWith(".db");
  return path.resolve(journal.databaseFile) === path.resolve(databaseFile)
    && isStagedDatabase(journal.candidateDatabaseFile, "restore-")
    && isStagedDatabase(journal.previousDatabaseFile, "previous-");
}

async function removeSidecars(databaseFile: string): Promise<void> {
  await Promise.all([
    rm(`${databaseFile}-wal`, { force: true }),
    rm(`${databaseFile}-shm`, { force: true })
  ]);
}

async function removeDatabaseFiles(databaseFile: string): Promise<void> {
  await Promise.all([
    rm(databaseFile, { force: true }),
    rm(`${databaseFile}-wal`, { force: true }),
    rm(`${databaseFile}-shm`, { force: true })
  ]).catch(() => undefined);
}
