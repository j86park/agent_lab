---
phase: 4
plan: 1
wave: 1
---

# Plan 4.1: WebSocket Log Streaming + Run API Client

## Objective
Create the WebSocket endpoint for real-time log streaming during agent runs, and add Run/RunLog types + `runApi` methods to the frontend API client. This provides the plumbing for the Run Dashboard UI (Plan 4.2).

## Context
- .gsd/SPEC.md
- backend/app/routers/runs.py
- backend/app/services/orchestrator.py
- backend/app/main.py
- frontend/src/lib/api.ts
- frontend/vite.config.ts (already proxies /ws → ws://localhost:8000)

## Tasks

<task type="auto">
  <name>WebSocket endpoint for run log streaming</name>
  <files>
    backend/app/routers/ws.py
    backend/app/main.py
    backend/app/services/orchestrator.py
  </files>
  <action>
    1. Create `backend/app/routers/ws.py`:
       - `@router.websocket("/ws/runs/{run_id}")` endpoint
       - On connect: query RunLogs already collected → send as initial batch
       - Then poll for new RunLogs every 1s (simple polling loop — not a full pub/sub system)
       - Send each new log as a JSON message: `{"type": "log", "data": { ... RunLogResponse fields }}`
       - On run completion/failure: send `{"type": "status", "status": "completed"|"failed", "run": { ... RunResponse fields }}`
       - Close connection when run is done OR client disconnects
       - Format: WebSocket text frames with JSON

    2. Wire the router in `main.py`:
       ```python
       from app.routers.ws import router as ws_router
       app.include_router(ws_router)
       ```

    3. Update `orchestrator.py` to emit log events:
       - After each `_log()` call, no change to the orchestrator itself — the WebSocket endpoint polls the DB for new logs. This keeps the architecture simple (no in-memory pub/sub needed).

    IMPORTANT:
    - Use a simple polling loop (SELECT WHERE id > last_seen_id) — no need for Redis/message queues
    - Handle WebSocket disconnects gracefully (catch ConnectionClosed)
    - The endpoint sends both log entries AND status updates
    - Client reconnects should work by re-fetching all logs
  </action>
  <verify>
    cd backend; ..\a_lab\Scripts\python.exe -c "from app.main import app; routes = [r.path for r in app.routes]; assert '/ws/runs/{run_id}' in routes; print('WebSocket route OK')"
  </verify>
  <done>
    - WebSocket endpoint at /ws/runs/{run_id} is registered
    - Sends initial log batch + polls for new logs
    - Sends status update when run completes/fails
    - Handles disconnects gracefully
  </done>
</task>

<task type="auto">
  <name>Add Run types and API methods to frontend client</name>
  <files>
    frontend/src/lib/api.ts
  </files>
  <action>
    1. Add Run and RunLog TypeScript interfaces to `api.ts`:
       ```typescript
       export interface Run {
           id: string;
           agent_id: string;
           task: string;
           status: "pending" | "running" | "completed" | "failed";
           cost: number | null;
           total_tokens: number | null;
           duration_seconds: number | null;
           error_message: string | null;
           created_at: string;
           completed_at: string | null;
       }

       export interface RunLog {
           id: number;
           run_id: string;
           timestamp: string;
           level: "info" | "warning" | "error" | "debug";
           message: string;
           metadata_json: string | null;
       }
       ```

    2. Add `runApi` object with methods:
       ```typescript
       export const runApi = {
           createRun: (agent_id: string, task: string) =>
               fetchApi<Run>("/api/runs", { method: "POST", body: JSON.stringify({ agent_id, task }) }),
           getRun: (id: string) => fetchApi<Run>(`/api/runs/${id}`),
           listRuns: (agent_id?: string, skip = 0, limit = 50) =>
               fetchApi<{ runs: Run[]; total: number }>(`/api/runs?skip=${skip}&limit=${limit}${agent_id ? `&agent_id=${agent_id}` : ""}`),
           getRunLogs: (runId: string) => fetchApi<RunLog[]>(`/api/runs/${runId}/logs`),
           deleteRun: (id: string) => fetchApi<void>(`/api/runs/${id}`, { method: "DELETE" }),
       };
       ```

    IMPORTANT:
    - Match the exact field names from the backend RunResponse/RunLogResponse schemas
    - Status field uses a union type for type safety
    - No WebSocket client code here — that goes in the React component (Plan 4.2)
  </action>
  <verify>
    cd frontend; npx tsc --noEmit 2>&1 | findstr /C:"error" || echo "TypeScript OK"
  </verify>
  <done>
    - Run and RunLog interfaces exported from api.ts
    - runApi object with createRun, getRun, listRuns, getRunLogs, deleteRun
    - TypeScript compiles without errors
  </done>
</task>

## Success Criteria
- [ ] WebSocket endpoint registered at /ws/runs/{run_id}
- [ ] WebSocket sends log entries as JSON text frames
- [ ] WebSocket sends status update on completion/failure
- [ ] Run/RunLog interfaces added to frontend
- [ ] runApi methods match backend endpoint signatures
- [ ] TypeScript compiles cleanly
