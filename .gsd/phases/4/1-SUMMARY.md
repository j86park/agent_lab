# Plan 4.1 Summary: WebSocket Log Streaming + Run API Client

## Changes Made

### [NEW] `backend/app/routers/ws.py`
- WebSocket endpoint at `/ws/runs/{run_id}`
- On connect: sends all existing `RunLog` entries as initial batch
- Polls DB every 1s for new logs (`WHERE id > last_seen_id`)
- Message formats:
  - `{"type": "log", "data": {...RunLogResponse}}` — each new log
  - `{"type": "status", "status": "completed"|"failed", "run": {...RunResponse}}` — on finish
  - `{"type": "error", "message": "..."}` — on run not found
- Closes connection when run finishes or client disconnects
- Handles already-completed runs (sends logs + status, then closes)

### Modified `backend/app/main.py`
- Added `ws_router` import and `app.include_router(ws_router)`

### Modified `frontend/src/lib/api.ts`
- Added `Run` interface (matches `RunResponse` schema)
- Added `RunLog` interface (matches `RunLogResponse` schema)
- Added `runApi` with 5 methods: `createRun`, `getRun`, `listRuns`, `getRunLogs`, `deleteRun`

## Verification Results

```
WebSocket route OK
TypeScript OK
```

## Technical Notes
- Simple DB polling (not pub/sub) — avoids Redis dependency for MVP
- `session.expire_all()` called before each poll to see fresh data
- Client reconnects work by re-fetching all logs (initial batch always sent)
