# Plan 7.3 Summary: Prompt Variables

## What Was Built

### Backend

**`models.py`**
- Added `resolved_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)` to `Run`
- Stores the system prompt with all `{{vars}}` substituted, frozen at run-creation time

**`schemas.py`**
- `RunCreate` + `variable_values: Optional[dict[str, str]] = None`
- `RunResponse` + `resolved_prompt: Optional[str] = None`

**`routers/runs.py`**
- Added `_resolve_prompt(template, values)` — uses `re.sub(r'\{\{([^}]+)\}\}', ...)`, preserves missing keys as-is
- `create_run()` resolves variables and stores in `run.resolved_prompt` before queuing execution

**`database.py`**
- Additive migration in `init_db()`: `ALTER TABLE runs ADD COLUMN resolved_prompt TEXT`
- Wrapped in `try/except OperationalError` — no-op on fresh DBs where `create_all` already adds it

**`services/orchestrator.py`**
- After `build_system_prompt()`, checks `run.resolved_prompt`
- Replaces the raw `agent.system_prompt` portion with the resolved version (skills still appended on top)
- Logs "Using resolved prompt (variable substitution applied)"

### Frontend

**`lib/api.ts`**
- `createRun(agent_id, task, variable_values?)` — optional third arg passed in JSON body

**`pages/AgentEditorPage.tsx`**
- `variableValues: Record<string, string>` state
- `extractVariables(prompt): string[]` — extracts unique `{{var}}` names via matchAll
- `detectedVars` computed from live `formData.system_prompt`
- **Template Variables section** in Run Agent card (only shown when `detectedVars.length > 0`):
  - Muted bordered box with `{{…}}` badge header
  - One labeled `<Input>` per variable (label shows `{{varName}}`, placeholder `Value for varName`)
  - Values collected in `variableValues` state
- `handleStartRun` passes `varPayload` (or `undefined` if no vars)

## Verification ✅
- `resolve('Analyze {{ticker}} for {{period}}', {ticker:'AAPL', period:'Q4'})` → `'Analyze AAPL for Q4'` ✓
- Missing key `{{missing}}` preserved as-is ✓
- TypeScript: clean (zero errors) ✓
- Committed: `feat(phase-7): plan 7.3` (9 files, 87 insertions)
