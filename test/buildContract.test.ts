import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("production build contract", () => {
  it("starts the server entry emitted by the server TypeScript config", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as { scripts: { start: string } };
    const tsconfig = JSON.parse(await readFile("tsconfig.server.json", "utf8")) as {
      compilerOptions: { rootDir: string; outDir: string };
    };
    const emittedEntry = path
      .join(tsconfig.compilerOptions.outDir, path.relative(tsconfig.compilerOptions.rootDir, "src/server/index.js"))
      .replaceAll("\\", "/");
    expect(packageJson.scripts.start).toBe(`node ${emittedEntry}`);
  });
});
