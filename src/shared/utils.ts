import type { NoteRecord } from "./types.js";

export function nowIso(): string {
  return new Date().toISOString();
}

export function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function parseCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return 0;
  }

  const normalized = value.trim().replace(/,/g, "");
  if (!normalized) {
    return 0;
  }

  const unit = normalized.at(-1);
  const numeric = Number.parseFloat(unit === "万" || unit === "亿" ? normalized.slice(0, -1) : normalized);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  if (unit === "万") {
    return Math.round(numeric * 10_000);
  }
  if (unit === "亿") {
    return Math.round(numeric * 100_000_000);
  }
  return Math.round(numeric);
}

export function ratio(numerator: number, denominator: number): number {
  if (!denominator) {
    return 0;
  }
  return Number((numerator / denominator).toFixed(4));
}

export function mean(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function median(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) {
    return sorted[middle] ?? 0;
  }
  return Math.round(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2);
}

export function hotScore(note: Pick<NoteRecord, "likedCount" | "commentCount" | "collectedCount" | "shareCount">): number {
  return note.likedCount + note.commentCount * 3 + note.collectedCount * 2 + note.shareCount * 2;
}

export function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function detectRiskSignal(value: unknown): string | undefined {
  const text = value instanceof Error ? value.message : JSON.stringify(value ?? "");
  const lower = text.toLowerCase();
  if (lower.includes("needverify") || lower.includes("captcha") || text.includes("验证码")) {
    return "NeedVerify/captcha detected.";
  }
  if (lower.includes("no 'a1'") || lower.includes("session expired") || lower.includes("cookie")) {
    return "XHS session cookie is invalid or expired.";
  }
  if (text.includes("300012") || lower.includes("ip block")) {
    return "IP rate limit 300012 detected.";
  }

  if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) {
    return "Empty response; xsec_token may be expired or anti-scrape was triggered.";
  }
  return undefined;
}
