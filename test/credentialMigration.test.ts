import { mkdir, mkdtemp, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CredentialCipher } from "../src/server/storage/credentialVault.js";

const tempDirs: string[] = [];

afterEach(async () => {
  delete process.env.XHS_COOKIE_STRING;
  delete process.env.AI_MODEL_PRIMARY_KEY;
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("desktop legacy credential migration", () => {
  it("encrypts allowlisted values transactionally and preserves non-secret file content byte-for-byte", async () => {
    const fixture = await createFixture([
      "# 保留评论",
      "PORT=8787",
      "XHS_COOKIE_STRING=synthetic-cookie",
      "AI_MODEL_PRIMARY_KEY=synthetic-model-key",
      "UNRELATED_TOKEN=keep-this",
      "中文配置=keep-too",
      ""
    ].join("\r\n"));
    process.env.XHS_COOKIE_STRING = "synthetic-cookie";
    process.env.AI_MODEL_PRIMARY_KEY = "synthetic-model-key";

    const status = await fixture.vault.migrateLegacyPlaintext();

    expect(status).toEqual({
      mode: "desktop-encrypted",
      state: "encrypted",
      encryptionAvailable: true,
      cookieConfigured: true,
      modelKeyCount: 1,
      encryptedCredentialCount: 2,
      unreadableCredentialCount: 0,
      legacyPlaintextCredentialCount: 0
    });
    expect(await readFile(fixture.envFile, "utf8")).toBe([
      "# 保留评论",
      "PORT=8787",
      "UNRELATED_TOKEN=keep-this",
      "中文配置=keep-too",
      ""
    ].join("\r\n"));
    await expect(fixture.vault.get("XHS_COOKIE_STRING")).resolves.toBe("synthetic-cookie");
    await expect(fixture.vault.get("AI_MODEL_PRIMARY_KEY")).resolves.toBe("synthetic-model-key");
    expect(process.env.XHS_COOKIE_STRING).toBeUndefined();
    expect(process.env.AI_MODEL_PRIMARY_KEY).toBeUndefined();

    await expect(fixture.vault.migrateLegacyPlaintext()).resolves.toEqual(status);
    fixture.database.close();
  });

  it("keeps an existing decryptable ciphertext and removes the stale plaintext line", async () => {
    const fixture = await createFixture("XHS_COOKIE_STRING=stale-placeholder\nPORT=8787\n");
    await fixture.vault.set("XHS_COOKIE_STRING", "existing-placeholder");

    const status = await fixture.vault.migrateLegacyPlaintext();

    await expect(fixture.vault.get("XHS_COOKIE_STRING")).resolves.toBe("existing-placeholder");
    expect(await readFile(fixture.envFile, "utf8")).toBe("PORT=8787\n");
    expect(status.state).toBe("encrypted");
    expect(status.encryptedCredentialCount).toBe(1);
    fixture.database.close();
  });

  it("does not overwrite unreadable ciphertext or remove its plaintext line", async () => {
    const fixture = await createFixture("XHS_COOKIE_STRING=replacement-placeholder\nPORT=8787\n");
    await fixture.vault.set("XHS_COOKIE_STRING", "existing-placeholder");
    fixture.cipher.failDecrypt = true;

    const status = await fixture.vault.migrateLegacyPlaintext();

    expect(status.state).toBe("reconfiguration-required");
    expect(status.unreadableCredentialCount).toBe(1);
    expect(status.legacyPlaintextCredentialCount).toBe(1);
    expect(await readFile(fixture.envFile, "utf8")).toBe("XHS_COOKIE_STRING=replacement-placeholder\nPORT=8787\n");
    expect(fixture.database.connection.prepare("SELECT COUNT(*) AS count FROM secure_credentials").get())
      .toEqual({ count: 1 });
    fixture.database.close();
  });

  it("rolls back all rows and leaves the source unchanged when encryption or verification fails", async () => {
    const source = "XHS_COOKIE_STRING=first-placeholder\nAI_MODEL_PRIMARY_KEY=second-placeholder\n";
    const fixture = await createFixture(source);
    fixture.cipher.failVerification = true;

    await expect(fixture.vault.migrateLegacyPlaintext()).rejects.toThrow("Credential migration failed.");

    expect(await readFile(fixture.envFile, "utf8")).toBe(source);
    expect(fixture.database.connection.prepare("SELECT COUNT(*) AS count FROM secure_credentials").get())
      .toEqual({ count: 0 });
    fixture.database.close();
  });

  it("keeps committed ciphertext active and reports cleanup-required when atomic replacement fails", async () => {
    const fixture = await createFixture("XHS_COOKIE_STRING=synthetic-cookie\nPORT=8787\n", true);
    process.env.XHS_COOKIE_STRING = "synthetic-cookie";

    const status = await fixture.vault.migrateLegacyPlaintext();

    expect(status.state).toBe("cleanup-required");
    expect(status.cookieConfigured).toBe(true);
    expect(status.legacyPlaintextCredentialCount).toBe(1);
    await expect(fixture.vault.get("XHS_COOKIE_STRING")).resolves.toBe("synthetic-cookie");
    expect(await readFile(fixture.envFile, "utf8")).toBe("XHS_COOKIE_STRING=synthetic-cookie\nPORT=8787\n");
    expect(process.env.XHS_COOKIE_STRING).toBeUndefined();
    fixture.database.close();
  });
});

async function createFixture(source: string, failRename = false) {
  const root = await mkdtemp(path.join(os.tmpdir(), "xhs-credential-migration-"));
  tempDirs.push(root);
  const dataDir = path.join(root, "data");
  const envFile = path.join(root, ".env.local");
  await mkdir(dataDir, { recursive: true });
  await writeFile(envFile, source, "utf8");
  const { openApplicationDatabase } = await import("../src/server/storage/database.js");
  const { SqliteCredentialVault } = await import("../src/server/storage/credentialVault.js");
  const database = openApplicationDatabase(path.join(dataDir, "app.db"));
  const cipher = new MigrationCipher();
  const vault = new SqliteCredentialVault(database, cipher, {
    legacyEnvFile: envFile,
    fileSystem: {
      readFile,
      writeFile,
      rename: failRename
        ? async () => { throw new Error("synthetic cleanup failure"); }
        : rename,
      unlink
    }
  });
  return { cipher, database, envFile, vault };
}

class MigrationCipher implements CredentialCipher {
  failDecrypt = false;
  failVerification = false;
  private nextCiphertext = 1;
  private decryptions = 0;
  private readonly plaintextByCiphertext = new Map<string, string>();

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async encryptString(value: string): Promise<Buffer> {
    const encrypted = Buffer.from([this.nextCiphertext++]);
    this.plaintextByCiphertext.set(encrypted.toString("hex"), value);
    return encrypted;
  }

  async decryptString(value: Buffer): Promise<{ value: string; shouldReEncrypt: boolean }> {
    if (this.failDecrypt) throw new Error("synthetic decrypt failure");
    const plaintext = this.plaintextByCiphertext.get(value.toString("hex"));
    if (plaintext === undefined) throw new Error("synthetic unknown ciphertext");
    this.decryptions += 1;
    return {
      value: this.failVerification && this.decryptions <= 2 ? "mismatched-placeholder" : plaintext,
      shouldReEncrypt: false
    };
  }
}
