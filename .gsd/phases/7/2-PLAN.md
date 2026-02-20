---
phase: 7
plan: 2
wave: 1
---

# Plan 7.2: Persistent Agent Workspace

## Objective
Give each agent a persistent host-side directory (`./agent_workspaces/{agent_id}/`) that is mounted into every sandbox run. Files written during one run remain available in subsequent runs for the same agent. Add a "Workspace" panel to the Agent Editor page showing current files with delete support.

## Context
- `backend/app/services/sandbox.py` — `create_sandbox()` creates containers; need to bind-mount host dir into `/workspace`
- `backend/app/services/orchestrator.py` — calls `create_sandbox(sandbox_cfg)`, passes config
- `backend/app/routers/agents.py` — add workspace file listing + delete endpoints
- `backend/app/config.py` — add `AGENT_WORKSPACES_DIR` setting
- `frontend/src/pages/AgentEditorPage.tsx` — add Workspace panel/tab

## Tasks

<task type="auto">
  <name>Backend: bind-mount persistent workspace into sandbox</name>
  <files>
    backend/app/services/sandbox.py
    backend/app/services/orchestrator.py
    backend/app/config.py
    backend/app/routers/agents.py
  </files>
  <action>
    1. In `config.py`: add `AGENT_WORKSPACES_DIR: Path = Path("./agent_workspaces")`.

    2. In `sandbox.py`:
       - Add `volumes: dict = field(default_factory=dict)` to `SandboxConfig` dataclass
       - In `create_sandbox()._create()`, pass `volumes=cfg.volumes` to `client.containers.run()`
       - Docker volumes format: `{"/host/path": {"bind": "/workspace", "mode": "rw"}}`

    3. In `orchestrator.py`:
       - Import the config setting
       - Before creating the sandbox, compute the agent's workspace path:
         `workspace_dir = AGENT_WORKSPACES_DIR / agent.id`
       - Create it if it doesn't exist: `workspace_dir.mkdir(parents=True, exist_ok=True)`
       - Pass it to `SandboxConfig`: `volumes={str(workspace_dir): {"bind": "/workspace", "mode": "rw"}}`
       - Log: `"Persistent workspace mounted: {workspace_dir}"`
       - Remove the old file injection logic IF it conflicts (Plan 7.1's upload injection can still run since it writes directly to the now-mounted host directory)

    4. In `agents.py`: add two endpoints:
       ```
       GET  /api/agents/{agent_id}/workspace   → list files in ./agent_workspaces/{agent_id}/
       DELETE /api/agents/{agent_id}/workspace/{filename} → delete that file
       ```
       - GET returns: `{"files": [{"name": "data.csv", "size_bytes": 1234, "modified_at": "..."}]}`
       - DELETE returns 204
       - If workspace dir doesn't exist yet, GET returns `{"files": []}`

    IMPORTANT: Do not use Docker volumes dict for Plan 7.1 uploads. Plan 7.1 should write uploaded files to `./agent_workspaces/{agent_id}/` (not a separate uploads dir) so they are naturally visible in the persistent workspace.
  </action>
  <verify>
    python -c "from app.services.sandbox import SandboxConfig; c = SandboxConfig(volumes={'/tmp': {'bind': '/workspace', 'mode': 'rw'}}); print('volumes field OK:', c.volumes)"
  </verify>
  <done>
    - `SandboxConfig` has `volumes` field
    - Orchestrator creates `./agent_workspaces/{agent_id}/` and mounts it
    - Log entry "Persistent workspace mounted" appears in runs
    - `GET /api/agents/{id}/workspace` lists files
    - `DELETE /api/agents/{id}/workspace/{filename}` removes file
  </done>
</task>

<task type="auto">
  <name>Frontend: Workspace panel in Agent Editor</name>
  <files>
    frontend/src/pages/AgentEditorPage.tsx
    frontend/src/lib/api.ts
  </files>
  <action>
    1. In `api.ts`: add two functions:
       ```typescript
       listAgentWorkspace(agentId: string): Promise<{files: {name: string, size_bytes: number, modified_at: string}[]}>
       deleteWorkspaceFile(agentId: string, filename: string): Promise<void>
       ```

    2. In `AgentEditorPage.tsx`: add a "Workspace" section below the existing tabs/panels.
       - Show a list of files: name, formatted size (e.g. "12.3 KB"), last modified date
       - Each file has a delete (trash icon) button — confirm before deleting
       - If no files: empty state "No workspace files yet. Attach files when starting a run."
       - Show file count in the section header: "Workspace (3 files)"
       - Refresh the list after deletion
       - Only show this section when editing an existing agent (not on /agents/new)

    Keep the UI minimal — plain list, no drag-drop upload here (uploads happen at run time per Plan 7.1).
  </action>
  <verify>
    npx tsc --noEmit 2>&1 | tail -5
  </verify>
  <done>
    - Workspace panel visible on agent edit page (not on /agents/new)
    - Lists files with size and date
    - Delete works and list refreshes
    - Empty state shown when no files
    - TypeScript clean
  </done>
</task>

## Success Criteria
- [ ] Each agent gets `./agent_workspaces/{agent_id}/` mounted into every sandbox run
- [ ] Files from previous runs persist and are accessible to the next run's agent
- [ ] Agent Editor shows workspace files with delete capability
- [ ] TypeScript clean
