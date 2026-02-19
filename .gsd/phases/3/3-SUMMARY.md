# Plan 3.3 Summary: Agent Orchestrator & Skill Injection

## Changes Made

### [NEW] `backend/app/services/skills_injector.py`
- `build_system_prompt(agent_id, session)` — async function
- Queries the `agent_skills` junction table and appends each skill's instructions to the agent's base prompt with `---` delimiters

### [NEW] `backend/app/services/tools.py`
- `AVAILABLE_TOOLS` dict — 4 registered tools
- `get_tool_definitions()` — returns OpenAI-compatible function schema array
- `execute_tool(tool_name, arguments, sandbox, container_id)` — async dispatcher

| Tool | Implementation |
|------|---------------|
| `file_read` | `sandbox.read_file()` |
| `file_write` | `sandbox.write_file()` |
| `code_execute` | Writes `_exec.py`, runs `python3`, returns stdout/stderr |
| `web_search` | Stub — returns informative placeholder message |

### [NEW] `backend/app/services/orchestrator.py`
- `AgentOrchestrator.execute_run(run_id)` — full async agent loop:
  1. Load Run + Agent from DB
  2. Mark run as "running"
  3. Build system prompt (skill injection)
  4. Create Docker sandbox
  5. Run LLM ↔ tool loop (max 10 iterations)
  6. Persist cost, tokens, duration, final status
  7. Destroy sandbox in `finally`
- `_log()` — creates `RunLog` entries after each step
- `_fail_run()` — marks run as failed with error message

## Verification Results

```
Skill injector + tools OK
Orchestrator OK
```

- All 4 tools in registry
- Tool definitions OpenAI-compatible (type: "function")
- Orchestrator instantiates with `sandbox_manager` and `execute_run` method

## Technical Notes
- Orchestrator reads its own DB session (`async_session()`) — safe for background task use
- Tool calls use the OpenAI `tool_calls` format (normalized across providers in Plan 3.1)
- Cost and token counts are accumulated across all iterations
- `finally` block always destroys the sandbox regardless of success or failure
