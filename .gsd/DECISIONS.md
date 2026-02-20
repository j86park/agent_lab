# DECISIONS.md — Architecture Decision Records

## Format

| ID | Decision | Date | Context | Status |
|----|----------|------|---------|--------|
| ADR-01 | Mount host Docker socket into backend container | 2026-02-16 | Required for backend to manage sandbox containers; DinD alternative is heavier | Accepted |
| ADR-02 | Include Ollama support in MVP | 2026-02-16 | Key differentiator for privacy/local-first story; worth the extra scope | Accepted |
| ADR-03 | Include FastAPI + Docker export in MVP | 2026-02-16 | Production-ready export strengthens value proposition; Python-only export too minimal | Accepted |
| ADR-04 | SQLite as sole database | 2026-02-16 | Simplicity for local-first; no external DB server needed; sufficient for single-user | Accepted |
| ADR-05 | shadcn/ui for frontend components | 2026-02-16 | Accessible, composable, Tailwind-based; good DX for solo developer | Accepted |
| ADR-06 | GSD-style modular Skills library | 2026-02-16 | Allows reusable rule enforcement and complex behaviors without cluttering agent prompts | Accepted |
