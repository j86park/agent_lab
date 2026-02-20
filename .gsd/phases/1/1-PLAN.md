---
phase: 1
plan: 1
wave: 1
---

# Plan 1.1: Backend Scaffold & Database Schema

## Objective
Create the FastAPI backend application with SQLAlchemy 2.0 async models, health endpoint, and Dockerfile. This gives us a running Python backend that can serve API requests and connect to SQLite.

## Context
- .gsd/SPEC.md
- .agent/skills/agent-lab-skills/SKILL.md

## Tasks

<task type="auto">
  <name>Create backend application structure</name>
  <files>
    backend/Dockerfile
    backend/requirements.txt
    backend/app/__init__.py
    backend/app/main.py
    backend/app/config.py
  </files>
  <action>
    Create the /backend directory with the following structure:

    backend/
    ├── Dockerfile
    ├── requirements.txt
    └── app/
        ├── __init__.py
        ├── main.py
        └── config.py

    1. **requirements.txt** — Pin major versions:
       - fastapi>=0.109.0
       - uvicorn[standard]>=0.27.0
       - sqlalchemy[asyncio]>=2.0.25
       - aiosqlite>=0.19.0
       - pydantic>=2.5.0
       - python-multipart>=0.0.6
       - cryptography>=42.0.0
       - docker>=7.0.0
       - openai>=1.10.0
       - anthropic>=0.18.0
       - websockets>=12.0
       - python-dotenv>=1.0.0

    2. **app/config.py** — Settings class using Pydantic BaseSettings:
       - DATA_DIR: Path = ~/.agent-lab (expanduser)
       - DATABASE_URL: str = sqlite+aiosqlite:///{DATA_DIR}/database.sqlite
       - HOST: str = 0.0.0.0
       - PORT: int = 8000
       - ensure_data_dirs() method that creates:
         ~/.agent-lab/
         ~/.agent-lab/agents/
         ~/.agent-lab/skills/
         ~/.agent-lab/runs/

    3. **app/main.py** — FastAPI app with:
       - Use lifespan context manager (NOT @app.on_event)
       - On startup: call ensure_data_dirs(), call init_db()
       - GET /health → {"status": "ok", "version": "0.1.0"}
       - CORS middleware allowing localhost:3000
       - Title: "Agent Lab API"

    4. **Dockerfile** — Multi-stage is overkill for dev; simple:
       - FROM python:3.11-slim
       - WORKDIR /app
       - COPY requirements.txt .
       - RUN pip install --no-cache-dir -r requirements.txt
       - COPY . .
       - CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
       - EXPOSE 8000

    IMPORTANT: Follow agent-lab-skills rules:
    - Use lifespan context manager, NOT @app.on_event
    - All routes are async def
    - Pydantic v2 style
  </action>
  <verify>
    cd backend && pip install -r requirements.txt && python -c "from app.main import app; print('OK')"
  </verify>
  <done>
    - FastAPI app imports without error
    - /health endpoint exists returning JSON
    - config.py has DATA_DIR and ensure_data_dirs()
    - Dockerfile builds successfully
  </done>
</task>

<task type="auto">
  <name>Create SQLAlchemy 2.0 async database models</name>
  <files>
    backend/app/database.py
    backend/app/models.py
  </files>
  <action>
    1. **app/database.py** — Async engine and session setup:
       - create_async_engine() with the DATABASE_URL from config
       - async_sessionmaker bound to engine
       - async def get_session() → AsyncGenerator[AsyncSession] (for FastAPI Depends)
       - async def init_db() → creates all tables via Base.metadata.create_all
       - Use run_sync for table creation since create_all is sync

    2. **app/models.py** — SQLAlchemy 2.0 models using Mapped[] and mapped_column():

       Agent model:
       - id: Mapped[str] (UUID, primary_key)
       - name: Mapped[str]
       - description: Mapped[Optional[str]]
       - system_prompt: Mapped[str]
       - tools_config: Mapped[str] (JSON string — list of enabled tools)
       - constraints_config: Mapped[str] (JSON string — max_tokens, timeout, budget)
       - provider: Mapped[str] (default "openai")
       - model: Mapped[str] (default "gpt-4o")
       - created_at: Mapped[datetime]
       - updated_at: Mapped[datetime]

       Skill model:
       - id: Mapped[str] (UUID, primary_key)
       - name: Mapped[str]
       - description: Mapped[Optional[str]]
       - instructions: Mapped[str] (the actual skill content/rules)
       - created_at: Mapped[datetime]
       - updated_at: Mapped[datetime]

       AgentSkill model (many-to-many junction):
       - agent_id: Mapped[str] (FK → agents.id)
       - skill_id: Mapped[str] (FK → skills.id)

       Run model:
       - id: Mapped[str] (UUID, primary_key)
       - agent_id: Mapped[str] (FK → agents.id)
       - task: Mapped[str] (user's task description)
       - status: Mapped[str] (pending, running, completed, failed)
       - cost: Mapped[Optional[float]]
       - total_tokens: Mapped[Optional[int]]
       - duration_seconds: Mapped[Optional[float]]
       - error_message: Mapped[Optional[str]]
       - created_at: Mapped[datetime]
       - completed_at: Mapped[Optional[datetime]]

       RunLog model:
       - id: Mapped[int] (auto-increment, primary_key)
       - run_id: Mapped[str] (FK → runs.id)
       - timestamp: Mapped[datetime]
       - level: Mapped[str] (info, warning, error, debug)
       - message: Mapped[str]
       - metadata_json: Mapped[Optional[str]] (JSON — extra data like token counts)

    IMPORTANT: Follow agent-lab-skills rules:
    - Use Mapped[] and mapped_column(), NOT Column()
    - Use DeclarativeBase, NOT declarative_base()
    - Use create_async_engine and async_sessionmaker
    - SQLite driver: sqlite+aiosqlite
  </action>
  <verify>
    cd backend && python -c "
from app.database import engine, init_db
from app.models import Agent, Skill, Run, RunLog, AgentSkill
import asyncio
asyncio.run(init_db())
print('All models created successfully')
"
  </verify>
  <done>
    - 5 tables created in SQLite: agents, skills, agent_skills, runs, run_logs
    - All models use Mapped[] / mapped_column() (2.0 style)
    - init_db() creates tables without error
    - get_session() yields AsyncSession
  </done>
</task>

## Success Criteria
- [ ] `python -c "from app.main import app"` succeeds
- [ ] Database tables created via init_db()
- [ ] Health endpoint returns `{"status": "ok"}`
- [ ] Dockerfile builds without error
