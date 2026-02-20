# REQUIREMENTS.md

## Format

| ID | Requirement | Source | Status |
|----|-------------|--------|--------|
| REQ-01 | System deploys via `docker compose up` with no additional setup beyond API keys | Goal 1, SC-1 | Pending |
| REQ-02 | Web UI allows creating/editing agent configurations (prompt, tools, constraints, context files) | Goal 1, SC-2 | Pending |
| REQ-03 | Agent configurations are saveable, loadable, and reusable | Goal 1 | Pending |
| REQ-04 | All services run locally — no external cloud dependencies | Goal 2, SC-12 | Pending |
| REQ-05 | User data stored in `~/.agent-lab/` with encrypted secrets | Goal 2 | Pending |
| REQ-06 | Support OpenAI API for LLM calls | Goal 3, SC-7 | Pending |
| REQ-07 | Support Anthropic API for LLM calls | Goal 3, SC-7 | Pending |
| REQ-08 | Support OpenRouter API for LLM calls | Goal 3, SC-7 | Pending |
| REQ-09 | Support Ollama for local model inference | Goal 3, SC-7 | Pending |
| REQ-10 | Each agent run executes in an isolated Docker container | Goal 4, SC-4 | Pending |
| REQ-11 | Sandbox containers have configurable CPU, memory, and timeout limits | Goal 4, SC-4 | Pending |
| REQ-12 | Real-time log streaming from sandbox to browser via WebSocket | Goal 5, SC-3 | Pending |
| REQ-13 | Side-by-side comparison of two agent runs | Goal 5, SC-5 | Pending |
| REQ-14 | Real-time cost and token usage tracking | Goal 5, SC-8 | Pending |
| REQ-15 | Run history persisted in SQLite with filtering by agent, date, status | Goal 5, SC-9 | Pending |
| REQ-16 | Export agent as standalone Python script | Goal 6, SC-6 | Pending |
| REQ-17 | Export agent as FastAPI application | Goal 6, SC-6 | Pending |
| REQ-18 | Export agent as Docker container | Goal 6, SC-6 | Pending |
| REQ-19 | File operations tool (read, write, list, search) available in sandbox | Goal 1 | Pending |
| REQ-20 | Code execution tool (Python, JavaScript) available in sandbox | Goal 1 | Pending |
| REQ-21 | 3+ built-in templates (Q&A Agent, Code Helper, Data Analyst) | SC-10 | Pending |
| REQ-22 | Settings page for API key management with encrypted local storage | Goal 2 | Pending |
| REQ-23 | Backend serves REST API + WebSocket on port 8000 | Architecture | Pending |
| REQ-24 | Frontend serves React app on port 3000 | Architecture | Pending |
| REQ-25 | Works on Mac, Linux, and Windows with Docker Desktop | SC-13 | Pending |
| REQ-26 | Modular Skills library: store/load instruction blocks in `~/.agent-lab/skills/` | Goal 7 | Pending |
| REQ-27 | Agent Orchestrator injects assigned skill instructions into the system prompt | Goal 7 | Pending |
