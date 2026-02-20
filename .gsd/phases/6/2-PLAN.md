---
phase: 6
plan: 2
wave: 1
---

# Plan 6.2: README & One-Line Install Script

## Objective
Write a comprehensive `README.md` (the first thing any user sees) and a cross-platform install script that gets the user running with `curl | bash` or one PowerShell command.

## Context
- README.md (currently: `# agent_lab`, 11 bytes — replace entirely)
- docker-compose.yml (reference for install instructions)
- .env.example (reference for required env vars)
- .gsd/SPEC.md (vision, goals, tech stack)
- backend/Dockerfile, frontend/Dockerfile (reference for build steps)

## Tasks

<task type="auto">
  <name>Write comprehensive README.md</name>
  <files>
    README.md
  </files>
  <action>
    Replace the entire README.md with a production-quality README covering:

    ## Sections (in order):

    ### 1. Badge row + Hero
    - Title: "# 🧪 Agent Lab"
    - Tagline: "The Postman for AI agents — a free, local-first platform for building and testing AI agents without writing a line of agent code."
    - Badges: MIT License, Python 3.11+, React 18+, Docker

    ### 2. Screenshot placeholder
    Add a note: `<!-- Add screenshot here -->`

    ### 3. Features (bullet list)
    - 🤖 Multi-provider support (OpenAI, Anthropic, OpenRouter, Ollama)
    - ⚡ Real-time streaming logs via WebSocket
    - 📊 Cost & token tracking per run
    - 🔄 Side-by-side run comparison
    - 📦 Export agents as Python script, FastAPI app, or Dockerfile
    - 🧠 Built-in agent templates (Q&A, Code Helper, Data Analyst)
    - 🔒 Local-first — all data stays on your machine
    - 🔑 Encrypted API key storage

    ### 4. Quick Start (most important section)
    ```bash
    # Prerequisites: Docker Desktop must be installed and running

    # 1. Clone
    git clone https://github.com/yourusername/agent-lab.git
    cd agent-lab

    # 2. Configure (copy and fill in your API keys)
    cp .env.example .env

    # 3. Start
    docker compose up

    # 4. Open browser
    # http://localhost:5173
    ```

    ### 5. Configuration
    Table of env vars from `.env.example`:
    | Variable | Description | Required |
    |---|---|---|
    | OPENAI_API_KEY | OpenAI API key | Optional |
    | ANTHROPIC_API_KEY | Anthropic API key | Optional |
    | OPENROUTER_API_KEY | OpenRouter API key | Optional |
    | SECRET_KEY | Encryption key for stored secrets | Recommended |

    Note: At least one LLM API key is required to run agents.

    ### 6. Usage Guide (brief)
    1. **Create an agent** — Go to Agents → New Agent, set system prompt and provider
    2. **Run it** — Click "Start Run", enter your task, watch real-time logs
    3. **Compare runs** — Select 2 runs in History → Compare
    4. **Export it** — Agent Editor → Export → choose Python / FastAPI / Docker

    ### 7. Project Structure
    ```
    agent-lab/
    ├── backend/        # FastAPI + SQLite
    ├── frontend/       # React + Vite
    ├── docs/           # Architecture & API docs
    └── docker-compose.yml
    ```

    ### 8. Development Setup
    ```bash
    # Backend
    cd backend && pip install -r requirements.txt
    uvicorn app.main:app --reload

    # Frontend
    cd frontend && npm install
    npm run dev
    ```

    ### 9. Documentation links
    - [Architecture](docs/architecture.md)
    - [API Reference](docs/api-reference.md)
    - [Troubleshooting](docs/troubleshooting.md)

    ### 10. License
    MIT — see LICENSE

    IMPORTANT: Use real markdown formatting. All code blocks must have language tags.
    Keep it concise but complete — this is a developer tool README, not marketing.
  </action>
  <verify>
    Test-Path "README.md" | Write-Host
    (Get-Item "README.md").Length | Write-Host
  </verify>
  <done>
    - README.md is comprehensive (>3KB)
    - Has Quick Start with docker compose commands
    - Has Features, Usage, Project Structure sections
  </done>
</task>

<task type="auto">
  <name>Create install.sh one-line install script</name>
  <files>
    install.sh
  </files>
  <action>
    Create `install.sh` at the repo root. This script automates the full setup:

    ```bash
    #!/usr/bin/env bash
    # Agent Lab — One-line install script
    # Usage: curl -fsSL https://raw.githubusercontent.com/yourusername/agent-lab/main/install.sh | bash
    # Or:    bash install.sh
    set -euo pipefail

    # --- Color helpers ---
    RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
    info()    { echo -e "${BLUE}[agent-lab]${NC} $*"; }
    success() { echo -e "${GREEN}[agent-lab]${NC} ✓ $*"; }
    warn()    { echo -e "${YELLOW}[agent-lab]${NC} ⚠ $*"; }
    error()   { echo -e "${RED}[agent-lab]${NC} ✗ $*"; exit 1; }

    # 1. Check Docker
    command -v docker &>/dev/null || error "Docker not found. Install Docker Desktop first: https://www.docker.com/products/docker-desktop"
    docker info &>/dev/null 2>&1 || error "Docker daemon not running. Please start Docker Desktop."
    success "Docker found: $(docker --version)"

    # 2. Check docker compose
    docker compose version &>/dev/null 2>&1 || error "docker compose plugin not found. Update Docker Desktop."
    success "Docker Compose found"

    # 3. Clone repo (if not already inside it)
    if [[ ! -f "docker-compose.yml" ]]; then
        info "Cloning Agent Lab..."
        git clone https://github.com/yourusername/agent-lab.git agent-lab
        cd agent-lab
    else
        info "Already inside Agent Lab directory"
    fi

    # 4. Setup .env
    if [[ ! -f ".env" ]]; then
        cp .env.example .env
        warn "Created .env from .env.example — add your API keys with your editor:"
        warn "  nano .env"
    else
        info ".env already exists (skipping)"
    fi

    # 5. Start services
    info "Starting Agent Lab..."
    docker compose pull --quiet
    docker compose up -d

    # 6. Wait for health
    info "Waiting for backend to be ready..."
    MAX=30; COUNT=0
    until curl -sf http://localhost:8000/health &>/dev/null || [[ $COUNT -ge $MAX ]]; do
        sleep 2; COUNT=$((COUNT+1))
    done
    [[ $COUNT -ge $MAX ]] && warn "Backend health check timed out — check: docker compose logs backend" || success "Backend ready"

    # 7. Done
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN} Agent Lab is running! 🧪${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "  UI:      http://localhost:5173"
    echo "  API:     http://localhost:8000"
    echo "  Docs:    http://localhost:8000/docs"
    echo ""
    echo "  To stop: docker compose down"
    echo "  Logs:    docker compose logs -f"
    echo ""
    ```

    IMPORTANT:
    - Make it executable: `chmod +x install.sh`
    - Replace git clone URL with a placeholder `https://github.com/yourusername/agent-lab.git`
    - The script should be idempotent (safe to run multiple times)
  </action>
  <verify>
    bash -n install.sh 2>&1; if ($LASTEXITCODE -eq 0) { Write-Host "Bash syntax OK" }
  </verify>
  <done>
    - install.sh exists at repo root
    - Bash syntax valid (bash -n passes)
    - Checks Docker, sets up .env, starts docker compose
    - Prints friendly completion message with URL
  </done>
</task>

## Success Criteria
- [ ] README.md is comprehensive (>3KB, has Quick Start, Features, Usage)
- [ ] install.sh exists and passes `bash -n` syntax check
- [ ] install.sh checks Docker, clones repo, sets up .env, starts services
