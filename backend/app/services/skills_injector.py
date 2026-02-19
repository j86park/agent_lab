"""Agent Lab — Skill Injection Engine.

Merges an agent's base system prompt with the instructions from all
skills attached to that agent.
"""

import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Agent, AgentSkill, Skill

logger = logging.getLogger(__name__)

_SKILL_SEPARATOR = "\n\n---\n"
_SKILL_HEADER = "## Skill: {name}\n{instructions}"


async def build_system_prompt(agent_id: str, session: AsyncSession) -> str:
    """
    Build the complete system prompt for an agent run.

    Loads the agent's base system_prompt, queries all attached skills
    in order, and appends each skill's instructions in a clearly delimited
    section.

    Args:
        agent_id: The ID of the agent whose prompt to build.
        session:  An open async database session.

    Returns:
        The combined system prompt string.

    Raises:
        ValueError: If the agent is not found.
    """
    # Load the agent
    agent = await session.get(Agent, agent_id)
    if agent is None:
        raise ValueError(f"Agent '{agent_id}' not found")

    parts = [agent.system_prompt.strip()]

    # Load attached skills via the junction table
    stmt = (
        select(Skill)
        .join(AgentSkill, AgentSkill.skill_id == Skill.id)
        .where(AgentSkill.agent_id == agent_id)
        .order_by(Skill.name)
    )
    result = await session.execute(stmt)
    skills = result.scalars().all()

    for skill in skills:
        header = _SKILL_HEADER.format(
            name=skill.name,
            instructions=skill.instructions.strip(),
        )
        parts.append(header)

    combined = _SKILL_SEPARATOR.join(parts)
    logger.debug(
        "Built system prompt for agent %s: %d chars, %d skill(s)",
        agent_id,
        len(combined),
        len(skills),
    )
    return combined
