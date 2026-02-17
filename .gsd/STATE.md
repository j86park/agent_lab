# STATE.md — Project Memory

> **Last Updated**: 2026-02-17

## Current Position
- **Milestone**: v1.0 — MVP
- **Phase**: 2 — Agent Configuration & Persistence (planning complete)
- **Task**: Planning complete — 4 plans created
- **Status**: Ready for execution

## Active Context
- Solo developer project
- Infrastructure established: FastAPI backend, React+Vite frontend, SQLite+SQLAlchemy 2.0
- Docker Compose orchestration with hot-reload support
- Data directories initialized at `~/.agent-lab/`

## Key Decisions
- [ADR-01] Docker socket mounting for sandbox management (accepted)
- [ADR-02] FastAPI + Docker export included in MVP
- [ADR-03] Ollama/local model support included in MVP
- [Fixed] Installed `curl` in backend Dockerfile for healthcheck support
- [ADR-04] API keys stored as encrypted JSON at `~/.agent-lab/settings.json`
- [ADR-05] Skills CRUD on single page (list + dialog) vs agents using separate pages

## Last Session Summary
Phase 2 planned with 4 plans across 2 waves:
- Wave 1: Backend APIs (Agent CRUD, Skills CRUD, Settings)
- Wave 2: Frontend UIs (Agent List + Editor, Skills Library + Settings)

## Next Steps
1. `/execute 2` — run all plans for Phase 2

## Blockers
_None_

## Notes
- Backend image now includes `curl` for healthcheck reliability.
- Root `tsconfig.json` updated with import aliases to support shadcn/ui.
- Phase 2 uses Fernet encryption for API key storage.
