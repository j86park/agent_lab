# 🧪 Agent Lab

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11%2B-blue)](https://python.org)
[![React](https://img.shields.io/badge/React-18%2B-61DAFB)](https://react.dev)
[![Docker](https://img.shields.io/badge/Docker-required-2496ED)](https://www.docker.com/products/docker-desktop)

> The Postman for AI agents — a free, local-first platform for building and testing AI agents without writing a line of agent code.

<!-- Add screenshot here -->

---

## ✨ Features

- 🤖 **Multi-provider** — OpenAI, Anthropic, OpenRouter, Ollama
- ⚡ **Real-time streaming** — Live logs via WebSocket as your agent runs
- 📊 **Cost & token tracking** — Per-run cost, tokens, and duration
- 🔄 **Side-by-side comparison** — Compare any two runs at a glance
- 📦 **Export agents** — Download as Python script, FastAPI app, or Dockerfile
- 🧠 **Built-in templates** — Q&A Agent, Code Helper, Data Analyst
- 🔒 **Local-first** — All data stays on your machine (SQLite, no cloud)
- 🔑 **Encrypted key storage** — API keys stored with Fernet encryption

---

## 🚀 Quick Start

> **Prerequisite:** [Docker Desktop](https://www.docker.com/products/docker-desktop) must be installed and running.

```bash
# 1. Clone
git clone https://github.com/j86park/agent_lab.git
cd agent_lab

# 2. Configure — add at least one LLM API key
cp .env.example .env
# then edit .env with your editor

# 3. Start
docker compose up

# 4. Open
# http://localhost:5173
```

Or use the one-line install script:

```bash
curl -fsSL https://raw.githubusercontent.com/j86park/agent_lab/main/install.sh | bash
```

---

## ⚙️ Configuration

Copy `.env.example` to `.env` and fill in at least one API key:

| Variable | Description | Required |
|---|---|---|
| `AGENT_LAB_OPENAI_API_KEY` | OpenAI API key | Optional |
| `AGENT_LAB_ANTHROPIC_API_KEY` | Anthropic API key | Optional |
| `AGENT_LAB_OPENROUTER_API_KEY` | OpenRouter API key (access 100+ models) | Optional |

> **Note:** At least one LLM API key is required to run agents.

---

## 📖 Usage

1. **Create an agent** — Agents → New Agent → set name, system prompt, provider & model
2. **Run it** — Click **Start Run**, enter your task, watch real-time streaming logs
3. **Review history** — History page shows all runs with cost, tokens, and duration
4. **Compare runs** — Select any two runs → Compare (side-by-side diff view)
5. **Export it** — Agent Editor → **Export** → choose Python script / FastAPI app / Dockerfile

---

## 🗂️ Project Structure

```
agent_lab/
├── backend/           # FastAPI + SQLAlchemy + SQLite
│   ├── app/
│   │   ├── routers/   # REST API endpoints
│   │   ├── services/  # LLM providers, export generators
│   │   └── models.py  # ORM models
│   └── Dockerfile
├── frontend/          # React 18 + Vite + shadcn/ui
│   └── src/
│       ├── pages/     # Page components
│       └── lib/api.ts # HTTP client
├── docs/              # Architecture & API reference
└── docker-compose.yml
```

---

## 🛠️ Development Setup

Run the services locally without Docker:

```bash
# Backend (Python 3.11+)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
# → http://localhost:8000
# → http://localhost:8000/docs  (Swagger UI)
```

```bash
# Frontend (Node 18+)
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## 📚 Documentation

- [Architecture](docs/architecture.md) — System design, data model, WebSocket protocol
- [API Reference](docs/api-reference.md) — All REST & WebSocket endpoints
- [Troubleshooting](docs/troubleshooting.md) — Common issues & solutions

---

## 📄 License

MIT — see [LICENSE](LICENSE)