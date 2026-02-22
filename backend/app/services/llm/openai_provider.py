"""Agent Lab — OpenAI LLM provider."""

import json
import logging
from openai import AsyncOpenAI

from app.services.llm.base import BaseLLMProvider, LLMMessage, LLMResponse
from app.services.encryption import get_or_create_key, decrypt_value
from app.config import settings

logger = logging.getLogger(__name__)

# Pricing per 1M tokens (input, output) in USD
OPENAI_PRICING: dict[str, tuple[float, float]] = {
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4-turbo": (10.00, 30.00),
    "gpt-3.5-turbo": (0.50, 1.50),
}


def _get_api_key() -> str:
    """Read and decrypt the OpenAI API key from settings."""
    settings_path = settings.DATA_DIR / "settings.json"
    if not settings_path.exists():
        return ""
    import json as _json
    data = _json.loads(settings_path.read_text())
    encrypted = data.get("openai_api_key", "")
    if not encrypted:
        return ""
    key = get_or_create_key(settings.ENCRYPTION_KEY_PATH)
    return decrypt_value(encrypted, key)


class OpenAIProvider(BaseLLMProvider):
    """OpenAI LLM provider using the official async client."""

    def _get_client(self) -> AsyncOpenAI:
        api_key = _get_api_key()
        return AsyncOpenAI(api_key=api_key or "sk-placeholder")

    async def chat(
        self,
        messages: list[LLMMessage],
        model: str,
        tools: list[dict] | None = None,
        **kwargs,
    ) -> LLMResponse:
        client = self._get_client()

        # Convert to OpenAI message format
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
            **kwargs,
        )

        choice = response.choices[0]
        message = choice.message

        # Extract tool calls if present
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
        cost = self.estimate_cost(input_tokens, output_tokens, model)

        return LLMResponse(
            content=message.content or "",
            model=response.model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost=cost,
            tool_calls=tool_calls,
            raw_response=response.model_dump(),
        )

    def estimate_cost(self, input_tokens: int, output_tokens: int, model: str) -> float:
        pricing = OPENAI_PRICING.get(model, (10.00, 30.00))  # Default to GPT-4 pricing
        input_cost = (input_tokens / 1_000_000) * pricing[0]
        output_cost = (output_tokens / 1_000_000) * pricing[1]
        return round(input_cost + output_cost, 8)
