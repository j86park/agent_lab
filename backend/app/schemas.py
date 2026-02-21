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


# --- Test Suite Schemas ---

class TestSuiteBase(BaseModel):
    """Base schema for test suite data."""
    name: str
    description: Optional[str] = None


class TestSuiteCreate(TestSuiteBase):
    """Schema for creating a new test suite."""
    agent_id: str

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Suite name cannot be empty")
        return v.strip()


class TestSuiteUpdate(BaseModel):
    """Schema for updating a test suite."""
    name: Optional[str] = None
    description: Optional[str] = None


class TestSuiteResponse(TestSuiteBase):
    """Schema for test suite response."""
    id: str
    agent_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TestSuiteListResponse(BaseModel):
    """Schema for a list of test suites."""
    suites: list[TestSuiteResponse]
    total: int


# --- Test Case Schemas ---

class TestCaseBase(BaseModel):
    """Base schema for test case data."""
    task: str
    expected_behavior: str
    rubric: Optional[str] = None


class TestCaseCreate(TestCaseBase):
    """Schema for creating a test case."""
    @field_validator("task")
    @classmethod
    def task_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Task cannot be empty")
        return v.strip()


class TestCaseUpdate(BaseModel):
    """Schema for updating a test case."""
    task: Optional[str] = None
    expected_behavior: Optional[str] = None
    rubric: Optional[str] = None


class TestCaseResponse(TestCaseBase):
    """Schema for test case response."""
    id: str
    suite_id: str
    last_run_id: Optional[str] = None
    last_run_score: Optional[float] = None
    last_run_status: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TestCaseListResponse(BaseModel):
    """Schema for a list of test cases."""
    cases: list[TestCaseResponse]
    total: int


# --- Prompt Snippet Schemas ---

class PromptSnippetBase(BaseModel):
    """Base schema for prompt snippets."""
    name: str
    content: str


class PromptSnippetCreate(PromptSnippetBase):
    """Schema for creating a snippet."""
    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Snippet name cannot be empty")
        return v.strip()


class PromptSnippetUpdate(BaseModel):
    """Schema for updating a snippet."""
    name: Optional[str] = None
    content: Optional[str] = None


class PromptSnippetResponse(PromptSnippetBase):
    """Schema for snippet response."""
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PromptSnippetListResponse(BaseModel):
    """Schema for a list of snippets."""
    snippets: list[PromptSnippetResponse]
    total: int


# --- Run Schemas ---

class RunCreate(BaseModel):
    """Schema for creating and starting a new agent run."""
    agent_id: str
    task: str = Field(..., min_length=1, description="The user's task description")
    variable_values: Optional[dict[str, str]] = None  # {{var}} substitution values
    tags: Optional[str] = None  # comma-separated labels e.g. "baseline,v2"
    test_case_id: Optional[str] = None


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
    tags: Optional[str] = None
    test_case_id: Optional[str] = None
    eval_score: Optional[float] = None
    eval_feedback: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class RunTagUpdate(BaseModel):
    """Schema for updating run tags via PATCH."""
    tags: Optional[str] = None


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
