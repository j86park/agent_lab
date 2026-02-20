---
phase: 2
plan: 1
wave: 1
---

# Plan 2.1: Agent CRUD API

## Objective
Create the full Agent CRUD REST API — Pydantic schemas, APIRouter, and all endpoints — so the frontend can create, read, update, delete, and list agents. This is the core backend for Phase 2.

## Context
- .gsd/SPEC.md
- .agent/skills/agent-lab-skills/SKILL.md
- backend/app/models.py
- backend/app/database.py
- backend/app/main.py

## Tasks

<task type="auto">
  <name>Create Pydantic schemas for Agent API</name>
  <files>
    backend/app/schemas.py
  </files>
  <action>
    Create `backend/app/schemas.py` with Pydantic v2 models:

    1. **AgentCreate** — Request body for creating an agent:
       - name: str (required, non-empty)
       - description: Optional[str] = None
       - system_prompt: str = ""
       - tools_config: str = "[]" (JSON string)
       - constraints_config: str = "{}" (JSON string)
       - provider: str = "openai"
       - model: str = "gpt-4o"

    2. **AgentUpdate** — Request body for updating (all fields optional):
       - name: Optional[str] = None
       - description: Optional[str] = None
       - system_prompt: Optional[str] = None
       - tools_config: Optional[str] = None
       - constraints_config: Optional[str] = None
       - provider: Optional[str] = None
       - model: Optional[str] = None

    3. **AgentResponse** — Response model:
       - id: str
       - name: str
       - description: Optional[str]
       - system_prompt: str
       - tools_config: str
       - constraints_config: str
       - provider: str
       - model: str
       - created_at: datetime
       - updated_at: datetime
       - model_config = ConfigDict(from_attributes=True)

    4. **AgentListResponse** — Paginated list:
       - agents: list[AgentResponse]
       - total: int

    IMPORTANT: Use Pydantic v2 style:
    - `field_validator` NOT `@validator`
    - `ConfigDict(from_attributes=True)` NOT `class Config: orm_mode = True`
    - Add `name_not_empty` validator on AgentCreate.name
  </action>
  <verify>
    cd backend && python -c "from app.schemas import AgentCreate, AgentUpdate, AgentResponse, AgentListResponse; print('Schemas OK')"
  </verify>
  <done>
    - All 4 schema classes importable
    - AgentCreate validates non-empty name
    - AgentResponse has from_attributes=True
  </done>
</task>

<task type="auto">
  <name>Create Agent CRUD router and wire to app</name>
  <files>
    backend/app/routers/__init__.py
    backend/app/routers/agents.py
    backend/app/main.py
  </files>
  <action>
    1. Create `backend/app/routers/__init__.py` (empty file).

    2. Create `backend/app/routers/agents.py` with an APIRouter:
       - Prefix: `/api/agents`
       - Tags: `["agents"]`

       Endpoints:
       - `POST /api/agents` → Create agent
         - Accept AgentCreate body
         - Generate UUID, create Agent model instance, add to session, commit
         - Return AgentResponse with status_code=201

       - `GET /api/agents` → List all agents
         - Query params: skip (int, default=0), limit (int, default=50)
         - Return AgentListResponse with total count

       - `GET /api/agents/{agent_id}` → Get single agent
         - Return AgentResponse
         - 404 if not found: `{"error": "Agent not found"}`

       - `PUT /api/agents/{agent_id}` → Update agent
         - Accept AgentUpdate body
         - Only update fields that are not None
         - Return AgentResponse
         - 404 if not found

       - `DELETE /api/agents/{agent_id}` → Delete agent
         - Return 204 No Content
         - 404 if not found

       All endpoints:
       - Use `async def`
       - Use `Depends(get_session)` for database session
       - Use SQLAlchemy 2.0 query style: `select()`, `session.execute()`
       - Use `session.scalar()` for single results
       - Use `func.count()` for total count in list endpoint

    3. Update `backend/app/main.py`:
       - Import the agents router
       - Add `app.include_router(agents_router)`
  </action>
  <verify>
    cd backend && python -c "
from app.main import app
routes = [r.path for r in app.routes]
assert '/api/agents' in routes or '/api/agents/' in routes, f'Missing agents route. Routes: {routes}'
print('Router wired OK')
"
  </verify>
  <done>
    - 5 CRUD endpoints accessible under /api/agents
    - Router included in main app
    - All endpoints use async and SQLAlchemy 2.0 style
  </done>
</task>

## Success Criteria
- [ ] `POST /api/agents` creates an agent and returns 201
- [ ] `GET /api/agents` returns a list with total count
- [ ] `GET /api/agents/{id}` returns a single agent or 404
- [ ] `PUT /api/agents/{id}` updates fields and returns updated agent
- [ ] `DELETE /api/agents/{id}` deletes and returns 204
