---
phase: 7
plan: 4
wave: 1
---

# Plan 7.4: Quick Re-Run + Run Tags

## Objective
Two small UX improvements bundled together:

1. **Quick Re-Run**: A "Re-run" button on the Run Dashboard page that opens a pre-filled Start Run dialog, letting the user tweak the task and immediately launch a new run without navigating back to the agent editor.

2. **Run Tags**: Users can apply short text labels (`baseline`, `v2`, etc.) to any run. Tags are filterable in History. Stored as a comma-joined string in a new DB column.

## Context
- `backend/app/models.py` — `Run` model, add `tags` column
- `backend/app/schemas.py` — `RunCreate` + `RunResponse` + `RunUpdate` for tags
- `backend/app/routers/runs.py` — update list endpoint to filter by tag; add PATCH for tags
- `frontend/src/pages/RunDashboardPage.tsx` — add Re-run button + tag editor
- `frontend/src/pages/HistoryPage.tsx` — add tag filter dropdown
- `frontend/src/lib/api.ts` — add tag-related types + API calls

## Tasks

<task type="auto">
  <name>Backend: run tags column + API + list filter</name>
  <files>
    backend/app/models.py
    backend/app/schemas.py
    backend/app/routers/runs.py
    backend/app/database.py
  </files>
  <action>
    1. In `models.py`: add to `Run`:
       ```python
       tags: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
       ```
       Convention: comma-separated, e.g. `"baseline,v2,prod"`. Keep simple, no JSON needed.

    2. In `schemas.py`:
       - Add `tags: str | None = None` to `RunCreate` and `RunResponse`
       - Create `RunTagUpdate(BaseModel): tags: str | None`

    3. In `routers/runs.py`:
       - In `create_run()`: set `run.tags = payload.tags` if provided
       - In `list_runs()`: add `tag: Optional[str] = Query(None)` param. If provided, filter:
         `stmt = stmt.where(Run.tags.contains(tag))` — SQLite LIKE-based contains is fine
       - Add new endpoint:
         ```
         PATCH /api/runs/{run_id}/tags
         ```
         Body: `RunTagUpdate`. Updates `run.tags`, returns updated `RunResponse`.

    4. SQLite migration in `database.py` startup (same pattern as Plan 7.3):
       ```python
       await conn.execute(text("ALTER TABLE runs ADD COLUMN tags VARCHAR(500)"))
       ```
       Wrap in try/except OperationalError.
  </action>
  <verify>
    python -c "from app.schemas import RunCreate; r = RunCreate(agent_id='x', task='t', tags='baseline,v2'); print('tags OK:', r.tags)"
  </verify>
  <done>
    - `Run.tags` column exists
    - `PATCH /api/runs/{id}/tags` updates tags
    - `GET /api/runs?tag=baseline` returns only runs with that tag substring
    - `RunResponse.tags` included in all run responses
  </done>
</task>

<task type="auto">
  <name>Frontend: Re-run button + tag editor + History filter</name>
  <files>
    frontend/src/pages/RunDashboardPage.tsx
    frontend/src/pages/HistoryPage.tsx
    frontend/src/lib/api.ts
  </files>
  <action>
    1. In `api.ts`:
       - Add `tags: string | null` to `Run` interface
       - Add `updateRunTags(runId: string, tags: string | null): Promise<Run>`
         → `PATCH /api/runs/${runId}/tags` with body `{tags}`

    2. In `RunDashboardPage.tsx`:

       **Re-run button:**
       - Add a "Re-run" button in the run header area (next to the existing back link)
       - On click: open a small inline dialog/panel pre-filled with the run's `task` text
       - User can edit the task text, then click "Start" → `POST /api/runs` with `agent_id` from current run + edited task
       - After creation, navigate to the new run's dashboard (`/runs/{newRunId}`)
       - While the new run is being created, show a loading spinner on the button

       **Tag editor:**
       - Below the run status header, add a small tag row: `[+ Add tag]`
       - Clicking shows a small text input. On Enter/blur: save via `updateRunTags()`
       - Display existing tags as small mono badge chips with an (×) to remove
       - Removing a tag: strip it from the comma string and call `updateRunTags()`
       - Keep tag chips contained in one line, no multiline

    3. In `HistoryPage.tsx`:
       - Add a "Tag" filter input field alongside the existing agent and status filters
       - On change (debounced 300ms), append `?tag={value}` to the runs list API call
       - If tag filter is empty, no tag filter applied

    Keep the re-run dialog minimal — just a textarea for the task, pre-filled, no modal overlay needed. An inline collapsible panel below the header works fine.
  </action>
  <verify>
    npx tsc --noEmit 2>&1 | tail -5
  </verify>
  <done>
    - "Re-run" button on RunDashboardPage, pre-fills task, creates new run on submit
    - Tag chips displayed and editable on RunDashboardPage
    - History page has tag filter input that queries `?tag=`
    - TypeScript clean
  </done>
</task>

## Success Criteria
- [ ] Re-run button creates new run with pre-filled task, navigates to new run dashboard
- [ ] Tag chips on Run Dashboard: add, display, remove
- [ ] History page filterable by tag string
- [ ] TypeScript clean
