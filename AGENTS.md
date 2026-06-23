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
- Do not run `git push`.
- Do not create a remote repository.
- Do not upload project source code or data.
- Do not access production databases, production APIs, or real user data.
- Do not print, modify, commit, or expose `.env`, tokens, cookies, API keys, private keys, passwords, or other secrets.
- Do not change business rules, calculations, public API routes, HTTP status codes, field names, request/response formats, error semantics, database schema, indexes, constraints, migrations, or transaction semantics.
- Do not change environment variable names, config keys, startup behavior, deployment behavior, framework versions, dependency versions, or runtime versions.
- Do not change frontend copy, translations, DOM semantics, classes, ids, selectors, CSS, layout, responsive behavior, animations, image assets, or interactions.
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
