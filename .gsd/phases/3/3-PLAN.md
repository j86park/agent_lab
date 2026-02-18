---
phase: 3
plan: 3
wave: 2
depends_on: [1, 2]
---

# Plan 3.3: Agent Orchestrator & Skill Injection

## Objective
Build the core orchestrator that takes an agent config, injects skills into the system prompt, executes the agent loop (LLM call → tool use → repeat), and manages the full run lifecycle. This ties together the LLM providers (Plan 3.1) and sandbox (Plan 3.2).

## Context
- .gsd/SPEC.md
- backend/app/models.py
- backend/app/services/llm/base.py
- backend/app/services/llm/factory.py
- backend/app/services/sandbox.py
- backend/app/database.py

## Tasks

<task type="auto">
  <name>Implement Skill Injection Engine and Tool Executors</name>
  <files>
    backend/app/services/skills_injector.py
    backend/app/services/tools.py
  </files>
  <action>
    1. Create `backend/app/services/skills_injector.py`:
       ```python
       async def build_system_prompt(agent_id: str, session: AsyncSession) -> str:
           # 1. Load the agent's system_prompt
           # 2. Query agent_skills join table for attached skills
           # 3. Append each skill's instructions to the prompt
           # 4. Return the combined prompt
       ```
       Format: Agent prompt first, then each skill in a delimited section:
       ```
       {agent.system_prompt}

       ---
       ## Skill: {skill.name}
       {skill.instructions}
       ---
       ```

    2. Create `backend/app/services/tools.py` — Tool executor dispatch:
       ```python
       AVAILABLE_TOOLS = {
           "file_read": "Read a file from the workspace",
           "file_write": "Write content to a file in the workspace",
           "code_execute": "Execute a Python script in the sandbox",
           "web_search": "Search the web (placeholder — returns mock results)",
       }

       async def execute_tool(
           tool_name: str,
           arguments: dict,
           sandbox: SandboxManager,
           container_id: str
       ) -> str:
           # Dispatch to the appropriate handler
           # Return the tool output as a string
       ```

       Tool implementations:
       - `file_read`: calls `sandbox.read_file(container_id, path)`
       - `file_write`: calls `sandbox.write_file(container_id, path, content)`
       - `code_execute`: calls `sandbox.execute_command(container_id, f"python3 -c '{code}'")`
       - `web_search`: returns a placeholder message (real implementation deferred)

    IMPORTANT:
    - Skill injection is a simple string concatenation — no templating engine needed
    - Tool functions return plain strings (the orchestrator formats them for the LLM)
    - web_search is a stub for now — returns "Web search not yet implemented"
  </action>
  <verify>
    cd backend; ..\a_lab\Scripts\python.exe -c "from app.services.skills_injector import build_system_prompt; from app.services.tools import execute_tool, AVAILABLE_TOOLS; print('Skill injector + tools OK')"
  </verify>
  <done>
    - Skill injector merges agent prompt + skill instructions
    - Tool executor dispatches to correct handler
    - All 4 tool types have implementations (web_search is stub)
  </done>
</task>

<task type="auto">
  <name>Implement the Agent Orchestrator (run loop)</name>
  <files>
    backend/app/services/orchestrator.py
  </files>
  <action>
    1. Create `backend/app/services/orchestrator.py`:
       ```python
       class AgentOrchestrator:
           def __init__(self, session: AsyncSession):
               self.session = session
               self.sandbox_manager = SandboxManager()

           async def execute_run(self, run_id: str) -> None:
               # 1. Load the Run record and its Agent config
               # 2. Update run status to "running"
               # 3. Build system prompt (with skill injection)
               # 4. Get LLM provider from factory
               # 5. Create sandbox container
               # 6. Run the agent loop:
               #    a. Send messages to LLM
               #    b. If LLM wants to use a tool → execute_tool() → append result
               #    c. If LLM returns final answer → break
               #    d. Max iterations: 10 (safety limit)
               # 7. Update run with results (cost, tokens, duration, status)
               # 8. Destroy sandbox
               # 9. Handle errors gracefully — update run status to "failed"
       ```

    2. Agent loop details:
       - Messages list starts with [system_prompt, user_task]
       - LLM response is checked for tool calls (OpenAI function calling format)
       - If tool call detected: execute tool, append result, loop
       - If no tool call: treat as final answer, break
       - Each iteration creates a RunLog entry
       - Track cumulative tokens and cost from each LLM response

    3. Tool call format (OpenAI-compatible):
       - LLM returns `tool_calls` in response when it wants to use a tool
       - For providers that don't support function calling natively, parse the response text for tool markers
       - Start with OpenAI function calling; other providers can use a simpler text-based approach

    4. Error handling:
       - Wrap entire execute_run in try/except
       - On failure: set run status="failed", save error_message
       - Always destroy sandbox in finally block

    IMPORTANT:
    - The orchestrator does NOT expose endpoints — that's Plan 3.4
    - Use asyncio for all I/O
    - Log every step to RunLog for observability
    - Keep the loop simple — max 10 iterations, no complex branching
  </action>
  <verify>
    cd backend; ..\a_lab\Scripts\python.exe -c "from app.services.orchestrator import AgentOrchestrator; print('Orchestrator OK')"
  </verify>
  <done>
    - AgentOrchestrator.execute_run() implements the full agent loop
    - Integrates LLM provider, sandbox, skill injection, and tools
    - Logs each step to RunLog
    - Tracks cost and tokens
    - Handles errors and always cleans up sandbox
  </done>
</task>

## Success Criteria
- [ ] Skill injection merges agent + skill prompts
- [ ] Tool executor handles all 4 tool types
- [ ] Orchestrator runs the full agent loop (LLM → tool → repeat)
- [ ] Cost and token tracking per run
- [ ] RunLog entries created for each step
- [ ] Sandbox always cleaned up (success or failure)
