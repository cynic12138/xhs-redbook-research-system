const API_BASE = "http://127.0.0.1:8787";
const XHS_COOKIE_URLS = [
  "https://www.xiaohongshu.com/",
  "https://www.xiaohongshu.com/explore",
  "https://edith.xiaohongshu.com/",
  "https://creator.xiaohongshu.com/"
];
const REQUIRED_COOKIE_NAMES = ["a1", "web_session"];
const BRIDGE_TOKEN_KEY = "xhsBridgeToken";
const LOCAL_APP_ORIGINS = new Set([
  "http://127.0.0.1:8787",
  "http://127.0.0.1:5173",
  "http://localhost:5173"
]);

void restrictStorageAccess();

chrome.runtime.onInstalled.addListener(() => {
  void restrictStorageAccess();
});

chrome.runtime.onStartup.addListener(() => {
  void restrictStorageAccess();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "XHS_BRIDGE_COMMAND") {
    return false;
  }

  if (!isAllowedSender(sender, message.action)) {
    sendResponse({ ok: false, error: "浏览器助手拒绝了不受信任的消息来源。" });
    return false;
  }

  handleCommand(message.action, message.payload)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  return true;
});

async function handleCommand(action, payload = {}) {
  if (action === "ping") {
    const token = await readBridgeToken();
    return {
      connected: true,
      browser: detectBrowser(),
      extensionVersion: chrome.runtime.getManifest().version,
      permissionStatus: "granted",
      pairing: { state: token ? "paired" : "unpaired" }
    };
  }
  if (action === "pairExtension") {
    return pairExtension(payload.code);
  }
  if (action === "unpairExtension") {
    return unpairExtension();
  }
  if (action === "syncCookie") {
    return syncCookie();
  }
  if (action === "openUrl") {
    return openUrl(payload.url);
  }
  throw new Error(`不支持的浏览器助手操作：${action}`);
}

async function syncCookie() {
  const token = await requireBridgeToken();
  const cookies = await readXhsCookies();
  const cookieMap = Object.fromEntries(cookies.map((cookie) => [cookie.name, cookie.value]));
  const pageAuth = await readPageAuthCandidates().catch((error) => ({
    ok: false,
    error: error instanceof Error ? error.message : String(error)
  }));
  if (pageAuth?.values) {
    for (const name of ["a1", "web_session", "webId"]) {
      if (!cookieMap[name] && pageAuth.values[name]) {
        cookieMap[name] = pageAuth.values[name];
      }
    }
  }
  const missingKeys = REQUIRED_COOKIE_NAMES.filter((name) => !cookieMap[name]);
  if (missingKeys.length) {
    const foundNames = [...new Set(cookies.map((cookie) => cookie.name))].sort();
    const pageHint = formatPageAuthHint(pageAuth);
    throw new Error(
      `缺少必要的小红书 Cookie：${missingKeys.join(", ")}。` +
        `已读取到的 Cookie 名称：${foundNames.length ? foundNames.join(", ") : "无"}。` +
        `${pageHint} ` +
        "请确认当前浏览器已登录小红书，刷新小红书页面后再重试。"
    );
  }

  const response = await fetch(`${API_BASE}/api/auth/extension-cookie`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-XHS-Bridge-Token": token
    },
    body: JSON.stringify({
      a1: cookieMap.a1,
      web_session: cookieMap.web_session,
      webId: cookieMap.webId,
      browser: detectBrowser(),
      extensionVersion: chrome.runtime.getManifest().version,
      permissionStatus: "granted"
    })
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) {
    await chrome.storage.local.remove(BRIDGE_TOKEN_KEY);
    throw new Error("浏览器助手配对已失效，请重新连接运营台。");
  }
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : `Sync failed: HTTP ${response.status}`);
  }
  return body;
}

async function pairExtension(code) {
  const normalizedCode = String(code ?? "").trim();
  if (!/^\d{6}$/.test(normalizedCode)) {
    throw new Error("请输入运营台显示的 6 位配对码。");
  }
  const token = generateBridgeToken();
  const response = await fetch(`${API_BASE}/api/auth/extension/pairing/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: normalizedCode,
      token,
      extensionId: chrome.runtime.id,
      browser: detectBrowser(),
      extensionVersion: chrome.runtime.getManifest().version
    })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : `Pairing failed: HTTP ${response.status}`);
  }
  await chrome.storage.local.set({ [BRIDGE_TOKEN_KEY]: token });
  return body;
}

async function unpairExtension() {
  const token = await requireBridgeToken();
  const response = await fetch(`${API_BASE}/api/auth/extension/pairing`, {
    method: "DELETE",
    headers: { "X-XHS-Bridge-Token": token }
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) {
    await chrome.storage.local.remove(BRIDGE_TOKEN_KEY);
    throw new Error("浏览器助手配对已失效，请重新连接运营台。");
  }
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : `Unpair failed: HTTP ${response.status}`);
  }
  await chrome.storage.local.remove(BRIDGE_TOKEN_KEY);
  return body;
}

async function restrictStorageAccess() {
  if (chrome.storage.local.setAccessLevel) {
    await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  }
}

async function readBridgeToken() {
  const stored = await chrome.storage.local.get(BRIDGE_TOKEN_KEY);
  return typeof stored[BRIDGE_TOKEN_KEY] === "string" ? stored[BRIDGE_TOKEN_KEY] : "";
}

async function requireBridgeToken() {
  const token = await readBridgeToken();
  if (!token) throw new Error("浏览器助手尚未配对，请先在运营台生成配对码。");
  return token;
}

function generateBridgeToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const binary = Array.from(bytes, (value) => String.fromCharCode(value)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function isAllowedSender(sender, action) {
  const senderUrl = sender?.url || sender?.tab?.url || "";
  const isExtensionPage = senderUrl.startsWith(`chrome-extension://${chrome.runtime.id}/`);
  if (action === "pairExtension" || action === "unpairExtension") return isExtensionPage;
  if (!new Set(["ping", "syncCookie", "openUrl"]).has(action)) return false;
  if (isExtensionPage) return true;
  try {
    return LOCAL_APP_ORIGINS.has(new URL(senderUrl).origin);
  } catch {
    return false;
  }
}

async function readXhsCookies() {
  const batches = await Promise.all([
    ...XHS_COOKIE_URLS.map((url) => chromeCall(chrome.cookies.getAll, { url }).catch(() => [])),
    chromeCall(chrome.cookies.getAll, { domain: "xiaohongshu.com" }).catch(() => []),
    chromeCall(chrome.cookies.getAll, { domain: ".xiaohongshu.com" }).catch(() => [])
  ]);
  const byKey = new Map();
  for (const cookie of batches.flat()) {
    byKey.set(`${cookie.domain}|${cookie.path}|${cookie.name}`, cookie);
  }
  return [...byKey.values()];
}

async function readPageAuthCandidates() {
  const tabs = await chromeCall(chrome.tabs.query, {
    url: ["https://*.xiaohongshu.com/*", "https://xiaohongshu.com/*"]
  });
  const candidates = tabs
    .filter((tab) => typeof tab.id === "number")
    .sort((a, b) => Number(Boolean(b.active)) - Number(Boolean(a.active)));
  if (!candidates.length) {
    return { ok: false, error: "没有找到已打开的小红书页面。" };
  }

  const errors = [];
  for (const tab of candidates) {
    try {
      const results = await chromeCall(chrome.scripting.executeScript, {
        target: { tabId: tab.id },
        func: collectPageAuthFromPage
      });
      const data = results?.[0]?.result;
      if (data) {
        return { ok: true, tabUrl: tab.url, ...data };
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { ok: false, error: errors[0] ?? "无法检测小红书页面登录态。" };
}

function collectPageAuthFromPage() {
  function isLikelyToken(value) {
    return typeof value === "string" && value.length >= 8 && value.length <= 512 && /^[A-Za-z0-9._=-]+$/.test(value);
  }

  function collectAuthValuesFromJson(input, values, depth) {
    if (!input || depth > 4 || typeof input !== "object") return;
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === "string" && isLikelyToken(value)) {
        if (key === "a1" && !values.a1) values.a1 = value;
        if (key === "webId" && !values.webId) values.webId = value;
        if (key === "web_session" && !values.web_session) values.web_session = value;
      } else if (value && typeof value === "object") {
        collectAuthValuesFromJson(value, values, depth + 1);
      }
    }
  }

  function collectSafeAuthValues(key, value, values) {
    const normalizedKey = key.toLowerCase().replace(/[_-]/g, "");
    if (!values.a1 && normalizedKey === "a1" && isLikelyToken(value)) {
      values.a1 = value;
    }
    if (!values.webId && normalizedKey === "webid" && isLikelyToken(value)) {
      values.webId = value;
    }
    if (!values.web_session && normalizedKey === "websession" && isLikelyToken(value)) {
      values.web_session = value;
    }
    if (!value || value.length > 20000 || (!value.includes("a1") && !value.includes("webId") && !value.includes("web_session"))) {
      return;
    }
    try {
      collectAuthValuesFromJson(JSON.parse(value), values, 0);
    } catch {
      // Ignore non-JSON storage values.
    }
  }

  const values = {};
  const cookieNames = [];
  for (const part of document.cookie.split(";")) {
    const [rawName, ...rawValueParts] = part.trim().split("=");
    const name = rawName?.trim();
    if (!name) continue;
    cookieNames.push(name);
    if (["a1", "web_session", "webId"].includes(name)) {
      values[name] = decodeURIComponent(rawValueParts.join("="));
    }
  }

  const storageKeys = [];
  for (const storageName of ["localStorage", "sessionStorage"]) {
    const storage = window[storageName];
    if (!storage) continue;
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key) continue;
      storageKeys.push(`${storageName}:${key}`);
      const value = storage.getItem(key) ?? "";
      collectSafeAuthValues(key, value, values);
    }
  }

  return {
    href: window.location.href,
    cookieNames: [...new Set(cookieNames)].sort(),
    storageKeys: [...new Set(storageKeys)].sort(),
    values
  };
}

function formatPageAuthHint(pageAuth) {
  if (!pageAuth) {
    return "未检测页面存储。";
  }
  if (!pageAuth.ok) {
    return `页面存储检测失败：${pageAuth.error ?? "未知错误"}。`;
  }
  const cookieNames = pageAuth.cookieNames?.length ? pageAuth.cookieNames.join(", ") : "none";
  const storageKeys = pageAuth.storageKeys?.length ? pageAuth.storageKeys.slice(0, 12).join(", ") : "none";
  const discovered = Object.keys(pageAuth.values ?? {}).sort();
  return (
    `页面 Cookie 名称：${cookieNames}。` +
    `已检查的页面存储键：${storageKeys}${pageAuth.storageKeys?.length > 12 ? ", ..." : ""}。` +
    `页面上下文发现的登录字段：${discovered.length ? discovered.join(", ") : "无"}。`
  );
}

async function openUrl(url) {
  const parsed = new URL(String(url));
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith("xiaohongshu.com")) {
    throw new Error("浏览器助手只能打开 xiaohongshu.com 链接。");
  }
  const tab = await chromeCall(chrome.tabs.create, { url: parsed.toString(), active: true });
  return {
    ok: true,
    mode: "current-browser",
    url: parsed.toString(),
    tabId: tab.id,
    message: "已在当前浏览器打开。"
  };
}

function detectBrowser() {
  return navigator.userAgent.includes("Edg/") ? "edge" : navigator.userAgent.includes("Chrome/") ? "chrome" : "unknown";
}

function chromeCall(fn, ...args) {
  return new Promise((resolve, reject) => {
    fn(...args, (result) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(result);
    });
  });
}
