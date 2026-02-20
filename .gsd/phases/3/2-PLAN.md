---
phase: 3
plan: 2
wave: 1
---

# Plan 3.2: Sandbox Manager

## Objective
Create a Docker sandbox manager that can create, monitor, and destroy isolated containers for agent execution. Each sandbox has resource limits (CPU, memory, network) and a working directory for agent code and artifacts.

## Context
- .gsd/SPEC.md
- backend/app/config.py
- docker-compose.yml
- backend/requirements.txt (docker>=7.0.0 already listed)

## Tasks

<task type="auto">
  <name>Implement Docker sandbox lifecycle manager</name>
  <files>
    backend/app/services/sandbox.py
  </files>
  <action>
    1. Create `backend/app/services/sandbox.py`:
       ```python
       @dataclass
       class SandboxConfig:
           image: str = "python:3.12-slim"
           cpu_limit: float = 1.0  # Number of CPUs
           memory_limit: str = "512m"
           timeout_seconds: int = 120
           network_enabled: bool = True
           working_dir: str = "/workspace"

       @dataclass
       class SandboxResult:
           exit_code: int
           stdout: str
           stderr: str
           duration_seconds: float

       class SandboxManager:
           def __init__(self):
               self.client = docker.from_env()

           async def create_sandbox(self, config: SandboxConfig) -> str:
               # Create container, return container ID
               # Mount a temp dir as /workspace
               # Apply resource limits

           async def execute_command(self, container_id: str, command: str, timeout: int = 60) -> SandboxResult:
               # Run command inside container, capture output
               # Enforce timeout

           async def write_file(self, container_id: str, path: str, content: str) -> None:
               # Write a file inside the container

           async def read_file(self, container_id: str, path: str) -> str:
               # Read a file from inside the container

           async def destroy_sandbox(self, container_id: str) -> None:
               # Stop and remove the container
               # Clean up temp directory
       ```

    2. Key behaviors:
       - Uses `docker.from_env()` to connect via Docker socket
       - Creates containers with labels `agent-lab=sandbox` for cleanup
       - Resource limits via Docker container config (nano_cpus, mem_limit)
       - Timeout enforcement using asyncio.wait_for
       - Auto-cleanup on destroy (container + temp files)
       - File I/O uses `docker exec` tar/cat commands or container.put_archive

    3. Add a cleanup utility:
       ```python
       async def cleanup_stale_sandboxes(self, max_age_minutes: int = 30) -> int:
           # Find and remove old agent-lab sandbox containers
       ```

    IMPORTANT:
    - Use `asyncio.to_thread()` to wrap synchronous Docker SDK calls
    - All methods must be async
    - Always try to destroy containers even if execution fails
    - Label all containers for easy identification and cleanup
  </action>
  <verify>
    cd backend; ..\a_lab\Scripts\python.exe -c "from app.services.sandbox import SandboxManager, SandboxConfig; print('Sandbox manager OK')"
  </verify>
  <done>
    - SandboxManager creates Docker containers with resource limits
    - Can execute commands and capture output
    - File read/write inside container works
    - Container cleanup works
    - All methods are async
  </done>
</task>

## Success Criteria
- [ ] SandboxManager class imports without errors
- [ ] create_sandbox creates a labeled Docker container
- [ ] execute_command runs code and captures stdout/stderr
- [ ] destroy_sandbox cleans up containers
- [ ] Resource limits (CPU, memory) are applied
