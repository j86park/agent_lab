---
phase: 10
plan: 1
wave: 1
---

# Plan 10.1: Live Prompt Preview

Provide real-time visibility into the final system prompt sent to the LLM (resolved variables + skills).

## Objective
Enable developers to see exactly what the LLM will receive, preventing issues with skill conflicts or variable resolution before running.

## Context
- .gsd/SPEC.md
- backend/app/routers/agents.py
- backend/app/services/skills_injector.py
- frontend/src/pages/AgentEditorPage.tsx

## Tasks

<task type="auto">
  <name>Add Backend Preview Endpoint</name>
  <files>
    - backend/app/routers/agents.py
  </files>
  <action>
    - Implement `GET /api/agents/{agent_id}/preview` endpoint.
    - Path parameter: `agent_id: str`.
    - Logic: Use `app.services.skills_injector.build_system_prompt(agent_id, session)` to get the combined prompt.
    - Return structure: `{"prompt": str}`.
  </action>
  <verify>curl -X GET http://localhost:8000/api/agents/{test_agent_id}/preview</verify>
  <done>Endpoint returns a string containing both the base prompt and any attached skills.</done>
</task>

<task type="auto">
  <name>Implement Prompt Preview UI</name>
  <files>
    - frontend/src/pages/AgentEditorPage.tsx
    - frontend/src/lib/api.ts
  </files>
  <action>
    - Update `api.ts` to include `getPromptPreview(agentId: string)`.
    - In `AgentEditorPage.tsx`, add a "Preview" tab or a side-sheet to the Prompt editor section.
    - When opened, fetch the preview from the backend and display it in a read-only, syntax-highlighted (or mono-font) area.
    - Ensure it updates when the agent description or attached skills change (local refresh).
  </action>
  <verify>Open Agent Editor, click Preview, and see the merged prompt.</verify>
  <done>User can read the full, resolved system prompt in the UI.</done>
</task>

## Success Criteria
- [ ] Backend provides a merged prompt string via API.
- [ ] Frontend displays the merged prompt in the Agent Editor flow.
