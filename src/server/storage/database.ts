import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { databaseMigrations } from "./migrations.js";

export interface ApplicationDatabase {
  readonly connection: DatabaseSync;
  readonly schemaVersion: number;
  close(): void;
}

export function openApplicationDatabase(databaseFile: string): ApplicationDatabase {
  if (databaseFile !== ":memory:") {
    mkdirSync(path.dirname(databaseFile), { recursive: true });
  }

  const connection = new DatabaseSync(databaseFile);
  let closed = false;
  try {
    connection.exec("PRAGMA journal_mode = WAL");
    connection.exec("PRAGMA foreign_keys = ON");
    connection.exec("PRAGMA busy_timeout = 5000");
    applyMigrations(connection);
  } catch (error) {
    connection.close();
    throw error;
  }

  return {
    connection,
    schemaVersion: readSchemaVersion(connection),
    close() {
      if (closed) return;
      closed = true;
      connection.close();
    }
  };
}

function applyMigrations(connection: DatabaseSync): void {
  connection.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);

  const supportedVersion = databaseMigrations.reduce((maximum, migration) => Math.max(maximum, migration.version), 0);
  const currentVersion = readSchemaVersion(connection);
  if (currentVersion > supportedVersion) {
    throw new Error(
      `数据库 Schema 版本 ${currentVersion} 高于当前应用支持版本 ${supportedVersion}，请升级应用后再打开。`
    );
  }

  const applied = new Set(
    connection.prepare("SELECT version FROM schema_migrations").all()
      .map((row) => Number((row as { version: unknown }).version))
  );
  const insertMigration = connection.prepare(
    "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)"
  );

  for (const migration of databaseMigrations) {
    if (applied.has(migration.version)) continue;
    connection.exec("BEGIN IMMEDIATE");
    try {
      connection.exec(migration.sql);
      insertMigration.run(migration.version, migration.name, new Date().toISOString());
      connection.exec("COMMIT");
    } catch (error) {
      connection.exec("ROLLBACK");
      throw new Error(`SQLite migration ${migration.version} (${migration.name}) failed.`, { cause: error });
    }
  }
}

function readSchemaVersion(connection: DatabaseSync): number {
  const row = connection.prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations").get() as {
    version: number | bigint;
  };
  return Number(row.version);
}
