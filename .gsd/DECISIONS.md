## Phase 8 Decisions

**Date:** 2026-02-20

### Implementation Approach
- **Chose**: Dedicated Search API (Tavily) via Backend Service.
- **Alternatives Considered**: Provider-specific search models (OpenRouter/Perplexity).
- **Rationale**:
    1. **Provider Agnostic**: Using a backend search service allows the "Web Search" tool to work regardless of which LLM provider is selected (Ollama, Anthropic, etc.). If we used an OpenRouter search model, the user would be locked into that specific provider.
    2. **Context Optimization**: Tavily is purpose-built for LLM agents. It performs "RAG-ready" extraction—stripping HTML, ads, and irrelevant UI elements before returning data. This significantly reduces token usage compared to raw search result processing.
    3. **Deterministic Structure**: Having a dedicated backend service allows us to control exactly how results are formatted and truncated before they hit the LLM, preventing context overflow and ensuring consistent agent behavior.
    4. **Latency**: Dedicated search endpoints are generally faster than waiting for a multi-stage LLM search model to respond.
