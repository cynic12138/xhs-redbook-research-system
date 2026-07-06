import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LocalStore } from "../src/server/storage/localStore.js";

describe("LocalStore", () => {
  it("returns cloned defaults for absent and empty collection files", async () => {
    const dataDir = await createTempDataDir();
    const store = new LocalStore(dataDir);

    const first = await store.read("authStatus");
    first.connected = true;

    expect(await store.read("authStatus")).toEqual({ connected: false, configured: false });

    await mkdir(dataDir, { recursive: true });
    await writeFile(path.join(dataDir, "searchJobs.json"), "", "utf8");

    expect(await store.read("searchJobs")).toEqual([]);
    expect(await store.read("aiCustomPrompts")).toEqual([]);
    expect(await store.read("aiCustomPromptRevisions")).toEqual([]);
  });

  it("writes JSON files with trailing newlines", async () => {
    const dataDir = await createTempDataDir();
    const store = new LocalStore(dataDir);
    const value = { connected: true, configured: true, checkedAt: "2026-06-23T00:00:00.000Z" };

    await store.write("authStatus", value);

    const raw = await readFile(path.join(dataDir, "authStatus.json"), "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(JSON.parse(raw)).toEqual(value);
  });

  it("serializes concurrent updates to the same collection", async () => {
    const dataDir = await createTempDataDir();
    const store = new LocalStore(dataDir);
    const events: string[] = [];

    await Promise.all([
      store.update("rateLimit", async (current) => {
        events.push("first-start");
        await sleep(20);
        events.push("first-end");
        return { ...current, consumedToday: current.consumedToday + 1 };
      }),
      store.update("rateLimit", (current) => {
        events.push(`second-sees-${current.consumedToday}`);
        return { ...current, consumedToday: current.consumedToday + 1 };
      })
    ]);

    expect(events).toEqual(["first-start", "first-end", "second-sees-1"]);
    expect((await store.read("rateLimit")).consumedToday).toBe(2);
  });
});

function createTempDataDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "xhs-local-store-"));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
