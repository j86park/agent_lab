# Summary: Plan 9.6 — Batch Execution Service

## Changes Made
### Backend Service & API
- Created `backend/app/services/test_suite_service.py`:
    - `execute_test_suite`: Iterates through all test cases in a suite and creates a `Run` record for each.
    - `run_suite_background`: Background wrapper that triggers the `AgentOrchestrator` for each run in the batch.
- Updated `backend/app/routers/test_suites.py`:
    - Added `POST /api/suites/{suite_id}/run` to trigger the batch execution.
    - Uses FastAPI `BackgroundTasks` for non-blocking execution.

### Frontend Integration
- Updated `frontend/src/lib/api.ts`:
    - Added `runSuite(id)` method to the `suiteApi` client.
- Updated `frontend/src/pages/TestSuiteDetailsPage.tsx`:
    - Wired the "Run Batch" button to the new API endpoint.
    - Added loading state and success/error toasts for the batch operation.
    - Disabled the button if a batch is already running or if no test cases exist.

## Verification Results
- Backend API: **VERIFIED**. Endpoint correctly spawns background runs.
- Orchestration: **VERIFIED**. Each run in the batch correctly triggers the `AgentOrchestrator`.
- Frontend: **VERIFIED**. "Run Batch" button triggers the execution and shows feedback.
