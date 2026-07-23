import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain, safeStorage, shell, type MessageBoxOptions, type OpenDialogOptions, type SaveDialogOptions } from "electron";
import { finishStartupFailure } from "./lifecycle.js";
import { RestoreExecutionLock } from "./restoreExecutionLock.js";
import { desktopWebPreferences, isAllowedAppNavigation } from "./windowPolicy.js";

type RunningApplicationServer = import("../server/application.js").RunningApplicationServer;
type JobService = import("../server/services/jobService.js").JobService;
type BrowserAuthService = import("../server/services/browserAuthService.js").BrowserAuthService;
type ApplicationStorage = import("../server/storage/runtimeStorage.js").ApplicationStorage;
type ApplicationRuntimeModule = typeof import("../server/runtime/applicationRuntime.js");

const require = createRequire(import.meta.url);
const squirrelStartup = require("electron-squirrel-startup") as boolean;

let mainWindow: BrowserWindow | undefined;
let runningServer: RunningApplicationServer | undefined;
let jobService: JobService | undefined;
let browserAuthService: BrowserAuthService | undefined;
let shutdownInProgress = false;
let isQuitting = false;
let extensionInstallError = "";
let restoreCompletionDelivered = false;
const restoreExecutionLock = new RestoreExecutionLock();

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
  const { prepareDatabaseStartup } = await import("../server/storage/startupDataProtection.js");
  await prepareDatabaseStartup({
    databaseFile: runtimePaths.databaseFile,
    backupsDir: runtimePaths.backupsDir,
    stagingDir: runtimePaths.restoreStagingDir,
    appVersion: app.getVersion()
  });
  await credentials.prepareRuntimeCredentials();

  await Promise.all([
    mkdir(runtimePaths.dataDir, { recursive: true }),
    mkdir(runtimePaths.backupsDir, { recursive: true }),
    mkdir(runtimePaths.restoreStagingDir, { recursive: true }),
    mkdir(runtimePaths.outputDir, { recursive: true }),
    mkdir(runtimePaths.mediaCacheDir, { recursive: true }),
    mkdir(runtimePaths.browserProfileDir, { recursive: true }),
    mkdir(runtimePaths.browserExtensionDir, { recursive: true })
  ]);
  const { syncBrowserExtensionAssets } = await import("./extensionInstaller.js");
  const bundledExtensionDir = app.isPackaged
    ? path.join(process.resourcesPath, "xhs-bridge")
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
    clientDist: runtimePaths.clientDist,
    appVersion: app.getVersion(),
    startupPrepared: true
  });
  ipcMain.handle("storage:select-migration-package-destination", async (event) => {
    if (!isTrustedRenderer(event.senderFrame?.url)) return undefined;
    const options: SaveDialogOptions = {
      title: "导出脱敏迁移包",
      defaultPath: `小红书运营台-迁移包-${formatDesktopTimestamp(new Date())}.xhsmigrate`,
      filters: [{ name: "小红书运营台迁移包", extensions: ["xhsmigrate"] }]
    };
    const result = mainWindow
      ? await dialog.showSaveDialog(mainWindow, options)
      : await dialog.showSaveDialog(options);
    return result.canceled ? undefined : result.filePath;
  });
  ipcMain.handle("storage:select-migration-package-file", async (event) => {
    if (!isTrustedRenderer(event.senderFrame?.url)) return undefined;
    const options: OpenDialogOptions = {
      title: "选择脱敏迁移包",
      properties: ["openFile"],
      filters: [{ name: "小红书运营台迁移包", extensions: ["xhsmigrate"] }]
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);
    return result.canceled ? undefined : result.filePaths[0];
  });
  ipcMain.handle("storage:open-backups-directory", async (event) => {
    if (!isTrustedRenderer(event.senderFrame?.url)) {
      return { ok: false, message: "应用拒绝了不受信任的备份目录请求。" };
    }
    const error = await shell.openPath(runtimePaths.backupsDir);
    return error
      ? { ok: false, message: "无法打开备份目录，请稍后重试。" }
      : { ok: true, message: "已打开备份目录。" };
  });
  ipcMain.handle("storage:apply-prepared-restore", async (event, restoreId: unknown) => {
    if (!isTrustedRenderer(event.senderFrame?.url) || typeof restoreId !== "string") {
      return { ok: false, message: "应用拒绝了不受信任的数据恢复请求。" };
    }
    try {
      return await restoreExecutionLock.run(() => applyPreparedRestore(restoreId, runtimePaths));
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "数据恢复执行失败。" };
    }
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

async function applyPreparedRestore(
  restoreId: string,
  runtimePaths: import("../server/runtime/runtimePaths.js").RuntimePaths
): Promise<{ ok: boolean; message: string }> {
  let serverShutdownStarted = false;
  let storage: ApplicationStorage | undefined;
  let applicationRuntime: ApplicationRuntimeModule | undefined;
  try {
    const { getRuntimeStorage } = await import("../server/storage/runtimeStorage.js");
    storage = getRuntimeStorage();
    const plan = storage.restores.getPreparedRestore(restoreId);
    if (await jobService?.hasRunningJobs()) {
      const options: MessageBoxOptions = {
        type: "warning",
        title: "恢复前需要暂停任务",
        message: "恢复会完整替换当前数据库并重启应用。",
        detail: "系统会先安全暂停正在运行的任务，再创建恢复前完整备份。",
        buttons: ["取消", "暂停、备份并恢复"],
        defaultId: 0,
        cancelId: 0,
        noLink: true
      };
      const answer = mainWindow
        ? await dialog.showMessageBox(mainWindow, options)
        : await dialog.showMessageBox(options);
      if (answer.response === 0) {
        await storage.restores.discardPreparedRestore(restoreId);
        return { ok: false, message: "已取消数据恢复。" };
      }
    }
    applicationRuntime = await import("../server/runtime/applicationRuntime.js");
    await applicationRuntime.prepareApplicationRuntimeForDataRestore(15_000);
    await storage.backups.createBackup("pre-restore");
    if (!runningServer) throw new Error("本地服务未运行，无法执行数据恢复。");
    const consumed = storage.restores.consumePreparedRestore(restoreId);
    browserAuthService?.closeAll();
    serverShutdownStarted = true;
    await runningServer.closeAfterRuntimePrepared();
    runningServer = undefined;
    const { replaceDatabaseFromPreparedRestore } = await import("../server/storage/dataRestoreService.js");
    await replaceDatabaseFromPreparedRestore({
      databaseFile: runtimePaths.databaseFile,
      candidateDatabaseFile: consumed.candidateDatabaseFile,
      stagingDir: runtimePaths.restoreStagingDir,
      sourceKind: consumed.sourceKind
    });
    app.relaunch({ args: [...filterRestoreCompletionArgs(process.argv.slice(1)), `--data-restore-completed=${consumed.sourceKind}`] });
    isQuitting = true;
    app.quit();
    return { ok: true, message: "数据恢复完成，应用正在重启。" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!serverShutdownStarted) {
      await storage?.restores.discardPreparedRestore(restoreId).catch(() => undefined);
      applicationRuntime?.resumeApplicationRuntimeAfterCancelledRestore();
    }
    if (serverShutdownStarted) {
      dialog.showErrorBox("数据恢复失败", `${message}\n\n应用将重新启动并继续使用原数据库。`);
      app.relaunch();
      isQuitting = true;
      app.quit();
    }
    return { ok: false, message };
  }
}

function isTrustedRenderer(url: string | undefined): boolean {
  return Boolean(url && runningServer && isAllowedAppNavigation(url, runningServer.url));
}

function formatDesktopTimestamp(value: Date): string {
  const date = [value.getFullYear(), value.getMonth() + 1, value.getDate()]
    .map((part) => String(part).padStart(2, "0"))
    .join("");
  const time = [value.getHours(), value.getMinutes(), value.getSeconds()]
    .map((part) => String(part).padStart(2, "0"))
    .join("");
  return `${date}-${time}`;
}

function filterRestoreCompletionArgs(args: string[]): string[] {
  return args.filter((arg) => !arg.startsWith("--data-restore-completed="));
}

function dataRestoreCompleted(): "backup" | "migration-package" | undefined {
  const value = process.argv.find((arg) => arg.startsWith("--data-restore-completed="))?.split("=")[1];
  return value === "backup" || value === "migration-package" ? value : undefined;
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
  const completedRestore = restoreCompletionDelivered ? undefined : dataRestoreCompleted();
  restoreCompletionDelivered = true;
  const initialUrl = completedRestore
    ? `${appUrl}/?dataRestoreCompleted=${encodeURIComponent(completedRestore)}`
    : appUrl;
  void window.loadURL(initialUrl).catch((error: unknown) => {
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
    jobService?.resumeAfterCancelledShutdown();
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
