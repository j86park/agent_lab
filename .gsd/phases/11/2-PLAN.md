---
phase: 11
plan: 2
wave: 2
---

# Plan 11.2: Wave 2 - Structural Refactoring

Decompose monolithic Agent Editor and finalize backend service layer.

## Objective
Improve maintainability by splitting large files into domain-specific modules.

## Context
- frontend/src/pages/AgentEditorPage.tsx
- backend/app/routers/agents.py
- backend/app/services/agent_service.py

## Tasks

<task type="auto">
  <name>Refactor Agent Editor UI</name>
  <files>
    - frontend/src/pages/AgentEditorPage.tsx
    - frontend/src/components/agent-editor/
  </files>
  <action>
    - Create `frontend/src/components/agent-editor/` directory.
    - Extract sub-components:
        - `AgentBasicInfo`: Name, Description, Provider, Model.
        - `PromptEditor`: System prompt and variables table.
        - `ConstraintSettings`: Max tokens, budget, etc.
        - `WorkspaceMonitor`: File list and deletion.
    - Move logic into these components, using props for state and callbacks.
  </action>
  <verify>Open an agent in the UI and ensure all sections render and function (save/delete/run) as before.</verify>
  <done>AgentEditorPage.tsx is reduced to < 400 lines and leverages modular components.</done>
</task>

<task type="auto">
  <name>Extract Agent Service</name>
  <files>
    - backend/app/routers/agents.py
    - backend/app/services/agent_service.py
  </files>
  <action>
    - Create `backend/app/services/agent_service.py`.
    - Move `export_agent` logic (file generation) and workspace file operations (list/delete) into the service.
    - Routers should only handle HTTP concerns (Depends, HTTPException) and call the service for logic.
  </action>
  <verify>Perform an agent export and delete a workspace file via UI; verify both still work.</verify>
  <done>Business logic for agent management is in the service layer.</done>
</task>

## Success Criteria
- [ ] AgentEditorPage.tsx is significantly more readable.
- [ ] `agents.py` router is focused strictly on API routing.
