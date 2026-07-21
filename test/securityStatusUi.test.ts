import { describe, expect, it } from "vitest";
import type { CredentialSecurityStatus } from "../src/shared/types.js";
import {
  credentialSecurityPresentation,
  shouldOpenCredentialSettings
} from "../src/client/securityStatus.js";

describe("credential security UI", () => {
  it.each([
    ["encrypted", "Cookie 和 AI Key 已使用 Windows 加密保护", false],
    ["development", "当前为开发模式，凭证仍由 .env.local 管理", false],
    ["cleanup-required", "仍有 2 项明文凭证需要清理", true],
    ["reconfiguration-required", "数据库可能来自其他电脑或 Windows 用户", true],
    ["empty", "尚未配置 Cookie 或 AI Key", false]
  ] as const)("presents %s without exposing credential details", (state, expected, warning) => {
    const result = credentialSecurityPresentation(status({ state }));

    expect(`${result.title} ${result.description}`).toContain(expected);
    expect(result.warning).toBe(warning);
    expect(JSON.stringify(result)).not.toContain("XHS_COOKIE_STRING");
  });

  it("opens model settings only for actionable security states", () => {
    expect(shouldOpenCredentialSettings(status({ state: "cleanup-required" }))).toBe(true);
    expect(shouldOpenCredentialSettings(status({ state: "reconfiguration-required" }))).toBe(true);
    expect(shouldOpenCredentialSettings(status({ state: "encrypted" }))).toBe(false);
    expect(shouldOpenCredentialSettings(null)).toBe(false);
  });
});

function status(overrides: Partial<CredentialSecurityStatus>): CredentialSecurityStatus {
  return {
    mode: "desktop-encrypted",
    state: "encrypted",
    encryptionAvailable: true,
    cookieConfigured: true,
    modelKeyCount: 1,
    encryptedCredentialCount: 2,
    unreadableCredentialCount: 0,
    legacyPlaintextCredentialCount: 2,
    ...overrides
  };
}
