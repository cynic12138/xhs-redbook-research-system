import type { BrowserBridgeBrowser } from "../../shared/types.js";
import type { ApplicationDatabase } from "./database.js";

export interface BrowserExtensionPairingRecord {
  tokenHash: Buffer;
  extensionId: string;
  browser: BrowserBridgeBrowser;
  extensionVersion?: string;
  pairedAt: string;
  lastSeenAt: string;
  lastSyncAt?: string;
}

export class BrowserExtensionPairingRepository {
  constructor(private readonly database: ApplicationDatabase) {}

  get(): BrowserExtensionPairingRecord | undefined {
    const row = this.database.connection.prepare(`
      SELECT token_hash, extension_id, browser, extension_version,
             paired_at, last_seen_at, last_sync_at
      FROM browser_extension_pairing
      WHERE singleton_id = 1
    `).get() as PairingRow | undefined;
    return row ? mapRow(row) : undefined;
  }

  replace(record: BrowserExtensionPairingRecord): void {
    const connection = this.database.connection;
    connection.exec("BEGIN IMMEDIATE");
    try {
      connection.prepare(`
        INSERT INTO browser_extension_pairing (
          singleton_id, token_hash, extension_id, browser, extension_version,
          paired_at, last_seen_at, last_sync_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(singleton_id) DO UPDATE SET
          token_hash = excluded.token_hash,
          extension_id = excluded.extension_id,
          browser = excluded.browser,
          extension_version = excluded.extension_version,
          paired_at = excluded.paired_at,
          last_seen_at = excluded.last_seen_at,
          last_sync_at = excluded.last_sync_at
      `).run(
        record.tokenHash,
        record.extensionId,
        record.browser,
        record.extensionVersion ?? null,
        record.pairedAt,
        record.lastSeenAt,
        record.lastSyncAt ?? null
      );
      connection.exec("COMMIT");
    } catch (error) {
      connection.exec("ROLLBACK");
      throw error;
    }
  }

  delete(): void {
    this.database.connection.prepare(
      "DELETE FROM browser_extension_pairing WHERE singleton_id = 1"
    ).run();
  }

  touch(input: { lastSeenAt: string; lastSyncAt?: string }): void {
    if (input.lastSyncAt) {
      this.database.connection.prepare(`
        UPDATE browser_extension_pairing
        SET last_seen_at = ?, last_sync_at = ?
        WHERE singleton_id = 1
      `).run(input.lastSeenAt, input.lastSyncAt);
      return;
    }
    this.database.connection.prepare(`
      UPDATE browser_extension_pairing
      SET last_seen_at = ?
      WHERE singleton_id = 1
    `).run(input.lastSeenAt);
  }
}

interface PairingRow {
  token_hash: Uint8Array;
  extension_id: string;
  browser: BrowserBridgeBrowser;
  extension_version: string | null;
  paired_at: string;
  last_seen_at: string;
  last_sync_at: string | null;
}

function mapRow(row: PairingRow): BrowserExtensionPairingRecord {
  return {
    tokenHash: Buffer.from(row.token_hash),
    extensionId: row.extension_id,
    browser: row.browser,
    extensionVersion: row.extension_version ?? undefined,
    pairedAt: row.paired_at,
    lastSeenAt: row.last_seen_at,
    lastSyncAt: row.last_sync_at ?? undefined
  };
}
