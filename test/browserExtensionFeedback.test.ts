import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

describe("browser extension pairing feedback", () => {
  it("includes the remaining count after an incorrect pairing code", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ pairing: { state: "pairing", attemptsRemaining: 4 } })
    });
    const format = await loadPairingFailureMessage(fetch);

    await expect(format({ status: 401 }, { error: "扩展配对码不正确。" })).resolves.toBe(
      "扩展配对码不正确，还剩 4 次。"
    );
    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:8787/api/auth/extension/status");
  });

  it("falls back to the original error when the status refresh fails", async () => {
    const format = await loadPairingFailureMessage(vi.fn().mockRejectedValue(new Error("offline")));

    await expect(format({ status: 401 }, { error: "扩展配对码不正确。" })).resolves.toBe(
      "扩展配对码不正确。"
    );
  });

  it("keeps terminal pairing errors without requesting another status", async () => {
    const fetch = vi.fn();
    const format = await loadPairingFailureMessage(fetch);

    await expect(format({ status: 429 }, { error: "扩展配对尝试次数已用完，请重新生成配对码。" })).resolves.toBe(
      "扩展配对尝试次数已用完，请重新生成配对码。"
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});

async function loadPairingFailureMessage(fetch: ReturnType<typeof vi.fn>) {
  const source = await readFile("browser-extension/xhs-bridge/background.js", "utf8");
  const context = {
    fetch,
    URL,
    Uint8Array,
    navigator: { userAgent: "Edg/1" },
    crypto: { getRandomValues: (values: Uint8Array) => values },
    btoa: () => "",
    chrome: {
      runtime: {
        id: "a".repeat(32),
        lastError: undefined,
        getManifest: () => ({ version: "0.2.0" }),
        onInstalled: { addListener: () => undefined },
        onStartup: { addListener: () => undefined },
        onMessage: { addListener: () => undefined }
      },
      storage: {
        local: {
          setAccessLevel: async () => undefined,
          get: async () => ({}),
          set: async () => undefined,
          remove: async () => undefined
        }
      },
      cookies: { getAll: () => undefined },
      tabs: { query: () => undefined, create: () => undefined },
      scripting: { executeScript: () => undefined }
    }
  } as Record<string, unknown>;
  vm.runInNewContext(source, context);
  return context.pairingFailureMessage as (
    response: { status: number },
    body: { error?: string }
  ) => Promise<string>;
}
