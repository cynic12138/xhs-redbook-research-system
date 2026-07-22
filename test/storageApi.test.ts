import express from "express";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { vi } from "vitest";

const activateApplicationRuntime = vi.fn(async () => undefined);
const credentialStatus = {
  mode: "desktop-encrypted",
  state: "cleanup-required",
  encryptionAvailable: true,
  cookieConfigured: true,
  modelKeyCount: 1,
  encryptedCredentialCount: 2,
  unreadableCredentialCount: 0,
  legacyPlaintextCredentialCount: 1
} as const;
const getCredentialStatus = vi.fn(async () => credentialStatus);
const retryRuntimeCredentialCleanup = vi.fn(async () => credentialStatus);

vi.mock("../src/server/runtime/applicationRuntime.js", () => ({ activateApplicationRuntime }));
vi.mock("../src/server/runtime/runtimeCredentialVault.js", () => ({
  readRuntimeCredential: vi.fn(async () => undefined),
  resolveRuntimeCredentialVault: vi.fn(async () => ({ getStatus: getCredentialStatus })),
  retryRuntimeCredentialCleanup
}));

const tempDirs: string[] = [];

afterAll(async () => {
  const { closeRuntimeStorage } = await import("../src/server/storage/runtimeStorage.js");
  closeRuntimeStorage();
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("storage migration API", () => {
  it("reports and retries credential security without returning credential identifiers", async () => {
    const { api } = await import("../src/server/routes/api.js");
    const app = express();
    app.use(express.json());
    app.use("/api", api);

    const status = await request(app, "/api/system/credential-security");
    expect(status.status).toBe(200);
    expect(status.body).toEqual(credentialStatus);
    expect(JSON.stringify(status.body)).not.toContain("XHS_COOKIE_STRING");

    const retry = await request(app, "/api/system/credential-security/retry", { method: "POST" });
    expect(retry.status).toBe(200);
    expect(retry.body).toEqual(credentialStatus);
    expect(retryRuntimeCredentialCleanup).toHaveBeenCalled();
  });

  it("previews, executes and reports a SQLite legacy import", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "xhs-storage-api-"));
    tempDirs.push(root);
    await writeFile(path.join(root, "searchJobs.json"), "[]\n", "utf8");
    const { api } = await import("../src/server/routes/api.js");
    const app = express();
    app.use(express.json());
    app.use("/api", api);

    const preview = await request(app, "/api/system/legacy-import/preview", {
      method: "POST",
      body: JSON.stringify({ sourceDir: root }),
      headers: { "Content-Type": "application/json" }
    });
    expect(preview.status).toBe(200);
    expect(preview.body.fingerprint).toMatch(/^[a-f0-9]{64}$/);

    const execute = await request(app, "/api/system/legacy-import/execute", {
      method: "POST",
      body: JSON.stringify({ sourceDir: root, fingerprint: preview.body.fingerprint }),
      headers: { "Content-Type": "application/json" }
    });
    expect(execute.status).toBe(200);
    expect(execute.body).toMatchObject({ imported: true, integrityCheck: "ok" });
    expect(activateApplicationRuntime).toHaveBeenCalledWith({ resumeJobs: false });

    const status = await request(app, "/api/system/storage-status");
    expect(status.status).toBe(200);
    expect(status.body).toMatchObject({ engine: "sqlite", migrationState: "imported" });
  });

  it("creates backups and prepares a credential-free migration restore through stable contracts", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "xhs-backup-api-"));
    tempDirs.push(root);
    const migrationFile = path.join(root, "portable.xhsmigrate");
    const { api } = await import("../src/server/routes/api.js");
    const app = express();
    app.use(express.json());
    app.use("/api", api);

    const created = await request(app, "/api/system/backups", { method: "POST" });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ kind: "manual", credentialsIncluded: true });
    const listed = await request(app, "/api/system/backups");
    expect(listed.status).toBe(200);
    expect(listed.body.backups).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: created.body.id })
    ]));

    const exported = await request(app, "/api/system/migration-package/export", {
      method: "POST",
      body: JSON.stringify({ destinationPath: migrationFile }),
      headers: { "Content-Type": "application/json" }
    });
    expect(exported.status).toBe(201);
    expect(exported.body).toMatchObject({ credentialsIncluded: false });

    const preview = await request(app, "/api/system/data-restore/preview", {
      method: "POST",
      body: JSON.stringify({ kind: "migration-package", filePath: migrationFile }),
      headers: { "Content-Type": "application/json" }
    });
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ sourceKind: "migration-package", requiresRestart: true });
    expect(JSON.stringify(preview.body)).not.toContain(root);

    const prepared = await request(app, "/api/system/data-restore/prepare", {
      method: "POST",
      body: JSON.stringify({
        source: { kind: "migration-package", filePath: migrationFile },
        fingerprint: preview.body.fingerprint
      }),
      headers: { "Content-Type": "application/json" }
    });
    expect(prepared.status).toBe(201);
    expect(prepared.body.restoreId).toMatch(/^[a-f0-9-]{36}$/);

    const conflict = await request(app, "/api/system/data-restore/prepare", {
      method: "POST",
      body: JSON.stringify({
        source: { kind: "migration-package", filePath: migrationFile },
        fingerprint: preview.body.fingerprint
      }),
      headers: { "Content-Type": "application/json" }
    });
    expect(conflict.status).toBe(409);
  });

  it("rejects a damaged migration package with status 422", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "xhs-backup-api-damaged-"));
    tempDirs.push(root);
    const migrationFile = path.join(root, "damaged.xhsmigrate");
    await writeFile(migrationFile, "not-a-data-package", "utf8");
    const { api } = await import("../src/server/routes/api.js");
    const app = express();
    app.use(express.json());
    app.use("/api", api);

    const response = await request(app, "/api/system/data-restore/preview", {
      method: "POST",
      body: JSON.stringify({ kind: "migration-package", filePath: migrationFile }),
      headers: { "Content-Type": "application/json" }
    });
    expect(response.status).toBe(422);
  });
});

async function request(app: express.Express, requestPath: string, init: RequestInit = {}) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server not available");
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, init);
    const body = await response.json() as Record<string, any>;
    return { status: response.status, body };
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}
