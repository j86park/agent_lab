# Research: Phase 9 — Testing & Evaluation + Agent Building QoL

## 1. Test Suites & Test Cases

### Proposed Schema
- **TestSuite**: Container for test cases targeting a specific agent.
  - `id` (UUID)
  - `agent_id` (FK agents.id)
  - `name` (String)
  - `description` (Text, optional)
- **TestCase**: Individual test definition.
  - `id` (UUID)
  - `suite_id` (FK test_suites.id)
  - `task` (Text) — Identical to `Run.task`
  - `expected_behavior` (Text) — Rubric or target answer
  - `rubric` (Text, optional) — Explicit criteria for the judge LLM

### Integration with Runs
- Add `test_case_id` (FK) to the `Run` model to track which test case triggered the run.
- Add `eval_score` (Float/Int) and `eval_feedback` (Text) to `Run` for storing judge results.

### Batch Execution Logic
- New service method `execute_test_suite(suite_id)`:
  - Loads all test cases.
  - For each case, creates a `Run` with `test_case_id`.
  - Queues all runs in background tasks.

## 2. Auto-Eval (LLM-as-a-Judge)

### Mechanism
- After a `Run` completes (if it has a `test_case_id`), trigger an `EvaluationService`.
- **Judge Prompt**: Use a lightweight model (e.g., GPT-4o-mini or Claude 3 Haiku) to compare `Run.logs` (final answer) against `TestCase.expected_behavior` using `TestCase.rubric`.
- **Output Schema**: JSON `{ "score": 1/0, "feedback": "reasoning..." }`.

## 3. Prompt Library (Snippets)

### Model: `PromptSnippet`
- `id` (UUID)
- `name` (String)
- `content` (Text)
- *Note: Unlike Skills, these aren't "assigned" to agents in the DB. They are a library for the UI to facilitate prompt engineering.*

### UI Integration
- Library sidecar in `AgentEditorPage`.
- "Insert at cursor" functionality for the system prompt textarea.

## 4. Risks & Considerations
- **Concurrency**: Running a large suite (e.g., 20 tests) might saturate Docker resources or LLM rate limits. Needs a pool/semaphore in `AgentOrchestrator`?
- **Cost**: Batch testing will consume significant tokens. UI should warn about estimated cost.
- **Judge Reliability**: LLM-as-a-judge can be inconsistent. Needs a well-defined system prompt for the judge.
