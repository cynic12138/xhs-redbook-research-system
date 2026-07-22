# Project Guardrails

This project is under a behavior-preserving refactor workflow. Prefer correctness,
small reversible changes, and verification over speed.

## Project Facts

- Runtime: Node.js.
- Package manager: npm with `package-lock.json`.
- Frontend: React with Vite.
- Backend: Express with TypeScript.
- Tests: Vitest.
- TypeScript configs: `tsconfig.json` for client/shared/tests and `tsconfig.server.json` for server/shared.
- Build output: `dist/`.
- Runtime/local data: `data/`, `output/`, `.playwright-cli/`, `.env.local`.
- No README, Dockerfile, docker-compose file, Makefile, CI config, or dedicated Vitest config was present when this file was created.

## Commands

- Install dependencies: `npm install`
- Development server: `npm run dev`
- Backend development server: `npm run dev:server`
- Frontend development server: `npm run dev:client`
- Unit tests: `npm test`
- Integration tests: not configured separately; use `npm test` for existing Vitest coverage.
- E2E tests: not configured.
- Lint: not configured.
- Type check: `npm run typecheck`
- Build: `npm run build`
- Production start after build: `npm start`

## Absolute Prohibitions

- Do not configure a Git remote unless the user explicitly asks for it after the local refactor workflow.
- Do not run `git push` unless the user explicitly authorizes the specific remote and branch after they have been confirmed. Never force push.
- Do not create a remote repository.
- Do not upload project source code except through an explicitly authorized Git push to a confirmed remote and branch. Never upload runtime/local data, credentials, or secrets.
- Do not access production databases, production APIs, or real user data.
- Do not print, modify, commit, or expose `.env`, tokens, cookies, API keys, private keys, passwords, or other secrets.
- Do not change business rules, calculations, public API routes, HTTP status codes, field names, request/response formats, error semantics, database schema, indexes, constraints, migrations, or transaction semantics.
- Do not change environment variable names, config keys, startup behavior, deployment behavior, framework versions, dependency versions, or runtime versions.
- Planned visual design changes to CSS, layout, responsive behavior, animations, and presentation DOM are allowed when explicitly requested; frontend business behavior, routes, data contracts, stable selectors, user copy, and interactions must remain unchanged.
- Do not mix bug fixes with refactoring.
- Do not delete or change tests to hide regressions.
- Do not update screenshot baselines to hide visual changes.
- Do not use destructive commands such as `rm -rf`, `git reset --hard`, `git clean`, or `git checkout -- .`.
- Do not modify `node_modules`, build output, generated code, local data, caches, or runtime artifacts.
- Do not continue changing an area when behavior equivalence cannot be verified.

Existing bugs and unusual behavior are part of the current behavior baseline unless the user explicitly asks to change them.

## Refactor Requirements

- Each refactor task must have a numbered plan item such as `R-001`.
- Only one numbered refactor task may be implemented at a time.
- Before a task, confirm the Git working tree is clean.
- Check direct callers, dynamic imports, string references, templates, config references, tests, scripts, and deployment references before editing.
- Skip and mark a task `BLOCKED` when it lacks enough behavior evidence, changes public API, changes database behavior, changes UI/DOM/CSS, needs dependency upgrades, needs network access, needs production data or external credentials, or cannot be verified.
- Keep public import paths compatible. Use re-exports if a module split is necessary.
- Do not add abstractions unless real duplication or complexity has been demonstrated.
- Do not delete code without positive evidence that it is unreachable or unused.
- After each completed task, inspect the full diff, run relevant tests, run type checks, run configured lint/build commands when available, compare public boundaries, update docs, and commit only that task.

## Approved Desktop Productization Track

- `D-001` is explicitly approved to add Electron/Forge dependencies, desktop entrypoints, Windows packaging scripts, runtime-path configuration, and the minimal server lifecycle changes required by the approved local EXE milestone.
- `D-001` must preserve the existing HTTP API contracts, business rules, React interactions, JSON storage format, and browser development workflow.
- Desktop runtime data must stay outside the installation directory and must never be committed or packaged.
- SQLite, credential encryption, extension pairing, backup/restore, automatic updates, and code signing remain outside `D-001` and require their own approved tasks.

## Approved SQLite Storage Track

- `D-002` is explicitly approved to use the Node 24 built-in `node:sqlite`, add versioned migrations, domain repositories, legacy JSON import, and the minimal storage-migration UI/API required by the approved plan.
- `D-002` must preserve existing business API paths, request/response contracts, status codes, business rules, and the Windows-only local deployment model.
- Production storage must cut over once from JSON to SQLite; long-term JSON/SQLite dual writes and silent fallback to JSON are prohibited.
- `LocalStore` may remain only as the read-only legacy importer after cutover. Legacy JSON, `.env.local`, browser profiles, and user output must never be deleted or packaged.
- Credential encryption, extension pairing, general backup/restore, automatic updates, signing, accounts, cloud sync, and multi-source data merging remain outside `D-002`.
- External SQLite native modules and machine-wide C++ build tools are not part of `D-002`; Node and packaged Electron must both pass the built-in SQLite runtime gate.

## Approved Credential Security Track

- `D-003` is explicitly approved to add Electron `safeStorage` encryption, SQLite Schema v2 secure credential storage, one-time legacy plaintext credential migration, and the minimal credential-security status API/UI required by the approved plan.
- The installed desktop application must read Cookie and AI model keys only through the encrypted credential vault; plaintext fallback is prohibited after encrypted migration succeeds.
- Browser development mode may continue to use `.env.local`; installed desktop mode must preserve non-sensitive settings while removing only migrated credential lines.
- Existing authentication, AI model, content review, Goal, tool-calling, and business API contracts must remain compatible.
- Credential values, encrypted blobs, and complete credential names must never appear in logs, API responses, artifacts, exports, tests, or committed fixtures.
- Extension pairing, backup/restore, code signing, automatic updates, cloud sync, accounts, and whole-database encryption remain outside `D-003`.

## Approved Extension Pairing Track

- `D-004` is explicitly approved to add SQLite Schema v3 browser-extension pairing state, an in-memory one-time pairing session, token-hash authentication for the existing extension Cookie sync route, and the minimal pairing status/API/UI required by the approved plan.
- `D-004` may replace the global open CORS middleware with a local-origin and Host security policy while preserving the existing Electron, Vite proxy, dedicated Edge, and no-Origin local-client workflows.
- The extension token must be generated by the extension, stored only in trusted extension storage, and represented in SQLite only by a one-way SHA-256 hash. Pairing codes, tokens, hashes, and Cookie values must never appear in logs, responses, artifacts, exports, or committed fixtures.
- `D-004` may package the existing browser extension as a read-only application resource, copy only its allowlisted files to a stable user-data directory, and expose one sender-validated IPC operation that opens that fixed directory.
- Existing authentication response contracts, encrypted Cookie/model-key storage, business API behavior, and the dedicated Edge login fallback must remain compatible.
- Native Messaging, extension-store publishing, enterprise installation policy, backup/restore, signing, automatic updates, cloud sync, accounts, and multi-browser simultaneous pairing remain outside `D-004`.

## Approved D-004.1 Acceptance Fix Track

- `D-004.1` is explicitly approved to separate installed Electron status presentation from the browser-page content-script Bridge, display the existing pairing attempt count in extension feedback, clarify saved Xiaohongshu account status, and package version `0.4.1` with extension `0.2.1`.
- Installed Electron mode must use the existing backend pairing and synchronization timestamps as authoritative and must not claim it can directly ping or command an Edge/Chrome extension process.
- Browser development mode must retain the existing content-script detection and in-page synchronization workflow.
- Revoking extension pairing must continue to preserve the encrypted Xiaohongshu Cookie and account status. D-004.1 must not add APIs, IPC, database migrations, dependencies, background command channels, or credential deletion behavior.

## Approved Backup and Restore Track

- `D-005` is explicitly approved to add automatic and manual SQLite backups, verified full-database restore, credential-free migration packages, and the minimal settings/API/Electron IPC required by the approved plan.
- Live backups must use the built-in `node:sqlite.backup()` API. Copying a live WAL database file directly, long-term dual storage, and selective cross-database merging are prohibited.
- Local backups may retain Electron `safeStorage` ciphertext for same-Windows-user recovery. Portable migration packages must remove encrypted credentials, browser-extension pairing, saved account state, and other machine-bound authentication state before export.
- Restore must create a verified pre-restore backup, stop background work, close SQLite, replace the database through a recoverable same-volume operation, and restart the desktop application. A failed or interrupted restore must preserve or recover the prior database.
- Backup manifests, APIs, logs, exports, tests, and committed fixtures must never expose credential values, encrypted blobs, pairing codes, bridge tokens, source user paths, or database contents.
- `D-005` must preserve SQLite Schema v3 and existing business API contracts. Cloud backup, selective merging, whole-database encryption, password-protected migration packages, signing, automatic updates, accounts, and multi-user sharing remain outside this milestone.

## Completion Standards

The repository audit is complete only when:

- 100% of Git-tracked files are categorized in `docs/refactor/FILE_COVERAGE.csv`.
- 100% of first-party production source files are assigned to a review area.
- 100% of first-party production source files are marked for semantic review status.
- Application entrypoints are identified.
- Public APIs and data contracts are identified.
- Main frontend pages and backend request chains are traced.
- Database and external service boundaries are identified.
- Unknown or unverified files are listed explicitly.

The final report must not claim behavior equivalence where evidence is missing.
