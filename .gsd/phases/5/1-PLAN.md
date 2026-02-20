---
phase: 5
plan: 1
wave: 1
---

# Plan 5.1: Run History Page + Side-by-Side Comparison

## Objective
Replace the HistoryPage stub with a full run history page, including filterable/sortable table, detailed run view, and side-by-side comparison of two runs. The existing `runApi` already provides `listRuns`, `getRun`, `getRunLogs`, and `deleteRun`.

## Context
- .gsd/SPEC.md
- frontend/src/pages/HistoryPage.tsx (stub)
- frontend/src/lib/api.ts (runApi already exists)
- frontend/src/pages/RunDashboardPage.tsx (for reference — run detail view)
- backend/app/routers/runs.py (GET /api/runs already supports agent_id filter)
- backend/app/schemas.py (RunResponse, RunLogResponse)

## Tasks

<task type="auto">
  <name>Implement HistoryPage with filterable run table</name>
  <files>
    frontend/src/pages/HistoryPage.tsx
  </files>
  <action>
    1. Replace the stub HistoryPage.tsx with a full implementation:

    **Layout** (top to bottom):
    - **Header**: "History" title + subtitle
    - **Filters row**: Status dropdown (All / Completed / Failed), Agent dropdown (All / agent names from run data), Date range (optional — just a "Last 7 days / 30 days / All" selector)
    - **Run table**: sortable by created_at (default newest first)
      - Columns: Status badge | Agent ID (short) | Task (truncated) | Cost | Tokens | Duration | Created At | Actions
      - Row click → navigate to `/runs/{id}` (existing RunDashboardPage)
      - Delete button per row with confirmation
    - **Pagination**: Show 20 runs per page, previous/next buttons
    - **Empty state**: "No runs yet" with a link to create an agent

    2. Fetch data:
       - Use `runApi.listRuns()` on mount and on filter change
       - Fetch agent list with `agentApi.listAgents()` to populate agent filter dropdown
       - Client-side filter by status (or extend the API call with status param)

    3. **Comparison mode**:
       - Add a checkbox column to the table (select up to 2 runs)
       - When 2 runs are selected, show a "Compare" button in the header
       - Clicking "Compare" navigates to `/history/compare?run1={id1}&run2={id2}`
       - Store selected run IDs in component state

    IMPORTANT:
    - Use shadcn/ui components: Table, TableHeader, TableBody, TableRow, TableCell, Badge, Select, Button
    - Reuse the StatusBadge pattern from RunDashboardPage (or extract it)
    - Table should be responsive
    - Format dates relative (e.g., "2 hours ago") using simple relative time formatting
  </action>
  <verify>
    cd frontend; npx tsc --noEmit 2>&1 | findstr /C:"error" || echo "TypeScript OK"
  </verify>
  <done>
    - HistoryPage shows paginated run table
    - Filters by status and agent
    - Checkbox selection for comparison (up to 2)
    - Compare button navigates to comparison route
    - Build passes
  </done>
</task>

<task type="auto">
  <name>Implement comparison page for side-by-side run view</name>
  <files>
    frontend/src/pages/CompareRunsPage.tsx
    frontend/src/App.tsx
  </files>
  <action>
    1. Create `CompareRunsPage.tsx`:
       - Reads `run1` and `run2` from URL search params
       - Fetches both runs and their logs via `runApi.getRun()` + `runApi.getRunLogs()`
       - **Side-by-side layout** (2 columns):
         - Each column shows: Status badge, task, stats (cost/tokens/duration)
         - Below stats: scrollable log viewer (same terminal style as RunDashboardPage)
       - **Comparison summary** at top:
         - Cost diff, token diff, duration diff (with arrows up/down)
         - Which run had fewer errors
       - If either run ID is missing or invalid, show error state with link back to History

    2. Add route to `App.tsx`:
       ```tsx
       <Route path="/history/compare" element={<CompareRunsPage />} />
       ```

    IMPORTANT:
    - Use CSS grid for the two-column layout (responsive: stack on mobile)
    - Log viewers should scroll independently
    - Show "N/A" for missing data, not crash
  </action>
  <verify>
    cd frontend; npx tsc --noEmit 2>&1 | findstr /C:"error" || echo "TypeScript OK"
  </verify>
  <done>
    - CompareRunsPage displays two runs side-by-side
    - Stats comparison summary at top
    - Both log viewers scrollable independently
    - Route registered at /history/compare
    - Build passes
  </done>
</task>

## Success Criteria
- [ ] HistoryPage shows paginated, filterable run table
- [ ] Checkbox selection for up to 2 runs + Compare button
- [ ] CompareRunsPage shows side-by-side run comparison
- [ ] Routes registered and navigable
- [ ] TypeScript compiles cleanly
