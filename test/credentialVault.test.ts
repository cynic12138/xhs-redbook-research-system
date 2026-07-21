import { describe, expect, it } from "vitest";
import type { CredentialCipher } from "../src/server/storage/credentialVault.js";

describe("SQLite credential vault", () => {
  it("stores encrypted blobs with the safe-storage provider and reads plaintext through the cipher", async () => {
    const fixture = await createFixture();

    await fixture.vault.set("credential-one", "vault-value");

    expect(fixture.database.connection.prepare(`
      SELECT credential_key, typeof(encrypted_value) AS value_type, provider
      FROM secure_credentials
    `).get()).toEqual({
      credential_key: "credential-one",
      value_type: "blob",
      provider: "electron-safe-storage"
    });
    await expect(fixture.vault.get("credential-one")).resolves.toBe("vault-value");
    fixture.database.close();
  });

  it("deletes an existing row when set receives an empty plaintext value", async () => {
    const fixture = await createFixture();
    await fixture.vault.set("credential-two", "vault-value");

    await fixture.vault.set("credential-two", "");

    await expect(fixture.vault.getResult("credential-two")).resolves.toEqual({ status: "missing" });
    expect(fixture.database.connection.prepare("SELECT COUNT(*) AS count FROM secure_credentials").get())
      .toEqual({ count: 0 });
    fixture.database.close();
  });

  it("deletes a stored credential explicitly", async () => {
    const fixture = await createFixture();
    await fixture.vault.set("credential-delete", "vault-value");

    await fixture.vault.delete("credential-delete");

    await expect(fixture.vault.getResult("credential-delete")).resolves.toEqual({ status: "missing" });
    fixture.database.close();
  });

  it("re-encrypts and updates a row after a decrypt requests rotation", async () => {
    const fixture = await createFixture();
    await fixture.vault.set("credential-three", "vault-value");
    const before = fixture.database.connection.prepare(
      "SELECT encrypted_value FROM secure_credentials WHERE credential_key = ?"
    ).get("credential-three") as { encrypted_value: Uint8Array };
    fixture.cipher.shouldReEncrypt = true;

    await expect(fixture.vault.get("credential-three")).resolves.toBe("vault-value");

    const after = fixture.database.connection.prepare(
      "SELECT encrypted_value FROM secure_credentials WHERE credential_key = ?"
    ).get("credential-three") as { encrypted_value: Uint8Array };
    expect(Buffer.from(after.encrypted_value).equals(Buffer.from(before.encrypted_value))).toBe(false);
    fixture.database.close();
  });

  it("does not let a delayed rotation overwrite a newer concurrent value", async () => {
    const fixture = await createFixture();
    try {
      await fixture.vault.set("credential-rotation-race", "original-placeholder");
      fixture.cipher.shouldReEncrypt = true;
      const gate = fixture.cipher.gateEncryptionFor("original-placeholder");

      const rotatingRead = fixture.vault.get("credential-rotation-race");
      await gate.started;
      fixture.cipher.shouldReEncrypt = false;
      await fixture.vault.set("credential-rotation-race", "newer-placeholder");
      gate.release();

      await expect(rotatingRead).resolves.toBe("original-placeholder");
      await expect(fixture.vault.get("credential-rotation-race")).resolves.toBe("newer-placeholder");
    } finally {
      fixture.database.close();
    }
  });

  it("reports unreadable ciphertext without deleting or replacing the stored row", async () => {
    const fixture = await createFixture();
    await fixture.vault.set("credential-four", "vault-value");
    const before = fixture.database.connection.prepare(
      "SELECT encrypted_value FROM secure_credentials WHERE credential_key = ?"
    ).get("credential-four") as { encrypted_value: Uint8Array };
    fixture.cipher.failDecrypt = true;

    await expect(fixture.vault.getResult("credential-four")).resolves.toEqual({ status: "unreadable" });
    await expect(fixture.vault.get("credential-four")).resolves.toBeUndefined();

    const after = fixture.database.connection.prepare(
      "SELECT encrypted_value FROM secure_credentials WHERE credential_key = ?"
    ).get("credential-four") as { encrypted_value: Uint8Array };
    expect(Buffer.from(after.encrypted_value).equals(Buffer.from(before.encrypted_value))).toBe(true);
    fixture.database.close();
  });

  it("sanitizes encryption failures and preserves the existing row", async () => {
    const fixture = await createFixture();
    await fixture.vault.set("credential-six", "vault-value");
    const before = fixture.database.connection.prepare(
      "SELECT encrypted_value FROM secure_credentials WHERE credential_key = ?"
    ).get("credential-six") as { encrypted_value: Uint8Array };
    fixture.cipher.failEncrypt = true;

    let thrown: unknown;
    try {
      await fixture.vault.set("credential-six", "replacement-value");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe("Credential encryption failed.");
    expect(fixture.database.connection.prepare("SELECT COUNT(*) AS count FROM secure_credentials").get())
      .toEqual({ count: 1 });
    const after = fixture.database.connection.prepare(
      "SELECT encrypted_value FROM secure_credentials WHERE credential_key = ?"
    ).get("credential-six") as { encrypted_value: Uint8Array };
    expect(Buffer.from(after.encrypted_value).equals(Buffer.from(before.encrypted_value))).toBe(true);
    fixture.database.close();
  });

  it("does not count secure credentials as legacy business data", async () => {
    const fixture = await createFixture();

    await fixture.vault.set("credential-five", "vault-value");

    expect(fixture.store.isEmpty()).toBe(true);
    fixture.database.close();
  });
});

async function createFixture() {
  const { openApplicationDatabase } = await import("../src/server/storage/database.js");
  const { SqliteStore } = await import("../src/server/storage/sqliteStore.js");
  const { SqliteCredentialVault } = await import("../src/server/storage/credentialVault.js");
  const database = openApplicationDatabase(":memory:");
  const cipher = new TestCipher();
  return {
    cipher,
    database,
    store: new SqliteStore(database),
    vault: new SqliteCredentialVault(database, cipher)
  };
}

class TestCipher implements CredentialCipher {
  failEncrypt = false;
  failDecrypt = false;
  shouldReEncrypt = false;
  private nextCiphertext = 1;
  private readonly plaintextByCiphertext = new Map<string, string>();
  private gatedValue: string | undefined;
  private encryptionGate: Deferred | undefined;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async encryptString(value: string): Promise<Buffer> {
    if (this.failEncrypt) throw new Error(`cipher failure detail: ${value}`);
    if (value === this.gatedValue && this.encryptionGate) {
      const gate = this.encryptionGate;
      this.gatedValue = undefined;
      this.encryptionGate = undefined;
      gate.start();
      await gate.promise;
    }
    const encrypted = Buffer.from([this.nextCiphertext++]);
    this.plaintextByCiphertext.set(encrypted.toString("hex"), value);
    return encrypted;
  }

  async decryptString(value: Buffer): Promise<{ value: string; shouldReEncrypt: boolean }> {
    if (this.failDecrypt) throw new Error("cipher failure detail");
    const plaintext = this.plaintextByCiphertext.get(value.toString("hex"));
    if (plaintext === undefined) throw new Error("unknown ciphertext");
    return { value: plaintext, shouldReEncrypt: this.shouldReEncrypt };
  }

  gateEncryptionFor(value: string): { started: Promise<void>; release(): void } {
    const deferred = new Deferred();
    this.gatedValue = value;
    this.encryptionGate = deferred;
    return { started: deferred.started, release: () => deferred.resolve() };
  }
}

class Deferred {
  readonly promise: Promise<void>;
  readonly started: Promise<void>;
  private resolvePromise!: () => void;
  private resolveStarted!: () => void;

  constructor() {
    this.promise = new Promise((resolve) => { this.resolvePromise = resolve; });
    this.started = new Promise((resolve) => { this.resolveStarted = resolve; });
  }

  start(): void { this.resolveStarted(); }
  resolve(): void { this.resolvePromise(); }
}
