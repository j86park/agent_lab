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
