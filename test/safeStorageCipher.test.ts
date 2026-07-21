import { describe, expect, it, vi } from "vitest";

describe("Electron async safeStorage cipher", () => {
  it("delegates only to async safeStorage APIs and maps decrypt results", async () => {
    const safeStorage = {
      isAsyncEncryptionAvailable: vi.fn(async () => true),
      encryptStringAsync: vi.fn(async () => Buffer.from([7])),
      decryptStringAsync: vi.fn(async () => ({ result: "synthetic-placeholder", shouldReEncrypt: true }))
    };
    const { createSafeStorageCipher } = await import("../src/electron/safeStorageCipher.js");
    const cipher = createSafeStorageCipher(safeStorage);

    await expect(cipher.isAvailable()).resolves.toBe(true);
    await expect(cipher.encryptString("synthetic-placeholder")).resolves.toEqual(Buffer.from([7]));
    await expect(cipher.decryptString(Buffer.from([7]))).resolves.toEqual({
      value: "synthetic-placeholder",
      shouldReEncrypt: true
    });
    expect(safeStorage.isAsyncEncryptionAvailable).toHaveBeenCalledOnce();
    expect(safeStorage.encryptStringAsync).toHaveBeenCalledOnce();
    expect(safeStorage.decryptStringAsync).toHaveBeenCalledOnce();
  });
});
