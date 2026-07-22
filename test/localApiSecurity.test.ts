import http from "node:http";
import express from "express";
import { describe, expect, it } from "vitest";
import { createLocalApiSecurityMiddleware } from "../src/server/security/localApiSecurity.js";

describe("local API security policy", () => {
  it("rejects untrusted web origins before a mutation route executes", async () => {
    let executed = false;
    const app = createApp(() => { executed = true; });
    const response = await request(app, {
      method: "POST",
      origin: "https://attacker.example",
      path: "/api/auth/cookie"
    });

    expect(response.status).toBe(403);
    expect(executed).toBe(false);
    expect(response.allowOrigin).toBeUndefined();
  });

  it("allows exact app and development origins without using a wildcard", async () => {
    for (const origin of ["http://127.0.0.1:8787", "http://127.0.0.1:5173", "http://localhost:5173"]) {
      const response = await request(createApp(), { method: "POST", origin, path: "/api/test" });
      expect(response.status).toBe(200);
      expect(response.allowOrigin).toBe(origin);
      expect(response.allowOrigin).not.toBe("*");
    }
  });

  it("allows extension origins only for extension API paths", async () => {
    const origin = `chrome-extension://${"a".repeat(32)}`;
    expect((await request(createApp(), { method: "POST", origin, path: "/api/auth/extension/pairing/complete" })).status).toBe(200);
    expect((await request(createApp(), { method: "POST", origin, path: "/api/auth/cookie" })).status).toBe(403);
  });

  it("preserves no-Origin local clients without emitting CORS headers", async () => {
    const response = await request(createApp(), { method: "POST", path: "/api/test" });
    expect(response.status).toBe(200);
    expect(response.allowOrigin).toBeUndefined();
  });

  it("rejects abnormal Host values", async () => {
    const response = await request(createApp(), {
      method: "POST",
      path: "/api/test",
      host: "attacker.example"
    });
    expect(response.status).toBe(403);
  });
});

function createApp(onExecute: () => void = () => undefined) {
  const app = express();
  app.use(createLocalApiSecurityMiddleware());
  app.post("/api/*path", (_req, res) => {
    onExecute();
    res.json({ ok: true });
  });
  return app;
}

async function request(
  app: express.Express,
  input: { method: "POST"; path: string; origin?: string; host?: string }
): Promise<{ status: number; allowOrigin?: string }> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not expose a port.");
  try {
    return await new Promise((resolve, reject) => {
      const request = http.request({
        hostname: "127.0.0.1",
        port: address.port,
        path: input.path,
        method: input.method,
        headers: {
          ...(input.origin ? { Origin: input.origin } : {}),
          ...(input.host ? { Host: input.host } : {})
        }
      }, (response) => {
        response.resume();
        response.on("end", () => resolve({
          status: response.statusCode ?? 0,
          allowOrigin: typeof response.headers["access-control-allow-origin"] === "string"
            ? response.headers["access-control-allow-origin"]
            : undefined
        }));
      });
      request.on("error", reject);
      request.end();
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}
