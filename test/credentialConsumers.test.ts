import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiModelConfig, AiModelInput } from "../src/shared/types.js";
import { modelCredentialKey } from "../src/server/storage/credentialKeys.js";

const FIXED_MASK = "••••••••";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("credential consumer boundaries", () => {
  it("keeps business services and routes away from direct credential env helpers", () => {
    for (const relativePath of [
      "../src/server/routes/api.ts",
      "../src/server/services/redbookService.ts",
      "../src/server/services/aiService.ts",
      "../src/server/services/aiToolCallingService.ts",
      "../src/server/services/contentStudioService.ts"
    ]) {
      const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
      expect(source, relativePath).not.toMatch(/from ["'][^"']*utils\/env\.js["']/);
      expect(source, relativePath).not.toMatch(/function keyNameForModel\s*\(/);
    }
    const envSource = readFileSync(new URL("../src/server/utils/env.ts", import.meta.url), "utf8");
    expect(envSource).not.toMatch(/export async function (?:getCookieString|saveCookieString)\s*\(/);
  });

  it("falls back to the vault only when an async tool credential callback has no value", async () => {
    const configured = model();
    const vault = {
      get: vi.fn(async () => "vault-token")
    };
    vi.doMock("../src/server/runtime/runtimeCredentialVault.js", () => ({
      resolveRuntimeCredentialVault: vi.fn(async () => vault)
    }));
    const { probeAiModelTools } = await import("../src/server/services/aiToolCallingService.js");
    const storage = {
      read: vi.fn(async () => [configured]),
      update: vi.fn()
    } as unknown as Parameters<typeof probeAiModelTools>[1];
    const authorizations: string[] = [];
    const fetchImpl = async (_url: string, init: { headers: Record<string, string> }) => {
      authorizations.push(init.headers.Authorization);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { tool_calls: [{
            id: "call_vault",
            type: "function",
            function: { name: "create_search_job", arguments: JSON.stringify({ keywords: ["tools-probe"] }) }
          }] } }]
        })
      };
    };

    await expect(probeAiModelTools(configured.id, storage, {
      getApiKey: async () => undefined,
      fetchImpl
    })).resolves.toMatchObject({ ok: true, supportsTools: true });
    expect(vault.get).toHaveBeenCalledWith(modelCredentialKey(configured.id));
    expect(authorizations).toEqual(["Bearer vault-token"]);

    vault.get.mockClear();
    await expect(probeAiModelTools(configured.id, storage, {
      getApiKey: async () => "injected-token",
      fetchImpl
    })).resolves.toMatchObject({ ok: true, supportsTools: true });
    expect(vault.get).not.toHaveBeenCalled();
    expect(authorizations.at(-1)).toBe("Bearer injected-token");
  });

  it("derives model key metadata from the vault and sanitizes historical stored fragments", async () => {
    const historical = model({ apiKeyMasked: "sensitive-first...sensitive-last", hasApiKey: true });
    const fixture = await loadAiService([historical], new Map([[modelCredentialKey(historical.id), "synthetic-value"]]));

    const listed = await fixture.service.listAiModels();

    expect(listed).toEqual([expect.objectContaining({ apiKeyMasked: FIXED_MASK, hasApiKey: true })]);
    expect(fixture.models[0]).toEqual(expect.objectContaining({ apiKeyMasked: "", hasApiKey: false }));
    expect(JSON.stringify(fixture.models)).not.toContain("sensitive-first");
    expect(JSON.stringify(fixture.models)).not.toContain("sensitive-last");
  });

  it("writes, preserves, rotates, and deletes model credentials through the vault", async () => {
    const fixture = await loadAiService([
      model({ id: "legacy-model", apiKeyMasked: "legacy-first...legacy-last", hasApiKey: true, isDefault: false })
    ], new Map());
    const created = await fixture.service.saveAiModel(modelInput({ apiKey: "synthetic-created" }));
    const credentialKey = modelCredentialKey(created.id);

    expect(fixture.vault.set).toHaveBeenCalledWith(credentialKey, "synthetic-created");
    expect(created).toEqual(expect.objectContaining({ apiKeyMasked: FIXED_MASK, hasApiKey: true }));
    expect(fixture.models[0]).toEqual(expect.objectContaining({ apiKeyMasked: "", hasApiKey: false }));
    expect(JSON.stringify(fixture.models)).not.toContain("legacy-first");
    expect(JSON.stringify(fixture.models)).not.toContain("legacy-last");

    fixture.vaultValues.set(credentialKey, "synthetic-created");
    const preserved = await fixture.service.updateAiModel(created.id, { name: "renamed", apiKey: "   " });
    expect(fixture.vault.set).toHaveBeenCalledTimes(1);
    expect(preserved).toEqual(expect.objectContaining({ name: "renamed", apiKeyMasked: FIXED_MASK, hasApiKey: true }));

    const rotated = await fixture.service.updateAiModel(created.id, { apiKey: "synthetic-rotated" });
    expect(fixture.vault.set).toHaveBeenLastCalledWith(credentialKey, "synthetic-rotated");
    expect(rotated).toEqual(expect.objectContaining({ apiKeyMasked: FIXED_MASK, hasApiKey: true }));

    await expect(fixture.service.deleteAiModel(created.id)).resolves.toEqual({ deleted: 1 });
    expect(fixture.vault.delete).toHaveBeenCalledWith(credentialKey);
  });

  it("uses the vault for model connectivity tests without exposing unreadable details", async () => {
    const configured = model();
    const fixture = await loadAiService([configured], new Map([[modelCredentialKey(configured.id), "model-token"]]));
    const fetchMock = vi.fn(async (_url: string, init: { headers: Record<string, string> }) => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "连接成功" } }] }),
      capturedAuthorization: init.headers.Authorization
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fixture.service.testAiModel(configured.id)).resolves.toEqual({ ok: true, message: "连接成功。" });
    expect(fetchMock.mock.calls[0]?.[1].headers.Authorization).toBe("Bearer model-token");

    fixture.vaultValues.delete(modelCredentialKey(configured.id));
    await expect(fixture.service.testAiModel(configured.id)).resolves.toEqual({ ok: false, message: "未配置 API Key。" });
  });
});

async function loadAiService(initialModels: AiModelConfig[], initialVaultValues: Map<string, string>) {
  let models = structuredClone(initialModels);
  const vaultValues = new Map(initialVaultValues);
  const vault = {
    get: vi.fn(async (key: string) => vaultValues.get(key)),
    set: vi.fn(async (key: string, value: string) => {
      vaultValues.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      vaultValues.delete(key);
    })
  };
  const store = {
    read: vi.fn(async (name: string) => name === "aiModels" ? structuredClone(models) : []),
    update: vi.fn(async (name: string, updater: (value: unknown) => unknown | Promise<unknown>) => {
      if (name !== "aiModels") return updater([]);
      models = await updater(structuredClone(models)) as AiModelConfig[];
      return structuredClone(models);
    }),
    write: vi.fn()
  };
  vi.doMock("../src/server/storage/runtimeStorage.js", () => ({ store }));
  vi.doMock("../src/server/runtime/runtimeCredentialVault.js", () => ({
    resolveRuntimeCredentialVault: vi.fn(async () => vault)
  }));
  vi.doMock("../src/server/utils/env.js", () => ({
    getEnvValue: vi.fn(() => undefined),
    saveEnvValue: vi.fn(async () => undefined)
  }));
  const service = await import("../src/server/services/aiService.js");
  return {
    service,
    store,
    vault,
    vaultValues,
    get models() {
      return models;
    }
  };
}

function model(overrides: Partial<AiModelConfig> = {}): AiModelConfig {
  return {
    id: "model-vault",
    name: "vault-model",
    provider: "OpenAI-compatible",
    baseUrl: "https://example.test/v1",
    model: "test-chat",
    apiKeyMasked: "",
    hasApiKey: false,
    isDefault: true,
    temperature: 0,
    maxTokens: 1000,
    createdAt: "2026-07-21T00:00:00.000Z",
    updatedAt: "2026-07-21T00:00:00.000Z",
    ...overrides
  };
}

function modelInput(overrides: Partial<AiModelInput> = {}): AiModelInput {
  return {
    name: "vault-model",
    provider: "OpenAI-compatible",
    baseUrl: "https://example.test/v1",
    model: "test-chat",
    temperature: 0,
    maxTokens: 1000,
    ...overrides
  };
}
