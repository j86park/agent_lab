---
phase: 5
plan: 2
wave: 1
---

# Plan 5.2: Agent Export Generators + Export UI

## Objective
Add backend export generators that produce standalone Python scripts, FastAPI apps, and Dockerfiles from an agent configuration. Add an export dialog in the Agent Editor page.

## Context
- .gsd/SPEC.md
- backend/app/routers/agents.py
- backend/app/models.py (Agent model)
- frontend/src/pages/AgentEditorPage.tsx
- frontend/src/lib/api.ts

## Tasks

<task type="auto">
  <name>Backend export endpoint with 3 generators</name>
  <files>
    backend/app/services/export_generators.py
    backend/app/routers/agents.py
  </files>
  <action>
    1. Create `backend/app/services/export_generators.py` with 3 generators:

    **`generate_python_script(agent: Agent) -> str`**:
    - Returns a standalone `.py` file using the `openai` package
    - Includes the system prompt, model, provider base URL
    - Reads API key from environment variable
    - Simple CLI: `python agent.py "your task here"`
    - Template as a Python string with f-string substitution

    **`generate_fastapi_app(agent: Agent) -> str`**:
    - Returns a FastAPI app with a single `/chat` POST endpoint
    - Uses the agent's provider/model/system prompt
    - Includes requirements.txt content as a comment at the top
    - Reads API key from environment variable

    **`generate_dockerfile(agent: Agent) -> str`**:
    - Returns a Dockerfile that packages the FastAPI app
    - FROM python:3.11-slim
    - Copies the generated FastAPI app
    - Installs dependencies, exposes port 8000
    - CMD to run uvicorn

    2. Add export endpoint to `agents.py`:
       ```python
       @router.get("/api/agents/{agent_id}/export")
       async def export_agent(agent_id: str, format: str = "python"):
           """Export an agent as standalone code.
           format: "python" | "fastapi" | "docker"
           """
       ```
       - Returns `{"filename": "...", "content": "...", "format": "..."}`
       - Validate format param, 400 for unknown formats
       - Fetch agent from DB, 404 if not found

    IMPORTANT:
    - Templates should be clean, well-commented, production-quality code
    - Use triple-quoted strings for templates (not Jinja)
    - API key should use env vars (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)
    - For OpenRouter, set base_url in the template
  </action>
  <verify>
    cd backend; ..\a_lab\Scripts\python.exe -c "from app.services.export_generators import generate_python_script, generate_fastapi_app, generate_dockerfile; print('Import OK')"
  </verify>
  <done>
    - 3 export generators produce valid Python code
    - GET /api/agents/{id}/export endpoint returns generated code
    - Import check passes
  </done>
</task>

<task type="auto">
  <name>Export dialog in Agent Editor</name>
  <files>
    frontend/src/lib/api.ts
    frontend/src/pages/AgentEditorPage.tsx
  </files>
  <action>
    1. Add `exportAgent` method to `agentApi` in `api.ts`:
       ```typescript
       exportAgent: (id: string, format: string) =>
           fetchApi<{ filename: string; content: string; format: string }>(
               `/api/agents/${id}/export?format=${format}`
           ),
       ```

    2. Add an "Export" button next to the Save/Delete buttons in `AgentEditorPage.tsx`:
       - Only visible for saved agents (edit mode)
       - Clicking it opens a Dialog with 3 export format options:
         - "Python Script" — standalone CLI tool
         - "FastAPI App" — deployable REST API
         - "Docker Container" — containerized service
       - Each option is a card/button
       - On format selection: call `agentApi.exportAgent(id, format)`
       - Show the generated code in a syntax-highlighted code block (monospace pre block)
       - Two action buttons: "Copy to Clipboard" and "Download as File"
       - Copy uses `navigator.clipboard.writeText()`
       - Download creates a Blob and triggers download with appropriate filename

    IMPORTANT:
    - Use shadcn/ui Dialog, Button
    - Code display in a scrollable pre/code block with dark bg
    - Keep it simple — no live editing of the export, just display + copy/download
    - Add Download icon from lucide-react
  </action>
  <verify>
    cd frontend; npx tsc --noEmit 2>&1 | findstr /C:"error" || echo "TypeScript OK"
  </verify>
  <done>
    - Export button visible on saved agents
    - Dialog shows 3 format options
    - Generated code displayed with copy/download actions
    - Build passes
  </done>
</task>

## Success Criteria
- [ ] 3 export generators produce valid standalone code
- [ ] GET /api/agents/{id}/export endpoint works
- [ ] Export dialog in Agent Editor with copy + download
- [ ] TypeScript compiles cleanly
