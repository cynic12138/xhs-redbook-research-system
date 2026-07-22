import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

describe("desktop build contract", () => {
  it("declares the Electron entry, Forge commands and Windows packaging dependencies", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      main?: string;
      productName?: string;
      author?: string;
      description?: string;
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(packageJson.productName).toBe("小红书运营台");
    expect((packageJson as { version?: string }).version).toBe("0.4.1");
    expect(packageJson.author).toBeTruthy();
    expect(packageJson.description).toBeTruthy();
    expect(packageJson.main).toBe("dist/server/electron/main.js");
    expect(packageJson.scripts["desktop:start"]).toContain("electron .");
    expect(packageJson.scripts["desktop:package"]).toContain("--platform=win32 --arch=x64");
    expect(packageJson.scripts["desktop:make"]).toContain("--platform=win32 --arch=x64");
    expect(packageJson.scripts["desktop:make"]).toContain("prepare-squirrel-vendor.mjs");
    expect(packageJson.scripts["desktop:credential-smoke"]).toContain("securitySmoke.js");
    expect(packageJson.devDependencies).toHaveProperty("electron");
    expect(packageJson.devDependencies).toHaveProperty("@electron-forge/cli");
    expect(packageJson.devDependencies).toHaveProperty("@electron-forge/maker-squirrel");
    expect(packageJson.dependencies).toHaveProperty("electron-squirrel-startup");
    expect(packageJson.dependencies).not.toHaveProperty("better-sqlite3");
    expect(packageJson.devDependencies).not.toHaveProperty("@electron-forge/plugin-auto-unpack-natives");
    expect(packageJson.devDependencies).not.toHaveProperty("@types/better-sqlite3");
  });

  it("emits the Electron main process from the server TypeScript build", async () => {
    const tsconfig = JSON.parse(await readFile("tsconfig.server.json", "utf8")) as { include: string[] };
    expect(tsconfig.include).toContain("src/electron");
  });

  it("exposes only a narrow legacy data directory picker to the renderer", async () => {
    const [mainSource, preloadSource] = await Promise.all([
      readFile("src/electron/main.ts", "utf8"),
      readFile("src/electron/preload.cts", "utf8")
    ]);
    expect(mainSource).toContain('ipcMain.handle("storage:select-legacy-data-directory"');
    expect(mainSource).toContain("preload:");
    expect(preloadSource).toContain('contextBridge.exposeInMainWorld("desktopStorage"');
    expect(preloadSource).toContain('ipcRenderer.invoke("storage:select-legacy-data-directory")');
    expect(preloadSource).not.toContain("shell");
    expect(preloadSource).not.toContain("fs");
    expect(mainSource).toContain('ipcMain.handle("extension:open-install-directory"');
    expect(mainSource).toContain("isAllowedAppNavigation(event.senderFrame.url");
    expect(preloadSource).toContain('contextBridge.exposeInMainWorld("desktopExtension"');
    expect(preloadSource).toContain('ipcRenderer.invoke("extension:open-install-directory")');
    expect(preloadSource).not.toContain("openPath");
  });

  it("configures an unsigned Squirrel installer without packaging local runtime data", async () => {
    const [source, mainSource] = await Promise.all([
      readFile("forge.config.cjs", "utf8"),
      readFile("src/electron/main.ts", "utf8")
    ]);

    expect(source).toContain("@electron-forge/maker-squirrel");
    expect(source).not.toContain("@electron-forge/plugin-auto-unpack-natives");
    expect(source).toContain("checksums: electronChecksums");
    expect(source).toContain("setupExe: \"小红书运营台-0.4.1-Setup.exe\"");
    expect(source).toContain('vendorDirectory: path.join(__dirname, ".cache", "squirrel-vendor")');
    expect(source).toContain('extraResource: ["browser-extension/xhs-bridge"]');
    expect(mainSource).toContain('path.join(process.resourcesPath, "xhs-bridge")');
    for (const excluded of [".git", ".env.local", ".vite", "AGENTS.md", "data", "design-system", "output", "test", ".playwright-cli"]) {
      expect(source).toContain(`\"${excluded}\"`);
    }
  });

  it("pins and verifies the modern NuGet used by the Squirrel maker", async () => {
    const source = await readFile("scripts/prepare-squirrel-vendor.mjs", "utf8");

    expect(source).toContain("https://dist.nuget.org/win-x86-commandline/v7.6.0/nuget.exe");
    expect(source).toContain("751EE5E79481626A428C1241DC7F94BCA2739B32588E669715BC5FB54D8FB8A2");
    expect(source).toContain('node_modules", "electron-winstaller", "vendor"');
    expect(source).toContain("source !== sourceNuget");
    expect(source).not.toContain("latest/nuget.exe");
  });

  it("runs the credential smoke only through asynchronous safeStorage APIs", async () => {
    const source = await readFile("src/electron/securitySmoke.ts", "utf8");

    expect(source).toContain("isAsyncEncryptionAvailable");
    expect(source).toContain("encryptStringAsync");
    expect(source).toContain("decryptStringAsync");
    expect(source).toContain("CREDENTIAL_SMOKE_OK=true");
    expect(source).not.toMatch(/console\.(?:log|error)\([^)]*(?:encrypted|decrypted|value)/i);
    expect(source).not.toContain("encryptString(");
    expect(source).not.toContain("decryptString(");
  });

  it("routes the login-card xiaohongshu link through the existing browser opener", async () => {
    const source = await readFile("src/client/App.tsx", "utf8");

    expect(source).not.toContain('window.open("https://www.xiaohongshu.com/", "_blank")');
    expect(source).toContain('openOriginalUrl("https://www.xiaohongshu.com/")');
  });

  it("ignores development roots without removing built client files with the same name", () => {
    const require = createRequire(import.meta.url);
    const config = require("../forge.config.cjs") as { packagerConfig: { ignore: RegExp[] } };
    const ignored = (filePath: string) => config.packagerConfig.ignore.some((pattern) => pattern.test(filePath));

    expect(ignored(path.join(process.cwd(), "index.html"))).toBe(true);
    expect(ignored(path.join(process.cwd(), "data", "searchJobs.json"))).toBe(true);
    expect(ignored(path.join(process.cwd(), "dist", "client", "index.html"))).toBe(false);
    expect(ignored(path.join(process.cwd(), "node_modules", "some-package", "test", "fixture.js"))).toBe(false);
    expect(ignored(`${path.sep}index.html`)).toBe(true);
    expect(ignored(`${path.sep}${path.join("data", "searchJobs.json")}`)).toBe(true);
    expect(ignored(`${path.sep}${path.join("dist", "client", "index.html")}`)).toBe(false);
    expect(ignored(`${path.sep}${path.join("node_modules", "some-package", "test", "fixture.js")}`)).toBe(false);
  });

  it("handles Squirrel install events so Windows shortcuts are created and removed", async () => {
    const source = await readFile("src/electron/main.ts", "utf8");
    expect(source).toContain("electron-squirrel-startup");
    expect(source).toContain("if (squirrelStartup)");
  });

  it("keeps Forge output outside Git", async () => {
    const gitignore = await readFile(".gitignore", "utf8");
    expect(gitignore.split(/\r?\n/)).toContain("out/");
  });
});

describe("desktop renderer security policy", () => {
  it("uses an isolated sandbox without Node integration", async () => {
    const { desktopWebPreferences } = await import("../src/electron/windowPolicy.js");
    expect(desktopWebPreferences).toEqual({
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    });
  });

  it("allows navigation only inside the local application origin", async () => {
    const { isAllowedAppNavigation } = await import("../src/electron/windowPolicy.js");
    const appUrl = "http://127.0.0.1:8787";

    expect(isAllowedAppNavigation(`${appUrl}/content`, appUrl)).toBe(true);
    expect(isAllowedAppNavigation("https://www.xiaohongshu.com/", appUrl)).toBe(false);
    expect(isAllowedAppNavigation("file:///C:/Windows/System32/calc.exe", appUrl)).toBe(false);
    expect(isAllowedAppNavigation("not a url", appUrl)).toBe(false);
  });
});

describe("desktop startup failure cleanup", () => {
  it("always quits even when no server was created or server close fails", async () => {
    const { finishStartupFailure } = await import("../src/electron/lifecycle.js");
    const quitWithoutServer = vi.fn();
    await finishStartupFailure(undefined, quitWithoutServer);
    expect(quitWithoutServer).toHaveBeenCalledOnce();

    const quitAfterCloseFailure = vi.fn();
    await finishStartupFailure(async () => {
      throw new Error("close failed");
    }, quitAfterCloseFailure);
    expect(quitAfterCloseFailure).toHaveBeenCalledOnce();
  });
});
