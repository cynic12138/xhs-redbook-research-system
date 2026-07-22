const statusEl = document.getElementById("status");
const pairingPanel = document.getElementById("pairing-panel");
const pairedPanel = document.getElementById("paired-panel");

void refreshPairingState();

document.getElementById("pair").addEventListener("click", async () => {
  setStatus("正在连接本地运营台...", "");
  const code = document.getElementById("pairing-code").value.trim();
  const response = await sendCommand("pairExtension", { code });
  if (response.ok) {
    showPaired(true);
    setStatus("配对成功，可以同步当前浏览器登录态。", "ok");
  } else {
    setStatus(response.error, "error");
  }
});

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

document.getElementById("unpair").addEventListener("click", async () => {
  setStatus("正在解除配对...", "");
  const response = await sendCommand("unpairExtension");
  showPaired(false);
  setStatus(response.ok ? "配对已解除。" : response.error, response.ok ? "ok" : "error");
});

async function refreshPairingState() {
  const response = await sendCommand("ping");
  const paired = response.ok && response.data?.pairing?.state === "paired";
  showPaired(paired);
  setStatus(paired ? "已连接小红书运营台。" : "请在运营台生成配对码。", paired ? "ok" : "");
}

function showPaired(paired) {
  pairingPanel.hidden = paired;
  pairedPanel.hidden = !paired;
}

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
