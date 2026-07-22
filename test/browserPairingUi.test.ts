import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  generateBrowserPairingCode,
  hashBrowserPairingCode,
  mergeBrowserBridgeStatuses,
  pairingSecondsRemaining,
  shouldUseBrowserPageBridge
} from "../src/client/browserPairing.js";

describe("browser pairing UI helpers", () => {
  it("generates a six-digit code from cryptographic random input", () => {
    expect(generateBrowserPairingCode(() => 0)).toBe("100000");
    expect(generateBrowserPairingCode(() => 899_999)).toBe("999999");
  });

  it("hashes the pairing code without returning the plaintext", async () => {
    const expected = createHash("sha256").update("123456").digest("hex");
    await expect(hashBrowserPairingCode("123456")).resolves.toBe(expected);
  });

  it("calculates a non-negative pairing countdown", () => {
    expect(pairingSecondsRemaining("2026-07-22T00:05:00.000Z", Date.parse("2026-07-22T00:04:01.000Z"))).toBe(59);
    expect(pairingSecondsRemaining("2026-07-22T00:05:00.000Z", Date.parse("2026-07-22T00:06:00.000Z"))).toBe(0);
  });

  it("keeps authoritative pairing data while reflecting the live extension connection", () => {
    const saved = {
      connected: false,
      browser: "edge" as const,
      permissionStatus: "unknown" as const,
      pairing: { state: "paired" as const, pairedAt: "2026-07-22T00:00:00.000Z" }
    };
    const runtime = {
      connected: true,
      browser: "chrome" as const,
      permissionStatus: "granted" as const,
      pairing: { state: "unpaired" as const }
    };

    expect(mergeBrowserBridgeStatuses(saved, runtime)).toMatchObject({
      connected: true,
      browser: "chrome",
      permissionStatus: "granted",
      pairing: saved.pairing
    });
    expect(mergeBrowserBridgeStatuses(saved, undefined)).toMatchObject({
      connected: false,
      pairing: saved.pairing
    });
  });

  it("uses the page Bridge only outside the installed Electron application", () => {
    expect(shouldUseBrowserPageBridge(undefined)).toBe(true);
    expect(shouldUseBrowserPageBridge({ openInstallDirectory: async () => ({ ok: true, message: "ok" }) })).toBe(false);
  });

  it("connects the login card to pairing APIs without handling the long-lived token", async () => {
    const app = await readFile("src/client/App.tsx", "utf8");
    const api = await readFile("src/client/lib/api.ts", "utf8");
    expect(api).toContain("startBrowserExtensionPairing");
    expect(api).toContain("cancelBrowserExtensionPairing");
    expect(api).toContain("revokeBrowserExtensionPairing");
    expect(app).toContain("开始配对");
    expect(app).toContain("取消配对");
    expect(app).toContain("解除配对");
    expect(app).toContain("pairingCode");
    expect(app).toContain("shouldUseBrowserPageBridge(window.desktopExtension)");
    expect(app).toContain("请在 Edge/Chrome 扩展弹窗中同步登录态");
    expect(app).not.toContain("X-XHS-Bridge-Token");
  });

  it("labels the saved account separately and refreshes it without changing pairing semantics", async () => {
    const app = await readFile("src/client/App.tsx", "utf8");
    const revokeStart = app.indexOf("async function revokeBrowserExtensionPairing");
    const revokeEnd = app.indexOf("async function openOriginalUrl", revokeStart);
    const revokeSource = app.slice(revokeStart, revokeEnd);

    expect(app).toContain("小红书账号");
    expect(app).toContain("最近验证：");
    expect(app).toContain("重新验证账号");
    expect(app).toContain('window.addEventListener("focus"');
    expect(app).toContain("api.verifyAuth()");
    expect(revokeSource).not.toContain("setAuth(");
  });
});
