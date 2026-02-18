# Plan 3.1 Summary: LLM Provider Abstraction

## Changes Made

### Created `backend/app/services/llm/` package

| File | Purpose |
|------|---------|
| `base.py` | `LLMMessage`, `LLMResponse` dataclasses + `BaseLLMProvider` ABC |
| `openai_provider.py` | OpenAI async adapter with cost estimation |
| `anthropic_provider.py` | Anthropic async adapter (system prompt & tool format normalized) |
| `openrouter_provider.py` | OpenRouter adapter (OpenAI-compatible, custom base URL + headers) |
| `ollama_provider.py` | Ollama adapter (OpenAI-compatible local API, cost=0) |
| `factory.py` | `get_provider(name)` factory with lazy imports |

## Verification Results

```
LLM factory OK — all 4 providers verified
```

- Factory returns correct typed instance for all 4 providers
- Cost estimation verified: OpenAI/Anthropic/OpenRouter > 0, Ollama = 0
- All providers implement `BaseLLMProvider` ABC

## Technical Notes
- OpenRouter and Ollama reuse the OpenAI SDK (both are OpenAI-compatible)
- Anthropic provider normalizes tool calls and system prompts to match OpenAI format
- API keys are read from encrypted `settings.json` at call time (not at import time)
- Factory uses lazy imports to avoid loading unused SDKs
