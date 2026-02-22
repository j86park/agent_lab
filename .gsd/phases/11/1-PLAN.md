---
phase: 11
plan: 1
wave: 1
---

# Plan 11.1: Wave 1 - Consolidation & Safety

Establish a service layer for prompt logic and consolidate frontend utilities.

## Objective
Reduce logic leakage in routers and standardize frontend error handling to prepare for structural refactors.

## Context
- backend/app/routers/runs.py
- backend/app/routers/agents.py
- frontend/src/lib/utils.ts

## Tasks

<task type="auto">
  <name>Extract Prompt Service</name>
  <files>
    - backend/app/services/prompt_service.py
    - backend/app/routers/runs.py
    - backend/app/routers/agents.py
  </files>
  <action>
    - Create `backend/app/services/prompt_service.py`.
    - Move `_resolve_prompt` from `runs.py` into the service.
    - Implement a unified `get_resolved_system_prompt(agent_id, session, variable_values)` in the service that uses `build_system_prompt` and then resolves variables.
    - Update `runs.py` and `agents.py` to use these high-level service functions.
  </action>
  <verify>Run a test run with variables and verify the prompt is correctly resolved in logs.</verify>
  <done>Prompt resolution logic is centralized and removed from routers.</done>
</task>

<task type="auto">
  <name>Standardize Frontend Utils</name>
  <files>
    - frontend/src/lib/utils.ts
    - frontend/src/lib/api.ts
  </files>
  <action>
    - Add a `getErrorMessage(error: unknown): string` utility to `utils.ts` to safely extract messages from catch blocks.
    - Update `api.ts` to export common error interfaces.
    - (Refactor) Replace at least 5 instances of `catch (err: any)` with safe utility calls in `lib/api.ts` and `pages/HomePage.tsx`.
  </action>
  <verify>npm run build passes with no new type errors.</verify>
  <done>Basic error handling is type-safe and reusable.</done>
</task>

## Success Criteria
- [ ] No variable resolution logic remains in the routers.
- [ ] Frontend uses `getErrorMessage` utility for common catch blocks.
