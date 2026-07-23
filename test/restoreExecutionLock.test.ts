import { describe, expect, it } from "vitest";
import { RestoreExecutionLock } from "../src/electron/restoreExecutionLock.js";

describe("desktop restore execution lock", () => {
  it("rejects a concurrent restore and releases the lock after completion", async () => {
    const lock = new RestoreExecutionLock();
    let release!: () => void;
    const active = lock.run(() => new Promise<void>((resolve) => {
      release = resolve;
    }));

    await expect(lock.run(async () => undefined)).rejects.toThrow("已有数据恢复正在执行");
    release();
    await active;
    await expect(lock.run(async () => "ok")).resolves.toBe("ok");
  });

  it("releases the lock when a restore fails", async () => {
    const lock = new RestoreExecutionLock();
    await expect(lock.run(async () => {
      throw new Error("restore failed");
    })).rejects.toThrow("restore failed");
    await expect(lock.run(async () => "retry")).resolves.toBe("retry");
  });
});
