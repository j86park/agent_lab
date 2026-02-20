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


# --- Run Schemas ---

class RunCreate(BaseModel):
    """Schema for creating and starting a new agent run."""
    agent_id: str
    task: str = Field(..., min_length=1, description="The user's task description")
    variable_values: Optional[dict[str, str]] = None  # {{var}} substitution values


class RunResponse(BaseModel):
    """Schema for a run record response."""
    id: str
    agent_id: str
    task: str
    status: str  # pending, running, completed, failed
    cost: Optional[float] = None
    total_tokens: Optional[int] = None
    duration_seconds: Optional[float] = None
    error_message: Optional[str] = None
    resolved_prompt: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class RunListResponse(BaseModel):
    """Schema for a paginated list of runs."""
    runs: list[RunResponse]
    total: int


class RunLogResponse(BaseModel):
    """Schema for a single run log entry."""
    id: int
    run_id: str
    timestamp: datetime
    level: str
    message: str
    metadata_json: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
