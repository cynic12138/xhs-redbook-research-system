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
}

export type CredentialReadResult =
  | { status: "found"; value: string }
  | { status: "missing" }
  | { status: "unreadable" };

const CREDENTIAL_PROVIDER = "electron-safe-storage";

export class SqliteCredentialVault implements CredentialVault {
  constructor(
    private readonly database: ApplicationDatabase,
    private readonly cipher: CredentialCipher
  ) {}

  async get(key: string): Promise<string | undefined> {
    const result = await this.getResult(key);
    return result.status === "found" ? result.value : undefined;
  }

  async getResult(key: string): Promise<CredentialReadResult> {
    const row = this.database.connection.prepare(
      "SELECT encrypted_value FROM secure_credentials WHERE credential_key = ?"
    ).get(key) as { encrypted_value: Uint8Array } | undefined;
    if (!row) return { status: "missing" };

    let decrypted: { value: string; shouldReEncrypt: boolean };
    try {
      decrypted = await this.cipher.decryptString(Buffer.from(row.encrypted_value));
    } catch {
      return { status: "unreadable" };
    }

    if (decrypted.shouldReEncrypt) {
      await this.set(key, decrypted.value);
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
}
