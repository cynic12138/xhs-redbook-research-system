# D-004 Browser Extension Pairing Design

## Outcome

Release version `0.4.0` so one locally installed Edge or Chrome extension must complete a one-time six-digit pairing before it can synchronize Xiaohongshu Cookie state. The pairing persists across restarts until it is replaced or revoked. The dedicated Edge login remains an independent fallback.

## Security model

- A five-minute pairing session and its SHA-256 code hash live only in process memory, allow five failed attempts, and are destroyed on success, cancellation, expiry, exhaustion, or shutdown.
- The extension creates a 32-byte random bearer token. Only its SHA-256 hash is stored in the Schema v3 singleton pairing row; the token remains in `chrome.storage.local` restricted to trusted extension contexts.
- A successful replacement pairing atomically invalidates the prior token. Merely starting or cancelling a pairing leaves the prior pairing valid.
- The existing Cookie sync route requires the bridge token header. Cookie verification failures do not revoke the pairing.
- Untrusted browser origins and abnormal Host values are rejected before business routes. Requests without an Origin remain compatible with local Node clients and tests; same-user malicious local processes are outside this milestone's threat model.
- Pairing codes, bridge tokens, hashes, Cookie values, and request bodies containing them never enter logs, responses, artifacts, exports, or committed fixtures.

## Product flow

1. The login card generates a six-digit code, hashes it with Web Crypto, and starts one server-side pairing session.
2. The user enters the code in extension version `0.2.0`.
3. The extension generates its long-lived token and completes the pairing without receiving any secret in the response.
4. Future Cookie synchronization includes `X-XHS-Bridge-Token` and updates last-seen/last-sync metadata.
5. The login card or authenticated extension can revoke the pairing. A newly completed pairing replaces the old one.

## Compatibility and packaging

- Existing authentication success response shapes and encrypted Cookie storage remain unchanged.
- `GET /api/auth/extension/status` gains additive pairing fields.
- The packaged extension is copied from a read-only application resource to `%APPDATA%/小红书运营台/browser-extension/xhs-bridge`.
- The renderer receives only one fixed-purpose, sender-validated IPC method for opening that directory.
- Native Messaging, extension-store publishing, enterprise deployment, backup/restore, signing, automatic updates, accounts, and simultaneous multi-browser pairing remain out of scope.

## Verification

TDD covers schema upgrade, one-time session behavior, token hashing, replacement/revocation, source policy, route contracts, extension storage/message boundaries, pairing UI, fixed IPC, and package contents. Release verification includes the full Vitest suite, typecheck, web build, credential smoke, Windows package, Squirrel installer, diff checks, and installed upgrade acceptance.
