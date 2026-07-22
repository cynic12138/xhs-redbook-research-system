import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  generateBrowserPairingCode,
  hashBrowserPairingCode,
  pairingSecondsRemaining
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
    expect(app).not.toContain("X-XHS-Bridge-Token");
  });
});
