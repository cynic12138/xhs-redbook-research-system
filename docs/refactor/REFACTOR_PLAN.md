# Behavior-Preserving Refactor Plan

Status: Phase 5 planning complete.

Tasks are ordered from lower risk to higher risk. Only tasks marked `READY` may be implemented automatically. `BLOCKED` tasks are documented for later work after stronger behavior evidence exists.

## R-001: Extract LocalStore Directory Initialization Helper

- Status: READY
- Risk level: Low
- Files and symbols: `src/server/storage/localStore.ts`; private `LocalStore` implementation only.
- Current structural issue: `read()` and `writeUnlocked()` duplicate the same `mkdir(this.dataDir, { recursive: true })` setup.
- Current behavior: `LocalStore` creates its data directory before reads and writes; absent or empty collection files return cloned defaults; writes serialize JSON with a trailing newline; same-collection updates are serialized in process.
- Proposed internal adjustment: add a private `ensureDataDir()` helper and call it from existing read/write paths.
- Boundaries that must not change: exported `LocalStore` and `store`; collection names; JSON filenames; default values; read/write/update behavior; tmp-file rename behavior; error behavior.
- Related tests: `test/localStore.test.ts`.
- Verification commands: `npm test -- test/localStore.test.ts`; `npm test`; `npm run typecheck`; `npm run build`.
- Rollback method: revert this task commit or restore only `src/server/storage/localStore.ts` to the pre-task version.
- Sufficient behavior evidence: Yes. Focused characterization tests cover the touched behavior and no public API/UI/database schema is changed.

## R-002: Consolidate JobService Upsert Helpers

- Status: BLOCKED
- Risk level: Medium
- Files and symbols: `src/server/services/jobService.ts`; private `upsertNotes`, `upsertComments`, `upsertAuthors`, `upsertAuthorPosts`.
- Current structural issue: four private methods repeat map-by-key upsert logic.
- Current behavior: each method merges incoming records into one collection and preserves existing records not replaced by the incoming key.
- Proposed internal adjustment: introduce a private generic upsert helper inside `jobService.ts`.
- Boundaries that must not change: queue behavior; collection write ordering; object identity expectations; key functions; job progress; rate budget; external Redbook behavior.
- Related tests: none focused on `JobService`.
- Verification commands: would require new job-service characterization tests plus `npm test`, `npm run typecheck`, and `npm run build`.
- Rollback method: restore only `src/server/services/jobService.ts` to the pre-task version.
- Sufficient behavior evidence: No. Blocked until job worker/upsert tests exist.

## R-003: Extract Server Media URL Classification Helpers

- Status: BLOCKED
- Risk level: Medium
- Files and symbols: `src/server/services/mediaService.ts`; `src/server/services/normalizers.ts`; media URL classification helpers.
- Current structural issue: image/video URL classification logic is similar across server media and normalization code.
- Current behavior: image URLs, cover URLs, video URLs, stream URLs, and media fallback behavior drive persisted records and media responses.
- Proposed internal adjustment: extract server-only helper functions without touching client UI helpers.
- Boundaries that must not change: media proxy response status/headers/body; cache filenames; note media normalization; video detection; host/protocol validation.
- Related tests: none focused on media classification or proxy/cache behavior.
- Verification commands: would require new media helper characterization tests plus `npm test`, `npm run typecheck`, and `npm run build`.
- Rollback method: restore only touched server media/normalizer files to the pre-task version.
- Sufficient behavior evidence: No. Blocked until media behavior tests exist.

## R-004: Centralize Workflow Key Runtime Tuples

- Status: BLOCKED
- Risk level: Medium
- Files and symbols: `src/shared/types.ts`; `src/server/routes/api.ts`; `src/server/services/aiPrompts.ts`; `src/server/services/aiService.ts`; `src/client/App.tsx`.
- Current structural issue: AI workflow keys are repeated in shared types, Zod validators, prompt metadata, service definitions, and UI filtering.
- Current behavior: the exact key set controls API validation, prompt selection, UI module filtering, persisted artifacts, and tests.
- Proposed internal adjustment: centralize a runtime tuple and derive validators and metadata checks from it.
- Boundaries that must not change: public union values; API validation; prompt keys; UI filtering; persisted artifact keys.
- Related tests: `test/aiPrompts.test.ts`; no route/UI tests.
- Verification commands: route characterization tests are required before implementation, then `npm test`, `npm run typecheck`, and `npm run build`.
- Rollback method: restore all touched key-definition files to the pre-task version.
- Sufficient behavior evidence: No. Blocked because it touches public API and UI-adjacent behavior without route/UI tests.

## R-005: Extract MarkdownView From App.tsx

- Status: BLOCKED
- Risk level: High
- Files and symbols: `src/client/App.tsx`; `MarkdownView` and markdown render helpers.
- Current structural issue: `App.tsx` is very large and contains custom markdown rendering alongside app state and page panels.
- Current behavior: AI/report markdown is rendered through custom React parsing for headings, code blocks, tables, quotes, lists, links, and inline code.
- Proposed internal adjustment: move `MarkdownView` and helpers to a dedicated component file with focused tests.
- Boundaries that must not change: rendered DOM structure; class names; text; link behavior; table/list/quote parsing; CSS selectors; layout.
- Related tests: none for React DOM or markdown rendering.
- Verification commands: would require component or DOM characterization tests and visual/browser smoke checks plus `npm test`, `npm run typecheck`, and `npm run build`.
- Rollback method: restore touched frontend files to the pre-task version.
- Sufficient behavior evidence: No. Blocked because UI/DOM/CSS is frozen without visual or DOM baseline.

## R-006: Introduce API Async Route Wrapper

- Status: BLOCKED
- Risk level: High
- Files and symbols: `src/server/routes/api.ts`; repeated `try/catch` route handlers.
- Current structural issue: many route handlers repeat `try/catch` and `next(error)`.
- Current behavior: individual handlers preserve specific status codes, validation errors, and explicit `404`/`400` responses, with global fallback `400`.
- Proposed internal adjustment: add a private `asyncRoute` helper to reduce repeated error forwarding.
- Boundaries that must not change: all route methods/paths; status codes; response bodies; validation timing; error forwarding; import-time reply worker behavior.
- Related tests: none for route contracts.
- Verification commands: route characterization tests required before implementation, then `npm test`, `npm run typecheck`, and `npm run build`.
- Rollback method: restore only `src/server/routes/api.ts` to the pre-task version.
- Sufficient behavior evidence: No. Blocked until route contract tests exist.
