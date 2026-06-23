# Risk Register

Status: Phase 3 audit complete. Risks are baseline observations, not requested fixes.

## Public Contract Risks

- `src/server/routes/api.ts` exposes 50 `/api` routes with current status codes and response shapes. Refactors must preserve all methods, paths, query/body fields, response formats, and error text/status behavior.
- Client route strings are split between `src/client/lib/api.ts`, direct links in `src/client/App.tsx`, `src/server/services/capabilities.ts`, `vite.config.ts`, and `scripts/wait-for-health.mjs`.
- Workflow keys, sort modes, note type filters, and reply strategies repeat across shared types, Zod schemas, services, tests, and UI.
- `src/shared/types.ts` is a central public contract and must not be changed without explicit behavior-changing scope.

## Database Risks

- Runtime persistence is local JSON files under `data/`, one collection per file.
- `LocalStore` locks are per collection and per process only.
- There are no cross-collection transactions. Multi-step operations such as job creation, note deletion, clear-all, reply-plan creation, auth save, and AI model save can partially succeed.
- Reads across multiple collections are not snapshots; analytics/export/detail can observe mixed versions.
- `boards` and `favoriteNotes` are defined collections, but tracked code does not appear to write them.

## Authorization Risks

- No backend route-level user auth was found; this is current behavior and not a refactor target.
- XHS auth depends on local cookie material in `.env.local`.
- Auth-risk behavior marks auth disconnected and pauses jobs; error message matching is behavior-sensitive.
- `POST /auth/browser` reads local browser cookies through the Redbook cookie helper at runtime.

## Concurrency And Cache Risks

- `jobService.ts` owns timers and active worker state for queues and startup resume/pause behavior.
- `commentOps.ts` starts a reply worker interval on `routes/api.ts` import and enforces a 180 second minimum delay between sends.
- Multiple Node processes can race on JSON files, media cache files, rate limits, queue claims, and reply sending.
- Media cache writes `.bin` and `.json` independently without temp/rename or locking.
- `PORT` is configurable, but dev script, Vite proxy, and health wait default to `8787`.

## Dynamic Import And String Reference Risks

- No dynamic `import()` or `require()` found in tracked source.
- High string-reference drift risk remains for `/api/*` paths, `store.read/write/update("...")`, workflow keys, environment variable names, and `localStorage` keys.
- Import-time side effects exist: `dotenv.config`, reply worker startup, server listen, and startup job resume/pause.
- Most code is statically acyclic now, but `queryService -> jobService` and `aiService -> queryService -> jobService` should be protected from reverse imports.

## Frontend Visual Risks

- `src/client/App.tsx` contains most UI markup and state; `src/client/styles.css` is a global stylesheet.
- No component tests, E2E tests, screenshots, or visual baselines exist.
- Current layout is desktop-first with minimum widths; DOM/CSS/layout/interactions must be treated as frozen.
- `MarkdownView` has custom parsing/rendering. Changes can alter AI/report display.
- Chinese UI copy, placeholders, class names, selectors, export/media anchors, and localStorage keys are public UI boundaries.

## Untested Areas

- React UI and API client.
- Express route contracts and error semantics.
- `LocalStore` persistence is partially characterized; invalid JSON behavior and multi-process behavior remain uncovered.
- Job queue workers, rate budget, startup resume/pause, and multi-collection side effects.
- Query delete/clear side effects.
- URL helpers now have focused characterization coverage.
- Media proxy/cache behavior.
- Environment helper behavior and `.env.local` writes.
- Redbook and AI external-service failure boundaries.
- Comment reply worker timing and failure behavior.

## Unverifiable Areas

- Production XHS calls and real user data must not be used.
- `.env.local`, tokens, cookies, API keys, and local runtime data must not be read or printed.
- UI visual equivalence cannot be proven without adding or using a visual/browser baseline.
- API contract equivalence is limited until route characterization tests exist.
- Multi-process concurrency behavior cannot be proven with current unit tests.
