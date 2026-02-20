---
phase: 1
plan: 3
wave: 2
depends_on: [1, 2]
---

# Plan 1.3: Docker Compose Integration & Verification

## Objective
Wire backend and frontend together via Docker Compose, verify the full development environment works end-to-end, and confirm hot-reload is functional for both services.

## Context
- .gsd/SPEC.md
- .agent/skills/agent-lab-skills/SKILL.md
- backend/Dockerfile
- frontend/Dockerfile

## Tasks

<task type="auto">
  <name>Create Docker Compose orchestration</name>
  <files>
    docker-compose.yml
    docker-compose.dev.yml
    .env.example
    .gitignore
  </files>
  <action>
    1. **docker-compose.yml** — Production-like config:
       - Service: backend
         - build: ./backend
         - ports: 8000:8000
         - volumes:
           - /var/run/docker.sock:/var/run/docker.sock (for sandbox management)
           - agent-lab-data:/root/.agent-lab (named volume for persistence)
         - environment:
           - DATA_DIR=/root/.agent-lab
         - healthcheck: curl -f http://localhost:8000/health || exit 1
         - restart: unless-stopped

       - Service: frontend
         - build: ./frontend
         - ports: 3000:3000
         - depends_on:
           - backend (condition: service_healthy)
         - restart: unless-stopped

       - volumes:
         - agent-lab-data: (named volume)

    2. **docker-compose.dev.yml** — Development override:
       - Service: backend
         - volumes (bind mounts for hot-reload):
           - ./backend:/app
         - restart: "no"

       - Service: frontend
         - volumes (bind mounts for hot-reload):
           - ./frontend:/app
           - /app/node_modules (anonymous volume to preserve node_modules)
         - restart: "no"

    3. **.env.example** — Template:
       - OPENAI_API_KEY=your-key-here
       - ANTHROPIC_API_KEY=your-key-here
       - OPENROUTER_API_KEY=your-key-here

    4. Update **.gitignore** — Ensure it includes:
       - .env
       - __pycache__/
       - *.pyc
       - node_modules/
       - frontend/dist/
       - *.sqlite
       - .agent-lab/

    IMPORTANT: Follow agent-lab-skills Docker Compose rules:
    - v3.8+ syntax
    - Backend mounts Docker socket
    - Named volumes for persistent data
    - Healthcheck on backend before frontend depends_on
  </action>
  <verify>
    docker compose config
  </verify>
  <done>
    - docker-compose.yml validates without error
    - docker-compose.dev.yml validates without error
    - .env.example exists with API key placeholders
    - .gitignore covers all generated files
  </done>
</task>

<task type="checkpoint:human-verify">
  <name>Verify full stack starts and hot-reload works</name>
  <files>
    docker-compose.yml
    docker-compose.dev.yml
  </files>
  <action>
    Start the full development environment and verify:

    1. Run: docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
    2. Wait for both services to be healthy
    3. Test backend: curl http://localhost:8000/health → should return {"status": "ok"}
    4. Test frontend: open http://localhost:3000 in browser → should show Agent Lab UI with sidebar
    5. Test navigation: click through sidebar links → pages should render
  </action>
  <verify>
    curl -s http://localhost:8000/health | python -c "import sys,json; d=json.load(sys.stdin); assert d['status']=='ok'; print('Backend OK')"
  </verify>
  <done>
    - Both containers start without error
    - Backend health endpoint responds
    - Frontend loads in browser with sidebar navigation
    - All placeholder pages accessible via routing
  </done>
</task>

## Success Criteria
- [ ] `docker compose config` validates
- [ ] Both services start via docker compose up
- [ ] Backend responds at localhost:8000/health
- [ ] Frontend serves UI at localhost:3000
- [ ] Navigation between all pages works
