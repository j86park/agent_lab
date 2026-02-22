"""Agent Lab — Agent Service Layer."""

from datetime import datetime, UTC
from pathlib import Path

from fastapi import HTTPException, status

from app.config import settings
from app.models import Agent
from app.services.export_generators import (
    generate_python_script,
    generate_fastapi_app,
    generate_dockerfile,
)


_EXPORT_FORMATS = {"python", "fastapi", "docker"}

_EXPORT_FILENAMES = {
    "python": "agent.py",
    "fastapi": "agent_app.py",
    "docker": "Dockerfile",
}

def export_agent(agent: Agent, format: str = "python") -> dict:
    """Export an agent as standalone code."""
    if format not in _EXPORT_FORMATS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown format '{format}'. Valid options: {sorted(_EXPORT_FORMATS)}",
        )

    if format == "python":
        content = generate_python_script(agent)
    elif format == "fastapi":
        content = generate_fastapi_app(agent)
    else:  # docker
        content = generate_dockerfile(agent)

    return {
        "filename": _EXPORT_FILENAMES[format],
        "content": content,
        "format": format,
    }


def list_workspace_files(agent_id: str) -> list[dict]:
    """List files in the agent's persistent workspace directory."""
    workspace_dir: Path = settings.AGENT_WORKSPACES_DIR / agent_id
    if not workspace_dir.exists():
        return []

    files = []
    for entry in sorted(workspace_dir.iterdir()):
        if entry.is_file():
            stat = entry.stat()
            files.append({
                "name": entry.name,
                "size_bytes": stat.st_size,
                "modified_at": datetime.fromtimestamp(stat.st_mtime, UTC).isoformat(),
            })

    return files


def delete_workspace_file(agent_id: str, filename: str) -> None:
    """Delete a single file from the agent's persistent workspace."""
    # Prevent path traversal
    safe_name = Path(filename).name
    file_path: Path = settings.AGENT_WORKSPACES_DIR / agent_id / safe_name

    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{safe_name}' not found in workspace",
        )

    file_path.unlink()
