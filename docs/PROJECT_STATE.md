# Project State

## Baseline

- Baseline branch: `codex/product-completeness-qa`.
- Baseline commit: `6b606d1`.
- D-001 development branch: `codex/local-exe-productization`.
- D-002 development branch: `codex/d-002-sqlite-storage`.
- Baseline verification: 18 Vitest files and 138 tests passed; TypeScript typecheck and production build passed.
- `docs/PROJECT_CONTEXT.md` remains an untracked user file and is not part of this milestone.

## Completed Milestone

- `D-001.1` version `0.1.1` passed automated verification and the user's installed-app acceptance, including the Xiaohongshu browser link, extension workflow, and preservation of existing local data.

## Current Work

- Active milestone: `D-002` SQLite storage migration.
- Storage remains JSON until the native-module gate, schema, repositories, and importer are complete; no dual write is permitted.
- The `0.2.0` installer remains unsigned and restricted to internal engineering validation.
- Runtime paths, reusable Express lifecycle, graceful job shutdown, Electron single-instance shell, Forge packaging, and Squirrel installer configuration are implemented.
- Automated verification currently covers the desktop path boundary, server lifecycle, shutdown persistence, renderer security policy, packaging exclusions, and build contracts.
- The desktop pilot is now version `0.1.1`; the login-card Xiaohongshu link uses the existing browser Bridge with the dedicated Edge fallback instead of a blocked renderer popup.
- A Windows x64 package and unsigned `小红书运营台-0.1.1-Setup.exe` have been generated on the development computer.
- D-002 begins with a native `better-sqlite3` Node/Electron x64 smoke gate before schema development.
- Credential encryption, backup/restore, signing, and fleet distribution remain later milestones.
