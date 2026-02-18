---
phase: 3
plan: 1
wave: 1
---

# Plan 3.1: LLM Provider Abstraction

## Objective
Create a unified LLM provider interface so the orchestrator can call any provider (OpenAI, Anthropic, OpenRouter, Ollama) through a single API. Each provider adapter handles auth, request formatting, and response normalization. This is a foundation for all agent execution.

## Context
- .gsd/SPEC.md
- backend/app/config.py
- backend/app/services/encryption.py
- backend/requirements.txt

## Tasks

<task type="auto">
  <name>Create LLM provider abstraction layer</name>
  <files>
    backend/app/services/llm/__init__.py
    backend/app/services/llm/base.py
    backend/app/services/llm/openai_provider.py
    backend/app/services/llm/anthropic_provider.py
    backend/app/services/llm/openrouter_provider.py
    backend/app/services/llm/ollama_provider.py
    backend/app/services/llm/factory.py
  </files>
  <action>
    1. Create `backend/app/services/llm/base.py` — Abstract base class:
       ```python
       @dataclass
       class LLMMessage:
           role: str  # "system", "user", "assistant"
           content: str

       @dataclass
       class LLMResponse:
           content: str
           model: str
           input_tokens: int
           output_tokens: int
           cost: float  # Estimated cost in USD
           raw_response: dict  # Provider-specific raw response

       class BaseLLMProvider(ABC):
           @abstractmethod
           async def chat(self, messages: list[LLMMessage], model: str, **kwargs) -> LLMResponse: ...
           @abstractmethod
           def estimate_cost(self, input_tokens: int, output_tokens: int, model: str) -> float: ...
       ```

    2. Create provider implementations:
       - `openai_provider.py` — Uses `openai.AsyncOpenAI` client
       - `anthropic_provider.py` — Uses `anthropic.AsyncAnthropic` client
       - `openrouter_provider.py` — Uses `openai.AsyncOpenAI` with `base_url="https://openrouter.ai/api/v1"`
       - `ollama_provider.py` — Uses `openai.AsyncOpenAI` with `base_url="http://localhost:11434/v1"` (Ollama is OpenAI-compatible)

    3. Each provider:
       - Reads API key from encrypted settings (via `encryption.py`)
       - Normalizes response into `LLMResponse`
       - Estimates cost using a pricing dict (0 for Ollama)
       - Handles provider-specific errors gracefully

    4. Create `factory.py` — Provider factory:
       ```python
       def get_provider(provider_name: str) -> BaseLLMProvider:
           # Returns the appropriate provider instance
       ```

    IMPORTANT:
    - Use async clients everywhere
    - ALL providers must return the same `LLMResponse` format
    - Cost estimation is approximate — use well-known pricing
    - OpenRouter and Ollama use OpenAI-compatible API (reuse pattern)
  </action>
  <verify>
    cd backend; ..\a_lab\Scripts\python.exe -c "from app.services.llm.factory import get_provider; print('LLM factory OK')"
  </verify>
  <done>
    - All 4 providers implemented with async chat()
    - Factory returns correct provider by name
    - LLMResponse dataclass normalizes all responses
    - Cost estimation included per provider
  </done>
</task>

## Success Criteria
- [ ] `get_provider("openai")` returns OpenAI provider
- [ ] `get_provider("anthropic")` returns Anthropic provider
- [ ] `get_provider("openrouter")` returns OpenRouter provider
- [ ] `get_provider("ollama")` returns Ollama provider
- [ ] All providers share the same `LLMResponse` interface
- [ ] Cost estimation works for each provider
