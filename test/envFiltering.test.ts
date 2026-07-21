import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const tempDirs: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  vi.resetModules();
  delete process.env.XHS_COOKIE_STRING;
  delete process.env.AI_MODEL_PRIMARY_KEY;
  delete process.env.DESKTOP_NON_SECRET;
  delete process.env.CWD_ONLY_SETTING;
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("runtime environment loading", () => {
  it("loads only non-sensitive desktop settings and never falls back to the current directory", async () => {
    const runtimeRoot = await createTempDir("xhs-env-runtime-");
    const cwdRoot = await createTempDir("xhs-env-cwd-");
    await writeFile(path.join(runtimeRoot, ".env.local"), [
      "DESKTOP_NON_SECRET=preserved",
      "XHS_COOKIE_STRING=synthetic-cookie",
      "AI_MODEL_PRIMARY_KEY=synthetic-model-key",
      ""
    ].join("\n"), "utf8");
    await writeFile(path.join(cwdRoot, ".env"), "CWD_ONLY_SETTING=must-not-load\n", "utf8");
    vi.spyOn(process, "cwd").mockReturnValue(cwdRoot);
    vi.doMock("../src/server/runtime/runtimePaths.js", () => ({
      getRuntimePaths: () => ({
        mode: "desktop",
        envFile: path.join(runtimeRoot, ".env.local")
      })
    }));

    const env = await import("../src/server/utils/env.js");
    env.loadRuntimeEnvironment();

    expect(process.env.DESKTOP_NON_SECRET).toBe("preserved");
    expect(process.env.XHS_COOKIE_STRING).toBeUndefined();
    expect(process.env.AI_MODEL_PRIMARY_KEY).toBeUndefined();
    expect(process.env.CWD_ONLY_SETTING).toBeUndefined();
  });
});

async function createTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  return dir;
}
