import { DatabaseSync } from "node:sqlite";
import { databaseMigrations } from "./migrations.js";
import { collectionCountsForConnection } from "./sqliteStore.js";

export interface DatabaseInspection {
  schemaVersion: number;
  counts: Record<string, number>;
  encryptedCredentialCount: number;
  extensionPairingCount: number;
  machineAuthStateCount: number;
}

export const supportedSchemaVersion = databaseMigrations.reduce(
  (maximum, migration) => Math.max(maximum, migration.version),
  0
);

export function inspectDatabaseFile(file: string): DatabaseInspection {
  const connection = new DatabaseSync(file, { readOnly: true, timeout: 5_000 });
  try {
    const quick = connection.prepare("PRAGMA quick_check").all() as Array<{ quick_check: string }>;
    if (quick.length !== 1 || quick[0]?.quick_check !== "ok") {
      throw new Error("SQLite 完整性校验失败。");
    }
    if (connection.prepare("PRAGMA foreign_key_check").all().length) {
      throw new Error("SQLite 外键校验失败。");
    }
    const schemaRow = connection.prepare(
      "SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations"
    ).get() as { version: number | bigint };
    const schemaVersion = Number(schemaRow.version);
    return {
      schemaVersion,
      counts: collectionCountsForConnection(connection),
      encryptedCredentialCount: rowCount(connection, "secure_credentials"),
      extensionPairingCount: rowCount(connection, "browser_extension_pairing"),
      machineAuthStateCount: Number((connection.prepare(
        "SELECT COUNT(*) AS count FROM app_state WHERE key IN ('authStatus', 'browserBridgeStatus')"
      ).get() as { count: number | bigint }).count)
    };
  } finally {
    connection.close();
  }
}

function rowCount(connection: DatabaseSync, table: string): number {
  const exists = connection.prepare(
    "SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?"
  ).get(table);
  if (!exists) return 0;
  const row = connection.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number | bigint };
  return Number(row.count);
}
