import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("runtime credential startup order", () => {
  it("prepares desktop credentials before importing Express or business services", async () => {
    const source = await readFile("src/electron/main.ts", "utf8");
    const configurePaths = source.indexOf("configureRuntimePaths(runtimePaths)");
    const configureCredentials = source.indexOf("configureRuntimeCredentials");
    const prepareCredentials = source.indexOf("prepareRuntimeCredentials");
    const importApplication = source.lastIndexOf('import("../server/application.js")');

    expect(configurePaths).toBeGreaterThan(-1);
    expect(configureCredentials).toBeGreaterThan(configurePaths);
    expect(prepareCredentials).toBeGreaterThan(configureCredentials);
    expect(importApplication).toBeGreaterThan(prepareCredentials);
  });

  it("prepares credentials before the reusable server listens", async () => {
    const source = await readFile("src/server/application.ts", "utf8");
    expect(source.indexOf("await prepareRuntimeCredentials()"))
      .toBeLessThan(source.indexOf("await listen(server"));
  });

  it("invalidates runtime credentials whenever application storage is closed", async () => {
    const source = await readFile("src/server/application.ts", "utf8");

    expect(source).toContain("disposeRuntimeCredentials");
    expect(source).toMatch(/disposeRuntimeCredentials\(\);\s*closeRuntimeStorage\(\);/);
  });
});
