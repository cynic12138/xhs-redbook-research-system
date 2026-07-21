import type { CredentialSecurityStatus } from "../../shared/types.js";
import { getRuntimePaths } from "./runtimePaths.js";
import { closeRuntimeStorage, getRuntimeStorage } from "../storage/runtimeStorage.js";
import { isLegacyModelCredentialKey } from "../storage/credentialKeys.js";
import {
  SqliteCredentialVault,
  type CredentialCipher,
  type CredentialVault
} from "../storage/credentialVault.js";
import { getEnvValue, saveEnvValue } from "../utils/env.js";

const DESKTOP_STARTUP_FAILURE = "本地凭据安全初始化失败。";

let configuredCipher: CredentialCipher | undefined;
let configurationComplete = false;
let runtimeVault: CredentialVault | undefined;
let preparation: Promise<CredentialSecurityStatus> | undefined;

export function configureRuntimeCredentials(options: { cipher: CredentialCipher }): void {
  if (configurationComplete) {
    throw new Error("Runtime credentials have already been configured.");
  }
  if (getRuntimePaths().mode !== "desktop") {
    throw new Error("Desktop runtime paths must be configured before runtime credentials.");
  }
  configuredCipher = options.cipher;
  configurationComplete = true;
}

export async function prepareRuntimeCredentials(): Promise<CredentialSecurityStatus> {
  if (runtimeVault) return runtimeVault.migrateLegacyPlaintext();
  if (preparation) return preparation;
  preparation = prepareRuntimeCredentialsOnce();
  try {
    return await preparation;
  } finally {
    preparation = undefined;
  }
}

export function getRuntimeCredentialVault(): CredentialVault {
  if (!runtimeVault) throw new Error("Runtime credentials have not been prepared.");
  return runtimeVault;
}

async function prepareRuntimeCredentialsOnce(): Promise<CredentialSecurityStatus> {
  const runtimePaths = getRuntimePaths();
  if (runtimePaths.mode === "development") {
    runtimeVault = new DevelopmentEnvCredentialVault();
    return runtimeVault.getStatus();
  }

  try {
    if (!configurationComplete || !configuredCipher || !await configuredCipher.isAvailable()) {
      throw new Error(DESKTOP_STARTUP_FAILURE);
    }
    const storage = getRuntimeStorage();
    const vault = new SqliteCredentialVault(storage.database, configuredCipher, {
      legacyEnvFile: runtimePaths.envFile
    });
    const status = await vault.migrateLegacyPlaintext();
    runtimeVault = vault;
    return status;
  } catch {
    closeRuntimeStorage();
    runtimeVault = undefined;
    throw new Error(DESKTOP_STARTUP_FAILURE);
  }
}

class DevelopmentEnvCredentialVault implements CredentialVault {
  async get(key: string): Promise<string | undefined> {
    return getEnvValue(key);
  }

  async set(key: string, value: string): Promise<void> {
    await saveEnvValue(key, value);
  }

  async delete(key: string): Promise<void> {
    await saveEnvValue(key, "");
    delete process.env[key];
  }

  async getStatus(): Promise<CredentialSecurityStatus> {
    const cookieConfigured = Boolean(getEnvValue("XHS_COOKIE_STRING"));
    const modelKeyCount = Object.keys(process.env)
      .filter((key) => isLegacyModelCredentialKey(key) && Boolean(getEnvValue(key)))
      .length;
    return {
      mode: "development-env",
      state: "development",
      encryptionAvailable: false,
      cookieConfigured,
      modelKeyCount,
      encryptedCredentialCount: 0,
      unreadableCredentialCount: 0,
      legacyPlaintextCredentialCount: 0
    };
  }

  migrateLegacyPlaintext(): Promise<CredentialSecurityStatus> {
    return this.getStatus();
  }
}
