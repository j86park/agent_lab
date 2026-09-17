"""Agent Lab — Runs API router.

Endpoints for creating, listing, retrieving, and deleting agent runs.
Execution is handled asynchronously via FastAPI BackgroundTasks.
"""

import logging
from pathlib import Path
from typing import Optional

import aiofiles
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, UploadFile, File, status
from fastapi.responses import PlainTextResponse
from app.services.context_engine import context_engine
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
import json
from app.database import get_session
from app.models import Agent, Run, RunLog, TrajectoryEvent
from app.schemas import (
    RunCreate,
    RunForkRequest,
    RunListResponse,
    RunLogResponse,
    RunResponse,
    RunTagUpdate,
    ToolApprovalRequest,
    ToolApprovalStatus,
    TrajectoryEventResponse,
    TrajectoryResponse,
)
from app.services.approval_manager import approval_manager
from app.services.orchestrator import AgentOrchestrator
from app.services.workspace_service import workspace_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/runs", tags=["runs"])

MAX_UPLOAD_FILES = 10
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB per file


# ─────────────────────────────────────────────────────────────────────────────
# Background task wrapper
# ─────────────────────────────────────────────────────────────────────────────

async def _run_agent_background(run_id: str) -> None:
    """Launch the orchestrator for a run — called as a FastAPI BackgroundTask."""
    try:
        orchestrator = AgentOrchestrator()
        await orchestrator.execute_run(run_id)
    except Exception as exc:
        logger.exception("Background run %s crashed: %s", run_id, exc)


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────
from app.services.prompt_service import get_resolved_system_prompt

@router.post("", response_model=RunResponse, status_code=status.HTTP_201_CREATED)
async def create_run(
    payload: RunCreate,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
) -> RunResponse:
    """
    Create a new run and start execution in the background.

    The run is returned immediately with status="pending". The frontend
    should poll GET /api/runs/{id} until status changes to
    "completed" or "failed".
    """
    # Verify the agent exists
    agent = await session.get(Agent, payload.agent_id)
    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent '{payload.agent_id}' not found",
        )

    # Resolve {{variable}} placeholders in the system prompt
    resolved: str | None = None
    if payload.variable_values:
        resolved = await get_resolved_system_prompt(payload.agent_id, session, payload.variable_values)

    run = Run(
        agent_id=payload.agent_id,
        task=payload.task,
        status="pending",
        resolved_prompt=resolved,
        tags=payload.tags,
    )
    session.add(run)
    await session.commit()
    await session.refresh(run)

    # Fire and forget — orchestrator updates the run record
    background_tasks.add_task(_run_agent_background, run.id)
    logger.info("Run %s created for agent %s, queued for execution", run.id, agent.id)

    return RunResponse.model_validate(run)


@router.get("", response_model=RunListResponse)
async def list_runs(
    agent_id: Optional[str] = Query(None, description="Filter by agent ID"),
    tag: Optional[str] = Query(None, description="Filter by tag substring"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
) -> RunListResponse:
    """List all runs, optionally filtered by agent and/or tag, newest first."""
    stmt = select(Run).order_by(Run.created_at.desc()).offset(skip).limit(limit)
    count_stmt = select(func.count()).select_from(Run)

    if agent_id:
        stmt = stmt.where(Run.agent_id == agent_id)
        count_stmt = count_stmt.where(Run.agent_id == agent_id)

    if tag:
        stmt = stmt.where(Run.tags.contains(tag))
        count_stmt = count_stmt.where(Run.tags.contains(tag))

    total_result = await session.execute(count_stmt)
    total = total_result.scalar_one()

    result = await session.execute(stmt)
    runs = result.scalars().all()

    return RunListResponse(
        runs=[RunResponse.model_validate(r) for r in runs],
        total=total,
    )


@router.patch("/{run_id}/tags", response_model=RunResponse)
async def update_run_tags(
    run_id: str,
    payload: RunTagUpdate,
    session: AsyncSession = Depends(get_session),
) -> RunResponse:
    """Update the tags on a run (comma-separated string)."""
    run = await session.get(Run, run_id)
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Run '{run_id}' not found",
        )
    run.tags = payload.tags
    await session.commit()
    await session.refresh(run)
    return RunResponse.model_validate(run)


@router.get("/{run_id}", response_model=RunResponse)
async def get_run(
    run_id: str,
    session: AsyncSession = Depends(get_session),
) -> RunResponse:
    """Get a single run by ID."""
    run = await session.get(Run, run_id)
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Run '{run_id}' not found",
        )
    return RunResponse.model_validate(run)


@router.get("/{run_id}/logs", response_model=list[RunLogResponse])
async def get_run_logs(
    run_id: str,
    session: AsyncSession = Depends(get_session),
) -> list[RunLogResponse]:
    """Get all log entries for a run, ordered chronologically."""
    # Verify run exists
    run = await session.get(Run, run_id)
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Run '{run_id}' not found",
        )

    stmt = select(RunLog).where(RunLog.run_id == run_id).order_by(RunLog.timestamp.asc())
    result = await session.execute(stmt)
    logs = result.scalars().all()

    return [RunLogResponse.model_validate(log) for log in logs]


@router.delete("/{run_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_run(
    run_id: str,
    session: AsyncSession = Depends(get_session),
) -> None:
    """Delete a run and all its log entries."""
    run = await session.get(Run, run_id)
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Run '{run_id}' not found",
        )

    # Guard: prevent deletion of in-progress runs
    if run.status == "running":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete a run that is currently running",
        )

    await session.delete(run)
    await session.commit()


@router.post("/{run_id}/files", status_code=status.HTTP_200_OK)
async def upload_run_files(
    run_id: str,
    files: list[UploadFile] = File(...),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """
    Upload files into the agent's persistent workspace directory.

    Files land in AGENT_WORKSPACES_DIR/{agent_id}/ which is bind-mounted
    into /workspace in the sandbox — so they are visible to the agent
    immediately on the next run (or the current one if uploaded before
    the orchestrator starts).

    Limits: max 10 files, max 10 MB per file.
    """
    run = await session.get(Run, run_id)
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Run '{run_id}' not found",
        )

    if len(files) > MAX_UPLOAD_FILES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Too many files: max {MAX_UPLOAD_FILES} allowed",
        )

    upload_dir: Path = settings.AGENT_WORKSPACES_DIR / run.agent_id
    upload_dir.mkdir(parents=True, exist_ok=True)

    saved: list[str] = []
    for upload in files:
        content = await upload.read()
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File '{upload.filename}' exceeds 10 MB limit",
            )
        filename = Path(upload.filename or "file").name  # strip any path component
        dest = upload_dir / filename
        async with aiofiles.open(dest, "wb") as f:
            await f.write(content)
        saved.append(filename)
        logger.info("Uploaded workspace file '%s' for agent %s", filename, run.agent_id)

    return {"uploaded": saved}


@router.get("/{run_id}/artifacts")
async def list_run_artifacts(
    run_id: str,
    session: AsyncSession = Depends(get_session),
):
    """List all offloaded artifacts for a run."""
    run = await session.get(Run, run_id)
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Run '{run_id}' not found",
        )

    run_artifacts_dir = context_engine.get_run_artifacts_dir(run_id)
    if not run_artifacts_dir.exists():
        return {"artifacts": []}

    artifacts = []
    for f in run_artifacts_dir.iterdir():
        if f.is_file():
            artifacts.append({
                "name": f.name,
                "size_bytes": f.stat().st_size,
                "uri": f"artifact://{run_id}/{f.name}",
            })
    return {"artifacts": artifacts}


@router.get("/{run_id}/artifacts/{artifact_id}", response_class=PlainTextResponse)
async def get_run_artifact(
    run_id: str,
    artifact_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Retrieve full raw content of an offloaded run artifact."""
    run = await session.get(Run, run_id)
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Run '{run_id}' not found",
        )

    try:
        content = context_engine.read_artifact(run_id, artifact_id)
        return content
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Artifact '{artifact_id}' not found for run '{run_id}'",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# ─────────────────────────────────────────────────────────────────────────────
# Trajectory Debugger & Time-Travel Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{run_id}/trajectory", response_model=TrajectoryResponse)
async def get_run_trajectory(
    run_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Retrieve the full chronological event stream for an agent run."""
    run = await session.get(Run, run_id)
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Run '{run_id}' not found",
        )

    stmt = (
        select(TrajectoryEvent)
        .where(TrajectoryEvent.run_id == run_id)
        .order_by(TrajectoryEvent.step_index.asc(), TrajectoryEvent.created_at.asc())
    )
    res = await session.execute(stmt)
    events = res.scalars().all()

    formatted_events = []
    for e in events:
        try:
            payload = json.loads(e.payload_json)
        except Exception:
            payload = {"raw": e.payload_json}

        formatted_events.append(
            TrajectoryEventResponse(
                id=e.id,
                run_id=e.run_id,
                step_index=e.step_index,
                event_type=e.event_type,
                payload=payload,
                created_at=e.created_at,
            )
        )

    return TrajectoryResponse(
        run_id=run_id,
        events=formatted_events,
        total_events=len(formatted_events),
    )


@router.post("/{run_id}/fork", response_model=RunResponse, status_code=status.HTTP_201_CREATED)
async def fork_run_at_step(
    run_id: str,
    payload: RunForkRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
):
    """
    Time-travel debugging: Fork an existing run from step_index.
    Clones history events 0..step_index, restores workspace snapshot, and launches execution.
    """
    parent_run = await session.get(Run, run_id)
    if parent_run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Parent run '{run_id}' not found",
        )

    agent = await session.get(Agent, parent_run.agent_id)
    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated agent not found",
        )

    # Create new child Run record
    child_run = Run(
        agent_id=agent.id,
        task=payload.override_task or parent_run.task,
        status="pending",
        tags=f"forked_from_{run_id[:8]}",
        resolved_prompt=payload.override_prompt or parent_run.resolved_prompt,
    )
    session.add(child_run)
    await session.commit()
    await session.refresh(child_run)

    # Clone historical trajectory events up to step_index
    stmt = (
        select(TrajectoryEvent)
        .where(TrajectoryEvent.run_id == run_id, TrajectoryEvent.step_index <= payload.step_index)
        .order_by(TrajectoryEvent.step_index.asc())
    )
    events_res = await session.execute(stmt)
    events_to_clone = events_res.scalars().all()

    for e in events_to_clone:
        cloned_event = TrajectoryEvent(
            run_id=child_run.id,
            step_index=e.step_index,
            event_type=e.event_type,
            payload_json=e.payload_json,
        )
        session.add(cloned_event)
    await session.commit()

    # Clone workspace snapshot state
    parent_workspace = settings.AGENT_WORKSPACES_DIR / agent.id
    workspace_service.restore_step_snapshot(parent_workspace, payload.step_index)

    # Launch execution of the forked child run in the background
    background_tasks.add_task(_run_agent_background, child_run.id)
    logger.info("Forked run %s from parent %s at step %d", child_run.id, run_id, payload.step_index)

    return RunResponse.model_validate(child_run)


@router.get("/{run_id}/approval", response_model=ToolApprovalStatus)
async def get_tool_approval_status(
    run_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Inspect whether a run is currently waiting for human-in-the-loop approval."""
    run = await session.get(Run, run_id)
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Run '{run_id}' not found",
        )

    pending_details = approval_manager.get_pending(run_id)
    return ToolApprovalStatus(
        run_id=run_id,
        status=run.status,
        pending_tool=pending_details,
    )


@router.post("/{run_id}/approve")
async def approve_tool_call(
    run_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Approve a pending tool call on a paused/breakpoint run."""
    run = await session.get(Run, run_id)
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Run '{run_id}' not found",
        )

    success = await approval_manager.approve(run_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Run '{run_id}' has no pending tool call awaiting approval",
        )
    return {"status": "approved", "run_id": run_id}


@router.post("/{run_id}/reject")
async def reject_tool_call(
    run_id: str,
    payload: ToolApprovalRequest,
    session: AsyncSession = Depends(get_session),
):
    """Reject a pending tool call on a paused/breakpoint run."""
    run = await session.get(Run, run_id)
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Run '{run_id}' not found",
        )

    success = await approval_manager.reject(run_id, reason=payload.rejection_reason or "Rejected by user")
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Run '{run_id}' has no pending tool call awaiting approval",
        )
    return {"status": "rejected", "run_id": run_id, "reason": payload.rejection_reason}


@router.post("/{run_id}/pause")
async def pause_run(
    run_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Pause an active run before its next iteration."""
    run = await session.get(Run, run_id)
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Run '{run_id}' not found",
        )

    approval_manager.pause(run_id)
    run.status = "paused"
    await session.commit()
    return {"status": "paused", "run_id": run_id}


@router.post("/{run_id}/resume")
async def resume_run(
    run_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Resume a paused run."""
    run = await session.get(Run, run_id)
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Run '{run_id}' not found",
        )

    approval_manager.resume(run_id)
    run.status = "running"
    await session.commit()
    return {"status": "running", "run_id": run_id}
