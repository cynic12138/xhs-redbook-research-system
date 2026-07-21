import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

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
    expect(database.schemaVersion).toBe(1);

    const tableNames = database.connection.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all().map((row) => String((row as { name: unknown }).name));
    expect(tableNames).toEqual(expect.arrayContaining([
      "schema_migrations", "legacy_imports", "app_state",
      "search_jobs", "queue_items", "notes", "note_jobs", "comments", "authors", "author_posts", "analysis_reports",
      "ai_models", "ai_reports", "ai_artifacts", "ai_prompt_configs", "ai_custom_prompts", "ai_custom_prompt_revisions",
      "ai_orchestrations", "ai_goal_runs", "ai_messages", "reply_plans", "reply_actions", "health_reports", "boards",
      "favorite_notes", "content_playbooks", "content_playbook_revisions", "content_projects", "content_project_materials",
      "content_drafts", "content_reviews"
    ]));

    database.close();
  });

  it("reopens an existing database without applying a migration twice", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "xhs-database-reopen-"));
    tempDirs.push(dir);
    const file = path.join(dir, "app.db");
    const { openApplicationDatabase } = await import("../src/server/storage/database.js");

    openApplicationDatabase(file).close();
    const reopened = openApplicationDatabase(file);

    expect(reopened.connection.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get()).toMatchObject({ count: 1 });
    expect(reopened.schemaVersion).toBe(1);
    reopened.close();
  });
});
