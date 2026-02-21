# ROADMAP.md

> **Current Phase**: Not started
> **Milestone**: v1.0 — MVP

## Must-Haves (from SPEC)

- [x] Docker Compose one-command deployment
- [x] Agent configuration UI (prompt, tools, constraints, file upload)
- [x] Sandboxed agent execution in Docker containers
- [x] Multi-provider LLM support (OpenAI, Anthropic, OpenRouter, Ollama)
- [x] Real-time log streaming via WebSocket
- [x] Run history with filtering
- [x] Side-by-side run comparison
- [x] Export (Python script, FastAPI app, Docker container)
- [x] Built-in templates
- [x] Modular Skills system (GSD pattern)
- [x] Cost and token tracking

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
**Status**: ✅ Complete
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
**Status**: ✅ Complete
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
**Status**: ✅ Complete
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
**Status**: ✅ Complete
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

---

### Phase 7: Agent Builder QoL
**Status**: ✅ Complete
**Objective**: Add workspace file uploads, persistent workspaces, prompt variables, quick re-run, and run tags to make building and testing agents significantly faster.

**Deliverables**:
- Workspace file uploads: attach files to a run, mounted into `/workspace` before execution
- Persistent agent workspace: host-side directory per agent, survives between runs
- Prompt variables: `{{variable}}` placeholders in system prompts, resolved at run time via UI form
- Quick Re-Run: button on RunDashboardPage to pre-fill and re-launch a run
- Run tags: label runs and filter History by tag

---

### Phase 8: Web Search Integration
**Status**: ✅ Complete
**Objective**: Transform the current `web_search` tool from a placeholder stub into a fully functional search service that the AI agent can use to browse the internet.
**Requirements**: REQ-08 (Tool execution), NEW (Web Search capability)

**Deliverables**:
- Secure search API integration (Tavily)
- Centralized search service with error handling
- Clean search result formatting for LLM context
- Configurable API keys via environment variables

---

### Phase 9: Testing & Evaluation
**Status**: ✅ Complete
**Objective**: Build a robust testing and evaluation suite for agents, including batch execution and automated LLM-as-a-Judge scoring.

**Deliverables**:
- Test Suite & Test Case management UI
- Prompt Snippet library for instruction reuse
- Batch execution service for running suites
- LLM-as-a-Judge evaluation service (score + feedback)
- Result visualization (badges and Judge feedback on Run details)

---

### Phase 10: Advanced UX & Analytics
**Status**: ✅ Complete
**Objective**: Scale the user experience with better run-time visibility, cost controls, and aggregate analytics.

**Deliverables**:
- **Live Prompt Preview**: Real-time view of the fully resolved system prompt (including skills and variables).
- **Model Picker with Cost Estimator**: Per-model pricing display and pre-run cost warning based on constraints.
- **Analytics Dashboard**: Aggregate metrics (success rate, avg cost/tokens) per agent over time.
