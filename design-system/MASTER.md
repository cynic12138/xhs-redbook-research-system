# XHS Operations Console Design System

This file is the visual source of truth for the local Xiaohongshu operations console. Page-level rules in `design-system/pages/*.md` may refine layout details, but they must not contradict these global rules.

## Product Position

- Product: Xiaohongshu operations console for search, crawling, content research, audience insight, competitor analysis, Prompt management, AI artifacts, and Markdown reports.
- Primary users: content operators, solo creators, brand researchers, growth analysts, and data assistants who need long desktop sessions.
- Product character: professional, calm, data-dense, trustworthy, AI-assisted, and readable for Chinese-heavy workflows.
- Main workflow: connect account -> create keyword task -> inspect notes/comments/authors -> analyze topics/viral/audience/competitors -> generate AI artifacts/reports -> refine prompts.

## Design Direction

Use a restrained data-operations dashboard rather than a marketing page. Keep Xiaohongshu rose as a brand and primary-action signal, but avoid large pink surfaces. Use neutral backgrounds, navy text, blue data accents, and clear semantic state colors.

Avoid:

- large gradients, glassmorphism, glow effects, and decorative blobs;
- oversized hero typography;
- card-in-card nesting;
- emoji as structural icons;
- layout-shifting hover transforms;
- relying on color alone for state;
- arbitrary one-off colors, shadows, and radii.

## Semantic Tokens

Use these CSS variables as the implementation target.

### Color

| Token | Value | Usage |
| --- | --- | --- |
| `--background` | `#f6f8fb` | application background |
| `--background-subtle` | `#eef3f8` | secondary page bands, empty states |
| `--surface` | `#ffffff` | panels, cards, drawers |
| `--surface-elevated` | `#ffffff` | drawers, floating assistant, popovers |
| `--surface-hover` | `#f8fbff` | row/card hover |
| `--foreground` | `#0f172a` | primary text |
| `--foreground-secondary` | `#334155` | secondary readable text |
| `--foreground-muted` | `#64748b` | metadata and helper copy |
| `--foreground-disabled` | `#94a3b8` | disabled text |
| `--border` | `#dbe3ef` | default borders |
| `--border-strong` | `#b8c5d8` | active and focused borders |
| `--divider` | `#e7edf5` | subtle separators |
| `--primary` | `#e11d48` | primary actions and brand-selected state |
| `--primary-hover` | `#be123c` | primary action hover |
| `--primary-active` | `#9f1239` | primary action active |
| `--primary-soft` | `#fff1f4` | selected navigation/background |
| `--primary-foreground` | `#ffffff` | text on primary |
| `--secondary` | `#2563eb` | analytics, links, prompt metadata |
| `--secondary-soft` | `#eff6ff` | blue chip backgrounds |
| `--accent` | `#d97706` | warning attention and manual confirmation |
| `--accent-soft` | `#fff7ed` | warning backgrounds |
| `--success` | `#059669` | connected, completed, available |
| `--success-soft` | `#ecfdf5` | success backgrounds |
| `--warning` | `#d97706` | throttling, pending, needs attention |
| `--warning-soft` | `#fffbeb` | warning backgrounds |
| `--error` | `#dc2626` | failure, delete, dangerous actions |
| `--error-soft` | `#fef2f2` | error backgrounds |
| `--info` | `#2563eb` | information states |
| `--info-soft` | `#eff6ff` | information backgrounds |
| `--focus-ring` | `rgba(37, 99, 235, 0.28)` | keyboard focus ring |
| `--overlay` | `rgba(15, 23, 42, 0.45)` | drawer/modal scrim |

### Typography

Use local/system fonts. Do not add remote font dependencies.

- UI text: `Inter`, `Microsoft YaHei`, `PingFang SC`, `Segoe UI`, system sans-serif.
- Data/code/prompt text: `JetBrains Mono`, `Fira Code`, `Consolas`, monospace.
- Body text: 13-14px on desktop, 16px minimum for mobile inputs.
- Panel title: 14-15px, 650 weight.
- Page title: 16-18px, 700 weight.
- Metadata/chips: 12px, 18px line-height.
- Markdown body: 14px, 1.75 line-height, max readable width 920-980px.

### Scale

| Type | Tokens |
| --- | --- |
| Space | `--space-1: 4px`, `--space-2: 8px`, `--space-3: 12px`, `--space-4: 16px`, `--space-5: 20px`, `--space-6: 24px` |
| Radius | `--radius-xs: 4px`, `--radius-sm: 6px`, `--radius-md: 8px`, `--radius-lg: 12px`, `--radius-pill: 999px` |
| Border | `--border-width: 1px` |
| Shadow | `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-drawer` |
| Z-index | `--z-nav: 10`, `--z-floating: 30`, `--z-drawer: 50`, `--z-modal: 60` |
| Motion | `--duration-fast: 120ms`, `--duration-normal: 180ms`, `--duration-slow: 240ms`, `--ease-standard: cubic-bezier(.2,0,0,1)` |
| Breakpoints | `--bp-mobile: 640px`, `--bp-tablet: 900px`, `--bp-desktop: 1280px`, `--bp-wide: 1440px` |

## Layout Rules

- App shell: sidebar + compact command bar + internally scrolling work area.
- Desktop sidebar: 216-232px; tablet/mobile sidebar may collapse to icon rail.
- Top command bar: 56-64px visual height; no page-specific forms inside it.
- Main panels must use `min-height: 0` when inside grid/flex layouts.
- Long lists, tables, Markdown, media grids, and prompt editors scroll internally.
- Avoid browser-wide horizontal scroll at 375px, 768px, 1280px, and 1440px.
- Keep one clear primary action per panel or workflow step.

## Component Rules

### Buttons

- Primary: filled rose, used only for main actions such as search, verify, generate, save.
- Secondary/ghost: neutral border, used for navigation, export, refresh, and low-risk actions.
- Danger: red text/border/background and clear label.
- Icon-only controls require `aria-label` and stable 32-36px desktop hit area; mobile hit area should approach 44px.
- Hover/focus must not move surrounding content.

### Forms

- Every input/select/textarea has a visible label.
- Placeholder never replaces label.
- Focus states use visible blue ring.
- Disabled states use both disabled attribute and muted styling.
- Error text appears close to the relevant area where possible.

### Panels and Tables

- Panels use white surface, subtle border, 8-12px radius, and minimal shadow.
- Table/list headers are sticky when content scrolls.
- Row hover uses soft background and border only.
- Empty states must explain why empty, what data is needed, and the next available action.

### Markdown and AI

- Markdown is used for AI artifacts, reports, assistant replies, and recent report previews.
- Headings, lists, tables, blockquotes, code blocks, inline code, and links need distinct styles.
- AI assistant entry is a horizontal draggable pill; no vertical rail.
- AI drawer is a right overlay/resizable drawer. It must not require changing business flow.
- Current assistant is non-streaming; do not present stop/regenerate controls as functional chat operations unless backend supports them.

### Drawers and Overlays

- Use a 45% dark scrim for modal/drawer overlays.
- Drawers must not cause horizontal scroll.
- Escape/close controls must be visible and keyboard-focusable.
- API keys and cookies are never shown in plaintext.

## Accessibility

- Text contrast should meet WCAG AA where practical.
- Focus state must be visible on keyboard navigation.
- State is expressed with text/icon plus color.
- Respect `prefers-reduced-motion`.
- Touch targets on narrow screens must be large enough for reliable use.
- Do not disable browser zoom.

## Page Priorities

1. AI Workbench: artifact/report reading center with prompt linkage.
2. Prompt Center: prompt selection, edit, variables, output structure, linked artifacts.
3. Notes Library: dense list + stable detail/media/body panel.
4. Research: compact search + keyword matrix + actionable empty states.
5. Viral/Audience/Competitor: data list + analysis report with readable Markdown.
6. Comments: clear two/three-step comment draft confirmation workflow.
7. Overview: status, task progress, capability map, recent artifacts.

## Verification Checklist

- `npm run typecheck`
- `npm test`
- `npm run build`
- Browser check at 375px, 768px, 1440px.
- No console runtime errors except known favicon 404 if present.
- Frontend 5173 and backend 8787 are reachable.
- No business API, route, storage, or backend behavior changed.
