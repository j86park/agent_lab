# Research: Tavily API Integration

## Overview
Tavily is an AI-optimized search engine that returns clean, structured content for LLMs. It is preferred for this project as it handles the "crawl and extract" phase, reducing token overhead.

## Implementation Details
- **Library**: `tavily-python` (built-in async support in v0.3.0+)
- **Integration**: `AsyncTavilyClient`
- **Dependency**: Add `tavily-python` to `backend/requirements.txt`.
- **API Key**: `AGENT_LAB_TAVILY_API_KEY` in environment variables.

## Example Code (Async)
```python
from tavily import AsyncTavilyClient
import os

client = AsyncTavilyClient(api_key=os.environ.get("TAVILY_API_KEY"))

async def search(query):
    # 'search' depth for clean results, 'news' for recent events
    response = await client.search(query=query, search_depth="basic")
    return response['results']
```

## Considerations
- **Formatting**: Results should be formatted as a single string for the agent:
  `[Title] (URL): Snippet`
- **Redundancy**: Return top 5 results to balance information density and context window.
- **Failover**: If the API key is missing, return a string explicitly telling the agent that search is not configured.
