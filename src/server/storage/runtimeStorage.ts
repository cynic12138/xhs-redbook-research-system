import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { StorageStatus } from "../../shared/types.js";
import { getRuntimePaths } from "../runtime/runtimePaths.js";
import { openApplicationDatabase, type ApplicationDatabase } from "./database.js";
import { LegacyImportService } from "./legacyImportService.js";
import { SqliteStore } from "./sqliteStore.js";
import { collectionNames, type CollectionName, type CollectionValue, type StoreLike } from "./storageContract.js";

export class ApplicationStorage {
  readonly database: ApplicationDatabase;
  readonly store: SqliteStore;
  readonly legacyImport: LegacyImportService;

  constructor(
    databaseFile: string,
    readonly legacyDataDir: string
  ) {
    this.database = openApplicationDatabase(databaseFile);
    this.store = new SqliteStore(this.database);
    this.legacyImport = new LegacyImportService(this.database, this.store);
  }

  async status(): Promise<StorageStatus> {
    const imported = this.database.connection.prepare(
      "SELECT imported_at FROM legacy_imports ORDER BY imported_at DESC LIMIT 1"
    ).get() as { imported_at: string } | undefined;
    const legacyDataDetected = collectionNames.some((name) =>
      existsSync(path.join(this.legacyDataDir, `${name}.json`))
    );
    const counts: Record<string, number> = {};
    for (const name of collectionNames) {
      const value = await this.store.read(name);
      counts[name] = Array.isArray(value) ? value.length : 1;
    }

    return {
      engine: "sqlite",
      schemaVersion: this.database.schemaVersion,
      migrationState: imported
        ? "imported"
        : this.store.isEmpty() && legacyDataDetected
          ? "legacy-import-required"
          : "ready",
      legacyDataDetected,
      importedAt: imported?.imported_at,
      counts
    };
  }

  close(): void {
    this.database.close();
  }
}

let runtimeStorage: ApplicationStorage | undefined;

export function getRuntimeStorage(): ApplicationStorage {
  if (!runtimeStorage) {
    const runtimePaths = getRuntimePaths();
    const isTest = process.env.NODE_ENV === "test";
    runtimeStorage = new ApplicationStorage(
      isTest ? ":memory:" : runtimePaths.databaseFile,
      isTest ? path.join(os.tmpdir(), "xhs-no-legacy-data") : runtimePaths.dataDir
    );
  }
  return runtimeStorage;
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
