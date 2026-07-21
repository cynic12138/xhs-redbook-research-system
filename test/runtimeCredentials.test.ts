import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CredentialCipher } from "../src/server/storage/credentialVault.js";

const tempDirs: string[] = [];
const runtimeCleanups: Array<() => void> = [];

afterEach(async () => {
  for (const cleanup of runtimeCleanups.splice(0)) cleanup();
  vi.resetModules();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("runtime credential boundary", () => {
  it("uses the development environment adapter without requiring a cipher", async () => {
    vi.resetModules();
    const runtime = await import("../src/server/runtime/runtimeCredentialVault.js");

    await expect(runtime.prepareRuntimeCredentials()).resolves.toMatchObject({
      mode: "development-env",
      state: "development",
      encryptionAvailable: false
    });
    expect(runtime.getRuntimeCredentialVault()).toBeDefined();
  });

  it("requires one explicit cipher configuration in desktop mode and never falls back to plaintext", async () => {
    const userDataDir = await mkdtemp(path.join(os.tmpdir(), "xhs-runtime-credentials-"));
    tempDirs.push(userDataDir);
    const runtimePaths = await import("../src/server/runtime/runtimePaths.js");
    runtimePaths.configureRuntimePaths(runtimePaths.createDesktopRuntimePaths({
      userDataDir,
      appPath: path.join(userDataDir, "app.asar")
    }));
    const runtime = await import("../src/server/runtime/runtimeCredentialVault.js");

    await expect(runtime.prepareRuntimeCredentials()).rejects.toThrow("本地凭据安全初始化失败。");
    runtime.configureRuntimeCredentials({ cipher: new AvailableCipher() });
    expect(() => runtime.configureRuntimeCredentials({ cipher: new AvailableCipher() }))
      .toThrow("Runtime credentials have already been configured.");
  });

  it("rejects unavailable desktop encryption before opening the server", async () => {
    const userDataDir = await mkdtemp(path.join(os.tmpdir(), "xhs-runtime-credentials-"));
    tempDirs.push(userDataDir);
    const runtimePaths = await import("../src/server/runtime/runtimePaths.js");
    runtimePaths.configureRuntimePaths(runtimePaths.createDesktopRuntimePaths({
      userDataDir,
      appPath: path.join(userDataDir, "app.asar")
    }));
    const runtime = await import("../src/server/runtime/runtimeCredentialVault.js");
    runtime.configureRuntimeCredentials({ cipher: new AvailableCipher(false) });

    await expect(runtime.prepareRuntimeCredentials()).rejects.toThrow("本地凭据安全初始化失败。");
  });

  it("single-flights repeated migration calls after the desktop vault already exists", async () => {
    const fixture = await createDesktopRuntime();
    await fixture.runtime.prepareRuntimeCredentials();
    await writeFile(fixture.envFile, "XHS_COOKIE_STRING=concurrent-placeholder\n", "utf8");
    const gate = fixture.cipher.gateNextEncryption();

    const first = fixture.runtime.prepareRuntimeCredentials();
    const second = fixture.runtime.prepareRuntimeCredentials();
    await gate.started;
    let concurrentEncryptionCount: number;
    try {
      await new Promise((resolve) => setTimeout(resolve, 20));
      concurrentEncryptionCount = fixture.cipher.encryptionCount;
    } finally {
      gate.release();
    }

    const [firstResult, secondResult] = await Promise.allSettled([first, second]);
    expect(concurrentEncryptionCount!).toBe(1);
    expect(firstResult.status).toBe("fulfilled");
    expect(secondResult.status).toBe("fulfilled");
    if (firstResult.status !== "fulfilled" || secondResult.status !== "fulfilled") return;
    const firstStatus = firstResult.value;
    const secondStatus = secondResult.value;
    expect(firstStatus).toEqual(secondStatus);
    expect(firstStatus.state).toBe("encrypted");
    expect(fixture.cipher.encryptionCount).toBe(1);
  });

  it("sanitizes a repeated migration failure and clears both the vault and opened storage", async () => {
    const fixture = await createDesktopRuntime();
    await fixture.runtime.prepareRuntimeCredentials();
    const openedStorage = fixture.storage.getRuntimeStorage();
    await writeFile(fixture.envFile, "AI_MODEL_PRIMARY_KEY=failure-placeholder\n", "utf8");
    fixture.cipher.failEncrypt = true;

    await expect(fixture.runtime.prepareRuntimeCredentials()).rejects.toThrow("本地凭据安全初始化失败。");

    expect(() => fixture.runtime.getRuntimeCredentialVault()).toThrow("Runtime credentials have not been prepared.");
    const reopenedStorage = fixture.storage.getRuntimeStorage();
    expect(reopenedStorage).not.toBe(openedStorage);
  });

  it("rebuilds the vault after normal disposal and storage close", async () => {
    const fixture = await createDesktopRuntime();
    await fixture.runtime.prepareRuntimeCredentials();
    const firstVault = fixture.runtime.getRuntimeCredentialVault();
    const firstStorage = fixture.storage.getRuntimeStorage();

    fixture.runtime.disposeRuntimeCredentials();
    fixture.storage.closeRuntimeStorage();
    await fixture.runtime.prepareRuntimeCredentials();

    expect(fixture.runtime.getRuntimeCredentialVault()).not.toBe(firstVault);
    expect(fixture.storage.getRuntimeStorage()).not.toBe(firstStorage);
  });
});

async function createDesktopRuntime() {
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "xhs-runtime-credentials-"));
  tempDirs.push(userDataDir);
  const runtimePaths = await import("../src/server/runtime/runtimePaths.js");
  runtimePaths.configureRuntimePaths(runtimePaths.createDesktopRuntimePaths({
    userDataDir,
    appPath: path.join(userDataDir, "app.asar")
  }));
  const runtime = await import("../src/server/runtime/runtimeCredentialVault.js");
  const storage = await import("../src/server/storage/runtimeStorage.js");
  const cipher = new AvailableCipher();
  runtime.configureRuntimeCredentials({ cipher });
  runtimeCleanups.push(() => {
    runtime.disposeRuntimeCredentials?.();
    storage.closeRuntimeStorage();
  });
  return { cipher, envFile: path.join(userDataDir, ".env.local"), runtime, storage };
}

class AvailableCipher implements CredentialCipher {
  failEncrypt = false;
  encryptionCount = 0;
  private nextCiphertext = 1;
  private readonly plaintextByCiphertext = new Map<string, string>();
  private encryptionGate: Deferred | undefined;

  constructor(private readonly available = true) {}
  async isAvailable(): Promise<boolean> { return this.available; }
  async encryptString(value: string): Promise<Buffer> {
    if (this.failEncrypt) throw new Error("unsanitized cipher detail");
    this.encryptionCount += 1;
    const gate = this.encryptionGate;
    gate?.start();
    await gate?.promise;
    const encrypted = Buffer.from([this.nextCiphertext++]);
    this.plaintextByCiphertext.set(encrypted.toString("hex"), value);
    return encrypted;
  }
  async decryptString(value: Buffer): Promise<{ value: string; shouldReEncrypt: boolean }> {
    const plaintext = this.plaintextByCiphertext.get(value.toString("hex"));
    if (plaintext === undefined) throw new Error("unknown synthetic ciphertext");
    return { value: plaintext, shouldReEncrypt: false };
  }

  gateNextEncryption(): { started: Promise<void>; release(): void } {
    const deferred = new Deferred();
    this.encryptionGate = deferred;
    return {
      started: deferred.started,
      release: () => {
        if (this.encryptionGate === deferred) this.encryptionGate = undefined;
        deferred.resolve();
      }
    };
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
