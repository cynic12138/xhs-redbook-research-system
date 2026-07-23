import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const BROWSER_EXTENSION_FILES = Object.freeze([
  "manifest.json",
  "background.js",
  "content-script.js",
  "popup.html",
  "popup.js",
  "README.md"
]);

export async function syncBrowserExtensionAssets(input: {
  sourceDir: string;
  targetDir: string;
}): Promise<void> {
  await mkdir(input.targetDir, { recursive: true });
  for (const name of BROWSER_EXTENSION_FILES) {
    const source = path.join(input.sourceDir, name);
    const target = path.join(input.targetDir, name);
    const temporary = `${target}.update.tmp`;
    const contents = await readFile(source);
    try {
      await writeFile(temporary, contents);
      await rename(temporary, target);
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
  }
}
