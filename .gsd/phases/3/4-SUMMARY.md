# Plan 3.4 Summary: Run API Endpoints

## Changes Made

### Modified `backend/app/schemas.py`
Added 4 new schemas at the end:
- `RunCreate` — `agent_id` + `task`
- `RunResponse` — full run record (id, status, cost, tokens, duration, error, timestamps)
- `RunListResponse` — paginated list of runs
- `RunLogResponse` — single log entry (id, run_id, timestamp, level, message, metadata_json)

### [NEW] `backend/app/routers/runs.py`
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/runs` | Create run + launch orchestrator via `BackgroundTasks` |
| `GET` | `/api/runs` | List runs, ordered newest first; `?agent_id=` filter + pagination |
| `GET` | `/api/runs/{id}` | Get a single run |
| `GET` | `/api/runs/{id}/logs` | Get all logs for a run |
| `DELETE` | `/api/runs/{id}` | Delete run (blocked if status=running) |

### Modified `backend/app/main.py`
- Added `from app.routers.runs import router as runs_router`
- Added `app.include_router(runs_router)`

## Verification Results

```
Runs router OK — registered routes:
  /api/runs
  /api/runs
  /api/runs/{run_id}
  /api/runs/{run_id}/logs
  /api/runs/{run_id}
```

## Technical Notes
- `POST /api/runs` returns immediately with `status="pending"` — execution is async
- Frontend polls `GET /api/runs/{id}` until status is `completed` or `failed`
- `DELETE` is guarded against deleting in-progress runs (409 Conflict)
- Run logs are ordered chronologically (ascending by timestamp)
