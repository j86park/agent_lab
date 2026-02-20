---
phase: 9
plan: 3
wave: 2
---

# Plan 9.3: Prompt Snippet UI Library

## Objective
Add a "Snippet Library" sidebar to the Agent Editor to facilitate reusable prompt injection.

## Context
- .gsd/phases/9/RESEARCH.md
- frontend/src/pages/AgentEditorPage.tsx
- frontend/src/components/PromptLibrary.tsx (NEW)

## Tasks

<task type="auto">
  <name>Snippet UI Component</name>
  <files>frontend/src/components/PromptLibrary.tsx</files>
  <action>
    Build a simple library UI that:
    - Fetches and displays available snippets.
    - Allows quick preview of snippet content.
    - Provides a button to "Insert at Cursor" into the system prompt.
  </action>
  <verify>Check component for list rendering and insertion logic.</verify>
  <done>PromptLibrary component is functional.</done>
</task>

<task type="auto">
  <name>Agent Editor Integration</name>
  <files>frontend/src/pages/AgentEditorPage.tsx</files>
  <action>
    Integrate the PromptLibrary as a sidecar/sidebar in the Agent Editor page. Ensure it interacts correctly with the main system prompt textarea.
  </action>
  <verify>Launch frontend and verify sidebar visibility and insertion functionality.</verify>
  <done>User can assemble prompts using library snippets.</done>
</task>

## Success Criteria
- [ ] Snippet Library visible in the Agent Editor.
- [ ] One-click insertion of snippets into the system prompt.
