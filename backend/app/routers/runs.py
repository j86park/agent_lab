"""Agent Lab — Runs API router.

Endpoints for creating, listing, retrieving, and deleting agent runs.
Execution is handled asynchronously via FastAPI BackgroundTasks.
"""

import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import Agent, Run, RunLog
from app.schemas import RunCreate, RunListResponse, RunLogResponse, RunResponse
from app.services.orchestrator import AgentOrchestrator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/runs", tags=["runs"])


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

    run = Run(
        agent_id=payload.agent_id,
        task=payload.task,
        status="pending",
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
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
) -> RunListResponse:
    """List all runs, optionally filtered by agent, newest first."""
    stmt = select(Run).order_by(Run.created_at.desc()).offset(skip).limit(limit)
    count_stmt = select(func.count()).select_from(Run)

    if agent_id:
        stmt = stmt.where(Run.agent_id == agent_id)
        count_stmt = count_stmt.where(Run.agent_id == agent_id)

    total_result = await session.execute(count_stmt)
    total = total_result.scalar_one()

    result = await session.execute(stmt)
    runs = result.scalars().all()

    return RunListResponse(
        runs=[RunResponse.model_validate(r) for r in runs],
        total=total,
    )


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
