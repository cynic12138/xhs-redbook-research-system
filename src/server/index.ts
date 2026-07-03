import cors from "cors";
import express from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import { api } from "./routes/api.js";
import { getAutoResumeJobs, getPort } from "./utils/env.js";
import { jobs } from "./services/jobService.js";

const app = express();
const port = getPort();
const clientDist = path.join(process.cwd(), "dist", "client");

function logBackgroundError(scope: string, error: unknown): void {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(`[background:${scope}] ${message}`);
}

process.on("unhandledRejection", (reason) => {
  logBackgroundError("unhandledRejection", reason);
});

process.on("uncaughtException", (error) => {
  logBackgroundError("uncaughtException", error);
});

app.use(cors());
app.use(express.json({ limit: "2mb" }));
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

app.listen(port, "127.0.0.1", () => {
  console.log(`API listening on http://127.0.0.1:${port}`);
  if (getAutoResumeJobs()) {
    void jobs.resumeActiveJobs().catch((error) => logBackgroundError("resumeActiveJobs", error));
  } else {
    void jobs.pauseActiveJobsOnStartup().catch((error) => logBackgroundError("pauseActiveJobsOnStartup", error));
  }
});
