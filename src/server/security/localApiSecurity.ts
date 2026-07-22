import type { RequestHandler } from "express";

const DEFAULT_APP_ORIGINS = new Set([
  "http://127.0.0.1:8787",
  "http://127.0.0.1:5173",
  "http://localhost:5173"
]);
const EXTENSION_ORIGIN = /^chrome-extension:\/\/[a-p]{32}$/;

interface LocalApiSecurityOptions {
  appOrigins?: ReadonlySet<string>;
}

export function createLocalApiSecurityMiddleware(
  options: LocalApiSecurityOptions = {}
): RequestHandler {
  const appOrigins = options.appOrigins ?? DEFAULT_APP_ORIGINS;
  return (req, res, next) => {
    if (!isLoopbackHost(req.hostname)) {
      res.status(403).json({ error: "本地接口拒绝了异常 Host。" });
      return;
    }

    const origin = req.get("Origin");
    if (!origin) {
      next();
      return;
    }

    const isAppOrigin = appOrigins.has(origin);
    const isExtensionOrigin = EXTENSION_ORIGIN.test(origin)
      && req.path.startsWith("/api/auth/extension/");
    if (!isAppOrigin && !isExtensionOrigin) {
      res.status(403).json({ error: "本地接口拒绝了不受信任的页面来源。" });
      return;
    }

    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-XHS-Bridge-Token");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  };
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost";
}
