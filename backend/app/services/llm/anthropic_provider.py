"""Agent Lab — Anthropic LLM provider."""

import logging
import anthropic

from app.services.llm.base import BaseLLMProvider, LLMMessage, LLMResponse
from app.services.encryption import get_or_create_key, decrypt_value
from app.config import settings

logger = logging.getLogger(__name__)

# Pricing per 1M tokens (input, output) in USD
ANTHROPIC_PRICING: dict[str, tuple[float, float]] = {
    "claude-3-5-sonnet-20240620": (3.00, 15.00),
    "claude-3-5-haiku-20241022": (0.80, 4.00),
    "claude-3-opus-20240229": (15.00, 75.00),
    # Aliases
    "claude-sonnet-4-20250514": (3.00, 15.00),
}


def _get_api_key() -> str:
    """Read and decrypt the Anthropic API key from settings."""
    settings_path = settings.DATA_DIR / "settings.json"
    if not settings_path.exists():
        return ""
    import json as _json
    data = _json.loads(settings_path.read_text())
    encrypted = data.get("anthropic_api_key", "")
    if not encrypted:
        return ""
    key = get_or_create_key(settings.ENCRYPTION_KEY_PATH)
    return decrypt_value(encrypted, key)


class AnthropicProvider(BaseLLMProvider):
    """Anthropic LLM provider using the official async client."""

    def _get_client(self) -> anthropic.AsyncAnthropic:
        api_key = _get_api_key()
        return anthropic.AsyncAnthropic(api_key=api_key or "sk-placeholder")

    async def chat(
        self,
        messages: list[LLMMessage],
        model: str,
        tools: list[dict] | None = None,
        **kwargs,
    ) -> LLMResponse:
        client = self._get_client()

        # Anthropic separates system prompt from messages
        system_content = ""
        anthropic_messages = []

        for msg in messages:
            if msg.role == "system":
                system_content = msg.content
            else:
                anthropic_messages.append({"role": msg.role, "content": msg.content})

        kwargs_extra: dict = {}
        if system_content:
            kwargs_extra["system"] = system_content
        if tools:
            # Convert OpenAI tool format to Anthropic format
            anthropic_tools = []
            for t in tools:
                if t.get("type") == "function":
                    fn = t["function"]
                    anthropic_tools.append({
                        "name": fn["name"],
                        "description": fn.get("description", ""),
                        "input_schema": fn.get("parameters", {"type": "object", "properties": {}}),
                    })
            kwargs_extra["tools"] = anthropic_tools

        response = await client.messages.create(
            model=model,
            max_tokens=4096,
            messages=anthropic_messages,
            **kwargs_extra,
        )

        # Extract text content and tool calls
        content_text = ""
        tool_calls = []
        for block in response.content:
            if block.type == "text":
                content_text = block.text
            elif block.type == "tool_use":
                import json
                tool_calls.append({
                    "id": block.id,
                    "type": "function",
                    "function": {
                        "name": block.name,
                        "arguments": json.dumps(block.input),
                    },
                })

        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        cost = self.estimate_cost(input_tokens, output_tokens, model)

        return LLMResponse(
            content=content_text,
            model=response.model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost=cost,
            tool_calls=tool_calls,
            raw_response=response.model_dump(),
        )

    def estimate_cost(self, input_tokens: int, output_tokens: int, model: str) -> float:
        pricing = ANTHROPIC_PRICING.get(model, (3.00, 15.00))
        input_cost = (input_tokens / 1_000_000) * pricing[0]
        output_cost = (output_tokens / 1_000_000) * pricing[1]
        return round(input_cost + output_cost, 8)
