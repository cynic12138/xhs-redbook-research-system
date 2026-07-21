import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import dotenv from "dotenv";
import type { CredentialSecurityStatus } from "../../shared/types.js";
import { COOKIE_CREDENTIAL_KEY, isLegacyModelCredentialKey } from "./credentialKeys.js";
import type { ApplicationDatabase } from "./database.js";

export interface CredentialCipher {
  isAvailable(): Promise<boolean>;
  encryptString(value: string): Promise<Buffer>;
  decryptString(value: Buffer): Promise<{ value: string; shouldReEncrypt: boolean }>;
}

export interface CredentialVault {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  stageSet(key: string, value: string): Promise<ReversibleCredentialMutation>;
  stageDelete(key: string): Promise<ReversibleCredentialMutation>;
  getStatus(): Promise<CredentialSecurityStatus>;
  migrateLegacyPlaintext(): Promise<CredentialSecurityStatus>;
}

export interface ReversibleCredentialMutation {
  rollback(): Promise<void>;
}

export type CredentialReadResult =
  | { status: "found"; value: string }
  | { status: "missing" }
  | { status: "unreadable" };

const CREDENTIAL_PROVIDER = "electron-safe-storage";
const MIGRATION_FAILURE = "Credential migration failed.";

interface CredentialMigrationFileSystem {
  readFile(file: string, encoding: "utf8"): Promise<string>;
  writeFile(file: string, data: string, encoding: "utf8"): Promise<unknown>;
  rename(from: string, to: string): Promise<unknown>;
  unlink(file: string): Promise<unknown>;
}

interface CredentialVaultOptions {
  legacyEnvFile?: string;
  fileSystem?: CredentialMigrationFileSystem;
}

const defaultFileSystem: CredentialMigrationFileSystem = {
  readFile: (file, encoding) => readFile(file, encoding),
  writeFile: (file, data, encoding) => writeFile(file, data, encoding),
  rename,
  unlink
};

export class SqliteCredentialVault implements CredentialVault {
  private readonly legacyEnvFile: string | undefined;
  private readonly fileSystem: CredentialMigrationFileSystem;

  constructor(
    private readonly database: ApplicationDatabase,
    private readonly cipher: CredentialCipher,
    options: CredentialVaultOptions = {}
  ) {
    this.legacyEnvFile = options.legacyEnvFile;
    this.fileSystem = options.fileSystem ?? defaultFileSystem;
  }

  async get(key: string): Promise<string | undefined> {
    const result = await this.getResult(key);
    return result.status === "found" ? result.value : undefined;
  }

  async getResult(key: string): Promise<CredentialReadResult> {
    const row = this.database.connection.prepare(
      "SELECT encrypted_value FROM secure_credentials WHERE credential_key = ?"
    ).get(key) as { encrypted_value: Uint8Array } | undefined;
    if (!row) return { status: "missing" };
    const originalEncryptedValue = Buffer.from(row.encrypted_value);

    let decrypted: { value: string; shouldReEncrypt: boolean };
    try {
      decrypted = await this.cipher.decryptString(originalEncryptedValue);
    } catch {
      return { status: "unreadable" };
    }

    if (decrypted.shouldReEncrypt) {
      await this.rotateIfUnchanged(key, decrypted.value, originalEncryptedValue);
    }
    return { status: "found", value: decrypted.value };
  }

  async set(key: string, value: string): Promise<void> {
    if (value === "") {
      await this.delete(key);
      return;
    }

    let encryptedValue: Buffer;
    try {
      encryptedValue = await this.cipher.encryptString(value);
    } catch {
      throw new Error("Credential encryption failed.");
    }

    const now = new Date().toISOString();
    this.database.connection.prepare(`
      INSERT INTO secure_credentials (
        credential_key, encrypted_value, provider, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(credential_key) DO UPDATE SET
        encrypted_value = excluded.encrypted_value,
        provider = excluded.provider,
        updated_at = excluded.updated_at
    `).run(key, encryptedValue, CREDENTIAL_PROVIDER, now, now);
  }

  async delete(key: string): Promise<void> {
    this.database.connection.prepare(
      "DELETE FROM secure_credentials WHERE credential_key = ?"
    ).run(key);
  }

  async stageSet(key: string, value: string): Promise<ReversibleCredentialMutation> {
    const snapshot = this.captureRawRow(key);
    await this.set(key, value);
    return { rollback: () => this.restoreRawRow(key, snapshot) };
  }

  async stageDelete(key: string): Promise<ReversibleCredentialMutation> {
    const snapshot = this.captureRawRow(key);
    await this.delete(key);
    return { rollback: () => this.restoreRawRow(key, snapshot) };
  }

  private captureRawRow(key: string): RawCredentialRow | undefined {
    const row = this.database.connection.prepare(`
      SELECT encrypted_value, provider, created_at, updated_at
      FROM secure_credentials WHERE credential_key = ?
    `).get(key) as {
      encrypted_value: Uint8Array;
      provider: string;
      created_at: string;
      updated_at: string;
    } | undefined;
    return row ? { ...row, encryptedValue: Buffer.from(row.encrypted_value) } : undefined;
  }

  private async restoreRawRow(key: string, snapshot: RawCredentialRow | undefined): Promise<void> {
    const connection = this.database.connection;
    connection.exec("BEGIN IMMEDIATE");
    try {
      if (snapshot) {
        connection.prepare(`
          INSERT INTO secure_credentials (
            credential_key, encrypted_value, provider, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(credential_key) DO UPDATE SET
            encrypted_value = excluded.encrypted_value,
            provider = excluded.provider,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at
        `).run(
          key,
          snapshot.encryptedValue,
          snapshot.provider,
          snapshot.created_at,
          snapshot.updated_at
        );
      } else {
        connection.prepare("DELETE FROM secure_credentials WHERE credential_key = ?").run(key);
      }
      connection.exec("COMMIT");
    } catch (error) {
      connection.exec("ROLLBACK");
      throw error;
    }
  }

  private async rotateIfUnchanged(key: string, value: string, originalEncryptedValue: Buffer): Promise<void> {
    let rotatedValue: Buffer;
    try {
      rotatedValue = await this.cipher.encryptString(value);
    } catch {
      throw new Error("Credential encryption failed.");
    }
    this.database.connection.prepare(`
      UPDATE secure_credentials
      SET encrypted_value = ?, provider = ?, updated_at = ?
      WHERE credential_key = ? AND encrypted_value = ?
    `).run(rotatedValue, CREDENTIAL_PROVIDER, new Date().toISOString(), key, originalEncryptedValue);
  }

  async getStatus(): Promise<CredentialSecurityStatus> {
    const legacy = await this.readLegacyPlaintext();
    const rows = this.database.connection.prepare(
      "SELECT credential_key, encrypted_value FROM secure_credentials ORDER BY credential_key"
    ).all() as Array<{ credential_key: string; encrypted_value: Uint8Array }>;
    let encryptionAvailable = false;
    try {
      encryptionAvailable = await this.cipher.isAvailable();
    } catch {
      encryptionAvailable = false;
    }

    let cookieConfigured = false;
    let modelKeyCount = 0;
    let unreadableCredentialCount = 0;
    for (const row of rows) {
      try {
        const decrypted = await this.cipher.decryptString(Buffer.from(row.encrypted_value));
        if (!decrypted.value) continue;
        if (row.credential_key === COOKIE_CREDENTIAL_KEY) cookieConfigured = true;
        if (isLegacyModelCredentialKey(row.credential_key)) modelKeyCount += 1;
      } catch {
        unreadableCredentialCount += 1;
      }
    }

    const legacyPlaintextCredentialCount = legacy.lines.filter((line) => line.key !== undefined).length;
    const state = unreadableCredentialCount > 0
      ? "reconfiguration-required"
      : legacyPlaintextCredentialCount > 0
        ? "cleanup-required"
        : rows.length === 0
          ? "empty"
          : "encrypted";

    return {
      mode: "desktop-encrypted",
      state,
      encryptionAvailable,
      cookieConfigured,
      modelKeyCount,
      encryptedCredentialCount: rows.length,
      unreadableCredentialCount,
      legacyPlaintextCredentialCount
    };
  }

  async migrateLegacyPlaintext(): Promise<CredentialSecurityStatus> {
    const legacy = await this.readLegacyPlaintext();
    if (legacy.values.size === 0) return this.getStatus();

    const removableKeys = new Set<string>();
    const missingValues = new Map<string, string>();
    for (const [key, value] of legacy.values) {
      const result = await this.getResultWithoutRotation(key);
      if (result.status === "found") {
        removableKeys.add(key);
      } else if (result.status === "missing") {
        removableKeys.add(key);
        if (value !== "") missingValues.set(key, value);
      }
    }

    try {
      const encrypted = new Map<string, Buffer>();
      for (const [key, value] of missingValues) {
        encrypted.set(key, await this.cipher.encryptString(value));
      }

      if (encrypted.size > 0) {
        this.database.connection.exec("BEGIN IMMEDIATE");
        try {
          const now = new Date().toISOString();
          const insert = this.database.connection.prepare(`
            INSERT INTO secure_credentials (
              credential_key, encrypted_value, provider, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?)
          `);
          for (const [key, encryptedValue] of encrypted) {
            insert.run(key, encryptedValue, CREDENTIAL_PROVIDER, now, now);
          }
          for (const [key, expected] of missingValues) {
            const row = this.database.connection.prepare(
              "SELECT encrypted_value FROM secure_credentials WHERE credential_key = ?"
            ).get(key) as { encrypted_value: Uint8Array } | undefined;
            if (!row) throw new Error("missing encrypted row");
            const verified = await this.cipher.decryptString(Buffer.from(row.encrypted_value));
            if (verified.value !== expected) throw new Error("credential verification mismatch");
          }
          this.database.connection.exec("COMMIT");
        } catch (error) {
          this.database.connection.exec("ROLLBACK");
          throw error;
        }
      }
    } catch {
      throw new Error(MIGRATION_FAILURE);
    }

    for (const key of legacy.values.keys()) delete process.env[key];
    if (removableKeys.size > 0) {
      const cleaned = legacy.bom + legacy.lines
        .filter((line) => line.key === undefined || !removableKeys.has(line.key))
        .map((line) => line.raw)
        .join("");
      const cleanupSucceeded = await this.replaceWithCleanedSource(cleaned);
      if (!cleanupSucceeded) return this.getStatus();
    }
    return this.getStatus();
  }

  private async getResultWithoutRotation(key: string): Promise<CredentialReadResult> {
    const row = this.database.connection.prepare(
      "SELECT encrypted_value FROM secure_credentials WHERE credential_key = ?"
    ).get(key) as { encrypted_value: Uint8Array } | undefined;
    if (!row) return { status: "missing" };
    try {
      const decrypted = await this.cipher.decryptString(Buffer.from(row.encrypted_value));
      return { status: "found", value: decrypted.value };
    } catch {
      return { status: "unreadable" };
    }
  }

  private async readLegacyPlaintext(): Promise<LegacyPlaintextSource> {
    if (!this.legacyEnvFile) return { bom: "", lines: [], values: new Map() };
    let source: string;
    try {
      source = await this.fileSystem.readFile(this.legacyEnvFile, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { bom: "", lines: [], values: new Map() };
      throw new Error("Credential status failed.");
    }
    return parseLegacyPlaintext(source);
  }

  private async replaceWithCleanedSource(cleaned: string): Promise<boolean> {
    if (!this.legacyEnvFile) return true;
    const temporaryFile = `${this.legacyEnvFile}.credential-cleanup.tmp`;
    try {
      await this.fileSystem.writeFile(temporaryFile, cleaned, "utf8");
      await this.fileSystem.rename(temporaryFile, this.legacyEnvFile);
      return true;
    } catch {
      await this.fileSystem.unlink(temporaryFile).catch(() => undefined);
      return false;
    }
  }
}

interface LegacyPlaintextLine {
  key?: string;
  raw: string;
}

interface RawCredentialRow {
  encryptedValue: Buffer;
  provider: string;
  created_at: string;
  updated_at: string;
}

interface LegacyPlaintextSource {
  bom: string;
  lines: LegacyPlaintextLine[];
  values: Map<string, string>;
}

function parseLegacyPlaintext(source: string): LegacyPlaintextSource {
  const bom = source.startsWith("\uFEFF") ? "\uFEFF" : "";
  const content = bom ? source.slice(1) : source;
  const rawLines = content.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g)?.filter((line) => line !== "") ?? [];
  const values = new Map<string, string>();
  const lines = rawLines.map((raw): LegacyPlaintextLine => {
    const content = raw.replace(/(?:\r\n|\n|\r)$/, "");
    const match = content.match(/^[ \t]*(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_]*)[ \t]*=/);
    const key = match?.[1];
    if (!key || (key !== COOKIE_CREDENTIAL_KEY && !isLegacyModelCredentialKey(key))) return { raw };
    const parsed = dotenv.parse(content);
    values.set(key, parsed[key] ?? "");
    return { key, raw };
  });
  return { bom, lines, values };
}
