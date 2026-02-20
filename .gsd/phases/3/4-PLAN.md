---
phase: 3
plan: 4
wave: 2
depends_on: [3]
---

# Plan 3.4: Run API Endpoints

## Objective
Create the REST API endpoints for starting, stopping, and listing agent runs. This connects the orchestrator (Plan 3.3) to the frontend and adds the Pydantic schemas for run data.

## Context
- .gsd/SPEC.md
- backend/app/models.py
- backend/app/schemas.py
- backend/app/services/orchestrator.py
- backend/app/main.py

## Tasks

<task type="auto">
  <name>Create Run schemas and API router</name>
  <files>
    backend/app/schemas.py
    backend/app/routers/runs.py
    backend/app/main.py
  </files>
  <action>
    1. Add to `backend/app/schemas.py` — Run schemas:
       ```python
       class RunCreate(BaseModel):
           agent_id: str
           task: str  # The user's task description

       class RunResponse(BaseModel):
           id: str
           agent_id: str
           task: str
           status: str
           cost: float | None
           total_tokens: int | None
           duration_seconds: float | None
           error_message: str | None
           created_at: datetime
           completed_at: datetime | None
           model_config = ConfigDict(from_attributes=True)

       class RunListResponse(BaseModel):
           runs: list[RunResponse]
           total: int

       class RunLogResponse(BaseModel):
           id: int
           run_id: str
           timestamp: datetime
           level: str
           message: str
           metadata_json: str | None
           model_config = ConfigDict(from_attributes=True)
       ```

    2. Create `backend/app/routers/runs.py`:
       - `POST /api/runs` → Create a new run, start orchestrator in background
         - Creates Run record with status="pending"
         - Launches `orchestrator.execute_run()` as a background task
         - Returns the Run immediately (client polls for updates)
       - `GET /api/runs` → List all runs with pagination (skip, limit)
         - Optional query param: `agent_id` for filtering
         - Order by created_at descending
       - `GET /api/runs/{run_id}` → Get a single run with details
       - `GET /api/runs/{run_id}/logs` → Get all logs for a run
       - `DELETE /api/runs/{run_id}` → Delete a run record

    3. Wire the router in `backend/app/main.py`:
       ```python
       from app.routers.runs import router as runs_router
       app.include_router(runs_router)
       ```

    4. Background task approach:
       - Use FastAPI's `BackgroundTasks` to launch orchestrator
       - The orchestrator runs asynchronously and updates the Run record in the database
       - Frontend polls `GET /api/runs/{id}` to check status

    IMPORTANT:
    - Do NOT use WebSocket here (that's Phase 4)
    - Background execution is fire-and-forget from the API perspective
    - The Run record in the database is the source of truth for status
    - Frontend will poll for updates until status is "completed" or "failed"
  </action>
  <verify>
    cd backend; ..\a_lab\Scripts\python.exe -c "from app.main import app; routes = [r.path for r in app.routes]; assert any('runs' in r for r in routes); print('Runs router OK')"
  </verify>
  <done>
    - Run schemas added (RunCreate, RunResponse, RunListResponse, RunLogResponse)
    - CRUD endpoints for runs implemented
    - POST /api/runs starts orchestrator in background
    - GET /api/runs/{id}/logs returns execution logs
    - Router wired into main.py
  </done>
</task>

## Success Criteria
- [ ] POST /api/runs creates a run and starts execution in background
- [ ] GET /api/runs lists all runs with pagination
- [ ] GET /api/runs/{id} returns run details with status
- [ ] GET /api/runs/{id}/logs returns execution logs
- [ ] DELETE /api/runs/{id} removes a run
- [ ] Build/import verification passes
