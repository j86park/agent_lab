"""Agent Lab — Pydantic schemas for API request and response validation."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AgentBase(BaseModel):
    """Base schema for Agent data."""
    name: str
    description: Optional[str] = None
    system_prompt: str = ""
    tools_config: str = "[]"  # JSON string
    constraints_config: str = "{}"  # JSON string
    provider: str = "openai"
    model: str = "gpt-4o"


class AgentCreate(AgentBase):
    """Schema for creating a new agent."""
    
    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        """Ensure agent name is not empty or whitespace."""
        if not v.strip():
            raise ValueError("Agent name cannot be empty")
        return v.strip()


class AgentUpdate(BaseModel):
    """Schema for updating an existing agent."""
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    tools_config: Optional[str] = None
    constraints_config: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None


class AgentResponse(AgentBase):
    """Schema for agent response data."""
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AgentListResponse(BaseModel):
    """Schema for a paginated list of agents."""
    agents: list[AgentResponse]
    total: int


# --- Skill Schemas ---

class SkillBase(BaseModel):
    """Base schema for Skill data."""
    name: str
    description: Optional[str] = None
    instructions: str = ""


class SkillCreate(SkillBase):
    """Schema for creating a new skill."""

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        """Ensure skill name is not empty or whitespace."""
        if not v.strip():
            raise ValueError("Skill name cannot be empty")
        return v.strip()


class SkillUpdate(BaseModel):
    """Schema for updating an existing skill."""
    name: Optional[str] = None
    description: Optional[str] = None
    instructions: Optional[str] = None


class SkillResponse(SkillBase):
    """Schema for skill response data."""
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SkillListResponse(BaseModel):
    """Schema for a paginated list of skills."""
    skills: list[SkillResponse]
    total: int


# --- Settings Schemas ---

class SettingsUpdate(BaseModel):
    """Schema for updating provider API keys."""
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None


class SettingsResponse(BaseModel):
    """Schema for returning settings status (not actual keys)."""
    openai_api_key_set: bool
    anthropic_api_key_set: bool
    openrouter_api_key_set: bool
