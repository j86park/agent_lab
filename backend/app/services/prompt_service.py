"""Agent Lab — Prompt Service.

Handles fetching the complete system prompt for an agent (with skills),
and resolving any {{variable}} placeholders.
"""

import re as _re
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.skills_injector import build_system_prompt

def _resolve_prompt_variables(template: str, values: dict[str, str]) -> str:
    """Substitute {{variable}} placeholders with provided values.
    Missing keys are left as-is (original {{var}} text preserved).
    """
    def replacer(m: "_re.Match[str]") -> str:
        key = m.group(1).strip()
        return values.get(key, m.group(0))
    return _re.sub(r'\{\{([^}]+)\}\}', replacer, template)

async def get_resolved_system_prompt(
    agent_id: str,
    session: AsyncSession,
    variable_values: Optional[dict[str, str]] = None
) -> str:
    """
    Build the complete system prompt for an agent run (including skills),
    and resolve any {{variable}} placeholders if values are provided.
    """
    # 1. Get combined prompt (agent system prompt + skills)
    combined_prompt = await build_system_prompt(agent_id, session)
    
    # 2. Resolve variables if any are provided
    if variable_values:
        return _resolve_prompt_variables(combined_prompt, variable_values)
    
    return combined_prompt
