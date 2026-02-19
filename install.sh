#!/usr/bin/env bash
# Agent Lab — One-line install script
#
# Usage (pipe from GitHub):
#   curl -fsSL https://raw.githubusercontent.com/yourusername/agent-lab/main/install.sh | bash
#
# Usage (local):
#   bash install.sh
#
# This script is idempotent — safe to run multiple times.

set -euo pipefail

# ── Color helpers ─────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()    { echo -e "${BLUE}[agent-lab]${NC} $*"; }
success() { echo -e "${GREEN}[agent-lab]${NC} ✓ $*"; }
warn()    { echo -e "${YELLOW}[agent-lab]${NC} ⚠ $*"; }
error()   { echo -e "${RED}[agent-lab]${NC} ✗ $*"; exit 1; }

# ── 1. Check Docker ────────────────────────────────────────────────────────────
command -v docker &>/dev/null \
  || error "Docker not found. Install Docker Desktop: https://www.docker.com/products/docker-desktop"

docker info &>/dev/null 2>&1 \
  || error "Docker daemon not running. Please start Docker Desktop and try again."

success "Docker: $(docker --version)"

# ── 2. Check docker compose ───────────────────────────────────────────────────
docker compose version &>/dev/null 2>&1 \
  || error "'docker compose' plugin not found. Update Docker Desktop to v4.0+ and retry."

success "Docker Compose: $(docker compose version --short 2>/dev/null || echo 'found')"

# ── 3. Clone repo if needed ───────────────────────────────────────────────────
REPO_URL="https://github.com/yourusername/agent-lab.git"

if [[ ! -f "docker-compose.yml" ]]; then
  info "Cloning Agent Lab..."
  git clone "$REPO_URL" agent-lab
  cd agent-lab
  success "Cloned into $(pwd)/agent-lab"
else
  info "Already inside an Agent Lab directory (docker-compose.yml found)"
fi

# ── 4. Set up .env ────────────────────────────────────────────────────────────
if [[ ! -f ".env" ]]; then
  cp .env.example .env
  warn "Created .env from .env.example"
  warn "Add at least one LLM API key before running agents:"
  warn "  nano .env   (or use your preferred editor)"
  echo ""
else
  info ".env already exists — skipping"
fi

# ── 5. Pull images & start services ──────────────────────────────────────────
info "Pulling images (this may take a minute on first run)..."
docker compose pull --quiet

info "Starting Agent Lab services..."
docker compose up -d

# ── 6. Wait for backend health ────────────────────────────────────────────────
info "Waiting for backend to be ready..."
MAX_WAIT=30
COUNT=0

until curl -sf http://localhost:8000/health &>/dev/null; do
  if [[ $COUNT -ge $MAX_WAIT ]]; then
    warn "Backend health check timed out after ${MAX_WAIT}s"
    warn "Check logs with: docker compose logs backend"
    break
  fi
  sleep 2
  COUNT=$((COUNT + 1))
done

if [[ $COUNT -lt $MAX_WAIT ]]; then
  success "Backend ready"
fi

# ── 7. Done ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN} 🧪 Agent Lab is running!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  UI:      http://localhost:5173"
echo "  API:     http://localhost:8000"
echo "  Swagger: http://localhost:8000/docs"
echo ""
echo "  Stop:    docker compose down"
echo "  Logs:    docker compose logs -f"
echo "  Restart: docker compose restart"
echo ""
