---
phase: 9
plan: 6
wave: 1
---

# Plan 9.6: Batch Execution Service

## Objective
Implement the orchestration logic to run an entire test suite as a batch of background runs.

## Context
- .gsd/phases/9/RESEARCH.md
- backend/app/services/test_suite_service.py (NEW)
- backend/app/routers/test_suites.py

## Tasks

<task type="auto">
  <name>Test Suite Execution Service</name>
  <files>backend/app/services/test_suite_service.py</files>
  <action>
    Implement logic to:
    - Load a suite and its cases.
    - Create a Run for each case, marking it with the test_case_id.
    - Trigger AgentOrchestrator for all runs asynchronously.
  </action>
  <verify>Write a temporary script to trigger a suite execution and check if runs appear in DB.</verify>
  <done>Batch execution logic works as intended.</done>
</task>

<task type="auto">
  <name>Execution Endpoint</name>
  <files>backend/app/routers/test_suites.py</files>
  <action>
    Add POST /api/suites/{id}/run endpoint to trigger the Batch Execution Service.
  </action>
  <verify>Trigger the run from the API and monitor history.</verify>
  <done>Batch execution can be triggered via API.</done>
</task>

## Success Criteria
- [ ] One click in the API (or UI later) triggers multiple agent runs.
- [ ] Each run is correctly linked to its respective test case.
