# Project State

## Baseline

- Baseline branch: `codex/product-completeness-qa`.
- Baseline commit: `6b606d1`.
- Development branch: `codex/local-exe-productization`.
- Baseline verification: 18 Vitest files and 138 tests passed; TypeScript typecheck and production build passed.
- `docs/PROJECT_CONTEXT.md` remains an untracked user file and is not part of this milestone.

## Current Work

- Active milestone: `D-001` Windows EXE desktop shell.
- Storage remains the existing local JSON implementation.
- The first installer is unsigned and restricted to internal engineering validation.
- Runtime paths, reusable Express lifecycle, graceful job shutdown, Electron single-instance shell, Forge packaging, and Squirrel installer configuration are implemented.
- Automated verification currently covers the desktop path boundary, server lifecycle, shutdown persistence, renderer security policy, packaging exclusions, and build contracts.
- A Windows x64 package and unsigned `小红书运营台-0.1.0-Setup.exe` have been generated on the development computer.
- Packaged startup health verification is pending because the user's active development server currently owns `127.0.0.1:8787`; that process was deliberately preserved.
- Clean Windows installation, shortcut, Edge login, upgrade, and task recovery acceptance remain manual validation items before D-001 can be marked complete.
