import path from "node:path";

export interface RuntimePaths {
  mode: "development" | "desktop";
  dataDir: string;
  databaseFile: string;
  backupsDir: string;
  restoreStagingDir: string;
  outputDir: string;
  mediaCacheDir: string;
  browserProfileDir: string;
  browserExtensionDir: string;
  envFile: string;
  clientDist: string;
}

let configuredPaths: RuntimePaths | undefined;

export function createDevelopmentRuntimePaths(cwd = process.cwd()): RuntimePaths {
  return {
    mode: "development",
    dataDir: path.join(cwd, "data"),
    databaseFile: path.join(cwd, "data", "app.db"),
    backupsDir: path.join(cwd, "data", "backups"),
    restoreStagingDir: path.join(cwd, "data", ".restore-staging"),
    outputDir: path.join(cwd, "output"),
    mediaCacheDir: path.join(cwd, "data", "media-cache"),
    browserProfileDir: path.join(cwd, "data", "xhs-login-edge-profile"),
    browserExtensionDir: path.join(cwd, "browser-extension", "xhs-bridge"),
    envFile: path.join(cwd, ".env.local"),
    clientDist: path.join(cwd, "dist", "client"),
  };
}

export function createDesktopRuntimePaths(input: {
  userDataDir: string;
  appPath: string;
}): RuntimePaths {
  return {
    mode: "desktop",
    dataDir: path.join(input.userDataDir, "data"),
    databaseFile: path.join(input.userDataDir, "data", "app.db"),
    backupsDir: path.join(input.userDataDir, "backups"),
    restoreStagingDir: path.join(input.userDataDir, "data", ".restore-staging"),
    outputDir: path.join(input.userDataDir, "output"),
    mediaCacheDir: path.join(input.userDataDir, "media-cache"),
    browserProfileDir: path.join(input.userDataDir, "browser-profile"),
    browserExtensionDir: path.join(input.userDataDir, "browser-extension", "xhs-bridge"),
    envFile: path.join(input.userDataDir, ".env.local"),
    clientDist: path.join(input.appPath, "dist", "client"),
  };
}

export function configureRuntimePaths(paths: RuntimePaths): void {
  if (configuredPaths) {
    throw new Error("Runtime paths have already been configured.");
  }

  configuredPaths = Object.freeze({ ...paths });
}

export function getRuntimePaths(): RuntimePaths {
  return configuredPaths ?? createDevelopmentRuntimePaths();
}
