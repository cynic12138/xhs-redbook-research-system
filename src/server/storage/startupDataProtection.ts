import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { ApplicationDatabase } from "./database.js";
import { BackupService } from "./backupService.js";
import { inspectDatabaseFile, supportedSchemaVersion } from "./databaseInspection.js";
import { recoverInterruptedDatabaseRestore } from "./dataRestoreService.js";

export async function prepareDatabaseStartup(input: {
  databaseFile: string;
  backupsDir: string;
  stagingDir: string;
  appVersion: string;
  now?: () => Date;
}): Promise<void> {
  await recoverInterruptedDatabaseRestore(input.stagingDir, input.databaseFile);
  if (!existsSync(input.databaseFile)) return;
  const inspection = inspectDatabaseFile(input.databaseFile);
  if (inspection.schemaVersion >= supportedSchemaVersion) return;

  const connection = new DatabaseSync(input.databaseFile, { readOnly: true, timeout: 5_000 });
  const database: ApplicationDatabase = {
    connection,
    schemaVersion: inspection.schemaVersion,
    close: () => connection.close()
  };
  try {
    const service = new BackupService(database, {
      backupsDir: input.backupsDir,
      stagingDir: input.stagingDir,
      appVersion: input.appVersion,
      now: input.now
    });
    await service.createBackup("pre-upgrade");
  } catch (error) {
    throw new Error("数据库升级前安全备份失败，应用已停止启动以保护现有数据。", { cause: error });
  } finally {
    database.close();
  }
}
