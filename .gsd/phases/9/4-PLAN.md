---
phase: 9
plan: 4
wave: 1
---

# Plan 9.4: Test Suite Backend & API

## Objective
Implement the backend structure and API for managing Test Suites and Test Cases.

## Context
- .gsd/phases/9/RESEARCH.md
- backend/app/routers/test_suites.py (NEW)
- backend/app/main.py

## Tasks

<task type="auto">
  <name>Test Suite Router</name>
  <files>backend/app/routers/test_suites.py</files>
  <action>
    Implement CRUD for TestSuite and TestCase:
    - POST /api/suites: Create suite.
    - GET /api/suites: List suites (optionally by agent_id).
    - DELETE /api/suites/{id}: Delete suite.
    - POST /api/suites/{id}/cases: Create test case.
    - GET /api/suites/{id}/cases: List cases.
    - DELETE /api/cases/{id}: Delete test case.
  </action>
  <verify>Check API endpoints in /docs.</verify>
  <done>Full CRUD for Test Suites and Cases is available via API.</done>
</task>

<task type="auto">
  <name>App Integration</name>
  <files>backend/app/main.py</files>
  <action>
    Register the test_suites router in the main application.
  </action>
  <verify>Verify router registration.</verify>
  <done>API endpoints are live.</done>
</task>

## Success Criteria
- [ ] Test suites can be created and managed via API.
- [ ] Test cases can be assigned to suites.
