import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("application database", () => {
  it("configures SQLite pragmas and applies the versioned schema", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "xhs-database-"));
    tempDirs.push(dir);
    const { openApplicationDatabase } = await import("../src/server/storage/database.js");
    const database = openApplicationDatabase(path.join(dir, "nested", "app.db"));

    expect(database.connection.prepare("PRAGMA journal_mode").get()).toMatchObject({ journal_mode: "wal" });
    expect(database.connection.prepare("PRAGMA foreign_keys").get()).toMatchObject({ foreign_keys: 1 });
    expect(database.connection.prepare("PRAGMA busy_timeout").get()).toMatchObject({ timeout: 5000 });
    expect(database.schemaVersion).toBe(3);

    const tableNames = database.connection.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all().map((row) => String((row as { name: unknown }).name));
    expect(tableNames).toEqual(expect.arrayContaining([
      "schema_migrations", "legacy_imports", "app_state",
      "search_jobs", "queue_items", "notes", "note_jobs", "comments", "authors", "author_posts", "analysis_reports",
      "ai_models", "ai_reports", "ai_artifacts", "ai_prompt_configs", "ai_custom_prompts", "ai_custom_prompt_revisions",
      "ai_orchestrations", "ai_goal_runs", "ai_messages", "reply_plans", "reply_actions", "health_reports", "boards",
      "favorite_notes", "content_playbooks", "content_playbook_revisions", "content_projects", "content_project_materials",
      "content_drafts", "content_reviews", "secure_credentials", "browser_extension_pairing"
    ]));

    expect(database.connection.prepare("PRAGMA table_info(secure_credentials)").all().map((row) => {
      const column = row as { name: unknown; type: unknown; notnull: unknown; pk: unknown };
      return {
        name: String(column.name),
        type: String(column.type),
        notnull: Number(column.notnull),
        pk: Number(column.pk)
      };
    })).toEqual([
      { name: "credential_key", type: "TEXT", notnull: 0, pk: 1 },
      { name: "encrypted_value", type: "BLOB", notnull: 1, pk: 0 },
      { name: "provider", type: "TEXT", notnull: 1, pk: 0 },
      { name: "created_at", type: "TEXT", notnull: 1, pk: 0 },
      { name: "updated_at", type: "TEXT", notnull: 1, pk: 0 }
    ]);
    expect(() => database.connection.prepare(`
      INSERT INTO secure_credentials (
        credential_key, encrypted_value, provider, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?)
    `).run("schema-contract", Buffer.from([1]), "unsupported-provider", "created", "updated")).toThrow();

    expect(database.connection.prepare("PRAGMA table_info(browser_extension_pairing)").all().map((row) => {
      const column = row as { name: unknown; type: unknown; notnull: unknown; pk: unknown };
      return {
        name: String(column.name),
        type: String(column.type),
        notnull: Number(column.notnull),
        pk: Number(column.pk)
      };
    })).toEqual([
      { name: "singleton_id", type: "INTEGER", notnull: 0, pk: 1 },
      { name: "token_hash", type: "BLOB", notnull: 1, pk: 0 },
      { name: "extension_id", type: "TEXT", notnull: 1, pk: 0 },
      { name: "browser", type: "TEXT", notnull: 1, pk: 0 },
      { name: "extension_version", type: "TEXT", notnull: 0, pk: 0 },
      { name: "paired_at", type: "TEXT", notnull: 1, pk: 0 },
      { name: "last_seen_at", type: "TEXT", notnull: 1, pk: 0 },
      { name: "last_sync_at", type: "TEXT", notnull: 0, pk: 0 }
    ]);
    expect(() => database.connection.prepare(`
      INSERT INTO browser_extension_pairing (
        singleton_id, token_hash, extension_id, browser, paired_at, last_seen_at
      ) VALUES (1, ?, ?, ?, ?, ?)
    `).run(Buffer.alloc(31), "a".repeat(32), "edge", "created", "created")).toThrow();

    database.close();
  });

  it("reopens an existing database without applying a migration twice", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "xhs-database-reopen-"));
    tempDirs.push(dir);
    const file = path.join(dir, "app.db");
    const { openApplicationDatabase } = await import("../src/server/storage/database.js");

    openApplicationDatabase(file).close();
    const reopened = openApplicationDatabase(file);

    expect(reopened.connection.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get()).toMatchObject({ count: 3 });
    expect(reopened.schemaVersion).toBe(3);
    reopened.close();
  });

  it("upgrades an existing schema v1 database to v2 without changing business data", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "xhs-database-upgrade-"));
    tempDirs.push(dir);
    const file = path.join(dir, "app.db");
    const legacy = new DatabaseSync(file);
    const { databaseMigrations } = await import("../src/server/storage/migrations.js");
    const versionOne = databaseMigrations.find((migration) => migration.version === 1);
    if (!versionOne) throw new Error("Schema v1 fixture migration is missing.");
    legacy.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
      ${versionOne.sql}
    `);
    legacy.prepare(
      "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)"
    ).run(versionOne.version, versionOne.name, "2026-07-21T00:00:00.000Z");
    legacy.prepare(
      "INSERT INTO app_state (key, value_json, updated_at) VALUES (?, ?, ?)"
    ).run("authStatus", JSON.stringify({ connected: false, configured: false }), "2026-07-21T00:00:00.000Z");
    legacy.close();

    const { openApplicationDatabase } = await import("../src/server/storage/database.js");
    const upgraded = openApplicationDatabase(file);

    expect(upgraded.schemaVersion).toBe(3);
    expect(upgraded.connection.prepare(
      "SELECT version FROM schema_migrations ORDER BY version"
    ).all()).toEqual([{ version: 1 }, { version: 2 }, { version: 3 }]);
    expect(upgraded.connection.prepare(
      "SELECT value_json FROM app_state WHERE key = ?"
    ).get("authStatus")).toEqual({ value_json: JSON.stringify({ connected: false, configured: false }) });
    expect(upgraded.connection.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'secure_credentials'"
    ).get()).toEqual({ name: "secure_credentials" });
    upgraded.close();
  });

  it("refuses to open a database created by a newer schema version", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "xhs-sqlite-future-"));
    tempDirs.push(dir);
    const databaseFile = path.join(dir, "app.db");
    const future = new DatabaseSync(databaseFile);
    future.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
      INSERT INTO schema_migrations (version, name, applied_at)
      VALUES (999, 'future-schema', '2026-07-21T00:00:00.000Z');
    `);
    future.close();

    const { openApplicationDatabase } = await import("../src/server/storage/database.js");
    expect(() => openApplicationDatabase(databaseFile)).toThrow("高于当前应用支持版本");
  });
});
