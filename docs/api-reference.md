# API Reference

**Base URL:** `http://localhost:8000`

> Interactive docs with live "Try it" support: **[http://localhost:8000/docs](http://localhost:8000/docs)**

---

## Agents `/api/agents`

### `POST /api/agents` — Create agent

**Request body:**
```json
{
  "name": "My Agent",
  "description": "Optional description",
  "system_prompt": "You are a helpful assistant.",
  "provider": "openai",
  "model": "gpt-4o",
  "tools_config": "[]",
  "constraints_config": "{}"
}
```

**Response `201`:**
```json
{
  "id": "uuid",
  "name": "My Agent",
  "description": "Optional description",
  "system_prompt": "You are a helpful assistant.",
  "provider": "openai",
  "model": "gpt-4o",
  "tools_config": "[]",
  "constraints_config": "{}",
  "created_at": "2026-02-19T12:00:00",
  "updated_at": "2026-02-19T12:00:00"
}
```

---

### `GET /api/agents` — List agents

**Query params:** `skip=0`, `limit=50`

**Response `200`:**
```json
{ "agents": [ { ...AgentResponse } ], "total": 5 }
```

---

### `GET /api/agents/{id}` — Get agent

**Response `200`:** AgentResponse  
**Response `404`:** `{ "detail": "Agent not found" }`

---

### `PUT /api/agents/{id}` — Update agent

**Request body:** Any subset of AgentCreate fields (all optional).  
**Response `200`:** Updated AgentResponse

---

### `DELETE /api/agents/{id}` — Delete agent

Cascades: deletes all runs and logs for this agent.  
**Response `204`:** No content  
**Response `404`:** `{ "detail": "Agent not found" }`

---

### `GET /api/agents/{id}/export` — Export agent as code

**Query params:** `format` = `python` | `fastapi` | `docker` (default: `python`)

**Response `200`:**
```json
{
  "filename": "agent.py",
  "content": "#!/usr/bin/env python3\n...",
  "format": "python"
}
```

| `format` | `filename` | Description |
|---|---|---|
| `python` | `agent.py` | Standalone CLI script |
| `fastapi` | `agent_app.py` | FastAPI REST app with `/chat` endpoint |
| `docker` | `Dockerfile` | Containerized FastAPI app |

---

## Runs `/api/runs`

### `POST /api/runs` — Start a run

Creates the run record and immediately begins execution in a background task.

**Request body:**
```json
{
  "agent_id": "uuid",
  "task": "What is the capital of France?"
}
```

**Response `201`:**
```json
{
  "id": "uuid",
  "agent_id": "uuid",
  "task": "What is the capital of France?",
  "status": "pending",
  "cost": null,
  "total_tokens": null,
  "duration_seconds": null,
  "error_message": null,
  "created_at": "2026-02-19T12:00:00",
  "completed_at": null
}
```

> Poll `GET /api/runs/{id}` or subscribe via WebSocket until `status` is `completed` or `failed`.

---

### `GET /api/runs` — List runs

**Query params:** `agent_id` (optional filter), `skip=0`, `limit=50` (max 200)

**Response `200`:**
```json
{ "runs": [ { ...RunResponse } ], "total": 42 }
```

---

### `GET /api/runs/{id}` — Get run

**Response `200`:** RunResponse (with final `cost`, `total_tokens`, `duration_seconds` when complete)

---

### `GET /api/runs/{id}/logs` — Get all logs

Returns all log entries ordered oldest-first.

**Response `200`:**
```json
[
  {
    "id": 1,
    "run_id": "uuid",
    "timestamp": "2026-02-19T12:00:01",
    "level": "info",
    "message": "Starting agent execution...",
    "metadata_json": null
  }
]
```

---

### `DELETE /api/runs/{id}` — Delete run

Cascades: deletes all log entries.  
**Response `204`:** No content  
**Response `409`:** `{ "detail": "Cannot delete a run that is currently running" }`

---

## Skills `/api/skills`

### `POST /api/skills` — Create skill

**Request body:**
```json
{
  "name": "Concise Responder",
  "description": "Always respond briefly",
  "instructions": "Keep all answers under 3 sentences."
}
```

**Response `201`:** SkillResponse

---

### `GET /api/skills` — List skills

**Query params:** `skip=0`, `limit=50`  
**Response `200`:** `{ "skills": [...], "total": N }`

---

### `GET /api/skills/{id}` — Get skill

**Response `200`:** SkillResponse

---

### `PUT /api/skills/{id}` — Update skill

**Request body:** Any subset of fields.  
**Response `200`:** Updated SkillResponse

---

### `DELETE /api/skills/{id}` — Delete skill

**Response `204`:** No content

---

## Settings `/api/settings`

### `GET /api/settings` — Get key status

Returns which providers have keys configured. **Key values are never returned.**

**Response `200`:**
```json
{
  "openai": true,
  "anthropic": false,
  "openrouter": true
}
```

---

### `PUT /api/settings` — Set API keys

**Request body:**
```json
{
  "openai_api_key": "sk-...",
  "anthropic_api_key": null,
  "openrouter_api_key": "sk-or-..."
}
```

Pass `null` or omit a key to leave it unchanged.  
**Response `200`:** Updated key status (same format as GET)

---

## WebSocket `/ws/runs/{run_id}`

**URL:** `ws://localhost:8000/ws/runs/{run_id}`

Connect immediately after `POST /api/runs` to receive real-time log streaming.

### Message types

**Log entry** (emitted as agent executes):
```json
{ "type": "log", "data": { "level": "info", "message": "...", "timestamp": "..." } }
```

**Status update** (emitted on completion or failure):
```json
{
  "type": "status",
  "run": {
    "id": "uuid",
    "status": "completed",
    "cost": 0.0014,
    "total_tokens": 312,
    "duration_seconds": 3.7,
    "completed_at": "2026-02-19T12:00:05"
  }
}
```

**Error** (unexpected server error):
```json
{ "type": "error", "message": "Internal error" }
```

The connection closes automatically after the status message.

---

## Health

### `GET /health`

**Response `200`:**
```json
{ "status": "ok", "version": "0.1.0" }
```
