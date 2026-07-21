import path from "node:path";

export interface RuntimePaths {
  mode: "development" | "desktop";
  dataDir: string;
  databaseFile: string;
  outputDir: string;
  mediaCacheDir: string;
  browserProfileDir: string;
  envFile: string;
  clientDist: string;
}

let configuredPaths: RuntimePaths | undefined;

export function createDevelopmentRuntimePaths(cwd = process.cwd()): RuntimePaths {
  return {
    mode: "development",
    dataDir: path.join(cwd, "data"),
    databaseFile: path.join(cwd, "data", "app.db"),
    outputDir: path.join(cwd, "output"),
    mediaCacheDir: path.join(cwd, "data", "media-cache"),
    browserProfileDir: path.join(cwd, "data", "xhs-login-edge-profile"),
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
    outputDir: path.join(input.userDataDir, "output"),
    mediaCacheDir: path.join(input.userDataDir, "media-cache"),
    browserProfileDir: path.join(input.userDataDir, "browser-profile"),
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
