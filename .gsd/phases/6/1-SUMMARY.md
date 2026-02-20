# Plan 6.1 Summary: PI-Inspired Dark Theme + Error Hardening

## What Was Built

### Task 1: Global Dark Theme (`index.css` + `index.html`)
**`frontend/index.html`**
- Added Google Fonts: `Inter` (300-700) + `JetBrains Mono` (400-500)
- Updated page title from "frontend" → "Agent Lab"

**`frontend/src/index.css`**
- Replaced the light/dark toggle system with a single **always-dark** palette
- `html { @apply dark }` forces all shadcn/ui components into dark mode permanently
- Key color tokens:
  - Background: `oklch(0.08 0.004 240)` — near-black with subtle blue-gray tint
  - Primary: `oklch(0.94 0 0)` — off-white/white
  - Borders: `oklch(1 0 0 / 8%)` — ultra-thin hairlines
  - Sidebar bg: `oklch(0.06 0.004 240)` — even darker than page bg
- `--radius: 0.25rem` → sharp angular corners everywhere (was 0.625rem)
- JetBrains Mono applied to all `code`, `pre`, `kbd` elements and `.font-mono` class

### Task 2: Sidebar + AppLayout Redesign
**`frontend/src/components/layout/Sidebar.tsx`** — full rewrite
- Width: `w-56` (was `w-64`)
- Nav items grouped into 2 sections:
  - `WORKSPACE`: Agents, New Agent, History, Templates, Skills
  - `SYSTEM`: Settings
- Section labels: `10px` monospace uppercase tracking-widest (PI style)
- Active nav item: `border-l-2 border-primary` (white left-border) + `bg-accent`
- Inactive: `text-muted-foreground` → `hover:text-foreground`
- Icons: `h-3.5 w-3.5` (smaller, more minimal)
- Logo: small `FlaskConical` icon + "AGENT LAB" monospace uppercase + `v1.0.0` version
- Footer: green dot + "Running locally" (replaces old "Local Execution" card)

**`frontend/src/components/layout/AppLayout.tsx`**
- Main padding: `p-8` → `px-8 py-6` (slightly tighter vertical)

### Task 3: 404 Page + Global Error Boundary
**`frontend/src/pages/NotFoundPage.tsx`** (new)
- Ghost icon, mono `404` label, "Page not found" message, "Go home" button

**`frontend/src/components/ErrorBoundary.tsx`** (new)
- Class component (required by React for render-error catching)
- Catches unexpected component crashes, shows error message + Reload button

**`frontend/src/App.tsx`**
- Wrapped entire `<BrowserRouter>` in `<ErrorBoundary>`
- Added `<Route path="*" element={<NotFoundPage />} />` as last route inside AppLayout

## Verification
- `npx tsc --noEmit` → TypeScript OK ✓
- Committed: `feat(phase-6): PI-inspired dark theme, sidebar redesign, 404 + error boundary`
