const API_BASE = "http://127.0.0.1:8787";
const XHS_COOKIE_URLS = [
  "https://www.xiaohongshu.com/",
  "https://www.xiaohongshu.com/explore",
  "https://edith.xiaohongshu.com/",
  "https://creator.xiaohongshu.com/"
];
const REQUIRED_COOKIE_NAMES = ["a1", "web_session"];

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "XHS_BRIDGE_COMMAND") {
    return false;
  }

  handleCommand(message.action, message.payload)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  return true;
});

async function handleCommand(action, payload = {}) {
  if (action === "ping") {
    return {
      connected: true,
      browser: detectBrowser(),
      extensionVersion: chrome.runtime.getManifest().version,
      permissionStatus: "granted"
    };
  }
  if (action === "syncCookie") {
    return syncCookie();
  }
  if (action === "openUrl") {
    return openUrl(payload.url);
  }
  throw new Error(`Unsupported bridge action: ${action}`);
}

async function syncCookie() {
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
      `Missing required XHS cookies: ${missingKeys.join(", ")}. ` +
        `Found cookie names: ${foundNames.length ? foundNames.join(", ") : "none"}. ` +
        `${pageHint} ` +
        "Please confirm this exact browser profile is logged in to xiaohongshu.com, refresh the Xiaohongshu tab, then try again."
    );
  }

  const response = await fetch(`${API_BASE}/api/auth/extension-cookie`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : `Sync failed: HTTP ${response.status}`);
  }
  return body;
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
    return { ok: false, error: "No open Xiaohongshu tab was found." };
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
  return { ok: false, error: errors[0] ?? "Unable to inspect the Xiaohongshu page." };
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
    return "Page storage was not inspected.";
  }
  if (!pageAuth.ok) {
    return `Page storage check failed: ${pageAuth.error ?? "unknown error"}.`;
  }
  const cookieNames = pageAuth.cookieNames?.length ? pageAuth.cookieNames.join(", ") : "none";
  const storageKeys = pageAuth.storageKeys?.length ? pageAuth.storageKeys.slice(0, 12).join(", ") : "none";
  const discovered = Object.keys(pageAuth.values ?? {}).sort();
  return (
    `Page cookie names: ${cookieNames}. ` +
    `Page storage keys checked: ${storageKeys}${pageAuth.storageKeys?.length > 12 ? ", ..." : ""}. ` +
    `Auth values discovered from page context: ${discovered.length ? discovered.join(", ") : "none"}.`
  );
}

async function openUrl(url) {
  const parsed = new URL(String(url));
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith("xiaohongshu.com")) {
    throw new Error("Only xiaohongshu.com URLs can be opened by this bridge.");
  }
  const tab = await chromeCall(chrome.tabs.create, { url: parsed.toString(), active: true });
  return {
    ok: true,
    mode: "current-browser",
    url: parsed.toString(),
    tabId: tab.id,
    message: "Opened in the current browser."
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
