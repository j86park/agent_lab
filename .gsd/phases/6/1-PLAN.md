---
phase: 6
plan: 1
wave: 1
---

# Plan 6.1: PrimeIntellect-Inspired UI Redesign + Error Hardening

## Objective
Overhaul the entire visual theme to match PrimeIntellect's ultra-dark, sharp, minimal aesthetic (white/off-white primary, near-zero border radius, monospace accents, hairline borders). Then add a 404 page and error boundary for resilience.

**Design reference:** https://www.primeintellect.ai/#lab + https://app.primeintellect.ai/dashboard

**Design decisions (confirmed by user):**
- Primary accent: white / off-white (NOT the bright green from marketing site)
- Scope: Option A — global theme token overhaul + layout components only
- All pages inherit the new look automatically via CSS custom properties

## Context
- frontend/src/index.css (current theme tokens — replace dark section entirely)
- frontend/src/components/layout/Sidebar.tsx (redesign)
- frontend/src/components/layout/AppLayout.tsx (redesign)
- frontend/src/App.tsx (add ErrorBoundary + 404 route)

## Tasks

<task type="auto">
  <name>Redesign global theme: index.css + typography</name>
  <files>
    frontend/src/index.css
    frontend/index.html
  </files>
  <action>
    ### 1. Update `frontend/index.html`
    Add Google Fonts import in `<head>` before the closing `</head>` tag:
    ```html
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    ```

    ### 2. Overwrite the theme in `frontend/src/index.css`

    Replace the ENTIRE `:root` block AND the entire `.dark` block with:

    ```css
    /* ── Force dark mode always ── */
    :root {
        color-scheme: dark;

        /* Base */
        --background: oklch(0.07 0.005 240);       /* ~#0a0b0d — near black with blue tint */
        --foreground: oklch(0.93 0 0);              /* off-white text */

        /* Cards / panels */
        --card: oklch(0.10 0.005 240);              /* slightly lighter than bg */
        --card-foreground: oklch(0.93 0 0);

        /* Popover */
        --popover: oklch(0.12 0.005 240);
        --popover-foreground: oklch(0.93 0 0);

        /* Primary — white/off-white accent */
        --primary: oklch(0.95 0 0);
        --primary-foreground: oklch(0.08 0 0);

        /* Secondary */
        --secondary: oklch(0.14 0.005 240);
        --secondary-foreground: oklch(0.80 0 0);

        /* Muted */
        --muted: oklch(0.13 0.003 240);
        --muted-foreground: oklch(0.52 0 0);

        /* Accent */
        --accent: oklch(0.16 0.005 240);
        --accent-foreground: oklch(0.93 0 0);

        /* Destructive */
        --destructive: oklch(0.60 0.20 20);

        /* Borders — ultra thin, low opacity */
        --border: oklch(1 0 0 / 8%);
        --input: oklch(1 0 0 / 6%);
        --ring: oklch(0.70 0 0);

        /* Radius — sharp, near-zero like PI */
        --radius: 0.25rem;

        /* Sidebar */
        --sidebar: oklch(0.06 0.005 240);           /* even darker than bg */
        --sidebar-foreground: oklch(0.93 0 0);
        --sidebar-primary: oklch(0.95 0 0);
        --sidebar-primary-foreground: oklch(0.08 0 0);
        --sidebar-accent: oklch(0.13 0.005 240);
        --sidebar-accent-foreground: oklch(0.93 0 0);
        --sidebar-border: oklch(1 0 0 / 7%);
        --sidebar-ring: oklch(0.50 0 0);

        /* Charts */
        --chart-1: oklch(0.75 0.10 200);
        --chart-2: oklch(0.65 0.12 150);
        --chart-3: oklch(0.70 0.10 260);
        --chart-4: oklch(0.75 0.14 40);
        --chart-5: oklch(0.65 0.13 320);
    }
    ```

    REMOVE the `.dark { ... }` block entirely — we're always dark.

    ### 3. Update `@layer base` to also force dark on html:
    ```css
    @layer base {
        html {
            @apply dark;
        }
        * {
            @apply border-border outline-ring/50;
        }
        body {
            @apply bg-background text-foreground;
            font-family: 'Inter', system-ui, sans-serif;
            -webkit-font-smoothing: antialiased;
        }
        code, pre, kbd, .font-mono {
            font-family: 'JetBrains Mono', 'Fira Code', monospace;
        }
    }
    ```

    IMPORTANT: The dark class must be on `html` element — shadcn/ui uses `.dark` selector for its components. By adding `@apply dark` to the `html` element we force all shadcn components into dark mode without any toggle logic.
  </action>
  <verify>
    cd frontend; npx tsc --noEmit 2>&1; if ($LASTEXITCODE -eq 0) { Write-Host "TypeScript OK" }
  </verify>
  <done>
    - index.css uses the new near-black token palette
    - No .dark block (dark is always-on)
    - JetBrains Mono imported for code elements
    - border-radius is 0.25rem (sharp edges)
    - TypeScript still passes
  </done>
</task>

<task type="auto">
  <name>Redesign Sidebar and AppLayout with PI aesthetic</name>
  <files>
    frontend/src/components/layout/Sidebar.tsx
    frontend/src/components/layout/AppLayout.tsx
  </files>
  <action>
    ### Sidebar.tsx — full redesign

    Rewrite `Sidebar.tsx` with these PI-inspired details:

    1. **Logo area** — sharp bottom border, monospace "AGENT LAB" in tracking-widest uppercase on one line, smaller version number below it
    2. **Nav sections** — group nav items into 2 sections with tiny uppercase mono-style section labels:
       - Section "WORKSPACE": Agents, New Agent, History, Templates, Skills
       - Section "SYSTEM": Settings
    3. **Nav item styling**:
       - `text-xs font-medium tracking-wide` label text
       - Active: `bg-accent text-foreground border-l-2 border-primary` (white left border when active)
       - Inactive: `text-muted-foreground hover:text-foreground hover:bg-accent/50`
       - Icon: `h-3.5 w-3.5` (smaller than current)
       - Padding: `px-3 py-1.5` (tighter than current)
       - Rounded: `rounded-sm` (matching new small radius)
    4. **Bottom status chip** — keep "Local Execution" badge but make it a simple row with a green dot indicator:
       ```tsx
       <div className="flex items-center gap-2 text-xs text-muted-foreground">
           <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
           <span>Running locally</span>
       </div>
       ```
    5. **Width**: keep `w-56` (slightly narrower than current w-64)
    6. **Background**: `bg-sidebar border-r border-sidebar-border`

    ### AppLayout.tsx — tighten layout

    Update `AppLayout.tsx`:
    - Keep flex layout
    - Change main content padding from `p-8` to `px-8 py-6`
    - Keep `max-w-5xl mx-auto`
    - Add `border-l border-border/40` inside main to create subtle content/sidebar separation on ultra-dark bg (optional, only if it looks right)

    IMPORTANT: Use `NavLink` from react-router-dom. Import `cn` from `@/lib/utils`. Keep all existing routes/icons — just restyle. Do NOT remove any nav items.
  </action>
  <verify>
    cd frontend; npx tsc --noEmit 2>&1; if ($LASTEXITCODE -eq 0) { Write-Host "TypeScript OK" }
  </verify>
  <done>
    - Sidebar has WORKSPACE/SYSTEM section labels
    - Active nav item has white left-border highlight
    - Bottom shows green dot + "Running locally"
    - Width is w-56
    - TypeScript compiles cleanly
  </done>
</task>

<task type="auto">
  <name>Add 404 page and global error boundary</name>
  <files>
    frontend/src/pages/NotFoundPage.tsx
    frontend/src/components/ErrorBoundary.tsx
    frontend/src/App.tsx
  </files>
  <action>
    1. Create `frontend/src/pages/NotFoundPage.tsx`:
       ```tsx
       import { useNavigate } from "react-router-dom";
       import { Button } from "@/components/ui/button";
       import { Ghost } from "lucide-react";

       export default function NotFoundPage() {
           const navigate = useNavigate();
           return (
               <div className="flex flex-col items-center justify-center h-[60vh] gap-6 text-center">
                   <Ghost className="h-16 w-16 text-muted-foreground/40" />
                   <div className="space-y-2">
                       <p className="text-xs font-mono tracking-widest text-muted-foreground uppercase">404</p>
                       <h1 className="text-2xl font-semibold">Page not found</h1>
                       <p className="text-sm text-muted-foreground">This page doesn't exist or has been moved.</p>
                   </div>
                   <Button variant="outline" onClick={() => navigate("/")}>Go home</Button>
               </div>
           );
       }
       ```

    2. Create `frontend/src/components/ErrorBoundary.tsx`:
       - Class component (required — hooks can't catch render errors)
       - State: `{ hasError: boolean; error: Error | null }`
       - `getDerivedStateFromError`: sets `hasError: true`
       - `componentDidCatch`: console.error
       - Fallback UI: centered layout with AlertCircle icon, error message, "Reload Page" button (`window.location.reload()`)
       - Children passthrough when `!hasError`

    3. Modify `frontend/src/App.tsx`:
       - Import `ErrorBoundary` from `@/components/ErrorBoundary`
       - Import `NotFoundPage` from `@/pages/NotFoundPage`
       - Wrap entire `<BrowserRouter>` in `<ErrorBoundary>`
       - Add `<Route path="*" element={<NotFoundPage />} />` as LAST route inside `<Route element={<AppLayout />}>`
  </action>
  <verify>
    cd frontend; npx tsc --noEmit 2>&1; if ($LASTEXITCODE -eq 0) { Write-Host "TypeScript OK" }
  </verify>
  <done>
    - /anything-nonexistent shows NotFoundPage with 404 mono label + Ghost icon
    - ErrorBoundary wraps entire app
    - TypeScript compiles cleanly
  </done>
</task>

## Success Criteria
- [ ] App is always dark — ultra-dark near-black background, off-white text
- [ ] border-radius is 0.25rem (sharp edges throughout)
- [ ] JetBrains Mono used for code/mono elements
- [ ] Sidebar has WORKSPACE/SYSTEM sections, active left-border highlight, tighter spacing
- [ ] Navigating to /nonexistent shows NotFoundPage
- [ ] ErrorBoundary class component wraps the app
- [ ] TypeScript compiles cleanly after all three tasks
