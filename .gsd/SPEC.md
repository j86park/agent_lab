# SPEC.md — Project Specification

> **Status**: `FINALIZED`

## Vision

Agent Lab is a free, open-source, local-first platform for building and testing AI agents — "Postman for AI agents." It runs entirely on the user's hardware using Docker, providing a complete development environment where developers can configure agents through a UI, test them with real data in isolated sandboxes, and iterate rapidly. Zero cost, complete privacy, no cloud dependencies.

## Goals

1. **Zero-friction agent development** — Configure, test, and iterate on AI agents without writing agent code, all through a browser UI
2. **Complete local execution** — Everything runs on the developer's machine via Docker; no data leaves their hardware
3. **Multi-provider LLM support** — OpenAI, Anthropic, OpenRouter, and local models via Ollama out of the box
4. **Safe sandboxed execution** — Each agent run executes in an isolated Docker container with resource limits
5. **Rapid iteration cycle** — Real-time log streaming, side-by-side comparison, cost tracking, and exportable results
6. **Production-ready export** — Generate standalone Python scripts, FastAPI apps, or Docker containers from tested agent configs
7. **Modular Skills System** — Allow agents to inherit rules and behaviors from a reusable library of "Skills" (inspired by the GSD framework pattern)

## Non-Goals (Out of Scope for MVP)

- Community marketplace for sharing agents
- Multi-agent orchestration
- Custom tool builder UI
- Visual workflow designer
- Performance analytics dashboard with statistical analysis
- Git-like versioning for agents (beyond basic save/load)
- Desktop app (Electron/Tauri wrapper)
- Cloud hosting or SaaS offering

## Users

**Primary**: Software developers who work with LLMs and want a local environment to prototype, test, and debug AI agents before deploying them. They are comfortable with Docker and the command line but want a UI-driven workflow for agent configuration and testing.

**Secondary**: Prompt engineers and technical product managers who need to experiment with different prompts and tool configurations without writing code.

## Constraints

- **Solo developer** — phases must be sequentially executable by one person
- **Docker Desktop required** — users must have Docker installed; the platform runs as Docker Compose services
- **Docker socket mounting** — backend container mounts host Docker socket (`/var/run/docker.sock`) to manage sandbox containers
- **No cloud infrastructure** — all services run locally
- **SQLite only** — no external database server
- **Browser-based UI** — no native app

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Distribution | Docker Compose, one-line install script |
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2.0, asyncio |
| Frontend | React 18+ with TypeScript, Vite, shadcn/ui (Radix + Tailwind CSS) |
| Database | SQLite 3 |
| Sandbox | Docker Engine (Python Docker SDK) |
| LLM Providers | OpenAI SDK, Anthropic SDK, OpenRouter (via OpenAI-compatible API), Ollama |
| Real-time | WebSocket (log streaming) |
| Storage | Local filesystem (~/.agent-lab/skills/, ~/.agent-lab/agents/) |
| Secrets | Encrypted with `cryptography` library |

## Success Criteria

- [ ] User can install with one command (`docker compose up`)
- [ ] User can configure an agent through the UI without writing code
- [ ] User can test an agent and see real-time streaming logs
- [ ] Agent runs execute in isolated Docker sandboxes with resource limits
- [ ] User can compare two agent runs side-by-side
- [ ] User can export a working agent as Python script, FastAPI app, or Docker container
- [ ] Supports OpenAI, Anthropic, OpenRouter, and Ollama providers
- [ ] Cost and token tracking displayed in real-time
- [ ] Run history persisted in SQLite with filtering
- [ ] 3+ built-in templates (Q&A, Code Helper, Data Analyst)
- [ ] User can create, edit, and assign reusable "Skills" to agents
- [ ] No crashes or data loss during normal operation
- [ ] Setup time < 10 minutes, first agent test < 5 minutes
- [ ] Works on Mac, Linux, and Windows (with Docker Desktop)
