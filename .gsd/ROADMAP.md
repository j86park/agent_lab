# ROADMAP.md

> **Current Phase**: Not started
> **Milestone**: v1.0 — MVP

## Must-Haves (from SPEC)

- [ ] Docker Compose one-command deployment
- [ ] Agent configuration UI (prompt, tools, constraints, file upload)
- [ ] Sandboxed agent execution in Docker containers
- [ ] Multi-provider LLM support (OpenAI, Anthropic, OpenRouter, Ollama)
- [ ] Real-time log streaming via WebSocket
- [ ] Run history with filtering
- [ ] Side-by-side run comparison
- [ ] Export (Python script, FastAPI app, Docker container)
- [ ] Built-in templates
- [ ] Modular Skills system (GSD pattern)
- [ ] Cost and token tracking

---

## Phases

### Phase 1: Project Scaffolding & Infrastructure
**Status**: ✅ Complete
**Objective**: Set up the monorepo structure, Docker Compose orchestration, database schema, and development environment so all subsequent phases have a working foundation.
**Requirements**: REQ-01, REQ-04, REQ-23, REQ-24, REQ-25

**Deliverables**:
- `/backend` — FastAPI app skeleton with health endpoint
- `/frontend` — React+Vite+shadcn/ui scaffold with routing shell
- `docker-compose.yml` — Backend, frontend, and volumes wired up
- SQLite database with SQLAlchemy models (Agents, Runs, RunLogs)
- `~/.agent-lab/` directory structure initialization
- Development hot-reload working for both services

---

### Phase 2: Agent Configuration & Persistence
**Status**: ✅ Complete
**Objective**: Build the full agent CRUD system — backend API + frontend UI — so users can create, edit, save, and load agent configurations.
**Requirements**: REQ-02, REQ-03, REQ-05, REQ-22

**Deliverables**:
- Agent CRUD REST endpoints (create, read, update, delete, list)
- Settings endpoints for API key management (encrypted storage)
- Agent Editor page: system prompt editor, tool selector, constraint settings, file upload, skill selection
- Agent List page (home)
- Skills library: CRUD endpoints and UI for reusable instruction blocks
- Save/load agent configurations to `~/.agent-lab/agents/` and skills to `~/.agent-lab/skills/`

---

### Phase 3: Sandbox Execution Engine
**Status**: ⬜ Not Started
**Objective**: Build the core execution engine — Docker sandbox creation, agent code generation, LLM API integration, and tool execution within containers.
**Requirements**: REQ-06, REQ-07, REQ-08, REQ-09, REQ-10, REQ-11, REQ-19, REQ-20

**Deliverables**:
- Sandbox manager: create/destroy Docker containers with resource limits
- Agent orchestrator: generate agent code from config, execute in sandbox
- LLM provider abstraction (OpenAI, Anthropic, OpenRouter, Ollama)
- Skill Injection Engine: merging skill instructions into the system prompt
- Tool executors: file operations + code execution inside sandbox
- Retry logic with exponential backoff
- Cost and token tracking per run

---

### Phase 4: Real-Time Observability & Run Dashboard
**Status**: ⬜ Not Started
**Objective**: Build the real-time execution experience — log streaming, run dashboard, cost counters, and execution timeline.
**Requirements**: REQ-12, REQ-14

**Deliverables**:
- WebSocket endpoint for log streaming
- Run Dashboard page: start run, live logs, cost/token counters, execution timeline
- Success/failure indicators with error messages
- Real-time cost accumulator
- Run status management (pending → running → completed/failed)

---

### Phase 5: History, Comparison & Export
**Status**: ⬜ Not Started
**Objective**: Build run history persistence, side-by-side comparison, and agent export capabilities.
**Requirements**: REQ-13, REQ-15, REQ-16, REQ-17, REQ-18, REQ-21

**Deliverables**:
- Run history page with filters (agent, date, status)
- Detailed run view (replay logs, view artifacts)
- Side-by-side comparison of two runs
- Export generators: Python script, FastAPI app, Docker container
- Export dialog UI with download/copy
- 3 built-in templates (Q&A Agent, Code Helper, Data Analyst)

---

### Phase 6: Polish, Documentation & Launch Prep
**Status**: ⬜ Not Started
**Objective**: Harden error handling, polish UI/UX, write documentation, and prepare for public release.
**Requirements**: REQ-25

**Deliverables**:
- Comprehensive error handling and user-friendly error messages
- UI polish: responsive design, loading states, empty states, theme
- `README.md` — Quick start guide
- `docs/architecture.md` — System design document
- `docs/api-reference.md` — API documentation
- `docs/troubleshooting.md` — Common issues
- Install script (`install.sh`)
- End-to-end testing of all user flows
