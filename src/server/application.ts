import { existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";
import cors from "cors";
import express from "express";
import { getRuntimePaths } from "./runtime/runtimePaths.js";
import { api } from "./routes/api.js";
import { jobs } from "./services/jobService.js";
import { closeRuntimeStorage, getRuntimeStorage } from "./storage/runtimeStorage.js";
import { getAutoResumeJobs, getPort } from "./utils/env.js";

export interface RunningApplicationServer {
  app: express.Express;
  server: Server;
  host: "127.0.0.1";
  port: number;
  url: string;
  close(): Promise<void>;
}

export interface StartApplicationServerOptions {
  host?: "127.0.0.1";
  port?: number;
  clientDist?: string;
  resumeJobs?: boolean;
}

export function createApplication(options: { clientDist?: string } = {}): express.Express {
  const app = express();
  const clientDist = options.clientDist ?? getRuntimePaths().clientDist;

  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  app.use(async (req, res, next) => {
    if (
      ["GET", "HEAD", "OPTIONS"].includes(req.method) ||
      req.path.startsWith("/api/system/storage-status") ||
      req.path.startsWith("/api/system/legacy-import/")
    ) {
      next();
      return;
    }
    try {
      const status = await getRuntimeStorage().status();
      if (status.migrationState === "legacy-import-required") {
        res.status(409).json({ error: "检测到旧版 JSON 数据，请先在模型设置的数据存储栏目完成迁移。" });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  });
  app.use("/api", api);

  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.use((req, res, next) => {
      if (req.method !== "GET") {
        next();
        return;
      }
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ error: message });
  });

  return app;
}

export async function startApplicationServer(
  options: StartApplicationServerOptions = {}
): Promise<RunningApplicationServer> {
  const host = options.host ?? "127.0.0.1";
  const requestedPort = options.port ?? getPort();
  const app = createApplication({ clientDist: options.clientDist });
  const server = createServer(app);

  await listen(server, host, requestedPort);
  const address = server.address();
  if (!address || typeof address === "string") {
    await closeServer(server);
    throw new Error("本地服务已启动，但无法读取监听地址。");
  }

  const port = address.port;
  const resumeJobs = options.resumeJobs ?? getAutoResumeJobs();
  const startupTask = resumeJobs ? jobs.resumeActiveJobs() : jobs.pauseActiveJobsOnStartup();
  void startupTask.catch((error) => logBackgroundError(resumeJobs ? "resumeActiveJobs" : "pauseActiveJobsOnStartup", error));

  return {
    app,
    server,
    host,
    port,
    url: `http://${host}:${port}`,
    close: () => closeApplication(server)
  };
}

export function logBackgroundError(scope: string, error: unknown): void {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(`[background:${scope}] ${message}`);
}

async function listen(server: Server, host: "127.0.0.1", port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const handleError = (error: NodeJS.ErrnoException) => {
      server.off("listening", handleListening);
      if (error.code === "EADDRINUSE") {
        reject(new Error(`本地服务端口 ${port} 已被占用，请关闭占用该端口的程序后重试。`, { cause: error }));
        return;
      }
      reject(new Error(`本地服务启动失败：${error.message}`, { cause: error }));
    };
    const handleListening = () => {
      server.off("error", handleError);
      resolve();
    };

    server.once("error", handleError);
    server.once("listening", handleListening);
    server.listen(port, host);
  });
}

async function closeApplication(server: Server): Promise<void> {
  try {
    await closeServer(server);
  } finally {
    closeRuntimeStorage();
  }
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
}
