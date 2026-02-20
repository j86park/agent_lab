"""Agent Lab — LLM Provider base classes and shared data types."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class LLMMessage:
    """A single message in a conversation."""
    role: str  # "system", "user", "assistant", "tool"
    content: str
    tool_call_id: str | None = None
    tool_calls: list[dict] | None = None


@dataclass
class LLMResponse:
    """Normalized response from any LLM provider."""
    content: str
    model: str
    input_tokens: int
    output_tokens: int
    cost: float  # Estimated cost in USD
    tool_calls: list[dict] = field(default_factory=list)  # OpenAI-format tool calls
    raw_response: dict = field(default_factory=dict)  # Provider-specific raw response


class BaseLLMProvider(ABC):
    """Abstract base class for all LLM providers."""

    @abstractmethod
    async def chat(
        self,
        messages: list[LLMMessage],
        model: str,
        tools: list[dict] | None = None,
        **kwargs,
    ) -> LLMResponse:
        """Send a chat request and return a normalized response."""
        ...

    @abstractmethod
    def estimate_cost(self, input_tokens: int, output_tokens: int, model: str) -> float:
        """Estimate the cost in USD for a given token count."""
        ...
