"""Agent Lab — Analytics API routes."""

from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import Run, Agent

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/summary")
async def get_analytics_summary(session: AsyncSession = Depends(get_session)):
    """Get high-level analytics for the entire project."""
    # Total stats
    stmt = select(
        func.count(Run.id).label("total_runs"),
        func.sum(Run.cost).label("total_cost"),
        func.sum(Run.total_tokens).label("total_tokens")
    )
    result = await session.execute(stmt)
    row = result.fetchone()
    
    total_runs = row[0] or 0
    total_cost = row[1] or 0.0
    total_tokens = row[2] or 0

    # Success rate
    stmt_success = select(func.count(Run.id)).where(Run.status == "completed")
    res_success = await session.execute(stmt_success)
    success_runs = res_success.scalar() or 0
    
    success_rate = (success_runs / total_runs) if total_runs > 0 else 0

    # Most active agent
    stmt_active = (
        select(Agent.name, func.count(Run.id).label("run_count"))
        .join(Run)
        .group_by(Agent.id)
        .order_by(desc("run_count"))
        .limit(1)
    )
    res_active = await session.execute(stmt_active)
    active_row = res_active.fetchone()
    most_active = active_row[0] if active_row else "None"

    return {
        "total_runs": total_runs,
        "total_cost": total_cost,
        "total_tokens": total_tokens,
        "success_rate": success_rate,
        "most_active_agent": most_active
    }

@router.get("/agents")
async def get_all_agents_analytics(session: AsyncSession = Depends(get_session)):
    """Get aggregate analytics for all agents."""
    # This query groups runs by agent and calculates metrics
    stmt = (
        select(
            Agent.id,
            Agent.name,
            Agent.provider,
            func.count(Run.id).label("total_runs"),
            func.sum(Run.cost).label("total_cost"),
            func.sum(Run.total_tokens).label("total_tokens"),
            func.count(Run.id).filter(Run.status == "completed").label("success_runs")
        )
        .join(Run, Run.agent_id == Agent.id, isouter=True)
        .group_by(Agent.id)
        .order_by(desc("total_runs"))
    )
    
    result = await session.execute(stmt)
    rows = result.fetchall()
    
    analytics = []
    for r in rows:
        total = r[3] or 0
        success = r[6] or 0
        analytics.append({
            "agent_id": r[0],
            "agent_name": r[1],
            "provider": r[2],
            "total_runs": total,
            "total_cost": r[4] or 0.0,
            "total_tokens": r[5] or 0,
            "success_rate": (success / total) if total > 0 else 0
        })
        
    return {"agents": analytics}

@router.get("/agents/{agent_id}")
async def get_agent_analytics(agent_id: str, session: AsyncSession = Depends(get_session)):
    """Get detailed analytics for a specific agent."""
    # Verify agent exists
    agent = await session.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Aggregate stats
    stmt = select(
        func.count(Run.id).label("total_runs"),
        func.sum(Run.cost).label("total_cost"),
        func.sum(Run.total_tokens).label("total_tokens"),
        func.avg(Run.cost).label("avg_cost"),
        func.avg(Run.total_tokens).label("avg_tokens")
    ).where(Run.agent_id == agent_id)
    
    result = await session.execute(stmt)
    row = result.fetchone()
    
    total_runs = row[0] or 0
    
    # Success rate
    stmt_success = select(func.count(Run.id)).where(
        Run.agent_id == agent_id,
        Run.status == "completed"
    )
    res_success = await session.execute(stmt_success)
    success_runs = res_success.scalar() or 0

    # Trend (last 7 days)
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    stmt_trend = (
        select(
            func.date(Run.created_at).label("date"),
            func.count(Run.id).label("runs"),
            func.sum(Run.cost).label("cost")
        )
        .where(Run.agent_id == agent_id, Run.created_at >= seven_days_ago)
        .group_by(func.date(Run.created_at))
        .order_by("date")
    )
    res_trend = await session.execute(stmt_trend)
    trend = [
        {"date": str(r[0]), "runs": r[1], "cost": r[2] or 0.0}
        for r in res_trend.fetchall()
    ]

    return {
        "agent_name": agent.name,
        "total_runs": total_runs,
        "success_rate": (success_runs / total_runs) if total_runs > 0 else 0,
        "total_cost": row[1] or 0.0,
        "avg_cost": row[3] or 0.0,
        "total_tokens": row[2] or 0,
        "avg_tokens": row[4] or 0.0,
        "trend": trend
    }
