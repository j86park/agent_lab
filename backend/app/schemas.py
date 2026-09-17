"""Agent Lab — Pydantic schemas for API request and response validation."""

from datetime import datetime
from typing import Any, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

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


# --- MCP Schemas ---

class MCPServerBase(BaseModel):
    """Base schema for an MCP server."""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    transport: Literal["stdio", "sse"] = "stdio"
    command: Optional[str] = None
    args: list[str] = Field(default_factory=list)
    env: dict[str, str] = Field(default_factory=dict)
    url: Optional[str] = None
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Server name cannot be empty")
        if not trimmed.replace("-", "").replace("_", "").isalnum():
            raise ValueError("Server name must contain only alphanumeric characters, hyphens, and underscores")
        return trimmed


class MCPServerCreate(MCPServerBase):
    """Schema for creating a new MCP server."""
    @model_validator(mode="after")
    def validate_transport_fields(self) -> "MCPServerCreate":
        if self.transport == "stdio" and (not self.command or not self.command.strip()):
            raise ValueError("Command is required for stdio transport")
        if self.transport == "sse" and (not self.url or not self.url.strip()):
            raise ValueError("URL is required for SSE transport")
        return self

class MCPServerUpdate(BaseModel):
    """Schema for updating an existing MCP server."""
    name: Optional[str] = None
    description: Optional[str] = None
    transport: Optional[Literal["stdio", "sse"]] = None
    command: Optional[str] = None
    args: Optional[list[str]] = None
    env: Optional[dict[str, str]] = None
    url: Optional[str] = None
    is_active: Optional[bool] = None


class MCPServerResponse(MCPServerBase):
    """Schema for MCP server response."""
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MCPServerListResponse(BaseModel):
    """Schema for list of MCP servers."""
    servers: list[MCPServerResponse]
    total: int


class MCPToolInfo(BaseModel):
    """Schema for an individual tool exposed by an MCP server."""
    server_id: str
    server_name: str
    name: str
    namespaced_name: str  # mcp__{server_name}__{name}
    description: Optional[str] = None
    input_schema: dict[str, Any] = Field(default_factory=dict)


class MCPToolCallRequest(BaseModel):
    """Schema for executing a tool call directly on an MCP server."""
    server_id: str
    tool_name: str
    arguments: dict[str, Any] = Field(default_factory=dict)


class MCPToolCallResponse(BaseModel):
    """Schema for the result of an MCP tool execution."""
    content: list[dict[str, Any]] = Field(default_factory=list)
    is_error: bool = False
    raw_text: str = ""
