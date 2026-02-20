---
phase: 9
plan: 2
wave: 1
---

# Plan 9.2: Prompt Snippet Backend & API

## Objective
Implement CRUD endpoints for managing reusable prompt blocks (Snippets).

## Context
- .gsd/phases/9/RESEARCH.md
- backend/app/routers/snippets.py (NEW)
- backend/app/main.py

## Tasks

<task type="auto">
  <name>Snippets Router</name>
  <files>backend/app/routers/snippets.py</files>
  <action>
    Create a new router for PromptSnippet CRUD:
    - POST /api/snippets: Create a snippet.
    - GET /api/snippets: List snippets.
    - GET /api/snippets/{id}: Get snippet details.
    - PUT /api/snippets/{id}: Update a snippet.
    - DELETE /api/snippets/{id}: Delete a snippet.
  </action>
  <verify>Run the backend and check if the router is accessible.</verify>
  <done>Router implements full CRUD for PromptSnippet.</done>
</task>

<task type="auto">
  <name>App Integration</name>
  <files>backend/app/main.py</files>
  <action>
    Register the snippets router in the main FastAPI application.
  </action>
  <verify>Check /docs for the new "snippets" group.</verify>
  <done>API endpoints are live.</done>
</task>

## Success Criteria
- [ ] Prompt Snippets can be created, updated, and deleted via API.
- [ ] API endpoints are documented in Swagger (/docs).
