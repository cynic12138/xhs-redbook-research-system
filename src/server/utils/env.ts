import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";

const envPath = path.join(process.cwd(), ".env.local");

dotenv.config({ path: envPath });
dotenv.config();

export function getPort(): number {
  return Number(process.env.PORT ?? 8787);
}

export async function getCookieString(): Promise<string | undefined> {
  const fromEnv = process.env.XHS_COOKIE_STRING;
  if (fromEnv) {
    return stripQuotes(fromEnv);
  }
  if (!existsSync(envPath)) {
    return undefined;
  }
  const raw = await readFile(envPath, "utf8");
  const match = raw.match(/^XHS_COOKIE_STRING=(.*)$/m);
  return match ? stripQuotes(match[1]) : undefined;
}

export async function saveCookieString(cookieString: string): Promise<void> {
  await saveEnvValue("XHS_COOKIE_STRING", cookieString);
}

export async function saveEnvValue(key: string, value: string): Promise<void> {
  const existing = existsSync(envPath) ? await readFile(envPath, "utf8") : "";
  const safe = JSON.stringify(value);
  const pattern = new RegExp(`^${escapeRegExp(key)}=.*$`, "m");
  const next = pattern.test(existing)
    ? existing.replace(pattern, `${key}=${safe}`)
    : `${existing.trim() ? `${existing.trim()}\n` : ""}${key}=${safe}\n`;

  await writeFile(envPath, next.endsWith("\n") ? next : `${next}\n`, "utf8");
  process.env[key] = value;
}

export function getEnvValue(key: string): string | undefined {
  const value = process.env[key];
  return value ? stripQuotes(value) : undefined;
}

export function getDetailIntervalSec(): number {
  return Number(process.env.XHS_DETAIL_INTERVAL_SEC ?? 60);
}

export function getDetailJitterPct(): number {
  return Number(process.env.XHS_DETAIL_JITTER_PCT ?? 50);
}

export function getDailyReadBudget(): number {
  return Number(process.env.XHS_DAILY_READ_BUDGET ?? 0);
}

export function getJobConcurrency(): number {
  return Number(process.env.XHS_JOB_CONCURRENCY ?? 2);
}

export function getMaxJobConcurrency(): number {
  return Math.max(1, Number(process.env.XHS_MAX_JOB_CONCURRENCY ?? 2));
}

export function getMediaAutoRefresh(): boolean {
  return process.env.XHS_MEDIA_AUTO_REFRESH === "true";
}

export function getAutoResumeJobs(): boolean {
  return process.env.XHS_AUTO_RESUME_JOBS === "true";
}

export function getSearchIntervalSec(): number {
  return Number(process.env.XHS_SEARCH_INTERVAL_SEC ?? 15);
}

export function getSearchJitterPct(): number {
  return Number(process.env.XHS_SEARCH_JITTER_PCT ?? 70);
}

export function getWorkerStaggerSec(): number {
  return Number(process.env.XHS_WORKER_STAGGER_SEC ?? 12);
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
