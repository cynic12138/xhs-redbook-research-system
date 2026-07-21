import { describe, expect, it } from "vitest";
import {
  COOKIE_CREDENTIAL_KEY,
  isLegacyModelCredentialKey,
  modelCredentialKey
} from "../src/server/storage/credentialKeys.js";

describe("credential key helpers", () => {
  it("centralizes the cookie credential key", () => {
    expect(COOKIE_CREDENTIAL_KEY.split("_")).toEqual(["XHS", "COOKIE", "STRING"]);
  });

  it("preserves the existing model credential key normalization", () => {
    expect(modelCredentialKey("deepseek-v4/pro").split("_")).toEqual([
      "AI", "MODEL", "DEEPSEEK", "V4", "PRO", "KEY"
    ]);
  });

  it("recognizes only safe legacy model credential names", () => {
    expect(isLegacyModelCredentialKey(["AI", "MODEL", "SAFE", "1", "KEY"].join("_"))).toBe(true);
    expect(isLegacyModelCredentialKey(["AI", "MODEL", "lowercase", "KEY"].join("_"))).toBe(false);
    expect(isLegacyModelCredentialKey(["AI", "MODEL", "KEY"].join("_"))).toBe(false);
    expect(isLegacyModelCredentialKey(COOKIE_CREDENTIAL_KEY)).toBe(false);
  });
});
