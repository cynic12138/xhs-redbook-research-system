# UI Redesign Decisions

## Direction

The redesign uses a restrained data-dense operations dashboard style. It keeps Xiaohongshu rose as a brand/primary-action color, while moving most structural surfaces to neutral whites and cool grays. Blue is used for analysis and focus, green for success, amber for risk/attention, and red for destructive actions.

## Why Not a Dramatic AI Look

The product is used for long operational sessions. Large gradients, glass effects, glow, and oversized hero blocks would reduce readability and make dense tables harder to scan. AI is presented as an assistant layer and artifact generator, not as decorative spectacle.

## Color Decisions

- Rose primary: preserves product identity and makes primary actions clear.
- Navy/slate text: improves long-session readability.
- Blue focus/data: separates analytics and focus states from brand actions.
- Soft semantic backgrounds: allow warning/error/success states without harsh panels.
- Reduced shadow: only drawers and floating entry need clear elevation.

## Typography Decisions

No remote fonts were added. The UI uses a system Chinese-first sans stack with Inter/Segoe UI fallbacks. Prompt and code-like content use a local monospace stack. This avoids network dependencies and keeps Chinese text clear.

## Layout Decisions

- Keep the existing single React app and module navigation.
- Keep the current user flow and event handlers.
- Use CSS variables and final-layer styles to create a consistent visual system.
- Improve narrow breakpoints instead of introducing a new framework.
- Keep AI assistant as a right drawer and draggable horizontal pill.

## AI Interface Decisions

- Because the assistant API is non-streaming, no fake stop control is introduced.
- A generating assistant message can be displayed as a visual waiting state without changing request behavior.
- Markdown readability is improved for AI artifacts, reports, and assistant replies.
- Assistant drawer actions remain workflow shortcuts and chat input; no new write operations are added.

## Implementation Boundary

The redesign intentionally avoids backend changes, API changes, dependency changes, route changes, and state-management rewrites. Changes are limited to AGENTS boundary clarification, design docs, front-end presentation DOM/ARIA where needed, and CSS.
