"""Agent Lab — Agent Orchestrator.

Ties together LLM provider, Docker sandbox, skill injection, and tool
execution to run the full agent loop for a given run record.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime, UTC

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models import Agent, Run, RunLog
from app.services.llm.base import LLMMessage
from app.services.llm.factory import get_provider
from app.services.sandbox import SandboxConfig, SandboxManager
from app.services.skills_injector import build_system_prompt
from app.services.tools import execute_tool, get_tool_definitions, AVAILABLE_TOOLS

logger = logging.getLogger(__name__)

MAX_ITERATIONS = 10  # Safety limit to prevent infinite loops


class AgentOrchestrator:
    """
    Orchestrates a single agent run from start to finish.

    Usage:
        orchestrator = AgentOrchestrator()
        await orchestrator.execute_run(run_id)
    """

    def __init__(self) -> None:
        self.sandbox_manager = SandboxManager()

    # ─────────────────────────────────────────────────────────────────────────
    # Public API
    # ─────────────────────────────────────────────────────────────────────────

    async def execute_run(self, run_id: str) -> None:
        """
        Execute the full agent loop for the given run.

        This method:
          1. Loads the Run record and its Agent config from the database.
          2. Marks the run as "running".
          3. Builds the system prompt (with skill injection).
          4. Creates a Docker sandbox.
          5. Runs the LLM ↔ tool loop (max MAX_ITERATIONS iterations).
          6. Persists cost, tokens, duration, and final status.
          7. Always destroys the sandbox in the finally block.
        """
        start_time = time.monotonic()
        container_id: str | None = None

        async with async_session() as session:
            # ── 1. Load run and agent ───────────────────────────────────────
            run = await session.get(Run, run_id)
            if run is None:
                logger.error("Run %s not found", run_id)
                return

            agent = await session.get(Agent, run.agent_id)
            if agent is None:
                await self._fail_run(session, run, "Agent not found")
                return

            # ── 2. Mark as running ─────────────────────────────────────────
            run.status = "running"
            await session.commit()
            await self._log(session, run_id, "info", f"Starting run for agent '{agent.name}'")

            try:
                # ── 3. Build system prompt ─────────────────────────────────
                system_prompt = await build_system_prompt(agent.id, session)
                await self._log(
                    session, run_id, "info",
                    f"System prompt built ({len(system_prompt)} chars)",
                )

                # ── 4. Determine enabled tools ─────────────────────────────
                import json as _json
                enabled_tools: list[str] = _json.loads(agent.tools_config or "[]")
                tool_defs = [
                    t for t in get_tool_definitions()
                    if t["function"]["name"] in enabled_tools
                ] if enabled_tools else []

                # ── 5. Create sandbox ──────────────────────────────────────
                constraints = _json.loads(agent.constraints_config or "{}")
                sandbox_cfg = SandboxConfig(
                    timeout_seconds=constraints.get("timeout_seconds", 120),
                    memory_limit=f"{constraints.get('max_tokens', 512)}m"
                        if "memory_mb" in constraints
                        else "512m",
                )
                container_id = await self.sandbox_manager.create_sandbox(sandbox_cfg)
                await self._log(session, run_id, "info", f"Sandbox created: {container_id}")

                # ── 6. Get LLM provider ────────────────────────────────────
                provider = get_provider(agent.provider)
                await self._log(
                    session, run_id, "info",
                    f"Using provider: {agent.provider} / model: {agent.model}",
                )

                # ── 7. Run the agent loop ──────────────────────────────────
                messages: list[LLMMessage] = [
                    LLMMessage(role="system", content=system_prompt),
                    LLMMessage(role="user", content=run.task),
                ]
                total_cost = 0.0
                total_input_tokens = 0
                total_output_tokens = 0

                for iteration in range(MAX_ITERATIONS):
                    await self._log(
                        session, run_id, "info",
                        f"Iteration {iteration + 1}/{MAX_ITERATIONS}: calling LLM...",
                    )

                    response = await provider.chat(
                        messages=messages,
                        model=agent.model,
                        tools=tool_defs or None,
                    )

                    total_cost += response.cost
                    total_input_tokens += response.input_tokens
                    total_output_tokens += response.output_tokens

                    await self._log(
                        session, run_id, "info",
                        f"LLM responded: {response.input_tokens} in / "
                        f"{response.output_tokens} out tokens, "
                        f"cost ${response.cost:.6f}",
                        metadata={"tokens_in": response.input_tokens,
                                  "tokens_out": response.output_tokens,
                                  "cost": response.cost},
                    )

                    # ── Tool calls? ────────────────────────────────────────
                    if response.tool_calls:
                        # Append the assistant's tool-call message
                        messages.append(LLMMessage(
                            role="assistant",
                            content=response.content or "",
                            tool_calls=response.tool_calls,
                        ))

                        for tc in response.tool_calls:
                            fn = tc.get("function", {})
                            tool_name = fn.get("name", "")
                            try:
                                args = json.loads(fn.get("arguments", "{}"))
                            except json.JSONDecodeError:
                                args = {}

                            await self._log(
                                session, run_id, "info",
                                f"Tool call: {tool_name}({args})",
                            )

                            tool_output = await execute_tool(
                                tool_name=tool_name,
                                arguments=args,
                                sandbox=self.sandbox_manager,
                                container_id=container_id,
                            )

                            await self._log(
                                session, run_id, "info",
                                f"Tool result: {tool_output[:200]}{'...' if len(tool_output) > 200 else ''}",
                            )

                            # Append the tool result
                            messages.append(LLMMessage(
                                role="tool",
                                content=tool_output,
                                tool_call_id=tc.get("id", ""),
                            ))
                        # Loop again for LLM to process tool results
                        continue

                    # ── No tool calls → final answer ───────────────────────
                    final_answer = response.content
                    await self._log(
                        session, run_id, "info",
                        f"Final answer received ({len(final_answer)} chars)",
                    )
                    break

                else:
                    # Reached MAX_ITERATIONS without a final answer
                    await self._log(
                        session, run_id, "warning",
                        f"Reached max iterations ({MAX_ITERATIONS}) without final answer",
                    )

                # ── 8. Persist results ─────────────────────────────────────
                duration = time.monotonic() - start_time
                run.status = "completed"
                run.cost = round(total_cost, 8)
                run.total_tokens = total_input_tokens + total_output_tokens
                run.duration_seconds = round(duration, 2)
                run.completed_at = datetime.now(UTC)
                await session.commit()
                await self._log(
                    session, run_id, "info",
                    f"Run completed in {duration:.1f}s — "
                    f"total tokens: {run.total_tokens}, cost: ${run.cost:.6f}",
                )

            except Exception as exc:
                logger.exception("Run %s failed: %s", run_id, exc)
                await self._fail_run(session, run, str(exc))

            finally:
                # ── 9. Always destroy the sandbox ──────────────────────────
                if container_id:
                    await self.sandbox_manager.destroy_sandbox(container_id)
                    logger.info("Sandbox %s destroyed for run %s", container_id, run_id)

    # ─────────────────────────────────────────────────────────────────────────
    # Helpers
    # ─────────────────────────────────────────────────────────────────────────

    async def _log(
        self,
        session: AsyncSession,
        run_id: str,
        level: str,
        message: str,
        metadata: dict | None = None,
    ) -> None:
        """Create a RunLog entry and commit it immediately."""
        entry = RunLog(
            run_id=run_id,
            level=level,
            message=message,
            metadata_json=json.dumps(metadata) if metadata else None,
        )
        session.add(entry)
        await session.commit()
        logger.log(
            logging.getLevelName(level.upper()),
            "[run:%s] %s",
            run_id[:8],
            message,
        )

    async def _fail_run(
        self,
        session: AsyncSession,
        run: Run,
        error_message: str,
    ) -> None:
        """Mark a run as failed and persist the error message."""
        run.status = "failed"
        run.error_message = error_message
        run.completed_at = datetime.now(UTC)
        await session.commit()
        logger.error("Run %s failed: %s", run.id, error_message)
