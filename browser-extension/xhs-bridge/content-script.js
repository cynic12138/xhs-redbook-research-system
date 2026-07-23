window.postMessage(
  {
    source: "XHS_BRIDGE",
    type: "XHS_BRIDGE_READY",
    payload: {
      connected: true,
      extensionVersion: chrome.runtime.getManifest().version
    }
  },
  window.location.origin
);

const ALLOWED_ACTIONS = new Set(["ping", "syncCookie", "openUrl"]);

window.addEventListener("message", (event) => {
  if (
    event.source !== window
    || event.origin !== window.location.origin
    || event.data?.source !== "XHS_APP"
    || event.data?.type !== "XHS_BRIDGE_REQUEST"
    || !ALLOWED_ACTIONS.has(event.data?.action)
  ) {
    return;
  }

  const { requestId, action, payload } = event.data;
  chrome.runtime.sendMessage({ type: "XHS_BRIDGE_COMMAND", action, payload }, (response) => {
    window.postMessage(
      {
        source: "XHS_BRIDGE",
        type: "XHS_BRIDGE_RESPONSE",
        requestId,
        ok: Boolean(response?.ok),
        data: response?.data,
        result: response?.data,
        error: response?.error ?? chrome.runtime.lastError?.message
      },
      window.location.origin
    );
  });
});
