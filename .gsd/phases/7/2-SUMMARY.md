# Plan 7.2 Summary: Persistent Agent Workspace

## What Was Built

### Backend

**`config.py`**
- Added `AGENT_WORKSPACES_DIR: Path = Path("./agent_workspaces")` — relative to CWD for easy Docker access
- Added to `ensure_data_dirs()` (auto-created on startup)

**`services/sandbox.py`**
- Added `volumes: dict = field(default_factory=dict)` to `SandboxConfig`
- Passes `volumes=cfg.volumes or None` to `client.containers.run()`
- Verified: `SandboxConfig(volumes={...})` works correctly ✓

**`services/orchestrator.py`**
- Computes `agent_workspace_dir = AGENT_WORKSPACES_DIR / agent.id`
- Creates it with `mkdir(parents=True, exist_ok=True)`
- Passes `volumes={str(agent_workspace_dir.resolve()): {"bind": "/workspace", "mode": "rw"}}` to SandboxConfig
- Logs `"Persistent workspace mounted: ..."` per run
- Removed `_inject_uploaded_files()` call (no longer needed — workspace is bind-mounted)

**`routers/runs.py`** (Plan 7.1 integration)
- Upload endpoint now writes to `AGENT_WORKSPACES_DIR/{agent_id}/` instead of `WORKSPACE_UPLOADS_DIR/{run_id}/`
- Uploaded files are immediately visible via the bind-mount — no injection step needed

**`routers/agents.py`**
- `GET /api/agents/{id}/workspace` → returns `{"files": [{name, size_bytes, modified_at}]}`; empty list if dir doesn't exist
- `DELETE /api/agents/{id}/workspace/{filename}` → 204 on success, 404 if not found; path traversal protected

### Frontend

**`lib/api.ts`**
- Added `WorkspaceFile` interface `{name, size_bytes, modified_at}`
- Added `agentApi.listAgentWorkspace(agentId)` and `agentApi.deleteWorkspaceFile(agentId, filename)`

**`pages/AgentEditorPage.tsx`**
- Added `agentWorkspaceFiles: WorkspaceFile[]` and `isLoadingWorkspace: boolean` state
- Added `loadWorkspaceFiles()` — called in useEffect on mount (edit mode only) and after deletion
- Added `handleDeleteWorkspaceFile(filename)` — confirm → delete → refresh list  
- Added **Workspace** card below Run Agent card:
  - FolderOpen icon, file count in header
  - Refresh (↻) button in top-right corner
  - File list: mono filename, smart-formatted size (B / KB / MB), Trash2 delete button
  - Empty state: *"No workspace files yet. Attach files when starting a run."*
  - Only visible on saved agent pages (edit mode)

## Success Criteria ✅
- [x] `SandboxConfig` has `volumes` field — verified with Python
- [x] Orchestrator creates `./agent_workspaces/{agent_id}/` and mounts it
- [x] Files from one run persist for next run (same host dir)
- [x] `GET /api/agents/{id}/workspace` lists files
- [x] `DELETE /api/agents/{id}/workspace/{filename}` removes file
- [x] Workspace panel visible on agent edit page, not /agents/new
- [x] TypeScript clean (zero errors)
- [x] Committed: `feat(phase-7): plan 7.2`
