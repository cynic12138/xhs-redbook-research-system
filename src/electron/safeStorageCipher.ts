import type { CredentialCipher } from "../server/storage/credentialVault.js";

interface AsyncSafeStorage {
  isAsyncEncryptionAvailable(): Promise<boolean>;
  encryptStringAsync(value: string): Promise<Buffer>;
  decryptStringAsync(value: Buffer): Promise<{ result: string; shouldReEncrypt: boolean }>;
}

export function createSafeStorageCipher(safeStorage: AsyncSafeStorage): CredentialCipher {
  return {
    isAvailable: () => safeStorage.isAsyncEncryptionAvailable(),
    encryptString: (value) => safeStorage.encryptStringAsync(value),
    async decryptString(value) {
      const result = await safeStorage.decryptStringAsync(value);
      return { value: result.result, shouldReEncrypt: result.shouldReEncrypt };
    }
  };
}
