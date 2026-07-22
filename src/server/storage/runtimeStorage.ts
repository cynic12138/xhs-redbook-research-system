import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { StorageStatus } from "../../shared/types.js";
import { getRuntimePaths } from "../runtime/runtimePaths.js";
import { openApplicationDatabase, type ApplicationDatabase } from "./database.js";
import { LegacyImportService } from "./legacyImportService.js";
import { SqliteStore } from "./sqliteStore.js";
import { collectionNames, type CollectionName, type CollectionValue, type StoreLike } from "./storageContract.js";
import { BrowserExtensionPairingRepository } from "./browserExtensionPairingRepository.js";
import { BrowserExtensionPairingService } from "../services/browserExtensionPairingService.js";
import { BackupService } from "./backupService.js";
import { DataRestoreService } from "./dataRestoreService.js";
import { supportedSchemaVersion } from "./databaseInspection.js";

export class ApplicationStorage {
  readonly database: ApplicationDatabase;
  readonly store: SqliteStore;
  readonly legacyImport: LegacyImportService;
  readonly extensionPairing: BrowserExtensionPairingService;
  readonly backups: BackupService;
  readonly restores: DataRestoreService;

  constructor(
    databaseFile: string,
    readonly legacyDataDir: string,
    options: {
      backupsDir?: string;
      restoreStagingDir?: string;
      appVersion?: string;
    } = {}
  ) {
    this.database = openApplicationDatabase(databaseFile);
    this.store = new SqliteStore(this.database);
    this.legacyImport = new LegacyImportService(this.database, this.store);
    this.extensionPairing = new BrowserExtensionPairingService(
      new BrowserExtensionPairingRepository(this.database)
    );
    const backupsDir = options.backupsDir ?? path.join(legacyDataDir, "backups");
    const restoreStagingDir = options.restoreStagingDir ?? path.join(legacyDataDir, ".restore-staging");
    this.backups = new BackupService(this.database, {
      backupsDir,
      stagingDir: restoreStagingDir,
      appVersion: options.appVersion ?? "development"
    });
    this.restores = new DataRestoreService(this.backups, {
      databaseFile,
      stagingDir: restoreStagingDir,
      supportedSchemaVersion
    });
  }

  async status(): Promise<StorageStatus> {
    const imported = this.latestImport();
    const legacyDataDetected = this.hasLegacyData();

    return {
      engine: "sqlite",
      schemaVersion: this.database.schemaVersion,
      migrationState: imported
        ? "imported"
        : legacyDataDetected
          ? this.store.isEmpty()
            ? "legacy-import-required"
            : "legacy-import-conflict"
          : "ready",
      legacyDataDetected,
      importedAt: imported?.imported_at,
      counts: this.store.collectionCounts()
    };
  }

  requiresLegacyImport(): boolean {
    return !this.latestImport() && this.hasLegacyData();
  }

  close(): void {
    this.database.close();
  }

  setReadOnly(readOnly: boolean): void {
    this.database.connection.exec(`PRAGMA query_only = ${readOnly ? "ON" : "OFF"}`);
  }

  private latestImport(): { imported_at: string } | undefined {
    return this.database.connection.prepare(
      "SELECT imported_at FROM legacy_imports ORDER BY imported_at DESC LIMIT 1"
    ).get() as { imported_at: string } | undefined;
  }

  private hasLegacyData(): boolean {
    return collectionNames.some((name) => existsSync(path.join(this.legacyDataDir, `${name}.json`)));
  }
}

let runtimeStorage: ApplicationStorage | undefined;
let runtimeAppVersion = process.env.npm_package_version || "development";
let runtimeStorageSuspended = false;

export function configureRuntimeStorage(options: { appVersion: string }): void {
  if (runtimeStorage) throw new Error("Runtime storage is already open.");
  runtimeAppVersion = options.appVersion;
  runtimeStorageSuspended = false;
}

export function getRuntimeStorage(): ApplicationStorage {
  if (runtimeStorageSuspended) throw new Error("应用正在关闭数据存储，暂不能读写数据库。");
  if (!runtimeStorage) {
    const runtimePaths = getRuntimePaths();
    const isTest = process.env.NODE_ENV === "test";
    runtimeStorage = new ApplicationStorage(
      isTest ? ":memory:" : runtimePaths.databaseFile,
      isTest ? path.join(os.tmpdir(), "xhs-no-legacy-data") : runtimePaths.dataDir,
      {
        backupsDir: isTest ? path.join(os.tmpdir(), "xhs-test-backups") : runtimePaths.backupsDir,
        restoreStagingDir: isTest ? path.join(os.tmpdir(), "xhs-test-restore-staging") : runtimePaths.restoreStagingDir,
        appVersion: runtimeAppVersion
      }
    );
  }
  return runtimeStorage;
}

export function suspendRuntimeStorageAccess(): void {
  runtimeStorage?.setReadOnly(true);
  runtimeStorageSuspended = true;
}

export function resumeRuntimeStorageAccess(): void {
  runtimeStorageSuspended = false;
  runtimeStorage?.setReadOnly(false);
}

export function closeRuntimeStorage(): void {
  runtimeStorage?.close();
  runtimeStorage = undefined;
}

class RuntimeStoreProxy implements StoreLike {
  read<K extends CollectionName>(name: K): Promise<CollectionValue[K]> {
    return getRuntimeStorage().store.read(name);
  }

  write<K extends CollectionName>(name: K, value: CollectionValue[K]): Promise<void> {
    return getRuntimeStorage().store.write(name, value);
  }

  update<K extends CollectionName>(
    name: K,
    updater: (value: CollectionValue[K]) => CollectionValue[K] | Promise<CollectionValue[K]>
  ): Promise<CollectionValue[K]> {
    return getRuntimeStorage().store.update(name, updater);
  }
}

export const store: StoreLike = new RuntimeStoreProxy();
