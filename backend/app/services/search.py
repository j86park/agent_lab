"""Agent Lab — Web Search Service using Tavily."""

import logging
from tavily import AsyncTavilyClient
from app.config import settings

logger = logging.getLogger(__name__)

async def perform_search(query: str) -> str:
    """
    Perform a web search using Tavily and return a formatted result string.
    
    If no API key is configured, returns an error message for the agent.
    """
    if not settings.tavily_api_key:
        logger.warning("Web search called but AGENT_LAB_TAVILY_API_KEY is not set")
        return (
            "Error: Web search is not configured. "
            "Please set the AGENT_LAB_TAVILY_API_KEY environment variable in the backend."
        )

    try:
        client = AsyncTavilyClient(api_key=settings.tavily_api_key)
        # We use 'basic' depth for efficiency; top 5 results are usually sufficient.
        response = await client.search(query=query, search_depth="basic", max_results=5)
        
        results = response.get("results", [])
        if not results:
            return f"No search results found for '{query}'."

        formatted_parts = [f"Search results for '{query}':\n"]
        for res in results:
            title = res.get("title", "No Title")
            url = res.get("url", "#")
            content = res.get("content", "No snippet available.")
            formatted_parts.append(f"[{title}] ({url})\n{content}\n---")

        return "\n\n".join(formatted_parts)

    except Exception as exc:
        logger.exception("Tavily search failed for query '%s': %s", query, exc)
        return f"Error performing web search: {str(exc)}"
