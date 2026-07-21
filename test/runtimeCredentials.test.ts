import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CredentialCipher } from "../src/server/storage/credentialVault.js";

const tempDirs: string[] = [];

afterEach(async () => {
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
});

class AvailableCipher implements CredentialCipher {
  constructor(private readonly available = true) {}
  async isAvailable(): Promise<boolean> { return this.available; }
  async encryptString(): Promise<Buffer> { return Buffer.from([1]); }
  async decryptString(): Promise<{ value: string; shouldReEncrypt: boolean }> {
    return { value: "synthetic-placeholder", shouldReEncrypt: false };
  }
}
