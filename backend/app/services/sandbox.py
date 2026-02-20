"""Agent Lab — Docker Sandbox Manager for isolated agent execution."""

import asyncio
import logging
import tarfile
import tempfile
import time
from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path

import docker
import docker.errors
from docker.models.containers import Container

logger = logging.getLogger(__name__)

# Label applied to all sandbox containers for easy identification and cleanup
SANDBOX_LABEL = "agent-lab-sandbox"
SANDBOX_IMAGE = "python:3.12-slim"


@dataclass
class SandboxConfig:
    """Configuration for a sandbox container."""
    image: str = SANDBOX_IMAGE
    cpu_limit: float = 1.0          # Number of CPUs
    memory_limit: str = "512m"      # Docker memory limit string
    timeout_seconds: int = 120      # Default command timeout
    network_enabled: bool = True
    working_dir: str = "/workspace"
    volumes: dict = field(default_factory=dict)  # host_path -> {bind, mode}


@dataclass
class SandboxResult:
    """Result of a command executed inside a sandbox container."""
    exit_code: int
    stdout: str
    stderr: str
    duration_seconds: float

    @property
    def success(self) -> bool:
        return self.exit_code == 0


class SandboxManager:
    """
    Manages the lifecycle of Docker sandbox containers for agent execution.

    All methods are async — synchronous Docker SDK calls are wrapped with
    asyncio.to_thread() to avoid blocking the event loop.
    """

    def __init__(self) -> None:
        self._client: docker.DockerClient | None = None

    def _get_client(self) -> docker.DockerClient:
        """Lazily initialize and return the Docker client."""
        if self._client is None:
            self._client = docker.from_env()
        return self._client

    # ─────────────────────────────────────────────────────────────────────────
    # Container lifecycle
    # ─────────────────────────────────────────────────────────────────────────

    async def create_sandbox(self, config: SandboxConfig | None = None) -> str:
        """
        Create a new sandbox container.

        Returns:
            The container ID (short form).
        """
        cfg = config or SandboxConfig()

        def _create() -> str:
            client = self._get_client()

            # Ensure the working directory exists inside the container by
            # running sleep infinity — the orchestrator will write files and
            # execute commands via exec_run.
            container: Container = client.containers.run(
                image=cfg.image,
                command="sleep infinity",
                detach=True,
                labels={SANDBOX_LABEL: "true"},
                working_dir=cfg.working_dir,
                nano_cpus=int(cfg.cpu_limit * 1e9),
                mem_limit=cfg.memory_limit,
                network_disabled=not cfg.network_enabled,
                volumes=cfg.volumes or None,
                # Create the working directory on startup
                entrypoint=[
                    "sh", "-c",
                    f"mkdir -p {cfg.working_dir} && sleep infinity",
                ],
            )
            return container.short_id  # type: ignore[return-value]

        container_id = await asyncio.to_thread(_create)
        logger.info("Sandbox created: %s", container_id)
        return container_id

    async def destroy_sandbox(self, container_id: str) -> None:
        """Stop and remove a sandbox container."""
        def _destroy() -> None:
            try:
                client = self._get_client()
                container = client.containers.get(container_id)
                container.stop(timeout=5)
                container.remove(force=True)
                logger.info("Sandbox destroyed: %s", container_id)
            except docker.errors.NotFound:
                logger.warning("Sandbox %s already gone", container_id)
            except Exception as exc:
                logger.error("Error destroying sandbox %s: %s", container_id, exc)

        await asyncio.to_thread(_destroy)

    # ─────────────────────────────────────────────────────────────────────────
    # Command execution
    # ─────────────────────────────────────────────────────────────────────────

    async def execute_command(
        self,
        container_id: str,
        command: str,
        timeout: int = 60,
    ) -> SandboxResult:
        """
        Run a shell command inside the container and return the result.

        Args:
            container_id: The container to run the command in.
            command: The shell command string to execute.
            timeout: Maximum seconds to wait for the command to complete.

        Returns:
            SandboxResult with exit_code, stdout, stderr, and duration.
        """
        def _exec() -> SandboxResult:
            client = self._get_client()
            container = client.containers.get(container_id)
            start = time.monotonic()

            exit_code, output = container.exec_run(
                cmd=["sh", "-c", command],
                stdout=True,
                stderr=True,
                demux=True,
            )

            duration = time.monotonic() - start
            stdout_bytes, stderr_bytes = output if output else (b"", b"")
            return SandboxResult(
                exit_code=exit_code or 0,
                stdout=(stdout_bytes or b"").decode("utf-8", errors="replace"),
                stderr=(stderr_bytes or b"").decode("utf-8", errors="replace"),
                duration_seconds=duration,
            )

        try:
            result = await asyncio.wait_for(
                asyncio.to_thread(_exec),
                timeout=timeout,
            )
        except asyncio.TimeoutError:
            logger.warning("Command timed out after %ds in sandbox %s", timeout, container_id)
            return SandboxResult(
                exit_code=124,  # Standard timeout exit code
                stdout="",
                stderr=f"Command timed out after {timeout} seconds",
                duration_seconds=float(timeout),
            )
        return result

    # ─────────────────────────────────────────────────────────────────────────
    # File I/O
    # ─────────────────────────────────────────────────────────────────────────

    async def write_file(
        self,
        container_id: str,
        path: str,
        content: str,
    ) -> None:
        """Write a text file into the container at the given path."""
        def _write() -> None:
            client = self._get_client()
            container = client.containers.get(container_id)

            # Build a tar archive in memory containing the file
            data = content.encode("utf-8")
            file_name = Path(path).name
            parent_dir = str(Path(path).parent)

            buf = BytesIO()
            with tarfile.open(fileobj=buf, mode="w") as tar:
                info = tarfile.TarInfo(name=file_name)
                info.size = len(data)
                tar.addfile(info, BytesIO(data))
            buf.seek(0)

            # Ensure parent directory exists then upload the tar
            container.exec_run(["mkdir", "-p", parent_dir])
            container.put_archive(parent_dir, buf)

        await asyncio.to_thread(_write)

    async def read_file(
        self,
        container_id: str,
        path: str,
    ) -> str:
        """Read a text file from inside the container."""
        result = await self.execute_command(container_id, f"cat '{path}'")
        if result.exit_code != 0:
            raise FileNotFoundError(
                f"Could not read '{path}' from sandbox: {result.stderr}"
            )
        return result.stdout

    # ─────────────────────────────────────────────────────────────────────────
    # Cleanup utilities
    # ─────────────────────────────────────────────────────────────────────────

    async def cleanup_stale_sandboxes(self, max_age_minutes: int = 30) -> int:
        """
        Find and remove agent-lab sandbox containers older than max_age_minutes.

        Returns:
            The number of containers removed.
        """
        def _cleanup() -> int:
            client = self._get_client()
            containers = client.containers.list(
                all=True,
                filters={"label": SANDBOX_LABEL},
            )
            removed = 0
            for container in containers:
                try:
                    container.stop(timeout=3)
                    container.remove(force=True)
                    removed += 1
                    logger.info("Cleaned up stale sandbox: %s", container.short_id)
                except Exception as exc:
                    logger.warning("Could not clean up %s: %s", container.short_id, exc)
            return removed

        count = await asyncio.to_thread(_cleanup)
        if count:
            logger.info("Cleaned up %d stale sandbox(es)", count)
        return count
