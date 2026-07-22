export function generateBrowserPairingCode(
  nextRandom: () => number = cryptographicRandom
): string {
  const value = 100_000 + (Math.abs(Math.trunc(nextRandom())) % 900_000);
  return String(value).padStart(6, "0");
}

export async function hashBrowserPairingCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function pairingSecondsRemaining(expiresAt: string | undefined, now = Date.now()): number {
  if (!expiresAt) return 0;
  const expiry = Date.parse(expiresAt);
  if (!Number.isFinite(expiry)) return 0;
  return Math.max(0, Math.ceil((expiry - now) / 1000));
}

function cryptographicRandom(): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] ?? 0;
}
