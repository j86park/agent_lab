---
phase: 6
plan: 1
wave: 1
---

# Plan 6.1: UI Polish & Error Hardening

## Objective
Add a global 404 page, improve empty states on the History and Skills pages, and add a global error boundary so the app never shows a blank white screen on unexpected crashes.

## Context
- frontend/src/App.tsx
- frontend/src/pages/HistoryPage.tsx (has basic empty state, needs polish)
- frontend/src/pages/SkillsPage.tsx
- frontend/src/pages/HomePage.tsx (reference — has good empty state pattern)

## Tasks

<task type="auto">
  <name>Add 404 (Not Found) page and error boundary</name>
  <files>
    frontend/src/pages/NotFoundPage.tsx
    frontend/src/components/ErrorBoundary.tsx
    frontend/src/App.tsx
  </files>
  <action>
    1. Create `frontend/src/pages/NotFoundPage.tsx`:
       - "404 — Page Not Found" with icon (AlertCircle or Ghost from lucide-react)
       - Subtitle: "This page doesn't exist."
       - A "Go Home" Button that navigates to "/"
       - Simple, centered layout using existing shadcn Card
       - Export as default

    2. Create `frontend/src/components/ErrorBoundary.tsx`:
       - React class component wrapping `React.Component<{children: React.ReactNode}, {hasError: boolean; error: Error | null}>`
       - `static getDerivedStateFromError(error)`: return `{ hasError: true, error }`
       - `componentDidCatch(error, info)`: `console.error(error, info)`
       - When `hasError`: render a centered Card with:
         - Title: "Something went wrong"
         - Description: error message
         - "Reload Page" button that calls `window.location.reload()`
       - Otherwise: render `this.props.children`
       - Export as default

    3. Modify `frontend/src/App.tsx`:
       - Import `NotFoundPage` and `ErrorBoundary`
       - Wrap the entire `<BrowserRouter>...</BrowserRouter>` tree in `<ErrorBoundary>`
       - Add a catch-all route INSIDE `<Route element={<AppLayout />}>` as the LAST route:
         `<Route path="*" element={<NotFoundPage />} />`

    Note: ErrorBoundary must be a class component — React hooks cannot catch render errors.
  </action>
  <verify>
    cd frontend; npx tsc --noEmit 2>&1; if ($LASTEXITCODE -eq 0) { Write-Host "TypeScript OK" }
  </verify>
  <done>
    - Navigating to /nonexistent shows NotFoundPage with "Go Home" button
    - ErrorBoundary wraps the entire tree
    - TypeScript compiles cleanly
  </done>
</task>

<task type="auto">
  <name>Polish empty states on SkillsPage</name>
  <files>
    frontend/src/pages/SkillsPage.tsx
  </files>
  <action>
    Read current SkillsPage.tsx and check its empty state. If it is minimal (just text or a simple message):
    - Replace/improve the empty state with a dashed-border Card similar to HomePage.tsx:
      ```tsx
      <Card className="border-dashed">
        <CardHeader className="text-center">
          <CardTitle>No skills yet</CardTitle>
          <CardDescription>
            Skills are reusable instruction blocks you can attach to agents.
            Create your first skill to get started.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button onClick={() => setIsCreating(true)}>
            <PlusSquare className="mr-2 h-4 w-4" />
            New Skill
          </Button>
        </CardContent>
      </Card>
      ```
    - Adapt button/handler to what SkillsPage already uses for creating skills.
    - Do NOT restructure the rest of the page — only improve the empty state.

    If SkillsPage already has a good empty state, skip this task and note it in the commit message.
  </action>
  <verify>
    cd frontend; npx tsc --noEmit 2>&1; if ($LASTEXITCODE -eq 0) { Write-Host "TypeScript OK" }
  </verify>
  <done>
    - SkillsPage shows a polished empty state with dashed-border Card
    - TypeScript compiles cleanly
  </done>
</task>

## Success Criteria
- [ ] Navigating to `/xyz` shows NotFoundPage (not blank page)
- [ ] ErrorBoundary wraps the app (class component, catches render errors)
- [ ] SkillsPage has polished empty state matching HomePage pattern
- [ ] TypeScript compiles cleanly
