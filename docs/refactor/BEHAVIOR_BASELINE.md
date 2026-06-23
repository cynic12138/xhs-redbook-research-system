# Behavior Baseline

Status: Phase 4 verification complete.

## Commands To Evaluate

| Area | Command | Status |
| --- | --- | --- |
| Unit tests | `npm test` | Passed |
| Integration tests | Not configured separately | Recorded as not configured; existing Vitest suite is unit-style characterization coverage. |
| E2E tests | Not configured | Not run. |
| Lint | Not configured | Not run. |
| Type check | `npm run typecheck` | Passed |
| Build | `npm run build` | Passed |

## Results

| Command | Working Directory | Start Time | Exit Code | Result | Summary | Pre-Refactor Existing Failure |
| --- | --- | --- | --- | --- | --- | --- |
| `npm test` | `C:\data\work file\小红书数据自动抓取系统` | 2026-06-23T12:38:47.9402750+08:00 | 0 | Success | Initial baseline: 4 test files passed; 11 tests passed. | No |
| `npm run typecheck` | `C:\data\work file\小红书数据自动抓取系统` | 2026-06-23T12:39:00.2812063+08:00 | 0 | Success | `tsc --noEmit -p tsconfig.json` and `tsc --noEmit -p tsconfig.server.json` passed. | No |
| `npm run build` | `C:\data\work file\小红书数据自动抓取系统` | 2026-06-23T12:39:14.1747044+08:00 | 0 | Success | `tsc -p tsconfig.server.json` and Vite build passed; 1580 modules transformed. | No |
| `npm test` | `C:\data\work file\小红书数据自动抓取系统` | 2026-06-23T12:41:07.8346970+08:00 | 0 | Success | After characterization tests: 6 test files passed; 17 tests passed. | No |
| `npm run typecheck` | `C:\data\work file\小红书数据自动抓取系统` | 2026-06-23T12:41:19.3145963+08:00 | 0 | Success | Typecheck passed after characterization tests. | No |
| `npm run build` | `C:\data\work file\小红书数据自动抓取系统` | 2026-06-23T12:41:19.3301019+08:00 | 0 | Success | Build passed after characterization tests; 1580 modules transformed. | No |

## Characterization Tests Added

- `test/localStore.test.ts`: records current `LocalStore` behavior for cloned defaults, empty collection files, JSON writes with trailing newline, and per-collection update serialization.
- `test/url.test.ts`: records current URL helper behavior for Xiaohongshu URL parsing, canonical web URL generation, and recursive `webUrl` enrichment.

No production source code was modified for these tests.

## Frontend Visual Baseline

No configured visual verification, component test, screenshot baseline, or E2E test exists. UI-affecting code is frozen for behavior-preserving refactors unless a visual/browser baseline is created without changing UI behavior.

## API And Data Baselines

- Public route inventory is documented in `CODEBASE_MAP.md`: 50 routes under `/api`.
- Local JSON collection inventory is documented in `CODEBASE_MAP.md`.
- No OpenAPI schema, database migration, or external database schema exists.
- Production data and external XHS/AI services were not accessed.
