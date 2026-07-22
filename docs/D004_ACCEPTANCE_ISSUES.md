# D-004 Installed Acceptance Issues

Date: 2026-07-22

Status: `0.4.0` automated verification passed, but installed-app acceptance found two functional defects and one status-semantics UX issue. Do not mark D-004 installed acceptance complete until the functional defects are resolved and retested.

## D004-BUG-001: Electron cannot directly detect the Edge extension

Severity: Important

Observed behavior:

- The Edge extension popup opens Xiaohongshu, completes pairing, and synchronizes through the local API.
- The desktop login card shows the pairing record (`Edge`, extension `0.2.0`) but “检测助手” reports that the browser helper did not respond.
- App-side “同步登录态” remains unavailable even though popup-side synchronization works.

Root cause evidence:

- The current renderer calls `callBrowserBridge`, which uses `window.postMessage` and expects `browser-extension/xhs-bridge/content-script.js` to be injected into the page.
- The installed application renders `http://127.0.0.1:8787` inside Electron `BrowserWindow`, while the extension is installed in a separate Edge/Chrome process.
- Edge cannot inject its extension content script into Electron web contents. Pairing and popup synchronization work because they call the Express API directly and do not depend on the page bridge.

Current workaround:

- Use the extension popup to open Xiaohongshu and synchronize the login state.
- Treat the backend pairing status and recent synchronization time as authoritative in the installed application.
- The dedicated Edge login window remains available as a fallback.

Required follow-up direction:

- Separate desktop status presentation from browser-page content-script detection.
- Keep content-script detection for Vite/browser development mode.
- In Electron mode, do not claim the Edge extension can be pinged through `window.postMessage`; either present backend pairing/last-seen state or introduce a separately approved command channel.

## D004-BUG-002: Pairing errors do not display attempts remaining

Severity: Moderate

Observed behavior:

- An incorrect code displays “扩展配对码不正确”.
- The fifth incorrect attempt correctly displays that attempts are exhausted and a new code is required.
- The extension popup does not display remaining attempts after the first through fourth failures.

Root cause evidence:

- `BrowserExtensionPairingService` decrements `attemptsRemaining` correctly.
- `sendPairingError` returns only `{ error }` for `401` and `429` responses.
- The popup renders only the returned error string and does not fetch the current pairing status after a failed attempt.

Current workaround:

- Generate a new pairing code if the user is unsure how many attempts remain.

Required follow-up direction:

- Return or fetch a sanitized pairing status after a failed completion attempt and display `attemptsRemaining` in the popup.
- Never return the pairing code, code hash, long-lived token, or token hash.

## D004-UX-003: Sidebar account card is mistaken for extension pairing state

Severity: UX clarification; separate functional defect not yet proven

Observed behavior:

- The bottom-left card continues to show the Xiaohongshu nickname and last verification time after pairing, re-pairing, or revoking the extension.
- It changes after application restart and credential verification, which makes it appear stale.

Current semantics:

- The card renders `AuthStatus`: the Xiaohongshu account represented by the currently saved encrypted Cookie.
- Pairing state is stored separately in `BrowserExtensionPairingStatus`.
- Revoking an extension pairing intentionally does not delete the saved Cookie, so the account card should not automatically become disconnected.

UX problem:

- The card does not label itself as “当前已验证小红书账号”, so users can reasonably interpret it as extension connection status.
- Pairing changes and Cookie/account changes are not visually distinguished.

Required follow-up direction:

- Label the sidebar card as Cookie/account verification status.
- Keep pairing/extension status in the login card.
- Add a deliberate “重新验证账号” or equivalent refresh action if immediate account-status refresh is required.
- If synchronizing a different Xiaohongshu account does not update the nickname immediately, record that as a separate reproducible functional bug.

## Acceptance impact

- Pairing security, token-hash persistence, popup-side Cookie synchronization, restart persistence, and the dedicated Edge fallback remain usable.
- The installed desktop interaction is not yet internally consistent because its live-detection button assumes a browser content-script bridge that cannot exist inside Electron.
- Recommended next milestone before merging D-004 to `main`: `D-004.1`, limited to these acceptance defects and their regression tests.
