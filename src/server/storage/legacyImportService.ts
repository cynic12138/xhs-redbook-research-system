import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { LegacyImportPreview, LegacyImportResult } from "../../shared/types.js";
import type { ApplicationDatabase } from "./database.js";
import { SqliteStore } from "./sqliteStore.js";
import {
  collectionNames,
  createCollectionDefaults,
  type CollectionName,
  type CollectionValue
} from "./storageContract.js";

const singletonCollections = new Set<CollectionName>(["authStatus", "browserBridgeStatus", "rateLimit"]);

interface LegacySnapshot {
  preview: LegacyImportPreview;
  values: CollectionValue;
}

export class LegacyImportService {
  constructor(
    private readonly database: ApplicationDatabase,
    private readonly store: SqliteStore
  ) {}

  async preview(sourceDir: string): Promise<LegacyImportPreview> {
    return (await readLegacySnapshot(sourceDir)).preview;
  }

  async execute(input: { sourceDir: string; fingerprint: string }): Promise<LegacyImportResult> {
    const imported = this.database.connection.prepare("SELECT imported_at FROM legacy_imports LIMIT 1").get() as
      | { imported_at: string }
      | undefined;
    if (imported) throw new Error("当前数据库已经完成旧版数据导入，不能重复导入。");
    if (!this.store.isEmpty()) throw new Error("当前数据库已经包含业务数据，不能导入旧版数据。");

    const snapshot = await readLegacySnapshot(input.sourceDir);
    if (!snapshot.preview.detectedFiles.length) {
      throw new Error("所选文件夹中未检测到可迁移的旧版 JSON 数据。");
    }
    if (snapshot.preview.fingerprint !== input.fingerprint) {
      throw new Error("旧版数据在预检后发生变化，请重新预检后再导入。");
    }

    const importedAt = new Date().toISOString();
    this.store.replaceAllCollections(snapshot.values, () => {
      this.database.connection.prepare(`
        INSERT INTO legacy_imports (
          id, source_fingerprint, source_label, imported_at, counts_json, schema_version
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        `legacy-${input.fingerprint}`,
        input.fingerprint,
        path.basename(path.resolve(input.sourceDir)),
        importedAt,
        JSON.stringify(snapshot.preview.counts),
        this.database.schemaVersion
      );
      assertDatabaseIntegrity(this.database);
    });

    return {
      imported: true,
      fingerprint: input.fingerprint,
      importedAt,
      counts: snapshot.preview.counts,
      integrityCheck: "ok"
    };
  }
}

async function readLegacySnapshot(sourceDir: string): Promise<LegacySnapshot> {
  const resolvedSourceDir = path.resolve(sourceDir);
  let sourceStat;
  try {
    sourceStat = await stat(resolvedSourceDir);
  } catch {
    throw new Error("选择的旧版 data 目录不存在。");
  }
  if (!sourceStat.isDirectory()) throw new Error("旧版数据来源必须是一个文件夹。");

  const values = createCollectionDefaults();
  const counts: Record<string, number> = {};
  const detectedFiles: string[] = [];
  const hash = createHash("sha256");
  let missingFiles = 0;
  let emptyFiles = 0;

  for (const name of collectionNames) {
    const fileName = `${name}.json`;
    const filePath = path.join(resolvedSourceDir, fileName);
    hash.update(`${fileName}\0`);
    if (!existsSync(filePath)) {
      hash.update("missing\0");
      counts[name] = 0;
      missingFiles += 1;
      continue;
    }

    const raw = await readFile(filePath, "utf8");
    detectedFiles.push(fileName);
    hash.update(raw);
    hash.update("\0");
    if (!raw.trim()) {
      counts[name] = 0;
      emptyFiles += 1;
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`${fileName} 不是有效的 JSON 文件。`, { cause: error });
    }
    validateCollectionShape(name, parsed);
    assignCollection(values, name, parsed);
    counts[name] = Array.isArray(parsed) ? parsed.length : 1;
  }

  const warnings: string[] = [];
  if (missingFiles) warnings.push(`${missingFiles} 个集合文件缺失，将使用空默认值。`);
  if (emptyFiles) warnings.push(`${emptyFiles} 个集合文件为空，将使用空默认值。`);

  return {
    values,
    preview: {
      sourceDir: resolvedSourceDir,
      fingerprint: hash.digest("hex"),
      detectedFiles: detectedFiles.sort((left, right) => left.localeCompare(right)),
      counts,
      warnings
    }
  };
}

function validateCollectionShape(name: CollectionName, value: unknown): void {
  if (singletonCollections.has(name)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${name}.json 必须包含一个 JSON 对象。`);
    }
    return;
  }
  if (!Array.isArray(value)) throw new Error(`${name}.json 必须包含一个 JSON 数组。`);
}

function assignCollection<K extends CollectionName>(values: CollectionValue, name: K, value: unknown): void {
  values[name] = value as CollectionValue[K];
}

function assertDatabaseIntegrity(database: ApplicationDatabase): void {
  const foreignKeyFailures = database.connection.prepare("PRAGMA foreign_key_check").all();
  if (foreignKeyFailures.length) throw new Error("旧版数据存在无法关联的记录，导入已回滚。");
  const quickCheck = database.connection.prepare("PRAGMA quick_check").get() as Record<string, unknown> | undefined;
  if (!quickCheck || !Object.values(quickCheck).includes("ok")) {
    throw new Error("SQLite 完整性检查未通过，导入已回滚。");
  }
}
