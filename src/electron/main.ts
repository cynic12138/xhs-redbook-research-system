import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain, safeStorage, shell, type MessageBoxOptions, type OpenDialogOptions } from "electron";
import { finishStartupFailure } from "./lifecycle.js";
import { desktopWebPreferences, isAllowedAppNavigation } from "./windowPolicy.js";

type RunningApplicationServer = import("../server/application.js").RunningApplicationServer;
type JobService = import("../server/services/jobService.js").JobService;
type BrowserAuthService = import("../server/services/browserAuthService.js").BrowserAuthService;

const require = createRequire(import.meta.url);
const squirrelStartup = require("electron-squirrel-startup") as boolean;

let mainWindow: BrowserWindow | undefined;
let runningServer: RunningApplicationServer | undefined;
let jobService: JobService | undefined;
let browserAuthService: BrowserAuthService | undefined;
let shutdownInProgress = false;
let isQuitting = false;
let extensionInstallError = "";

if (squirrelStartup) {
  app.quit();
} else {
  startDesktopLifecycle();
}

function startDesktopLifecycle(): void {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  app.on("second-instance", () => {
    focusMainWindow();
  });

  app.on("before-quit", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    void requestShutdown();
  });

  app.on("activate", () => {
    if (mainWindow) {
      focusMainWindow();
    } else if (runningServer) {
      mainWindow = createMainWindow(runningServer.url);
    }
  });

  void app.whenReady().then(bootDesktop).catch(showStartupFailure);
}

async function bootDesktop(): Promise<void> {
  app.setName("小红书运营台");
  const runtime = await import("../server/runtime/runtimePaths.js");
  const runtimePaths = runtime.createDesktopRuntimePaths({
    userDataDir: app.getPath("userData"),
    appPath: app.getAppPath()
  });
  runtime.configureRuntimePaths(runtimePaths);

  const [{ createSafeStorageCipher }, credentials] = await Promise.all([
    import("./safeStorageCipher.js"),
    import("../server/runtime/runtimeCredentialVault.js")
  ]);
  credentials.configureRuntimeCredentials({ cipher: createSafeStorageCipher(safeStorage) });
  await credentials.prepareRuntimeCredentials();

  await Promise.all([
    mkdir(runtimePaths.dataDir, { recursive: true }),
    mkdir(runtimePaths.outputDir, { recursive: true }),
    mkdir(runtimePaths.mediaCacheDir, { recursive: true }),
    mkdir(runtimePaths.browserProfileDir, { recursive: true }),
    mkdir(runtimePaths.browserExtensionDir, { recursive: true })
  ]);
  const { syncBrowserExtensionAssets } = await import("./extensionInstaller.js");
  const bundledExtensionDir = app.isPackaged
    ? path.join(process.resourcesPath, "browser-extension", "xhs-bridge")
    : path.join(app.getAppPath(), "browser-extension", "xhs-bridge");
  await syncBrowserExtensionAssets({
    sourceDir: bundledExtensionDir,
    targetDir: runtimePaths.browserExtensionDir
  }).catch(() => {
    extensionInstallError = "浏览器扩展文件准备失败，请使用专用 Edge 登录或重新安装应用。";
  });

  const clientIndex = path.join(runtimePaths.clientDist, "index.html");
  if (!existsSync(clientIndex)) {
    throw new Error(`未找到桌面页面文件：${clientIndex}`);
  }

  const [{ startApplicationServer }, { jobs }, { browserAuth }] = await Promise.all([
    import("../server/application.js"),
    import("../server/services/jobService.js"),
    import("../server/services/browserAuthService.js")
  ]);
  jobService = jobs;
  browserAuthService = browserAuth;
  ipcMain.handle("storage:select-legacy-data-directory", async () => {
    const options: OpenDialogOptions = {
      title: "选择旧版 data 文件夹",
      properties: ["openDirectory"]
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);
    return result.canceled ? undefined : result.filePaths[0];
  });
  runningServer = await startApplicationServer({
    host: "127.0.0.1",
    port: 8787,
    clientDist: runtimePaths.clientDist
  });
  ipcMain.handle("extension:open-install-directory", async (event) => {
    if (!event.senderFrame || !isAllowedAppNavigation(event.senderFrame.url, runningServer!.url)) {
      return { ok: false, message: "应用拒绝了不受信任的扩展目录请求。" };
    }
    if (extensionInstallError) return { ok: false, message: extensionInstallError };
    const error = await shell.openPath(runtimePaths.browserExtensionDir);
    return error
      ? { ok: false, message: "无法打开浏览器扩展目录，请重新安装应用。" }
      : { ok: true, message: "已打开浏览器扩展目录。" };
  });
  mainWindow = createMainWindow(runningServer.url);
}

function createMainWindow(appUrl: string): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1080,
    minHeight: 720,
    show: false,
    webPreferences: {
      ...desktopWebPreferences,
      preload: path.join(import.meta.dirname, "preload.cjs")
    }
  });

  window.once("ready-to-show", () => window.show());
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = undefined;
  });
  window.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    void requestShutdown();
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, targetUrl) => {
    if (!isAllowedAppNavigation(targetUrl, appUrl)) event.preventDefault();
  });
  void window.loadURL(appUrl).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    dialog.showErrorBox("页面加载失败", `本地应用页面无法加载：${message}`);
  });
  return window;
}

async function requestShutdown(): Promise<void> {
  if (shutdownInProgress || isQuitting) return;
  shutdownInProgress = true;

  try {
    const hasRunningJobs = await jobService?.hasRunningJobs() ?? false;
    if (hasRunningJobs) {
      const messageBoxOptions: MessageBoxOptions = {
        type: "warning",
        title: "仍有任务正在运行",
        message: "退出前需要安全暂停当前任务。",
        detail: "暂停后可在下次启动应用时继续恢复任务。",
        buttons: ["取消", "安全暂停并退出"],
        defaultId: 0,
        cancelId: 0,
        noLink: true
      };
      const result = mainWindow
        ? await dialog.showMessageBox(mainWindow, messageBoxOptions)
        : await dialog.showMessageBox(messageBoxOptions);
      if (result.response === 0) {
        shutdownInProgress = false;
        return;
      }
      await jobService?.prepareForShutdown(15_000);
    }

    browserAuthService?.closeAll();
    await runningServer?.close();
    isQuitting = true;
    app.quit();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    dialog.showErrorBox("无法安全退出", `${message}\n\n应用仍在运行，请稍后重试。`);
    shutdownInProgress = false;
  }
}

function focusMainWindow(): void {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function showStartupFailure(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  dialog.showErrorBox("小红书运营台启动失败", message);
  void finishStartupFailure(runningServer ? () => runningServer!.close() : undefined, () => {
    isQuitting = true;
    app.quit();
  });
}
