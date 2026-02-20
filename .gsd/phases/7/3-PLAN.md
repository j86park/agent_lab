---
phase: 7
plan: 3
wave: 1
---

# Plan 7.3: Prompt Variables

## Objective
Let agents define `{{variable_name}}` placeholders in their system prompt. When a user starts a run, the frontend detects all placeholders and shows an inline form for the user to fill in the values. The resolved prompt is sent to the backend as part of the run task payload, and stored per-run.

## Context
- `backend/app/models.py` — `Run` has `task: text`; add `resolved_prompt: text | null` column
- `backend/app/schemas.py` — `RunCreate` needs `variable_values: dict[str, str] | None`
- `backend/app/routers/runs.py` — `POST /api/runs` resolves variables before creating run
- `backend/app/services/orchestrator.py` — use `resolved_prompt` as the system prompt if set
- `frontend/src/pages/AgentEditorPage.tsx` — detect variables from system_prompt, show form before Start Run

## Tasks

<task type="auto">
  <name>Backend: store variable values and resolve prompts per-run</name>
  <files>
    backend/app/models.py
    backend/app/schemas.py
    backend/app/routers/runs.py
    backend/app/services/orchestrator.py
  </files>
  <action>
    1. In `models.py`: add to `Run` class:
       ```python
       resolved_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
       ```
       This stores the system prompt with variables substituted, frozen at run-creation time.

    2. In `schemas.py`: add to `RunCreate`:
       ```python
       variable_values: dict[str, str] | None = None
       ```
       And to `RunResponse`:
       ```python
       resolved_prompt: str | None = None
       ```

    3. In `routers/runs.py` `create_run()`:
       - After loading the agent, resolve variables:
         ```python
         import re
         def resolve_prompt(template: str, values: dict[str, str]) -> str:
             def replacer(m):
                 key = m.group(1).strip()
                 return values.get(key, m.group(0))  # keep original if no value provided
             return re.sub(r'\{\{([^}]+)\}\}', replacer, template)
         ```
       - Set `run.resolved_prompt = resolve_prompt(agent.system_prompt, payload.variable_values or {})`
       - If no `variable_values` provided, fall back: `run.resolved_prompt = None`

    4. In `orchestrator.py` `execute_run()`, in step 3 (build system prompt):
       - After `build_system_prompt()` returns the skill-injected prompt, check if `run.resolved_prompt` is set
       - If set, replace the base system prompt part with `run.resolved_prompt` (insert it in place of `agent.system_prompt`)
       - Simplest approach: if `run.resolved_prompt`: use `run.resolved_prompt` directly as the system message content (before skill injection layers are appended). Look at `build_system_prompt()` to see how to integrate cleanly.

    IMPORTANT: Alembic is NOT used in this project. The DB uses `create_all()` on startup. Adding a column to an existing SQLite table requires a migration. Add this to `database.py` or `main.py` startup:
    ```python
    async with engine.begin() as conn:
        await conn.execute(text("ALTER TABLE runs ADD COLUMN resolved_prompt TEXT"))
    ```
    Wrap in try/except OperationalError (column may already exist).
  </action>
  <verify>
    python -c "
    import re
    def resolve(t, vals):
        return re.sub(r'\{\{([^}]+)\}\}', lambda m: vals.get(m.group(1).strip(), m.group(0)), t)
    result = resolve('Analyze {{ticker}} for {{period}}', {'ticker': 'AAPL', 'period': 'Q4'})
    assert result == 'Analyze AAPL for Q4', result
    print('OK:', result)
    "
  </verify>
  <done>
    - `Run.resolved_prompt` column exists in DB
    - `RunCreate.variable_values` accepted by API
    - Variables in system_prompt are substituted before storing in `resolved_prompt`
    - Orchestrator uses `resolved_prompt` as system message when set
  </done>
</task>

<task type="auto">
  <name>Frontend: variable detection and inline fill-in form</name>
  <files>
    frontend/src/pages/AgentEditorPage.tsx
    frontend/src/lib/api.ts
  </files>
  <action>
    1. In `api.ts`: update `RunCreate` type and `runApi.create()`:
       ```typescript
       interface RunCreate {
           agent_id: string;
           task: string;
           variable_values?: Record<string, string>;
       }
       ```

    2. In `AgentEditorPage.tsx`, in the "Start Run" section:
       - Write a `extractVariables(prompt: string): string[]` function:
         ```typescript
         function extractVariables(prompt: string): string[] {
             const matches = [...prompt.matchAll(/\{\{([^}]+)\}\}/g)];
             return [...new Set(matches.map(m => m[1].trim()))];
         }
         ```
       - When the agent loads, call `extractVariables(agent.system_prompt)` and store as `detectedVars`
       - If `detectedVars.length > 0`: show a "Template Variables" section above the task input with a labeled text input per variable (label = variable name, placeholder = `Enter value for {{name}}`)
       - Collect values into `variableValues: Record<string, string>`
       - On "Start Run": pass `variable_values: variableValues` in the `RunCreate` payload

    3. When `detectedVars.length === 0`: no extra UI shown, behavior unchanged.

    Show a small mono `{{...}}` badge near the system prompt preview if variables are detected (hint to the user that this prompt uses variables).
  </action>
  <verify>
    npx tsc --noEmit 2>&1 | tail -5
  </verify>
  <done>
    - Variables detected from system_prompt and shown as labeled inputs
    - Values sent in `variable_values` on run creation
    - No extra UI shown if prompt has no `{{var}}` placeholders
    - TypeScript clean
  </done>
</task>

## Success Criteria
- [ ] `{{ticker}}` in system prompt → labeled input appears before Start Run
- [ ] Values substituted and stored in `run.resolved_prompt`
- [ ] Orchestrator uses resolved prompt as system message
- [ ] TypeScript clean
