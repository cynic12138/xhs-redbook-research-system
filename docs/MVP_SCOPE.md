# MVP Scope

## Current Milestone

`D-004.1` resolves the installed acceptance defects in D-004 by separating Electron status presentation from the browser-page Bridge, exposing the existing remaining-attempt feedback, and clarifying saved account status without changing pairing security or credential persistence.

## In Scope

- SQLite Schema v3 single-extension pairing metadata with one-way token hashes.
- One-time six-digit pairing sessions that live only in process memory.
- Authentication of the existing extension Cookie sync route without changing its success response contract.
- Removal of global open CORS and validation of local app, development, and extension origins.
- Pairing and revocation controls in the existing login card and extension popup.
- A stable packaged extension directory and one fixed, sender-validated Electron IPC operation to open it.
- Windows x64 packaging, installer, upgrade, restart-persistence, and revocation validation.
- Electron-mode status based on existing pairing and synchronization timestamps, while browser development mode retains content-script detection.
- Remaining-attempt feedback in extension pairing errors and explicit saved-account labeling with manual re-verification.

## Out of Scope

- Account management, roles, cloud deployment, or shared data.
- Native Messaging, extension-store publishing, enterprise extension policy, general backup/restore, automatic updates, code signing, or custom application artwork.
- Multi-source data merging or long-term JSON/SQLite dual writes.
- Cloud sync, accounts, roles, whole-database encryption, or cross-Windows-user credential portability.
- Changes to existing business HTTP routes, response contracts, status codes, or business rules.
- An application-to-extension command queue, WebSocket, Native Messaging, heartbeat service, new IPC, or new database migration.

## Success Criteria

- An unpaired or revoked extension cannot write Cookie state; a paired extension remains usable across application and browser restarts.
- SQLite stores only a fixed-length token hash, while the raw token remains in trusted extension storage.
- A new successful pairing atomically replaces the prior pairing; starting or cancelling a pairing does not invalidate the prior token.
- Untrusted web origins receive no permissive CORS response and cannot invoke local mutation routes through a browser.
- Existing encrypted Cookie/model keys, dedicated Edge login, business APIs, automated tests, typecheck, build, credential smoke, and Windows installer build remain compatible.
- An installed `0.4.0` upgrades a validated `0.3.0` installation without losing business data or encrypted credentials.
- An installed `0.4.1` upgrades `0.4.0`, preserves the encrypted Cookie and pairing hash, and no longer reports a false extension-detection failure in Electron mode.
