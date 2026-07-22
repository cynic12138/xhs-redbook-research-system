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

## Current Work

- Active milestone: `D-004` browser-extension pairing, local API hardening, and version `0.4.0`.
- Production services now use SQLite only; `LocalStore` is retained solely as a legacy JSON reader for compatibility tests and import support, with no JSON/SQLite dual write.
- The generated `0.4.0` installer remains unsigned and restricted to internal company validation.
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
- D-004 installed-app acceptance remains pending; backup/restore, signing, Native Messaging, extension-store publishing, and fleet distribution remain later milestones.
