# UI Redesign Audit

## Product Understanding

This is a local single-user Xiaohongshu operations console. It combines redbook-powered search/crawling, note library inspection, viral decomposition, audience insight, competitor analysis, comment operations, Prompt management, model configuration, and AI artifact/report generation.

Primary users are content operators, creators, brand researchers, and analysts who need a dense desktop workspace rather than a marketing-style website.

## Actual Stack

- Runtime: Node.js
- Package manager: npm with `package-lock.json`
- Frontend: React 19.2.1
- Build tool: Vite 7.3.5
- Backend: Express 5 + TypeScript
- CSS: one global stylesheet at `src/client/styles.css`
- Icons: `lucide-react`
- UI library: none
- Routing: no URL router; local `activeModule` state drives module switching
- API layer: `src/client/lib/api.ts`
- Tests: Vitest unit/service tests
- Lint: not configured
- E2E: not configured

## Main Pages

- Overview
- Topic Research
- Notes Library
- Viral Breakdown
- Audience Insight
- Competitor Analysis
- Comment Operations
- Prompt Center
- AI Workbench
- Global model settings drawer
- Global AI assistant drawer and floating entry

## Current Strengths

- Single-shell layout is understandable.
- Core workflows already exist.
- Prompt, artifact, report, and model concepts are present.
- Markdown rendering avoids raw HTML injection.
- Many async operations already show loading via existing `busy` keys.

## Main UI/UX Problems

- CSS has multiple appended override layers, making the final visual system hard to reason about.
- The old palette overuses pink for too many states.
- Several status colors are duplicated with similar but different hex values.
- Mobile and tablet behavior is weak because earlier CSS used desktop minimum widths.
- Several long-content panels depend on fragile `100vh + overflow` chains.
- AI assistant supports only non-streaming chat, but the UI needs clearer non-streaming feedback.
- Empty states are inconsistent and sometimes too terse.
- Icon-only actions need stronger accessible names.
- Model settings, Prompt Center, AI Workbench, and Markdown reading need visual consistency.

## Stable Boundaries

The redesign must not change API paths, HTTP methods, request/response fields, backend services, route behavior, prompt keys, test expectations, cookies, API keys, storage semantics, or crawling/comment logic.

## Baseline Verification

Before redesign:

- `npm run typecheck`: passed
- `npm test`: passed, 6 files / 17 tests
- `npm run build`: passed
- Backend health: reachable at `http://127.0.0.1:8787/api/health`
- Frontend dev server: reachable at `http://127.0.0.1:5173/`
- Browser console baseline: favicon 404 only
- Baseline screenshots saved under `output/playwright/baseline/`
