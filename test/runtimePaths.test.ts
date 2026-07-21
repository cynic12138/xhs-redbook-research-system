import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

describe("runtime paths", () => {
  it("resolves the existing repository paths in development mode", async () => {
    vi.resetModules();
    const { createDevelopmentRuntimePaths } = await import("../src/server/runtime/runtimePaths.js");
    const root = path.resolve("C:/workspace/xhs-app");

    expect(createDevelopmentRuntimePaths(root)).toEqual({
      mode: "development",
      dataDir: path.join(root, "data"),
      outputDir: path.join(root, "output"),
      mediaCacheDir: path.join(root, "data", "media-cache"),
      browserProfileDir: path.join(root, "data", "xhs-login-edge-profile"),
      envFile: path.join(root, ".env.local"),
      clientDist: path.join(root, "dist", "client")
    });
  });

  it("keeps writable desktop paths under the Electron user data directory", async () => {
    vi.resetModules();
    const { createDesktopRuntimePaths } = await import("../src/server/runtime/runtimePaths.js");
    const userDataDir = path.resolve("C:/Users/test/AppData/Roaming/xhs-workbench");
    const appPath = path.resolve("C:/Program Files/xhs-workbench/resources/app.asar");

    const result = createDesktopRuntimePaths({ userDataDir, appPath });

    expect(result).toEqual({
      mode: "desktop",
      dataDir: path.join(userDataDir, "data"),
      outputDir: path.join(userDataDir, "output"),
      mediaCacheDir: path.join(userDataDir, "media-cache"),
      browserProfileDir: path.join(userDataDir, "browser-profile"),
      envFile: path.join(userDataDir, ".env.local"),
      clientDist: path.join(appPath, "dist", "client")
    });
    for (const writablePath of [result.dataDir, result.outputDir, result.mediaCacheDir, result.browserProfileDir, result.envFile]) {
      expect(writablePath.startsWith(userDataDir)).toBe(true);
      expect(writablePath.startsWith(appPath)).toBe(false);
    }
  });

  it("allows one explicit configuration and rejects a second configuration", async () => {
    vi.resetModules();
    const runtime = await import("../src/server/runtime/runtimePaths.js");
    const desktop = runtime.createDesktopRuntimePaths({
      userDataDir: path.resolve("C:/Users/test/AppData/Roaming/xhs-workbench"),
      appPath: path.resolve("C:/Program Files/xhs-workbench/resources/app.asar")
    });

    runtime.configureRuntimePaths(desktop);

    expect(runtime.getRuntimePaths()).toEqual(desktop);
    expect(() => runtime.configureRuntimePaths(desktop)).toThrow("Runtime paths have already been configured.");
  });

  it("falls back to development paths before desktop configuration", async () => {
    vi.resetModules();
    const runtime = await import("../src/server/runtime/runtimePaths.js");

    expect(runtime.getRuntimePaths()).toEqual(runtime.createDevelopmentRuntimePaths());
  });

  it("uses the configured desktop data directory for the default LocalStore", async () => {
    vi.resetModules();
    const userDataDir = await mkdtemp(path.join(os.tmpdir(), "xhs-runtime-store-"));
    try {
      const runtime = await import("../src/server/runtime/runtimePaths.js");
      runtime.configureRuntimePaths(runtime.createDesktopRuntimePaths({
        userDataDir,
        appPath: path.join(userDataDir, "app.asar")
      }));
      const { LocalStore } = await import("../src/server/storage/localStore.js");

      await new LocalStore().write("searchJobs", []);

      expect(existsSync(path.join(userDataDir, "data", "searchJobs.json"))).toBe(true);
    } finally {
      await rm(userDataDir, { recursive: true, force: true });
    }
  });

  it("writes environment settings to the configured desktop env file", async () => {
    vi.resetModules();
    const userDataDir = await mkdtemp(path.join(os.tmpdir(), "xhs-runtime-env-"));
    const key = "D001_RUNTIME_PATH_TEST";
    try {
      const runtime = await import("../src/server/runtime/runtimePaths.js");
      runtime.configureRuntimePaths(runtime.createDesktopRuntimePaths({
        userDataDir,
        appPath: path.join(userDataDir, "app.asar")
      }));
      const { saveEnvValue } = await import("../src/server/utils/env.js");

      await saveEnvValue(key, "desktop-value");

      expect(await readFile(path.join(userDataDir, ".env.local"), "utf8")).toContain(`${key}="desktop-value"`);
    } finally {
      delete process.env[key];
      await rm(userDataDir, { recursive: true, force: true });
    }
  });
});
