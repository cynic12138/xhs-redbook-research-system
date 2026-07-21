import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import net from "node:net";
import { homedir } from "node:os";
import path from "node:path";
import type { BrowserAuthBrowser, BrowserAuthSessionInfo, BrowserAuthSessionStatus, BrowserOpenResult, UserSummary } from "../../shared/types.js";
import { nowIso } from "../../shared/utils.js";
import { getRuntimePaths } from "../runtime/runtimePaths.js";
import { redbook } from "./redbookService.js";

const XHS_LOGIN_URL = "https://www.xiaohongshu.com/";
const BROWSER: BrowserAuthBrowser = "edge";
const BROWSER_NAME = "Microsoft Edge";
const PROFILE_DIR = getRuntimePaths().browserProfileDir;
const REQUIRED_KEYS = ["a1", "web_session"] as const;

interface BrowserAuthSession {
  sessionId: string;
  port: number;
  process?: ChildProcess;
  profileDir: string;
  browser: BrowserAuthBrowser;
  browserName: string;
  status: BrowserAuthSessionStatus;
  loginUrl: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
}

export interface BrowserAuthCaptureWaiting extends BrowserAuthSessionInfo {
  status: "opening" | "waiting" | "failed" | "closed";
}

export interface BrowserAuthCaptureVerified {
  status: "verified";
  session: BrowserAuthSessionInfo;
  cookieString: string;
  user: UserSummary;
}

export type BrowserAuthCaptureResult = BrowserAuthCaptureWaiting | BrowserAuthCaptureVerified;

interface CdpCookie {
  name: string;
  value: string;
  domain: string;
}

interface CdpTarget {
  id: string;
  type: string;
  url: string;
  webSocketDebuggerUrl?: string;
}

export class BrowserAuthService {
  private readonly sessions = new Map<string, BrowserAuthSession>();

  async startSession(): Promise<BrowserAuthSessionInfo> {
    const reusable = [...this.sessions.values()].find((session) =>
      session.status !== "closed" && session.status !== "failed" && session.process && !session.process.killed
    );
    if (reusable) {
      reusable.updatedAt = nowIso();
      reusable.message = "专用登录窗口已打开。请在窗口中登录小红书，系统会自动检测 Cookie。";
      return this.toInfo(reusable);
    }

    const browserPath = findEdgeBinary();
    if (!browserPath) {
      throw new Error("未找到 Microsoft Edge 浏览器。请安装或修复 Edge 后重试，也可以使用手动 Cookie 输入。");
    }

    await mkdir(PROFILE_DIR, { recursive: true });
    const port = await findFreePort();
    const createdAt = nowIso();
    const session: BrowserAuthSession = {
      sessionId: `browser_auth_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      port,
      profileDir: PROFILE_DIR,
      browser: BROWSER,
      browserName: BROWSER_NAME,
      status: "opening",
      loginUrl: XHS_LOGIN_URL,
      message: "正在打开专用 Microsoft Edge 登录窗口...",
      createdAt,
      updatedAt: createdAt
    };

    const args = [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${PROFILE_DIR}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-session-crashed-bubble",
      "--new-window",
      XHS_LOGIN_URL
    ];

    const child = spawn(browserPath, args, {
      detached: false,
      stdio: "ignore",
      windowsHide: false
    });
    session.process = child;
    this.sessions.set(session.sessionId, session);

    child.once("exit", () => {
      if (session.status !== "verified") {
        session.status = "closed";
        session.message = "专用登录窗口已关闭。";
        session.updatedAt = nowIso();
      }
    });

    session.status = "waiting";
    session.message = "专用登录窗口已打开。请扫码/登录小红书，系统会自动检测 Cookie。";
    session.updatedAt = nowIso();
    void normalizeLoginTabs(port);
    return this.toInfo(session);
  }

  async captureSession(sessionId: string): Promise<BrowserAuthCaptureResult> {
    const session = this.getSession(sessionId);
    if (session.status === "closed" || session.status === "failed") {
      return this.toInfo(session) as BrowserAuthCaptureWaiting;
    }

    const wsUrl = await getDebuggerWebSocketUrl(session.port);
    if (!wsUrl) {
      session.status = "opening";
      session.message = "登录窗口仍在启动中，请稍后自动检测。";
      session.updatedAt = nowIso();
      return this.toInfo(session) as BrowserAuthCaptureWaiting;
    }

    const cookies = await readXhsCookies(wsUrl, session.port);
    const missingKeys = REQUIRED_KEYS.filter((key) => !cookies[key]);
    if (missingKeys.length > 0) {
      session.status = "waiting";
      session.message = "还没有检测到完整登录 Cookie。请确认专用窗口里已经登录小红书。";
      session.updatedAt = nowIso();
      return { ...this.toInfo(session), missingKeys } as BrowserAuthCaptureWaiting;
    }

    const cookieString = cookieMapToString(cookies);
    try {
      const user = await redbook.verifyCookie(cookieString);
      session.status = "verified";
      session.message = "已读取并验证专用登录窗口 Cookie。";
      session.updatedAt = nowIso();
      return {
        status: "verified",
        session: this.toInfo(session),
        cookieString,
        user
      };
    } catch (error) {
      session.status = "failed";
      session.lastError = safeErrorMessage(error);
      session.message = "Cookie 已读取，但验证失败。请在专用窗口重新登录后再检测。";
      session.updatedAt = nowIso();
      return this.toInfo(session) as BrowserAuthCaptureWaiting;
    }
  }

  closeSession(sessionId: string): BrowserAuthSessionInfo {
    const session = this.getSession(sessionId);
    if (session.process && !session.process.killed) {
      session.process.kill();
    }
    session.status = "closed";
    session.message = "专用登录窗口已关闭。";
    session.updatedAt = nowIso();
    this.sessions.delete(sessionId);
    return this.toInfo(session);
  }

  closeAll(): void {
    for (const session of this.sessions.values()) {
      if (session.process && !session.process.killed) {
        session.process.kill();
      }
    }
    this.sessions.clear();
  }

  async openUrl(url: string): Promise<BrowserOpenResult> {
    assertXhsUrl(url);
    const browserPath = findEdgeBinary();
    if (!browserPath) {
      throw new Error("未找到 Microsoft Edge 浏览器，无法打开原帖。");
    }
    await mkdir(PROFILE_DIR, { recursive: true });
    spawn(
      browserPath,
      [
        `--user-data-dir=${PROFILE_DIR}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--new-window",
        url
      ],
      {
        detached: true,
        stdio: "ignore",
        windowsHide: false
      }
    ).unref();
    return {
      ok: true,
      mode: "dedicated-edge",
      url,
      message: "已用 Edge 专用登录环境打开原帖。"
    };
  }

  private getSession(sessionId: string): BrowserAuthSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("登录会话不存在或已关闭。");
    }
    return session;
  }

  private toInfo(session: BrowserAuthSession): BrowserAuthSessionInfo {
    return {
      sessionId: session.sessionId,
      status: session.status,
      browser: session.browser,
      browserName: session.browserName,
      loginUrl: session.loginUrl,
      message: session.message,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      lastError: session.lastError
    };
  }
}

export const browserAuth = new BrowserAuthService();

process.once("exit", () => {
  browserAuth.closeAll();
});

function findEdgeBinary(): string | undefined {
  const candidates =
    process.platform === "win32"
      ? [
          process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Microsoft", "Edge", "Application", "msedge.exe"),
          process.env["PROGRAMFILES(X86)"] && path.join(process.env["PROGRAMFILES(X86)"], "Microsoft", "Edge", "Application", "msedge.exe"),
          process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "Application", "msedge.exe")
        ]
      : process.platform === "darwin"
        ? ["/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]
        : [
            "/usr/bin/microsoft-edge",
            "/usr/bin/microsoft-edge-stable",
            "/usr/bin/microsoft-edge-beta",
            "/usr/bin/microsoft-edge-dev",
            path.join(homedir(), ".local", "bin", "microsoft-edge")
          ];
  return candidates.filter(Boolean).find((candidate) => existsSync(candidate as string)) as string | undefined;
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === "string") {
          reject(new Error("无法分配本地调试端口。"));
          return;
        }
        resolve(address.port);
      });
    });
  });
}

async function getDebuggerWebSocketUrl(port: number): Promise<string | undefined> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(2500)
    });
    if (!response.ok) {
      return undefined;
    }
    const data = (await response.json()) as { webSocketDebuggerUrl?: string };
    return data.webSocketDebuggerUrl;
  } catch {
    return undefined;
  }
}

async function readXhsCookies(browserWsUrl: string, port: number): Promise<Record<string, string>> {
  let allCookies: CdpCookie[] = [];
  try {
    allCookies = await getStorageCookies(browserWsUrl);
  } catch {
    allCookies = [];
  }

  const storageCookies = filterXhsCookies(allCookies);
  if (hasRequiredCookies(storageCookies)) {
    return storageCookies;
  }

  const pageTargets = await getPageTargets(port);
  for (const target of pageTargets) {
    if (!target.webSocketDebuggerUrl) {
      continue;
    }
    try {
      const pageCookies = await getPageCookies(target.webSocketDebuggerUrl);
      allCookies = [...allCookies, ...pageCookies];
    } catch {
      // Some pages or browser versions do not expose Network cookies; try the next target.
    }
  }
  return filterXhsCookies(allCookies);
}

function filterXhsCookies(allCookies: CdpCookie[]): Record<string, string> {
  const xhsCookies: Record<string, string> = {};
  for (const cookie of allCookies) {
    if (cookie.domain.includes("xiaohongshu.com")) {
      xhsCookies[cookie.name] = cookie.value;
    }
  }
  return xhsCookies;
}

function hasRequiredCookies(cookies: Record<string, string>): boolean {
  return REQUIRED_KEYS.every((key) => Boolean(cookies[key]));
}

async function getStorageCookies(wsUrl: string): Promise<CdpCookie[]> {
  const result = await sendCdpCommand<{ cookies?: CdpCookie[] }>(wsUrl, "Storage.getCookies");
  return result.cookies ?? [];
}

async function getPageCookies(wsUrl: string): Promise<CdpCookie[]> {
  const result = await sendCdpCommand<{ cookies?: CdpCookie[] }>(wsUrl, "Network.getCookies", {
    urls: ["https://www.xiaohongshu.com/", "https://xiaohongshu.com/"]
  });
  return result.cookies ?? [];
}

async function sendCdpCommand<T>(wsUrl: string, method: string, params?: Record<string, unknown>): Promise<T> {
  if (typeof globalThis.WebSocket === "undefined") {
    throw new Error("当前 Node.js 不支持 WebSocket，无法通过专用登录窗口读取 Cookie。");
  }
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("读取登录窗口 Cookie 超时。"));
    }, 10_000);

    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ id: 1, method, params }));
    });

    ws.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(String(event.data)) as {
          id?: number;
          error?: { message?: string };
          result?: T;
        };
        if (message.id !== 1) {
          return;
        }
        clearTimeout(timeout);
        ws.close();
        if (message.error) {
          reject(new Error(message.error.message ?? "浏览器 DevTools 返回错误。"));
          return;
        }
        resolve((message.result ?? {}) as T);
      } catch (error) {
        clearTimeout(timeout);
        ws.close();
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });

    ws.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("无法连接专用登录窗口调试通道。"));
    });
  });
}

async function getPageTargets(port: number): Promise<CdpTarget[]> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
      signal: AbortSignal.timeout(2500)
    });
    if (!response.ok) {
      return [];
    }
    const targets = (await response.json()) as CdpTarget[];
    return targets.filter((target) => target.type === "page");
  } catch {
    return [];
  }
}

async function normalizeLoginTabs(port: number): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const targets = (await getPageTargets(port)).filter((target) => target.url.includes("xiaohongshu.com"));
    if (targets.length > 0) {
      for (const duplicate of targets.slice(1)) {
        await closeTarget(port, duplicate.id);
      }
      return;
    }
    await delay(500);
  }
}

async function closeTarget(port: number, targetId: string): Promise<void> {
  try {
    await fetch(`http://127.0.0.1:${port}/json/close/${encodeURIComponent(targetId)}`, {
      signal: AbortSignal.timeout(1500)
    });
  } catch {
    // Best-effort cleanup only; duplicate tabs do not block auth.
  }
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function cookieMapToString(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message.replace(/(a1|web_session|webId)=[^;\s]+/g, "$1=<hidden>") : String(error);
}

function assertXhsUrl(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("原帖链接不是有效 URL。");
  }
  if (url.protocol !== "https:" || !url.hostname.endsWith("xiaohongshu.com")) {
    throw new Error("只允许打开 xiaohongshu.com 原帖链接。");
  }
}
