---
phase: 9
plan: 7
wave: 1
---

# Plan 9.7: LLM-as-a-Judge Evaluation

## Objective
Implement the automated evaluation service that judges agent outputs against test case rubrics.

## Context
- .gsd/phases/9/RESEARCH.md
- backend/app/services/evaluator.py (NEW)
- backend/app/services/orchestrator.py

## Tasks

<task type="auto">
  <name>Evaluation Service</name>
  <files>backend/app/services/evaluator.py</files>
  <action>
    Implement an `EvaluationService` that:
    - Uses a lightweight model (e.g. gpt-4o-mini).
    - Takes `logs`, `expected_behavior`, and `rubric`.
    - Returns a score (float) and feedback (text).
    - Handles JSON format for consistent parsing.
  </action>
  <verify>Test the service with mock inputs and verify score/feedback output.</verify>
  <done>Judge mechanism is accurate and robust.</done>
</task>

<task type="auto">
  <name>Orchestrator Hook</name>
  <files>backend/app/services/orchestrator.py</files>
  <action>
    Modify `execute_run` to check if `run.test_case_id` is present. If so, call the `EvaluationService` after the completion of the main run loop and persist the results.
  </action>
  <verify>Run a test case and verify that eval_score and eval_feedback are populated in the DB.</verify>
  <done>Runs are automatically evaluated upon completion.</done>
</task>

## Success Criteria
- [ ] Completed test runs contain automated scores and detailed feedback.
- [ ] Evaluation is performed asynchronously after the main run.
