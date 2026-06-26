const statusEl = document.getElementById("status");

document.getElementById("open-xhs").addEventListener("click", async () => {
  setStatus("正在打开小红书...", "");
  const response = await sendCommand("openUrl", { url: "https://www.xiaohongshu.com/" });
  setStatus(response.ok ? "已打开小红书。登录后请回到这里点击同步。" : response.error, response.ok ? "ok" : "error");
});

document.getElementById("sync").addEventListener("click", async () => {
  setStatus("正在读取小红书 Cookie 和页面登录态...", "");
  const response = await sendCommand("syncCookie");
  setStatus(response.ok ? "同步成功，请回到本地运营台。" : response.error, response.ok ? "ok" : "error");
});

function sendCommand(action, payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "XHS_BRIDGE_COMMAND", action, payload }, (response) => {
      resolve(response ?? { ok: false, error: chrome.runtime.lastError?.message ?? "浏览器助手没有响应。" });
    });
  });
}

function setStatus(text, className) {
  statusEl.textContent = text || "";
  statusEl.className = className || "";
}
