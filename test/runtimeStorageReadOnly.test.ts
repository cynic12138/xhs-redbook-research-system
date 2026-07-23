import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ApplicationStorage } from "../src/server/storage/runtimeStorage.js";

describe("runtime storage restore freeze", () => {
  it("blocks writes through an already-held store reference until the freeze is cancelled", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "xhs-runtime-freeze-"));
    const storage = new ApplicationStorage(path.join(root, "app.db"), path.join(root, "legacy"));
    try {
      await storage.store.write("authStatus", { connected: false, configured: false });
      storage.setReadOnly(true);
      await expect(storage.store.write("authStatus", { connected: true, configured: true })).rejects.toThrow();
      storage.setReadOnly(false);
      await storage.store.write("authStatus", { connected: true, configured: true });
      await expect(storage.store.read("authStatus")).resolves.toMatchObject({ connected: true, configured: true });
    } finally {
      storage.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
