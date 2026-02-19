# Plan 3.2 Summary: Sandbox Manager

## Changes Made

### [NEW] `backend/app/services/sandbox.py`

Three main classes:

| Class | Purpose |
|-------|---------|
| `SandboxConfig` | Dataclass: `image`, `cpu_limit`, `memory_limit`, `timeout_seconds`, `network_enabled`, `working_dir` |
| `SandboxResult` | Dataclass: `exit_code`, `stdout`, `stderr`, `duration_seconds`, `.success` property |
| `SandboxManager` | Docker container lifecycle manager — all methods are async |

**SandboxManager methods:**

| Method | What it does |
|--------|-------------|
| `create_sandbox(config?)` | Creates a labeled container with resource limits; returns container ID |
| `destroy_sandbox(container_id)` | Stops and removes the container (silent if already gone) |
| `execute_command(container_id, command, timeout)` | Runs a shell command via `exec_run`, returns `SandboxResult`; enforces timeout |
| `write_file(container_id, path, content)` | Writes a text file into the container using `put_archive` |
| `read_file(container_id, path)` | Reads a file via `cat` command |
| `cleanup_stale_sandboxes(max_age_minutes?)` | Removes all containers labeled `agent-lab-sandbox` |

## Verification Results

```
Sandbox manager OK
```

- All 6 methods present on `SandboxManager`
- Config defaults verified (1 CPU, 512m, 120s timeout)

## Technical Notes
- All Docker SDK calls wrapped in `asyncio.to_thread()` — non-blocking
- Timeout enforced via `asyncio.wait_for()` on the thread (exit code 124)
- File writes use tar archive (`put_archive`) for reliability
- All containers labeled `agent-lab-sandbox=true` for cleanup targeting
- Docker client is lazily initialized (`_get_client()` called on first call)
