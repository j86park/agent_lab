"""Agent Lab — Ollama LLM provider (OpenAI-compatible local API)."""

import logging
from openai import AsyncOpenAI

from app.services.llm.base import BaseLLMProvider, LLMMessage, LLMResponse

logger = logging.getLogger(__name__)

OLLAMA_BASE_URL = "http://localhost:11434/v1"


class OllamaProvider(BaseLLMProvider):
    """Ollama provider — connects to local Ollama server via OpenAI-compatible API."""

    def _get_client(self) -> AsyncOpenAI:
        return AsyncOpenAI(
            api_key="ollama",  # Ollama doesn't require a real key
            base_url=OLLAMA_BASE_URL,
        )

    async def chat(
        self,
        messages: list[LLMMessage],
        model: str,
        tools: list[dict] | None = None,
        **kwargs,
    ) -> LLMResponse:
        client = self._get_client()

        openai_messages = []
        for msg in messages:
            m: dict = {"role": msg.role, "content": msg.content}
            if msg.tool_call_id:
                m["tool_call_id"] = msg.tool_call_id
            if msg.tool_calls:
                m["tool_calls"] = msg.tool_calls
            openai_messages.append(m)

        kwargs_extra = {}
        if tools:
            kwargs_extra["tools"] = tools
            kwargs_extra["tool_choice"] = "auto"

        response = await client.chat.completions.create(
            model=model,
            messages=openai_messages,
            **kwargs_extra,
        )

        choice = response.choices[0]
        message = choice.message

        tool_calls = []
        if message.tool_calls:
            for tc in message.tool_calls:
                tool_calls.append({
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                })

        input_tokens = response.usage.prompt_tokens if response.usage else 0
        output_tokens = response.usage.completion_tokens if response.usage else 0

        return LLMResponse(
            content=message.content or "",
            model=response.model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost=0.0,  # Ollama is free (local)
            tool_calls=tool_calls,
            raw_response=response.model_dump(),
        )

    def estimate_cost(self, input_tokens: int, output_tokens: int, model: str) -> float:
        """Ollama is always free — runs locally."""
        return 0.0
