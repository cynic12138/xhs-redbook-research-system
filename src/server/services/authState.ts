import { nowIso } from "../../shared/utils.js";
import { store } from "../storage/runtimeStorage.js";

export async function markAuthDisconnected(reason: string): Promise<void> {
  if (!isAuthRisk(reason)) {
    return;
  }

  await store.update("authStatus", (status) => ({
    ...status,
    connected: false,
    configured: true,
    error: reason,
    checkedAt: nowIso()
  }));
}

export function isAuthRisk(reason: string): boolean {
  const lower = reason.toLowerCase();
  return (
    lower.includes("cookie") ||
    lower.includes("session expired") ||
    lower.includes("no 'a1'") ||
    lower.includes("missing xhs_cookie") ||
    lower.includes("needverify") ||
    lower.includes("captcha")
  );
}
