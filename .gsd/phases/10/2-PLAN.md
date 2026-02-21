---
phase: 10
plan: 2
wave: 1
---

# Plan 10.2: Model Selection & Costs

Help users track and control LLM spending with pricing metadata and pre-run warnings.

## Objective
Provide transparent pricing during agent configuration to prevent unexpected costs.

## Context
- backend/app/services/llm/ (pricing constants)
- frontend/src/components/ModelSelector.tsx
- frontend/src/pages/AgentEditorPage.tsx

## Tasks

<task type="auto">
  <name>Expose Model Pricing Metadata</name>
  <files>
    - backend/app/routers/metadata.py
    - backend/main.py
  </files>
  <action>
    - Create `backend/app/routers/metadata.py`.
    - Implement `GET /api/metadata/models` endpoint.
    - Consolidate pricing from `OpenAIProvider`, `AnthropicProvider`, and `OpenRouterProvider`.
    - Return a list: `{"models": [{"id": str, "provider": str, "input_price_1m": float, "output_price_1m": float}]}`.
    - register the router in `main.py`.
  </action>
  <verify>curl http://localhost:8000/api/metadata/models</verify>
  <done>Backend returns a unified list of models with their 1M token pricing.</done>
</task>

<task type="auto">
  <name>Update Model Selection & Warning UI</name>
  <files>
    - frontend/src/components/ModelSelector.tsx
    - frontend/src/pages/AgentEditorPage.tsx
    - frontend/src/lib/api.ts
  </files>
  <action>
    - Fetch model metadata in `AgentEditorPage.tsx`.
    - Update `ModelSelector` to show input/output pricing per 1k tokens (converted from 1M rates) in the dropdown.
    - Add a "Pre-run estimate" warning in the sidebar: if (estimated_input + max_tokens) * price > $1.00, show a colored alert.
  </action>
  <verify>Select a high-cost model like GPT-4, set high max_tokens, and see the cost warning appear.</verify>
  <done>User sees pricing alongside models and receive warnings for expensive configurations.</done>
</task>

## Success Criteria
- [ ] Centralized pricing metadata API.
- [ ] Frontend displays per-model costs.
- [ ] Financial guardrail (warning) implemented for high-cost runs.
