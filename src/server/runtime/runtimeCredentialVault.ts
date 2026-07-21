import type { CredentialSecurityStatus } from "../../shared/types.js";
import { getRuntimePaths } from "./runtimePaths.js";
import { closeRuntimeStorage, getRuntimeStorage, type ApplicationStorage } from "../storage/runtimeStorage.js";
import { COOKIE_CREDENTIAL_KEY, isLegacyModelCredentialKey } from "../storage/credentialKeys.js";
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
let runtimeVaultStorage: ApplicationStorage | undefined;
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

export function prepareRuntimeCredentials(): Promise<CredentialSecurityStatus> {
  if (preparation) return preparation;
  const currentPreparation = prepareRuntimeCredentialsOnce()
    .catch(() => {
      disposeRuntimeCredentials();
      closeRuntimeStorage();
      throw new Error(DESKTOP_STARTUP_FAILURE);
    })
    .finally(() => {
      if (preparation === currentPreparation) preparation = undefined;
    });
  preparation = currentPreparation;
  return currentPreparation;
}

export function getRuntimeCredentialVault(): CredentialVault {
  if (!runtimeVault) throw new Error("Runtime credentials have not been prepared.");
  return runtimeVault;
}

export async function resolveRuntimeCredentialVault(): Promise<CredentialVault> {
  if (!runtimeVault) await prepareRuntimeCredentials();
  return getRuntimeCredentialVault();
}

export async function readRuntimeCredential(key: string): Promise<string | undefined> {
  try {
    return await (await resolveRuntimeCredentialVault()).get(key);
  } catch {
    return undefined;
  }
}

export function disposeRuntimeCredentials(): void {
  runtimeVault = undefined;
  runtimeVaultStorage = undefined;
}

async function prepareRuntimeCredentialsOnce(): Promise<CredentialSecurityStatus> {
  const runtimePaths = getRuntimePaths();
  if (runtimePaths.mode === "development") {
    const vault = runtimeVault ?? new DevelopmentEnvCredentialVault();
    const status = await vault.migrateLegacyPlaintext();
    runtimeVault = vault;
    runtimeVaultStorage = undefined;
    return status;
  }

  if (!configurationComplete || !configuredCipher || !await configuredCipher.isAvailable()) {
    throw new Error(DESKTOP_STARTUP_FAILURE);
  }
  const storage = getRuntimeStorage();
  const vault = runtimeVault && runtimeVaultStorage === storage
    ? runtimeVault
    : new SqliteCredentialVault(storage.database, configuredCipher, {
      legacyEnvFile: runtimePaths.envFile
    });
  const status = await vault.migrateLegacyPlaintext();
  runtimeVault = vault;
  runtimeVaultStorage = storage;
  return status;
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
    const cookieConfigured = Boolean(getEnvValue(COOKIE_CREDENTIAL_KEY));
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
