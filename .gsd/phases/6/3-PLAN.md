---
phase: 6
plan: 3
wave: 1
---

# Plan 6.3: Technical Documentation

## Objective
Create three reference documents in `docs/`: a system architecture overview, an API reference, and a troubleshooting guide.

## Context
- .gsd/SPEC.md (tech stack, goals)
- backend/app/main.py (routers)
- backend/app/routers/ (all endpoints)
- backend/app/models.py (DB schema)
- docs/ (existing dir — has unrelated files, add new files)

## Tasks

<task type="auto">
  <name>Write docs/architecture.md</name>
  <files>
    docs/architecture.md
  </files>
  <action>
    Create `docs/architecture.md` with these sections:

    ## 1. Overview
    Brief description: Agent Lab is a local-first platform running as Docker Compose services.
    Local-only: SQLite, no cloud.

    ## 2. System Diagram (Mermaid)
    ```mermaid
    graph LR
        Browser["Browser\n(React + Vite)"]
        Backend["Backend\n(FastAPI)"]
        DB["SQLite DB"]
        Docker["Docker\n(Sandbox Containers)"]
        LLM["LLM Providers\n(OpenAI / Anthropic / OpenRouter / Ollama)"]

        Browser -- "HTTP REST" --> Backend
        Browser -- "WebSocket" --> Backend
        Backend -- "SQLAlchemy" --> DB
        Backend -- "Docker SDK" --> Docker
        Backend -- "API calls" --> LLM
    ```

    ## 3. Service Breakdown
    | Service | Port | Technology | Purpose |
    |---|---|---|---|
    | frontend | 5173 | React 18, Vite, shadcn/ui | Browser UI |
    | backend | 8000 | Python 3.11, FastAPI, SQLAlchemy | REST API + WebSocket |
    | sqlite | - | SQLite 3 | Persistent storage |

    ## 4. Directory Structure
    ```
    agent-lab/
    ├── backend/
    │   ├── app/
    │   │   ├── main.py           # FastAPI app + lifespan
    │   │   ├── models.py         # SQLAlchemy ORM models
    │   │   ├── schemas.py        # Pydantic request/response schemas
    │   │   ├── database.py       # Async session factory
    │   │   ├── config.py         # Settings (env vars)
    │   │   ├── routers/
    │   │   │   ├── agents.py     # CRUD + export
    │   │   │   ├── runs.py       # Run lifecycle
    │   │   │   ├── skills.py     # CRUD
    │   │   │   ├── settings.py   # API key management
    │   │   │   └── ws.py         # WebSocket log streaming
    │   │   └── services/
    │   │       ├── llm/          # LLM provider abstraction
    │   │       └── export_generators.py
    ├── frontend/
    │   ├── src/
    │   │   ├── App.tsx           # Routes
    │   │   ├── lib/api.ts        # HTTP client
    │   │   ├── pages/            # Page components
    │   │   └── components/       # Shared UI components
    └── docker-compose.yml
    ```

    ## 5. Data Model
    Brief description of main entities:
    - **Agent**: id, name, description, system_prompt, provider, model, tools_config, constraints_config
    - **Run**: id, agent_id, task, status (pending/running/completed/failed), cost, total_tokens, duration_seconds
    - **RunLog**: id, run_id, timestamp, level, message, metadata_json
    - **Skill**: id, name, description, instructions
    - **AgentSkill**: agent_id + skill_id (many-to-many)

    ## 6. Real-Time Streaming
    How WebSocket log streaming works:
    1. Frontend opens `ws://localhost:8000/ws/runs/{run_id}`
    2. Backend sends initial batch of existing logs on connect
    3. Backend polls DB every 1 second for new logs → sends as `{type: "log", data: ...}`
    4. On completion/failure: sends `{type: "status", run: ...}` then closes

    ## 7. Security
    - API keys stored encrypted using `cryptography` Fernet
    - No API keys ever returned in API responses
    - All data stays local — no external analytics, no cloud sync
    - Docker sandbox containers are ephemeral and resource-limited
  </action>
  <verify>
    Test-Path "docs/architecture.md" | Write-Host
    (Get-Item "docs/architecture.md").Length | Write-Host
  </verify>
  <done>
    - docs/architecture.md exists and is >2KB
    - Has system diagram (mermaid), directory structure, data model sections
  </done>
</task>

<task type="auto">
  <name>Write docs/api-reference.md and docs/troubleshooting.md</name>
  <files>
    docs/api-reference.md
    docs/troubleshooting.md
  </files>
  <action>
    ### docs/api-reference.md
    Document all REST + WebSocket endpoints. Structure:

    **Base URL**: `http://localhost:8000`

    #### Agents
    | Method | Path | Description |
    |---|---|---|
    | GET | /api/agents | List agents (skip, limit query params) |
    | POST | /api/agents | Create agent |
    | GET | /api/agents/{id} | Get agent by ID |
    | PUT | /api/agents/{id} | Update agent |
    | DELETE | /api/agents/{id} | Delete agent |
    | GET | /api/agents/{id}/export?format=python\|fastapi\|docker | Export agent as code |

    For each endpoint, include:
    - Request body schema (for POST/PUT): field names and types
    - Response schema: field names and types
    - Example request+response in JSON code block

    #### Runs
    | Method | Path | Description |
    |---|---|---|
    | POST | /api/runs | Start a run (agent_id, task) |
    | GET | /api/runs | List runs (agent_id?, skip, limit) |
    | GET | /api/runs/{id} | Get run by ID |
    | GET | /api/runs/{id}/logs | Get all logs for a run |
    | DELETE | /api/runs/{id} | Delete run and logs |

    #### Skills
    | Method | Path | Description |
    |---|---|---|
    | GET | /api/skills | List skills |
    | POST | /api/skills | Create skill |
    | GET | /api/skills/{id} | Get skill |
    | PUT | /api/skills/{id} | Update skill |
    | DELETE | /api/skills/{id} | Delete skill |

    #### Settings
    | Method | Path | Description |
    |---|---|---|
    | GET | /api/settings | Get API key status (not the keys themselves) |
    | PUT | /api/settings | Set API keys |

    #### WebSocket
    **URL**: `ws://localhost:8000/ws/runs/{run_id}`
    Document message types: `log`, `status`, `error` with JSON schemas.

    #### Other
    | Method | Path | Description |
    |---|---|---|
    | GET | /health | Health check |
    | GET | /docs | Swagger UI (auto-generated) |

    Note: Full interactive API docs available at http://localhost:8000/docs

    ---

    ### docs/troubleshooting.md
    Common issues and solutions:

    **1. Backend won't start**
    - Symptom: `uvicorn` exits immediately
    - Fix: Check `backend/.env` has SECRET_KEY set; run `docker compose logs backend`

    **2. "API key not set" error when running an agent**
    - Fix: Go to Settings → enter key for your chosen provider → Save

    **3. WebSocket connection refused on Run Dashboard**
    - Symptom: Log stream shows "Connection failed"
    - Fix: Ensure backend is running at port 8000. Check `docker compose ps`.

    **4. Agent run fails immediately with "provider not found"**
    - Fix: Check the agent's provider matches an API key you've configured in Settings.

    **5. Frontend shows blank white page**
    - Fix: Open browser DevTools console for error. Ensure `npm run dev` is running (dev) or Vite build succeeded.

    **6. Docker Compose port conflict**
    - Symptom: `address already in use` on port 8000 or 5173
    - Fix: Stop conflicting services or edit `docker-compose.yml` to use different ports.

    **7. "Docker daemon not running"**
    - Fix: Start Docker Desktop application and wait for it to fully initialize (whale icon in taskbar should be solid, not animated).

    **8. Database migration issues**
    - Agent Lab uses SQLAlchemy with `create_all` on startup. If schema changes cause errors: `docker compose down -v` (removes volumes) then `docker compose up` to recreate.

    **9. Viewing logs**
    ```bash
    docker compose logs backend    # Backend logs
    docker compose logs frontend   # Frontend logs
    docker compose logs -f         # Follow all logs
    ```

    **10. Resetting everything**
    ```bash
    docker compose down -v    # Stop and remove volumes (data will be lost)
    docker compose up         # Fresh start
    ```
  </action>
  <verify>
    Test-Path "docs/api-reference.md" | Write-Host
    Test-Path "docs/troubleshooting.md" | Write-Host
  </verify>
  <done>
    - docs/api-reference.md covers all endpoints with schemas
    - docs/troubleshooting.md covers 10 common issues
    - Both files > 1KB
  </done>
</task>

## Success Criteria
- [ ] docs/architecture.md with system diagram, directory tree, data model
- [ ] docs/api-reference.md with all endpoints documented
- [ ] docs/troubleshooting.md with 10 common issues + solutions
