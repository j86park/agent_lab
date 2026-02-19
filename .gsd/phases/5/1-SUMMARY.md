# Plan 5.1 Summary: Run History Page + Side-by-Side Comparison

## Changes Made

### New: `frontend/src/pages/HistoryPage.tsx`
Full implementation replacing stub:
- **Filterable table** — status dropdown (All/Completed/Failed/Running/Pending) + agent dropdown + pagination (20/page)
- **Run table** — columns: Status badge | Agent name | Task (truncated) | Cost | Tokens | Duration | Started (relative time) | Actions
- **Comparison selection** — checkbox per row (max 2), live "X/2 selected" indicator
- **Compare button** — appears when exactly 2 runs are selected; navigates to `/history/compare?run1=&run2=`
- **Delete** — per-row delete with confirmation dialog
- **Empty state** — "No runs found" with link to Agents
- **Pagination** — previous/next buttons with page counter

### New: `frontend/src/components/ui/table.tsx`
Installed via `npx shadcn@latest add table --yes`

### New: `frontend/src/pages/CompareRunsPage.tsx`
- Reads `run1` + `run2` from URL search params
- Fetches both runs + logs in parallel
- **Diff summary bar** — cost/token/duration diff with TrendingUp/TrendingDown arrows
- **Two-column layout** (responsive grid) — each column: status badge, task, 3 stat cards, scrollable terminal-style log viewer
- Error handling if IDs missing or fetch fails

### Modified: `frontend/src/App.tsx`
- Added `import CompareRunsPage`
- Added `<Route path="/history/compare" element={<CompareRunsPage />} />`

## Verification

```
TypeScript OK — npx tsc --noEmit passed cleanly
```

## Technical Notes
- `runApi.listRuns(agent_id?, skip, limit)` already had agent filter support
- Status filter done client-side (API doesn't support status query param yet)
- Parallel fetch of both runs in CompareRunsPage with `Promise.all`
