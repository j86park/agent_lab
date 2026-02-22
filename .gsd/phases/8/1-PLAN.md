---
phase: 8
plan: 1
wave: 1
---

# Plan 8.1: Web Search Infrastructure

## Objective
Establish the foundational infrastructure for web search, including dependencies, configuration, and a core search service.

## Context
- .gsd/SPEC.md
- .gsd/phases/8/RESEARCH.md
- backend/requirements.txt
- backend/app/config.py

## Tasks

<task type="auto">
  <name>Setup Search Dependencies and Config</name>
  <files>
    - backend/requirements.txt
    - backend/app/config.py
  </files>
  <action>
    - Add `tavily-python>=0.3.5` to `backend/requirements.txt`.
    - Add `tavily_api_key: Optional[str] = None` to `backend/app/config.py` in the `Settings` class.
    - Ensure it can be loaded via the environment variable `AGENT_LAB_TAVILY_API_KEY`.
  </action>
  <verify>grep "tavily-python" backend/requirements.txt</verify>
  <done>
    -Dependency added.
    -Config setting exists.
  </done>
</task>

<task type="auto">
  <name>Implement Search Service</name>
  <files>
    - backend/app/services/search.py [NEW]
  </files>
  <action>
    - Create `backend/app/services/search.py`.
    - Implement `perform_search(query: str) -> str` using `AsyncTavilyClient`.
    - Handle missing API key: if `settings.tavily_api_key` is not set, return a string: "Error: Web search is not configured. Please set the AGENT_LAB_TAVILY_API_KEY environment variable."
    - Format results as a concise string: `[Title] (URL)\nSnippet\n---`
    - Limit to top 5 results.
  </action>
  <verify>ls backend/app/services/search.py</verify>
  <done>Search service implemented with error handling and formatting.</done>
</task>

## Success Criteria
- [ ] Requirements.txt updated.
- [ ] Config supports Tavily API key.
- [ ] Search service created and functional.
