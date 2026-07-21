export const COOKIE_CREDENTIAL_KEY = "XHS_COOKIE_STRING";

export function modelCredentialKey(id: string): string {
  return `AI_MODEL_${id.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}_KEY`;
}

export function isLegacyModelCredentialKey(value: string): boolean {
  return /^AI_MODEL_[A-Z0-9_]+_KEY$/.test(value);
}
