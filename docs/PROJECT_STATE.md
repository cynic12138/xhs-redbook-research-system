# Project State

## Baseline

- Baseline branch: `codex/product-completeness-qa`.
- Baseline commit: `6b606d1`.
- D-001 development branch: `codex/local-exe-productization`.
- D-002 development branch: `codex/d-002-sqlite-storage`.
- D-003 development branch: `codex/d-003-safe-storage`.
- Baseline verification: 18 Vitest files and 138 tests passed; TypeScript typecheck and production build passed.
- `docs/PROJECT_CONTEXT.md` remains an untracked user file and is not part of this milestone.

## Completed Milestone

- `D-001.1` version `0.1.1` passed automated verification and the user's installed-app acceptance, including the Xiaohongshu browser link, extension workflow, and preservation of existing local data.
- `D-002` version `0.2.0` passed automated verification and the user's installed-app acceptance, including SQLite migration, restart persistence, and Windows installer validation.
- `D-003` version `0.3.0` passed automated verification and the user's installed-app acceptance, including encrypted credential migration, restart persistence, and Windows installer validation; it is present on remote `main` at baseline commit `721b95d`.
- `D-004`/`D-004.1` version `0.4.1` passed automated verification and the user's installed-app acceptance, including extension pairing, installed-mode status refresh, remaining-attempt feedback, account-status clarity, and preservation of encrypted credentials and local data.
- `D-005` version `0.5.0` passed automated and installed-app acceptance, including daily/manual backups, verified full-database restore, credential-free migration, tamper rejection, retention behavior, and preservation of the existing business workflow.

## Current Internal Release

- Current release: unsigned Windows x64 `0.5.0`. D-001 through D-005 form the complete internal single-user business baseline; no further development milestone is active.
- Production services now use SQLite only; `LocalStore` is retained solely as a legacy JSON reader for compatibility tests and import support, with no JSON/SQLite dual write.
- The generated desktop installer remains unsigned and is approved for internal company use. SmartScreen may show an unknown-publisher warning; code signing and automatic updates are not current release requirements.
- Runtime paths, reusable Express lifecycle, graceful job shutdown, Electron single-instance shell, Forge packaging, and Squirrel installer configuration are implemented.
- Automated verification currently covers the desktop path boundary, server lifecycle, shutdown persistence, renderer security policy, packaging exclusions, and build contracts.
- The D-003 desktop pilot release candidate is version `0.3.0`; the login-card Xiaohongshu link continues to use the existing browser Bridge with the dedicated Edge fallback.
- SQLite schema v1, WAL, foreign keys, busy timeout, 30-collection row storage, one-source transactional JSON import, fingerprint validation, and the settings migration workflow are implemented.
- A read-only dry run imported the current 23 legacy files and 8,575 records into a temporary database with `foreign_key_check` and `quick_check` passing.
- The external `better-sqlite3` gate was rejected because Electron 43 ABI 148 required an unavailable C++ rebuild; the user approved the built-in Node 24 `node:sqlite` replacement.
- Built-in SQLite passed in-memory create/write/read/close smoke checks in both Node 24.15 and Electron 43.1.1 / Node 24.18, without native dependencies.
- D-003 final verification had 39 Vitest files and 243 tests passing, plus TypeScript typecheck, production build, asynchronous safeStorage smoke, Windows x64 packaging, and Squirrel installer generation.
- Migration gating blocks every business API and background worker until import succeeds; migration completion safely pauses imported running jobs and activates the reply worker in the same process.
- Startup rejects unsupported future Schema versions, and shutdown waits for any in-flight reply before closing SQLite.
- The unsigned Windows x64 `小红书运营台-0.2.0-Setup.exe` was generated successfully; SHA-256 is `A641B7F1D694BE3293A07286C3D1A7BAA8F795A6B276B984D7A17C0A0C703DEC`.
- Package inspection found no `.env.local`, `app.db`, legacy JSON data, output, project docs, or `PROJECT_CONTEXT.md`; the sandboxed CommonJS preload is present in the ASAR.
- D-002 installed acceptance is complete and its commit is present on remote `main`.
- D-003 now includes SQLite Schema v2, asynchronous Electron `safeStorage`, automatic and idempotent plaintext credential migration, a single credential vault used by Cookie and model flows, key rotation, security-status APIs, and a credential-security card in model settings.
- Credential metadata APIs expose only booleans and counts. Unreadable copied credentials remain stored but are treated as unconfigured until the user reconnects Xiaohongshu or replaces the model Key.
- The independent Electron credential smoke prints only a success boolean and passed on the current Windows user; installed upgrade acceptance is complete.
- Squirrel's bundled NuGet 2.8 reproducibly failed on Electron 43 `dxcompiler.dll`; the make workflow now prepares Microsoft NuGet 7.6.0 from a pinned official URL and SHA-256 without modifying `node_modules`.
- The unsigned Windows x64 `小红书运营台-0.3.0-Setup.exe` release candidate was generated successfully; SHA-256 is `33B7EDEE0A08CEFB2B68A78EBB375E7FC5638AFF8E66ADD29658B28B57062C10`.
- The accepted `0.3.0` package inspection found no root `.env.local`, `app.db`, legacy data, output, tests, docs, or `PROJECT_CONTEXT.md`.
- D-004 implementation adds Schema v3 single-extension pairing, five-minute in-memory pairing sessions, one-way bridge-token hashes, authenticated Cookie sync, local Origin/Host validation, extension `0.2.0`, login-card pairing controls, and a stable packaged extension directory.
- D-004 automated release verification passed with 44 Vitest files and 266 tests, TypeScript typecheck, production build, asynchronous safeStorage smoke, Windows x64 packaging, and Squirrel installer generation.
- The packaged application reads extension `0.2.0` from `resources/xhs-bridge` and atomically copies its allowlisted files into the stable user-data directory; package inspection found no root `.env.local`, `app.db`, legacy data, output, project tests, project docs, or `PROJECT_CONTEXT.md`.
- The unsigned Windows x64 `小红书运营台-0.4.0-Setup.exe` release candidate was generated successfully; SHA-256 is `11B7D7D79AC9364A4EE82ED3409930CA1A0E39774D6E13E082449C287462B4BD`.
- D-004 installed-app acceptance found two functional defects and one status-semantics UX issue; the `0.4.1` fixes and completed manual retest are recorded in `docs/D004_ACCEPTANCE_ISSUES.md`.
- In `0.4.0`, the Electron renderer incorrectly attempted to detect an Edge content script, pairing errors omitted remaining attempts, and the saved account card was ambiguous. D-004.1 corrects those behaviors without changing stored Cookie or pairing semantics.
- Signing, Native Messaging, extension-store publishing, automatic updates, custom artwork, and fleet distribution automation are deferred until an actual internal-use problem justifies reopening productization work.
- D-005 was separately approved and has completed installed acceptance. Signing, automatic updates, cloud backup, password-protected packages, selective merging, and fleet distribution automation remain excluded from the accepted `0.5.0` baseline.
- D-004.1 implementation is limited to Electron/browser status separation, remaining-attempt feedback, saved-account labeling and refresh, and release packaging; baseline verification is 44 Vitest files and 266 tests plus TypeScript typecheck.
- D-004.1 now uses backend pairing/synchronization status in Electron, keeps the page Bridge in browser development mode, reports remaining incorrect-code attempts from extension `0.2.1`, and separates the saved Xiaohongshu account card from extension pairing state.
- D-004.1 automated release verification passed with 45 Vitest files and 272 tests, TypeScript typecheck, production build, asynchronous safeStorage smoke, Windows x64 packaging, Squirrel installer generation, packaged extension `0.2.1`, and ASAR/resource sensitive-file checks.
- The unsigned Windows x64 `小红书运营台-0.4.1-Setup.exe` release candidate was generated successfully; size is `178.26 MB` and SHA-256 is `E502967BFDCC395232F0C4CCA8DA44EB687119DBBB8A09820F0EDBD05AFD2927`.
- The user completed the D-004.1 installed checklist without finding further issues and explicitly authorized pushing the accepted feature branch to the configured Git remote. Merge to `main` remains a separate action.
- D-005 implementation now includes a versioned gzip package format, WAL-safe SQLite snapshots, one-per-day automatic backup, manual and safety backups, 7/3 retention, credential-free migration export, verified restore preview, a 15-minute prepared-restore plan, recoverable closed-database replacement, restart feedback, and settings controls.
- D-005 automated release verification passed with 53 Vitest files and 305 tests, TypeScript typecheck, production build, asynchronous safeStorage smoke, Windows x64 packaging, Squirrel installer generation, packaged extension `0.2.1`, and ASAR/resource sensitive-file checks.
- Restore execution is process-exclusive. Before the mandatory `pre-restore` backup, the application blocks new API work, drains AI/Goal/orchestration/reply/search workers within one timeout budget, and freezes the open SQLite connection as query-only; cancelling safely re-enables scheduling and writes.
- The unsigned Windows x64 `小红书运营台-0.5.0-Setup.exe` release candidate was generated successfully; size is `146513408` bytes and SHA-256 is `47ADA96C44EC62E0A2D7080FD8D0B63A9F353A526B93A1BF9476E7CB887B5AD9`.
- The user completed the D-005 installed upgrade, backup, restore, migration, tamper-rejection, and retention checklist without further issues and selected `0.5.0` as the current internal formal release.
