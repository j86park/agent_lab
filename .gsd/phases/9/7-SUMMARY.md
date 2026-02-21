# Summary: Plan 9.7 — LLM-as-a-Judge Evaluation

## Changes Made
### Evaluation Service
- Created `backend/app/services/evaluator.py`:
    - `EvaluationService`: Uses OpenRouter (`openai/gpt-4o-mini`) to grade agent runs against test case tasks, expectations, and rubrics.
    - Returns a score (0.0 to 1.0) and detailed feedback.
- Updated `backend/app/config.py`:
    - Added `OPENROUTER_API_KEY` property with fallback to `os.getenv("OPENROUTER_KEY")` to support unprefixed environment variables for local testing.
- Updated `backend/app/services/llm/openrouter_provider.py`:
    - Fixed API key loading to support the new config property as a fallback.
- Updated `backend/app/services/llm/openai_provider.py`:
    - Fixed `chat()` method to correctly pass additional keyword arguments (like `response_format`) to the underlying OpenAI client.
- **Dependency Fix**: Downgraded `httpx` to `0.27.2` to resolve a library incompatibility with `openai` that was causing `TypeError: AsyncClient.__init__() got an unexpected keyword argument 'proxies'`.

### Orchestrator Integration
- Updated `backend/app/services/orchestrator.py`:
    - Integrated `EvaluationService` into the `execute_run` loop.
    - If a run has an associated `test_case_id`, it is automatically graded after completion.
    - Results (`eval_score`, `eval_feedback`) are persisted to the `Run` record.

## Verification Results
- **Library Compatibility**: **VERIFIED**. `openai` client now initializes correctly with `httpx 0.27.2`.
- **Evaluation Logic**: **VERIFIED**. Tested with a mock run via a script; generated a perfect 1.0 score and accurate feedback for a circle area calculation task.
- **Asynchronous Execution**: **VERIFIED**. Evaluation runs immediately following the completion of the main agent loop within the same background task.
