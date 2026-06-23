import type { Request, Response } from "express";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { NoteRecord } from "../../shared/types.js";
import { nowIso } from "../../shared/utils.js";
import { store } from "../storage/localStore.js";
import { getMediaAutoRefresh } from "../utils/env.js";
import { normalizeNote } from "./normalizers.js";
import { redbook } from "./redbookService.js";

const cacheDir = path.join(process.cwd(), "data", "media-cache");
const allowedHostSuffixes = [".xhscdn.com", ".xiaohongshu.com"];

interface CachedMediaMeta {
  contentType: string;
  cachedAt: string;
}

export async function proxyMedia(req: Request, res: Response): Promise<void> {
  const mediaUrl = assertMediaUrl(String(req.query.url ?? ""));
  const context = parseMediaContext(req);
  try {
    await serveMedia(req, res, mediaUrl);
  } catch (error) {
    if (!getMediaAutoRefresh()) {
      sendMediaFallback(res, mediaUrl);
      return;
    }
    const replacement = await refreshMediaUrl(context, mediaUrl).catch(() => undefined);
    if (replacement && replacement !== mediaUrl) {
      await serveMedia(req, res, replacement);
      return;
    }
    throw error;
  }
}

async function serveMedia(req: Request, res: Response, mediaUrl: string): Promise<void> {
  const range = typeof req.headers.range === "string" ? req.headers.range : undefined;

  if (range || isVideoUrl(mediaUrl)) {
    await streamRemoteMedia(mediaUrl, res, range);
    return;
  }

  const cached = await readCachedMedia(mediaUrl);
  if (cached) {
    sendBuffer(res, cached.body, cached.contentType, true);
    return;
  }

  const remote = await fetchRemoteMedia(mediaUrl);
  const contentType = remote.headers.get("content-type") ?? inferContentType(mediaUrl);
  if (contentType.startsWith("video/")) {
    await pipeRemoteMedia(remote, res);
    return;
  }

  const body = Buffer.from(await remote.arrayBuffer());
  await writeCachedMedia(mediaUrl, body, contentType);
  sendBuffer(res, body, contentType, false);
}

function parseMediaContext(req: Request): { noteId?: string; kind?: "image" | "video"; index?: number } {
  const noteId = typeof req.query.noteId === "string" && req.query.noteId.trim() ? req.query.noteId.trim() : undefined;
  const kind = req.query.kind === "video" ? "video" : req.query.kind === "image" ? "image" : undefined;
  const index = typeof req.query.index === "string" ? Number(req.query.index) : undefined;
  return { noteId, kind, index: typeof index === "number" && Number.isInteger(index) && index >= 0 ? index : undefined };
}

async function refreshMediaUrl(
  context: { noteId?: string; kind?: "image" | "video"; index?: number },
  failedUrl: string
): Promise<string | undefined> {
  if (!context.noteId) {
    return undefined;
  }

  const notes = await store.read("notes");
  const existing = notes.find((note) => note.id === context.noteId);
  if (!existing?.webUrl) {
    return undefined;
  }

  const raw = await redbook.read(existing.webUrl);
  const refreshed = normalizeNote(raw, existing.keywords[0] ?? "", existing.jobIds[0] ?? "media-refresh", existing);
  if (!refreshed) {
    return undefined;
  }

  await store.update("notes", (current) =>
    current.map((note) =>
      note.id === refreshed.id
        ? {
            ...note,
            ...refreshed,
            updatedAt: nowIso()
          }
        : note
    )
  );

  return selectReplacementMedia(refreshed, failedUrl, context);
}

function selectReplacementMedia(
  note: NoteRecord,
  failedUrl: string,
  context: { kind?: "image" | "video"; index?: number }
): string | undefined {
  if (context.kind === "video" || isVideoUrl(failedUrl)) {
    return note.videoUrl || undefined;
  }

  const candidates = noteMediaImages(note);
  const sameSlot = context.index === undefined ? undefined : candidates[context.index];
  if (sameSlot) {
    return sameSlot;
  }

  const fingerprint = mediaFingerprint(failedUrl);
  return candidates.find((url) => mediaFingerprint(url) === fingerprint) ?? candidates[0];
}

function noteMediaImages(note: NoteRecord): string[] {
  return [
    ...new Set(
      [...(note.imageUrls ?? []), note.coverUrl].filter((url): url is string => typeof url === "string" && Boolean(url.trim()) && !isVideoUrl(url))
    )
  ];
}

function mediaFingerprint(mediaUrl: string): string {
  try {
    const parsed = new URL(mediaUrl);
    return parsed.pathname.split("/").filter(Boolean).at(-1) ?? mediaUrl;
  } catch {
    return mediaUrl;
  }
}

function assertMediaUrl(rawUrl: string): string {
  if (!rawUrl.trim()) {
    throw new Error("media url is required");
  }

  const parsed = new URL(rawUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("unsupported media protocol");
  }

  const host = parsed.hostname.toLowerCase();
  const allowed = allowedHostSuffixes.some((suffix) => host.endsWith(suffix) || host === suffix.slice(1));
  if (!allowed) {
    throw new Error("unsupported media host");
  }

  return parsed.toString();
}

async function readCachedMedia(mediaUrl: string): Promise<{ body: Buffer; contentType: string } | undefined> {
  const key = cacheKey(mediaUrl);
  const bodyPath = path.join(cacheDir, `${key}.bin`);
  const metaPath = path.join(cacheDir, `${key}.json`);
  if (!existsSync(bodyPath) || !existsSync(metaPath)) {
    return undefined;
  }

  const [body, metaRaw] = await Promise.all([readFile(bodyPath), readFile(metaPath, "utf8")]);
  const meta = JSON.parse(metaRaw) as CachedMediaMeta;
  return { body, contentType: meta.contentType };
}

async function writeCachedMedia(mediaUrl: string, body: Buffer, contentType: string): Promise<void> {
  await mkdir(cacheDir, { recursive: true });
  const key = cacheKey(mediaUrl);
  await Promise.all([
    writeFile(path.join(cacheDir, `${key}.bin`), body),
    writeFile(path.join(cacheDir, `${key}.json`), JSON.stringify({ contentType, cachedAt: new Date().toISOString() }, null, 2), "utf8")
  ]);
}

async function streamRemoteMedia(mediaUrl: string, res: Response, range?: string): Promise<void> {
  const remote = await fetchRemoteMedia(mediaUrl, range);
  await pipeRemoteMedia(remote, res);
}

async function fetchRemoteMedia(mediaUrl: string, range?: string): Promise<globalThis.Response> {
  const headers: Record<string, string> = {
    accept: isVideoUrl(mediaUrl) ? "video/*,*/*;q=0.8" : "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    referer: "https://www.xiaohongshu.com/",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36"
  };
  if (range) {
    headers.range = range;
  }

  const remote = await fetch(mediaUrl, { headers, redirect: "follow" });
  if (!remote.ok && remote.status !== 206) {
    throw new Error(`media fetch failed: ${remote.status}`);
  }
  return remote;
}

async function pipeRemoteMedia(remote: globalThis.Response, res: Response): Promise<void> {
  res.status(remote.status === 206 ? 206 : 200);
  copyHeader(remote, res, "content-type");
  copyHeader(remote, res, "content-length");
  copyHeader(remote, res, "content-range");
  copyHeader(remote, res, "accept-ranges");
  res.setHeader("Cache-Control", "private, max-age=3600");

  if (!remote.body) {
    res.end();
    return;
  }

  Readable.fromWeb(remote.body).pipe(res);
}

function sendBuffer(res: Response, body: Buffer, contentType: string, cacheHit: boolean): void {
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Length", String(body.length));
  res.setHeader("Cache-Control", "private, max-age=86400");
  res.setHeader("X-Media-Cache", cacheHit ? "hit" : "miss");
  res.send(body);
}

function sendMediaFallback(res: Response, mediaUrl: string): void {
  if (res.headersSent) {
    res.end();
    return;
  }

  res.setHeader("Cache-Control", "private, max-age=1800");
  res.setHeader("X-Media-Fallback", "true");
  if (isVideoUrl(mediaUrl)) {
    res.status(204).end();
    return;
  }

  const body = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="240" viewBox="0 0 360 240"><rect width="360" height="240" rx="10" fill="#edf1f5"/><path d="M142 96h76a10 10 0 0 1 10 10v48a10 10 0 0 1-10 10h-76a10 10 0 0 1-10-10v-48a10 10 0 0 1 10-10zm12 52h52l-15-18-12 13-10-11-15 16z" fill="#aab4c0"/><text x="180" y="188" text-anchor="middle" font-size="16" font-family="Arial, sans-serif" fill="#718096">媒体暂不可用</text></svg>`
  );
  res.status(200);
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Content-Length", String(body.length));
  res.send(body);
}

function copyHeader(remote: globalThis.Response, res: Response, name: string): void {
  const value = remote.headers.get(name);
  if (value) {
    res.setHeader(name, value);
  }
}

function cacheKey(mediaUrl: string): string {
  return createHash("sha256").update(mediaUrl).digest("hex");
}

function inferContentType(mediaUrl: string): string {
  if (/\.png(\?|#|$)/i.test(mediaUrl)) {
    return "image/png";
  }
  if (/\.jpe?g(\?|#|$)/i.test(mediaUrl)) {
    return "image/jpeg";
  }
  if (/\.gif(\?|#|$)/i.test(mediaUrl)) {
    return "image/gif";
  }
  if (/\.mp4(\?|#|$)/i.test(mediaUrl)) {
    return "video/mp4";
  }
  return "image/webp";
}

function isVideoUrl(mediaUrl: string): boolean {
  return /\.(mp4|m3u8|mov)(\?|#|$)/i.test(mediaUrl) || /\/stream\//i.test(mediaUrl);
}
