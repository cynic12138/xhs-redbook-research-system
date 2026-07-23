import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("browser extension pairing contract", () => {
  it("ships extension 0.2.1 and injects the bridge into desktop and development origins", async () => {
    const manifest = JSON.parse(await readFile("browser-extension/xhs-bridge/manifest.json", "utf8"));
    expect(manifest.version).toBe("0.2.1");
    expect(manifest.content_scripts[0].matches).toEqual(expect.arrayContaining([
      "http://127.0.0.1:8787/*",
      "http://127.0.0.1:5173/*",
      "http://localhost:5173/*"
    ]));
  });

  it("keeps the bridge token in trusted extension storage and authenticates cookie sync", async () => {
    const source = await readFile("browser-extension/xhs-bridge/background.js", "utf8");
    expect(source).toContain('accessLevel: "TRUSTED_CONTEXTS"');
    expect(source).toContain("crypto.getRandomValues");
    expect(source).toContain('"X-XHS-Bridge-Token"');
    expect(source).toMatch(/chrome\.storage\.local\.(?:get|set|remove)/);
    expect(source).toContain("response.status === 401");
    expect(source).toContain("pairExtension");
    expect(source).toContain("unpairExtension");
  });

  it("reads the authoritative pairing status after an incorrect code and reports remaining attempts", async () => {
    const source = await readFile("browser-extension/xhs-bridge/background.js", "utf8");
    expect(source).toContain("/api/auth/extension/status");
    expect(source).toContain("attemptsRemaining");
    expect(source).toContain("还剩 ${attemptsRemaining} 次");
  });

  it("does not expose bridge credentials to the page-facing content script", async () => {
    const source = await readFile("browser-extension/xhs-bridge/content-script.js", "utf8");
    expect(source).toContain("event.origin !== window.location.origin");
    expect(source).toContain("ALLOWED_ACTIONS");
    expect(source).not.toContain("chrome.storage");
    expect(source).not.toContain("Bridge-Token");
  });

  it("offers pairing and revocation controls in the popup", async () => {
    const html = await readFile("browser-extension/xhs-bridge/popup.html", "utf8");
    const script = await readFile("browser-extension/xhs-bridge/popup.js", "utf8");
    expect(html).toContain('id="pairing-code"');
    expect(html).toContain('id="pair"');
    expect(html).toContain('id="unpair"');
    expect(script).toContain('sendCommand("pairExtension"');
    expect(script).toContain('sendCommand("unpairExtension"');
  });
});
