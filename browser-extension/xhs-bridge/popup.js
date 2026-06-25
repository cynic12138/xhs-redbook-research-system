const statusEl = document.getElementById("status");

document.getElementById("open-xhs").addEventListener("click", async () => {
  setStatus("Opening Xiaohongshu...", "");
  const response = await sendCommand("openUrl", { url: "https://www.xiaohongshu.com/" });
  setStatus(response.ok ? "Xiaohongshu opened. Log in, then click sync." : response.error, response.ok ? "ok" : "error");
});

document.getElementById("sync").addEventListener("click", async () => {
  setStatus("Reading XHS cookies and page storage...", "");
  const response = await sendCommand("syncCookie");
  setStatus(response.ok ? "Sync succeeded. Return to the local ops app." : response.error, response.ok ? "ok" : "error");
});

function sendCommand(action, payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "XHS_BRIDGE_COMMAND", action, payload }, (response) => {
      resolve(response ?? { ok: false, error: chrome.runtime.lastError?.message ?? "Bridge did not respond." });
    });
  });
}

function setStatus(text, className) {
  statusEl.textContent = text || "";
  statusEl.className = className || "";
}
