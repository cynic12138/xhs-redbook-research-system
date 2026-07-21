import { app, safeStorage } from "electron";

void app.whenReady()
  .then(async () => {
    if (!await safeStorage.isAsyncEncryptionAvailable()) {
      throw new Error("asynchronous encryption unavailable");
    }

    const sample = `desktop-security-smoke-${process.pid}`;
    const ciphertext = await safeStorage.encryptStringAsync(sample);
    const decrypted = await safeStorage.decryptStringAsync(ciphertext);
    if (decrypted.result !== sample) {
      throw new Error("security smoke mismatch");
    }

    console.log("CREDENTIAL_SMOKE_OK=true");
    app.exit(0);
  })
  .catch(() => {
    console.error("CREDENTIAL_SMOKE_OK=false");
    app.exit(1);
  });
