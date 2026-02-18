"""Agent Lab — LLM Provider Factory."""

from app.services.llm.base import BaseLLMProvider


def get_provider(provider_name: str) -> BaseLLMProvider:
    """
    Return the appropriate LLM provider instance for the given provider name.

    Args:
        provider_name: One of "openai", "anthropic", "openrouter", "ollama"

    Returns:
        An instance of the appropriate BaseLLMProvider subclass.

    Raises:
        ValueError: If the provider name is not recognized.
    """
    name = provider_name.lower().strip()

    if name == "openai":
        from app.services.llm.openai_provider import OpenAIProvider
        return OpenAIProvider()

    if name == "anthropic":
        from app.services.llm.anthropic_provider import AnthropicProvider
        return AnthropicProvider()

    if name == "openrouter":
        from app.services.llm.openrouter_provider import OpenRouterProvider
        return OpenRouterProvider()

    if name == "ollama":
        from app.services.llm.ollama_provider import OllamaProvider
        return OllamaProvider()

    raise ValueError(
        f"Unknown LLM provider: '{provider_name}'. "
        f"Supported providers: openai, anthropic, openrouter, ollama"
    )
