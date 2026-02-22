# Summary: Plan 9.1 — Core Models & Schemas

## Changes Made
### Backend Models
- Defined `TestSuite` model for grouping test cases.
- Defined `TestCase` model for individual test protocols (task, behavior, rubric).
- Defined `PromptSnippet` model for reusable prompt components.
- Extended `Run` model with:
  - `test_case_id` for tracking run origin.
  - `eval_score` and `eval_feedback` for storing judge results.
- Established relationships: `Agent -> TestSuites -> TestCases -> Runs`.

### Backend Schemas
- Implemented Pydantic schemas for `TestSuite`, `TestCase`, and `PromptSnippet` (Base, Create, Update, Response).
- Updated `RunCreate` to accept optional `test_case_id`.
- Updated `RunResponse` to include evaluation fields and `test_case_id`.

## Verification Results
- Backend start test: **PASSED**. The application initializes `fastapi` and `sqlalchemy` without schema validation or relationship errors.
