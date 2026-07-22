import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  BROWSER_EXTENSION_FILES,
  syncBrowserExtensionAssets
} from "../src/electron/extensionInstaller.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("packaged browser extension installer", () => {
  it("copies only allowlisted extension assets to the stable target directory", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "xhs-extension-assets-"));
    tempDirs.push(root);
    const sourceDir = path.join(root, "source");
    const targetDir = path.join(root, "user-data", "browser-extension", "xhs-bridge");
    await mkdir(sourceDir, { recursive: true });
    await Promise.all(BROWSER_EXTENSION_FILES.map(async (name) => {
      await writeFile(path.join(sourceDir, name), `asset:${name}`, { encoding: "utf8", flag: "wx" });
    }).concat([
      writeFile(path.join(sourceDir, "should-not-copy.secret"), "secret", { encoding: "utf8", flag: "wx" })
    ]));

    await syncBrowserExtensionAssets({ sourceDir, targetDir });

    for (const name of BROWSER_EXTENSION_FILES) {
      await expect(readFile(path.join(targetDir, name), "utf8")).resolves.toBe(`asset:${name}`);
    }
    await expect(readFile(path.join(targetDir, "should-not-copy.secret"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });
});
