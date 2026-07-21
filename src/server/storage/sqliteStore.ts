import type { SQLInputValue } from "node:sqlite";
import type { ApplicationDatabase } from "./database.js";
import {
  collectionNames,
  getCollectionDefault,
  type CollectionName,
  type CollectionValue,
  type StoreLike
} from "./storageContract.js";

type SingletonCollectionName = "authStatus" | "browserBridgeStatus" | "rateLimit";
type EntityCollectionName = Exclude<CollectionName, SingletonCollectionName>;

interface EntityColumn {
  column: string;
  field: string;
  boolean?: boolean;
}

interface EntityConfiguration {
  table: string;
  keyColumn: string;
  keyField: string;
  columns: EntityColumn[];
}

const singletonCollections = new Set<CollectionName>(["authStatus", "browserBridgeStatus", "rateLimit"]);

const importOrder: readonly CollectionName[] = [
  "authStatus",
  "browserBridgeStatus",
  "rateLimit",
  "searchJobs",
  "authors",
  "notes",
  "queueItems",
  "comments",
  "authorPosts",
  "analysisReports",
  "aiModels",
  "aiPromptConfigs",
  "aiCustomPrompts",
  "aiCustomPromptRevisions",
  "aiReports",
  "aiArtifacts",
  "aiOrchestrations",
  "aiGoalRuns",
  "aiMessages",
  "contentPlaybooks",
  "contentPlaybookRevisions",
  "contentProjects",
  "contentProjectMaterials",
  "contentDrafts",
  "contentReviews",
  "replyPlans",
  "replyActions",
  "healthReports",
  "boards",
  "favoriteNotes"
];

const entityConfigurations: Record<EntityCollectionName, EntityConfiguration> = {
  searchJobs: entity("search_jobs", "id", ["status", "createdAt", "updatedAt"]),
  queueItems: entity("queue_items", "id", ["jobId", "noteId", "kind", "status", "createdAt", "updatedAt"]),
  notes: entity("notes", "id", ["authorId", "type", "publishedAt", "createdAt", "updatedAt"]),
  comments: entity("comments", "id", ["noteId", "authorId", "createdAt"]),
  authors: entity("authors", "id", ["updatedAt"]),
  authorPosts: entity("author_posts", "id", ["authorId"]),
  analysisReports: entity("analysis_reports", "jobId", ["generatedAt"]),
  aiModels: entity("ai_models", "id", ["isDefault", "createdAt", "updatedAt"], ["isDefault"]),
  aiReports: entity("ai_reports", "id", ["jobId", "status", "createdAt", "updatedAt"]),
  aiArtifacts: entity("ai_artifacts", "id", ["workflowKey", "jobId", "noteId", "status", "createdAt", "updatedAt"]),
  aiPromptConfigs: entity("ai_prompt_configs", "key", ["updatedAt"]),
  aiCustomPrompts: entity("ai_custom_prompts", "id", ["status", "createdAt", "updatedAt"]),
  aiCustomPromptRevisions: entity("ai_custom_prompt_revisions", "id", ["promptId", "createdAt"]),
  aiOrchestrations: entity("ai_orchestrations", "id", ["jobId", "status", "createdAt", "updatedAt"]),
  aiGoalRuns: entity("ai_goal_runs", "id", ["jobId", "status", "createdAt", "updatedAt"]),
  aiMessages: entity("ai_messages", "id", ["role", "createdAt"]),
  replyPlans: entity("reply_plans", "id", ["noteId", "status", "createdAt", "updatedAt"]),
  replyActions: entity("reply_actions", "id", ["planId", "noteId", "status", "createdAt", "updatedAt"]),
  healthReports: entity("health_reports", "id", ["jobId", "generatedAt"]),
  boards: entity("boards", "id", ["updatedAt"]),
  favoriteNotes: entity("favorite_notes", "id", ["updatedAt"]),
  contentPlaybooks: entity("content_playbooks", "id", ["createdAt", "updatedAt"]),
  contentPlaybookRevisions: entity("content_playbook_revisions", "id", ["playbookId", "createdAt"]),
  contentProjects: entity("content_projects", "id", ["playbookId", "jobId", "status", "createdAt", "updatedAt"]),
  contentProjectMaterials: entity("content_project_materials", "id", ["projectId", "source", "sourceId", "category", "createdAt", "updatedAt"]),
  contentDrafts: entity("content_drafts", "id", ["projectId", "playbookId", "jobId", "status", "createdAt", "updatedAt"]),
  contentReviews: entity("content_reviews", "id", ["projectId", "playbookId", "jobId", "noteId", "draftId", "status", "risk", "createdAt", "updatedAt"])
};

export class SqliteStore implements StoreLike {
  private readonly locks = new Map<CollectionName, Promise<unknown>>();

  constructor(readonly database: ApplicationDatabase) {}

  async read<K extends CollectionName>(name: K): Promise<CollectionValue[K]> {
    if (singletonCollections.has(name)) {
      const row = this.database.connection.prepare("SELECT value_json FROM app_state WHERE key = ?").get(name) as
        | { value_json: string }
        | undefined;
      return (row ? JSON.parse(row.value_json) : getCollectionDefault(name)) as CollectionValue[K];
    }

    const configuration = entityConfigurations[name as EntityCollectionName];
    const rows = this.database.connection.prepare(
      `SELECT data_json FROM ${configuration.table} ORDER BY position ASC`
    ).all() as Array<{ data_json: string }>;
    return rows.map((row) => JSON.parse(row.data_json)) as CollectionValue[K];
  }

  async write<K extends CollectionName>(name: K, value: CollectionValue[K]): Promise<void> {
    await this.withCollectionLock(name, () => this.writeUnlocked(name, value));
  }

  isEmpty(): boolean {
    const stateCount = Number((this.database.connection.prepare("SELECT COUNT(*) AS count FROM app_state").get() as { count: number | bigint }).count);
    if (stateCount > 0) return false;
    return collectionNames
      .filter((name): name is EntityCollectionName => !singletonCollections.has(name))
      .every((name) => {
        const table = entityConfigurations[name].table;
        const row = this.database.connection.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number | bigint };
        return Number(row.count) === 0;
      });
  }

  replaceAllCollections(values: CollectionValue, beforeCommit?: () => void): void {
    if (!this.isEmpty()) throw new Error("SQLite database already contains business data.");
    const connection = this.database.connection;
    connection.exec("BEGIN IMMEDIATE");
    try {
      for (const name of importOrder) {
        this.writeWithinTransaction(name, values[name] as CollectionValue[typeof name]);
      }
      beforeCommit?.();
      connection.exec("COMMIT");
    } catch (error) {
      connection.exec("ROLLBACK");
      throw error;
    }
  }

  async update<K extends CollectionName>(
    name: K,
    updater: (value: CollectionValue[K]) => CollectionValue[K] | Promise<CollectionValue[K]>
  ): Promise<CollectionValue[K]> {
    return this.withCollectionLock(name, async () => {
      const current = await this.read(name);
      const next = await updater(current);
      this.writeUnlocked(name, next);
      return next;
    });
  }

  private writeUnlocked<K extends CollectionName>(name: K, value: CollectionValue[K]): void {
    const connection = this.database.connection;
    connection.exec("BEGIN IMMEDIATE");
    try {
      this.writeWithinTransaction(name, value);
      connection.exec("COMMIT");
    } catch (error) {
      connection.exec("ROLLBACK");
      throw error;
    }
  }

  private writeWithinTransaction<K extends CollectionName>(name: K, value: CollectionValue[K]): void {
    if (singletonCollections.has(name)) {
      this.database.connection.prepare(`
        INSERT INTO app_state (key, value_json, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
      `).run(name, JSON.stringify(value), new Date().toISOString());
      return;
    }
    this.writeEntities(name as EntityCollectionName, value as unknown[]);
  }

  private writeEntities(name: EntityCollectionName, values: unknown[]): void {
    const connection = this.database.connection;
    const configuration = entityConfigurations[name];
    const columnNames = [configuration.keyColumn, ...configuration.columns.map((column) => column.column), "position", "data_json"];
    const placeholders = columnNames.map(() => "?").join(", ");
    const updateColumns = columnNames
      .filter((column) => column !== configuration.keyColumn)
      .map((column) => `${column} = excluded.${column}`)
      .join(", ");
    const upsert = connection.prepare(`
      INSERT INTO ${configuration.table} (${columnNames.join(", ")}) VALUES (${placeholders})
      ON CONFLICT(${configuration.keyColumn}) DO UPDATE SET ${updateColumns}
    `);
    const incomingKeys = new Set<string>();

    values.forEach((value, position) => {
      const record = asRecord(value);
      const key = requiredString(record, configuration.keyField);
      incomingKeys.add(key);
      const fields = configuration.columns.map((column) => columnValue(record[column.field], column.boolean));
      upsert.run(key, ...fields, position, JSON.stringify(value));
      if (name === "notes") this.replaceNoteJobs(key, record.jobIds);
    });

    const existingRows = connection.prepare(
      `SELECT ${configuration.keyColumn} AS entity_key FROM ${configuration.table}`
    ).all() as Array<{ entity_key: string }>;
    const remove = connection.prepare(
      `DELETE FROM ${configuration.table} WHERE ${configuration.keyColumn} = ?`
    );
    for (const row of existingRows) {
      if (!incomingKeys.has(String(row.entity_key))) remove.run(row.entity_key);
    }
  }

  private replaceNoteJobs(noteId: string, rawJobIds: unknown): void {
    const connection = this.database.connection;
    connection.prepare("DELETE FROM note_jobs WHERE note_id = ?").run(noteId);
    const insert = connection.prepare("INSERT INTO note_jobs (note_id, job_id, position) VALUES (?, ?, ?)");
    const jobIds = Array.isArray(rawJobIds) ? rawJobIds : [];
    jobIds.forEach((jobId, position) => insert.run(noteId, String(jobId), position));
  }

  private async withCollectionLock<T>(name: CollectionName, task: () => T | Promise<T>): Promise<T> {
    const previous = this.locks.get(name) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const chained = previous.then(() => current, () => current);
    this.locks.set(name, chained);
    await previous.catch(() => undefined);
    try {
      return await task();
    } finally {
      release();
      if (this.locks.get(name) === chained) this.locks.delete(name);
    }
  }
}

function entity(
  table: string,
  keyField: string,
  fields: string[],
  booleanFields: string[] = []
): EntityConfiguration {
  const booleanSet = new Set(booleanFields);
  return {
    table,
    keyColumn: snakeCase(keyField),
    keyField,
    columns: fields.map((field) => ({ column: snakeCase(field), field, boolean: booleanSet.has(field) }))
  };
}

function snakeCase(value: string): string {
  return value.replace(/[A-Z]/g, (character) => `_${character.toLowerCase()}`);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("SQLite entity value must be an object.");
  }
  return value as Record<string, unknown>;
}

function requiredString(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== "string" || !value) throw new Error(`SQLite entity is missing ${field}.`);
  return value;
}

function columnValue(value: unknown, boolean = false): SQLInputValue {
  if (boolean) return value ? 1 : 0;
  if (value === undefined || value === null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") return value;
  throw new Error("SQLite indexed column contains an unsupported value.");
}
