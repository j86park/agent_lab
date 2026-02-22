---
phase: 8
plan: 2
wave: 1
---

# Plan 8.2: Web Search Tool Integration

## Objective
Integrate the search service into the agent tool execution loop and verify the end-to-end flow.

## Context
- backend/app/services/tools.py
- backend/app/services/search.py

## Tasks

<task type="auto">
  <name>Integrate Search into Tools Dispatcher</name>
  <files>
    - backend/app/services/tools.py
  </files>
  <action>
    - Import `perform_search` from `app.services.search`.
    - Replace the placeholder logic in the `web_search` branch of `execute_tool`.
    - Await `perform_search(query)` and return the result string.
  </action>
  <verify>Check backend/app/services/tools.py for perform_search call</verify>
  <done>placeholder replaced with real search integration.</done>
</task>

<task type="checkpoint:human-verify">
  <name>End-to-End Search Verification</name>
  <files>None</files>
  <action>
    - Start the backend with `AGENT_LAB_TAVILY_API_KEY` set (if available).
    - Create an agent with "Web Search" enabled.
    - Run a task like "What is the latest score for the Lakers?"
    - Verify logs show the tool call and real search results.
  </action>
  <verify>Manual verification in UI</verify>
  <done>Search verified in live runs.</done>
</task>

## Success Criteria
- [ ] backend/app/services/tools.py uses real search logic.
- [ ] Agent correctly interprets search results in final answers.
