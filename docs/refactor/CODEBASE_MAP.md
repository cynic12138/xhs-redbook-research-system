# Codebase Map

Status: Phase 3 audit complete.

## Total File Statistics

- Git-tracked files: 47.
- First-party production source and app assets: 24 (`index.html` plus `src/`).
- Tests: 6.
- Build/development script files: 1.
- Root configuration and lock files: 7.
- Refactor documentation files: 9.
- Public HTTP routes: 50 under `/api`.

## Technology Stack

- Node.js
- TypeScript
- React
- Vite
- Express
- Vitest
- Zod for API request validation.
- Local JSON-file persistence under `data/`.
- `@lucasygu/redbook` for Xiaohongshu access.

## Directory Responsibilities

- `src/client/`: React UI. `App.tsx` owns most state and renders module panels; `lib/api.ts` wraps HTTP calls; `styles.css` defines global styling.
- `src/server/index.ts`: Express app startup, CORS, JSON parser, `/api` mount, optional static client serving, global error middleware.
- `src/server/routes/api.ts`: public API router, Zod request schemas, response status and shape semantics.
- `src/server/services/`: business logic for jobs, Redbook access, AI, analytics, comments, media, health, normalization, and queries.
- `src/server/storage/`: local JSON store abstraction.
- `src/server/utils/`: environment and `.env.local` helpers.
- `src/shared/`: shared API/persistence types and pure utilities.
- `test/`: Vitest characterization coverage for selected shared/server logic.
- `scripts/`: development health wait helper.

## Application Entrypoints

- `index.html` loads `/src/client/main.tsx` and defines `#root`.
- `src/client/main.tsx` renders `<App />` under `React.StrictMode`.
- `src/server/index.ts` listens on `127.0.0.1:${PORT || 8787}`.
- `src/server/routes/api.ts` exports the mounted `/api` router.
- `package.json` scripts are the command entrypoints.

## Frontend Data Flow

- No client-side router. `activeModule` in `App.tsx` switches module panels.
- Active modules: `overview`, `research`, `notes`, `viral`, `audience`, `competitors`, `comments`, `prompts`, `ai`.
- `App.tsx` owns auth state, cookie fields, search form state, jobs, notes filters/pagination, analytics, capabilities, reply queues, AI models/prompts/artifacts/reports, assistant drawer/chat state, `busy`, and `error`.
- Effects load core data, notes, analytics, operations, prompt details, poll every 7 seconds, and persist `xhs.aiDrawerWidth` / `xhs.aiFabPosition` to `localStorage`.
- `src/client/lib/api.ts` is the main typed API wrapper. Export and media URLs are also embedded directly in `App.tsx`.
- No component tests, DOM snapshots, or E2E tests exist. UI/DOM/CSS must be treated as frozen until a visual or browser baseline exists.

## Backend Call Chains

- Search job creation: `api.ts` -> `JobService.createJob` -> `redbook.search` -> normalizers -> `LocalStore` collections -> queued workers.
- Job workers: `JobService.startWorkers` processes `read`, `comments`, `user`, `user-posts`, and `analyze` queue items with timers, daily budget checks, and auth-risk handling.
- Notes and analytics: `api.ts` -> `queryService` -> `LocalStore` and `analysis`.
- Comment plans: `api.ts` -> `commentOps` -> `LocalStore`; approved actions are processed by a timed reply worker.
- AI workflows: `api.ts` -> `aiService` -> `aiPrompts`, local context from `queryService`, optional OpenAI-compatible chat completion, and AI artifact/report persistence.
- Media proxy: `api.ts` -> `mediaService` -> host allowlist, optional refresh via Redbook, image cache under `data/media-cache`, or remote streaming.

## Data Models

- Shared TypeScript contracts live in `src/shared/types.ts`.
- Local persistence shape lives in `DataShape` / `CollectionName` in `src/server/storage/localStore.ts`.
- Collections: `authStatus`, `searchJobs`, `queueItems`, `notes`, `comments`, `authors`, `authorPosts`, `analysisReports`, `aiModels`, `aiReports`, `aiArtifacts`, `aiPromptConfigs`, `aiMessages`, `replyPlans`, `replyActions`, `healthReports`, `boards`, `favoriteNotes`, and `rateLimit`.
- Each collection maps to `data/<collection>.json` at runtime.
- `.env.local` stores local cookie/API-key material through `env.ts`; contents were not read.

## Public Interfaces

- 50 public HTTP routes under `/api`.
- Request validation uses Zod schemas in `src/server/routes/api.ts`.
- Response contracts rely on `src/shared/types.ts`, literal route responses, and existing status code behavior.
- Global error middleware returns `400` with `{ error: message }`.
- Explicit `404` exists for missing jobs, notes, AI artifacts, and AI reports.
- Delete endpoints return `{ deleted: number }`.
- Client wrapper in `src/client/lib/api.ts` and direct export/media links in `App.tsx` must stay compatible.

## External Services

- Xiaohongshu access through `@lucasygu/redbook` and direct `fetch` fallback in `redbookService.ts`.
- Chrome cookie extraction through `@lucasygu/redbook/cookies`.
- Media fetches limited to `.xhscdn.com` and `.xiaohongshu.com`.
- OpenAI-compatible model base URLs through `aiService.ts`.
- Local filesystem side effects: `data/*.json`, `data/media-cache/*`, and `.env.local`.

## Key Business Flows

- Search and collect Redbook notes with controlled concurrency and daily read budget.
- Read note details, comments, author profiles, and author posts into local JSON collections.
- Analyze notes into hot score, content type, discussion type, hook patterns, and keyword metrics.
- Generate local or AI-backed workflow artifacts and reports.
- Create reply plans as drafts; approval queues one action; reply worker sends with a minimum delay.
- Diagnose note health and auth/risk states.
- Proxy or refresh media while preserving cache behavior.

## High Risk Modules

- `src/client/App.tsx` and `src/client/styles.css`: large UI surface without visual tests.
- `src/server/routes/api.ts`: 50-route public contract and status semantics.
- `src/server/services/jobService.ts`: timers, queue state, rate budget, external XHS calls, multi-collection writes.
- `src/server/storage/localStore.ts`: persistence schema and locking.
- `src/server/services/mediaService.ts`: cache writes, remote streaming, response headers.
- `src/server/services/commentOps.ts`: timed write-like automation and external reply side effects.
- `src/server/utils/env.ts`: `.env.local` writes and env key semantics.
- `src/shared/types.ts`: shared contract boundary.

## Test Coverage

- Current tests cover shared utilities, analysis rules, prompt generation, capabilities, health diagnosis, local JSON store behavior, and URL helpers.
- No route contract tests.
- No React component, DOM, visual, or E2E tests.
- No job worker, media proxy, env helper, Redbook boundary, AI boundary, route contract, UI, or multi-process concurrency tests.
- No lint command or config is present.

## Audit Completion

- 100% Git-tracked files categorized in `FILE_COVERAGE.csv` as of Phase 4 test additions.
- 100% first-party production source files assigned to a review area.
- 100% first-party production source files marked for semantic review.
- Application entrypoints identified.
- Public APIs and data contracts identified.
- Main frontend pages and backend request chains traced.
- Database and external service boundaries identified.
- Unknown/unverified areas are listed in `RISK_REGISTER.md`.
