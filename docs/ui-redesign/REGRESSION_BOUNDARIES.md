# Regression Boundaries

## Frozen Functional Areas

Do not change:

- Backend services and routes
- API URLs, methods, request bodies, response fields, and status semantics
- redbook crawling, queue, throttling, comment, author, media, and auth logic
- AI model invocation logic
- AI workflow keys and prompt test expectations
- Local storage/data schema
- Cookie/API key handling
- Build scripts and dependency versions
- User-visible business copy unless required for accessibility labels

## Allowed Areas

Allowed:

- CSS variables, colors, spacing, shadows, radii, focus states
- Presentation-only class structure
- Non-functional ARIA labels and titles
- Empty/loading/error visual styling
- Responsive layout and internal scrolling
- Markdown visual styling
- Drawer and floating button visual polish

## Test Risk

Current tests do not depend on React DOM snapshots or `data-testid`. They do depend on AI prompt keys, prompt headings, capabilities, URL parsing, local store behavior, and analysis calculations. Visual redesign must not touch those files.

## Manual Browser Risk Checks

- Sidebar module switching must still work.
- Search form controls must still submit the same values.
- Notes filtering and pagination must still work.
- Prompt save/reset/activate buttons must still call the same handlers.
- AI assistant send must still call `/api/ai/assistant/chat`.
- Export/delete/report/model actions must remain reachable.
- Drawer overlays must not hide required close controls.
- 375px and 768px must not introduce unusable horizontal scroll.
