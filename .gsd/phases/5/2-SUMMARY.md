# Plan 5.2 Summary: Export Generators + Export Dialog

## Changes Made

### New: `backend/app/services/export_generators.py`
Three generator functions, each accepting an `Agent` ORM object:
- **`generate_python_script(agent)`** — Standalone CLI script; reads API key from env var, calls OpenAI-compatible API, `if __name__ == "__main__"` entrypoint
- **`generate_fastapi_app(agent)`** — Full FastAPI server with `POST /chat` + `GET /health`, pydantic request/response models
- **`generate_dockerfile(agent)`** — Dockerfile targeting `agent_app.py`, with layer-cached deps, HEALTHCHECK, and CMD

Provider-aware: maps `openai/anthropic/openrouter` → correct env var name and base URL.

### Modified: `backend/app/routers/agents.py`
- Imported the 3 generators
- Added `GET /api/agents/{id}/export?format=python|fastapi|docker` endpoint
- Returns `{ filename, content, format }` JSON
- 400 on unknown format, 404 if agent not found

### Modified: `frontend/src/lib/api.ts`
- Added `agentApi.exportAgent(id, format)` method

### Modified: `frontend/src/pages/AgentEditorPage.tsx`
- Added `Download` icon import
- Added `exportFormat`, `isExporting`, `exportOpen` state
- Added `handleExport()` — fetches content, creates `<a>` download link, triggers click
- Added Export dialog in header (Edit mode only):
  - 3-card format picker (Python Script / FastAPI App / Dockerfile)
  - "Includes" section that updates based on format
  - Download button with loading state

## Verification

```
TypeScript OK — npx tsc --noEmit passed
Python import OK — from app.services.export_generators import ... OK
```
