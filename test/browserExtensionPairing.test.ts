import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { openApplicationDatabase } from "../src/server/storage/database.js";
import {
  BrowserExtensionPairingError,
  BrowserExtensionPairingService
} from "../src/server/services/browserExtensionPairingService.js";
import { BrowserExtensionPairingRepository } from "../src/server/storage/browserExtensionPairingRepository.js";

const EXTENSION_ID = "a".repeat(32);
const FIRST_TOKEN = Buffer.alloc(32, 1).toString("base64url");
const SECOND_TOKEN = Buffer.alloc(32, 2).toString("base64url");

describe("browser extension pairing", () => {
  it("stores only the token hash and authenticates the matching extension", () => {
    const fixture = createFixture();
    fixture.service.start({ codeHash: sha256Hex("123456") });
    const status = fixture.service.complete({
      code: "123456",
      token: FIRST_TOKEN,
      extensionId: EXTENSION_ID,
      browser: "edge",
      extensionVersion: "0.2.0"
    });

    expect(status).toMatchObject({ state: "paired", browser: "edge", extensionVersion: "0.2.0" });
    const row = fixture.database.connection.prepare(
      "SELECT token_hash, extension_id FROM browser_extension_pairing WHERE singleton_id = 1"
    ).get() as { token_hash: Uint8Array; extension_id: string };
    expect(Buffer.from(row.token_hash)).toEqual(createHash("sha256").update(FIRST_TOKEN).digest());
    expect(Buffer.from(row.token_hash).toString("utf8")).not.toContain(FIRST_TOKEN);
    expect(row.extension_id).toBe(EXTENSION_ID);
    expect(fixture.service.authenticate(FIRST_TOKEN, EXTENSION_ID)).toBe(true);
    expect(fixture.service.authenticate(SECOND_TOKEN, EXTENSION_ID)).toBe(false);
    fixture.database.close();
  });

  it("keeps the old pairing while a new session starts or is cancelled, then replaces it atomically", () => {
    const fixture = createFixture();
    fixture.service.start({ codeHash: sha256Hex("123456") });
    fixture.service.complete({
      code: "123456",
      token: FIRST_TOKEN,
      extensionId: EXTENSION_ID,
      browser: "edge"
    });

    fixture.service.start({ codeHash: sha256Hex("654321") });
    expect(fixture.service.authenticate(FIRST_TOKEN, EXTENSION_ID)).toBe(true);
    fixture.service.cancel();
    expect(fixture.service.authenticate(FIRST_TOKEN, EXTENSION_ID)).toBe(true);

    fixture.service.start({ codeHash: sha256Hex("654321") });
    fixture.service.complete({
      code: "654321",
      token: SECOND_TOKEN,
      extensionId: EXTENSION_ID,
      browser: "chrome"
    });
    expect(fixture.service.authenticate(FIRST_TOKEN, EXTENSION_ID)).toBe(false);
    expect(fixture.service.authenticate(SECOND_TOKEN, EXTENSION_ID)).toBe(true);
    fixture.database.close();
  });

  it("expires pairing sessions and destroys them after five incorrect attempts", () => {
    let now = Date.parse("2026-07-22T00:00:00.000Z");
    const fixture = createFixture(() => new Date(now));
    fixture.service.start({ codeHash: sha256Hex("123456") });

    for (let attempt = 0; attempt < 4; attempt += 1) {
      expect(() => fixture.service.complete({
        code: "000000",
        token: FIRST_TOKEN,
        extensionId: EXTENSION_ID,
        browser: "edge"
      })).toThrowError(expect.objectContaining({ statusCode: 401 }));
      expect(fixture.service.status()).toMatchObject({
        state: "pairing",
        attemptsRemaining: 4 - attempt
      });
    }
    expect(() => fixture.service.complete({
      code: "000000",
      token: FIRST_TOKEN,
      extensionId: EXTENSION_ID,
      browser: "edge"
    })).toThrowError(expect.objectContaining({ statusCode: 429 }));
    expect(fixture.service.status().state).toBe("unpaired");

    fixture.service.start({ codeHash: sha256Hex("123456") });
    now += 5 * 60_000 + 1;
    expect(() => fixture.service.complete({
      code: "123456",
      token: FIRST_TOKEN,
      extensionId: EXTENSION_ID,
      browser: "edge"
    })).toThrowError(expect.objectContaining({ statusCode: 410 }));
    expect(fixture.service.status().state).toBe("expired");
    fixture.database.close();
  });

  it("revokes the pairing without exposing or retaining the token", () => {
    const fixture = createFixture();
    fixture.service.start({ codeHash: sha256Hex("123456") });
    fixture.service.complete({
      code: "123456",
      token: FIRST_TOKEN,
      extensionId: EXTENSION_ID,
      browser: "edge"
    });

    expect(fixture.service.revoke()).toMatchObject({ state: "unpaired" });
    expect(fixture.service.authenticate(FIRST_TOKEN, EXTENSION_ID)).toBe(false);
    expect(fixture.database.connection.prepare(
      "SELECT COUNT(*) AS count FROM browser_extension_pairing"
    ).get()).toEqual({ count: 0 });
    fixture.database.close();
  });
});

function createFixture(now: () => Date = () => new Date("2026-07-22T00:00:00.000Z")) {
  const database = openApplicationDatabase(":memory:");
  const repository = new BrowserExtensionPairingRepository(database);
  const service = new BrowserExtensionPairingService(repository, { now });
  return { database, repository, service };
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

void BrowserExtensionPairingError;
