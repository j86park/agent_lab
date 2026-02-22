"""Agent Lab — Agent CRUD API routes."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import Agent
from app.schemas import AgentCreate, AgentUpdate, AgentResponse, AgentListResponse
from app.services import agent_service
from app.services.prompt_service import get_resolved_system_prompt


router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.post("", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    agent_in: AgentCreate, session: AsyncSession = Depends(get_session)
):
    """Create a new AI agent configuration."""
    agent = Agent(
        name=agent_in.name,
        description=agent_in.description,
        system_prompt=agent_in.system_prompt,
        tools_config=agent_in.tools_config,
        constraints_config=agent_in.constraints_config,
        provider=agent_in.provider,
        model=agent_in.model,
    )
    session.add(agent)
    await session.commit()
    await session.refresh(agent)
    return agent


@router.get("", response_model=AgentListResponse)
async def list_agents(
    skip: int = 0, limit: int = 50, session: AsyncSession = Depends(get_session)
):
    """List all configured AI agents with pagination."""
    # Query for agents
    agents_query = select(Agent).offset(skip).limit(limit).order_by(Agent.created_at.desc())
    agents_result = await session.execute(agents_query)
    agents = agents_result.scalars().all()

    # Query for total count
    count_query = select(func.count()).select_from(Agent)
    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    return {"agents": agents, "total": total}


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: str, session: AsyncSession = Depends(get_session)):
    """Get a single agent configuration by ID."""
    result = await session.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found"
        )
    return agent


@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: str, agent_in: AgentUpdate, session: AsyncSession = Depends(get_session)
):
    """Update an existing agent configuration."""
    result = await session.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found"
        )

    # Update only fields that were provided
    update_data = agent_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(agent, field, value)

    await session.commit()
    await session.refresh(agent)
    return agent

@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(agent_id: str, session: AsyncSession = Depends(get_session)):
    """Delete an agent configuration."""
    result = await session.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found"
        )
    
    await session.delete(agent)
    await session.commit()
    return None


@router.get("/{agent_id}/preview")
async def get_agent_prompt_preview(
    agent_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Get the fully resolved system prompt for an agent (with skills)."""
    result = await session.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found"
        )
    
    try:
        combined_prompt = await get_resolved_system_prompt(agent_id, session)
        return {"prompt": combined_prompt}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to build prompt preview: {str(e)}"
        )


@router.get("/{agent_id}/export")
async def export_agent(
    agent_id: str,
    format: str = "python",
    session: AsyncSession = Depends(get_session),
):
    """Export an agent as standalone code."""
    result = await session.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found"
        )
    return agent_service.export_agent(agent, format)


# ─────────────────────────────────────────────────────────────────────────────
# Workspace endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{agent_id}/workspace")
async def list_workspace_files(
    agent_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """List files in the agent's persistent workspace directory."""
    result = await session.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    files = agent_service.list_workspace_files(agent_id)
    return {"files": files}


@router.delete("/{agent_id}/workspace/{filename}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace_file(
    agent_id: str,
    filename: str,
    session: AsyncSession = Depends(get_session),
) -> None:
    """Delete a single file from the agent's persistent workspace."""
    result = await session.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    agent_service.delete_workspace_file(agent_id, filename)
