"""Agent Lab — Agent Orchestrator.

Ties together LLM provider, Docker sandbox, skill injection, and tool
execution to run the full agent loop for a given run record.
"""

from __future__ import annotations

import asyncio
import aiofiles
import json
import logging
import time
from datetime import datetime, UTC

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session
from app.services.llm.base import LLMMessage
from app.services.llm.factory import get_provider
from app.services.sandbox import SandboxConfig, SandboxManager
from app.services.skills_injector import build_system_prompt
from app.services.tools import execute_tool, get_tool_definitions, AVAILABLE_TOOLS
from app.services.evaluator import EvaluationService
from app.models import Agent, Run, RunLog, TestCase

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
                # If prompt variables were resolved at run creation time, use the
                # resolved version as the system message (variables substituted).
                if run.resolved_prompt:
                    # Replace the raw agent.system_prompt portion with resolved_prompt.
                    # build_system_prompt() prepends the agent prompt then appends skills;
                    # we swap only the agent prompt section by rebuilding if needed.
                    if agent.system_prompt and agent.system_prompt in system_prompt:
                        system_prompt = system_prompt.replace(
                            agent.system_prompt, run.resolved_prompt, 1
                        )
                    else:
                        # Fallback: prepend resolved prompt to existing system_prompt
                        system_prompt = run.resolved_prompt + "\n\n" + system_prompt
                    await self._log(
                        session, run_id, "info",
                        "Using resolved prompt (variable substitution applied)",
                    )
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
                agent_workspace_dir = settings.AGENT_WORKSPACES_DIR / agent.id
                agent_workspace_dir.mkdir(parents=True, exist_ok=True)
                sandbox_cfg = SandboxConfig(
                    timeout_seconds=constraints.get("timeout_seconds", 120),
                    memory_limit=f"{constraints.get('max_tokens', 512)}m"
                        if "memory_mb" in constraints
                        else "512m",
                    volumes={
                        str(agent_workspace_dir.resolve()): {
                            "bind": "/workspace",
                            "mode": "rw",
                        }
                    },
                )
                container_id = await self.sandbox_manager.create_sandbox(sandbox_cfg)
                await self._log(session, run_id, "info", f"Sandbox created: {container_id}")
                await self._log(
                    session, run_id, "info",
                    f"Persistent workspace mounted: {agent_workspace_dir}",
                )

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

                # ── 8.5. Automated Evaluation ──────────────────────────────
                if run.test_case_id:
                    await self._log(session, run_id, "info", "Starting automated evaluation...")
                    test_case = await session.get(TestCase, run.test_case_id)
                    if test_case:
                        # Fetch all logs for this run
                        stmt = select(RunLog).where(RunLog.run_id == run_id).order_by(RunLog.timestamp.asc())
                        log_result = await session.execute(stmt)
                        run_logs = log_result.scalars().all()

                        evaluator = EvaluationService()
                        eval_result = await evaluator.evaluate_run(run, test_case, run_logs)
                        
                        run.eval_score = eval_result["score"]
                        run.eval_feedback = eval_result["feedback"]
                        await session.commit()
                        
                        await self._log(
                            session, run_id, "info", 
                            f"Evaluation complete: score={run.eval_score}",
                            metadata=eval_result
                        )
                    else:
                        await self._log(session, run_id, "warning", f"Test case {run.test_case_id} not found for evaluation")

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

    async def _inject_uploaded_files(
        self,
        session: AsyncSession,
        run_id: str,
        container_id: str,
    ) -> None:
        """
        Read any files uploaded for this run from the host upload directory
        and inject them into the container's /workspace via write_file().
        Cleans up the upload directory after successful injection.
        """
        upload_dir = settings.WORKSPACE_UPLOADS_DIR / run_id
        if not upload_dir.exists():
            return

        files = list(upload_dir.iterdir())
        if not files:
            return

        injected: list[str] = []
        for file_path in files:
            if not file_path.is_file():
                continue
            async with aiofiles.open(file_path, "rb") as f:
                raw = await f.read()
            try:
                content = raw.decode("utf-8")
            except UnicodeDecodeError:
                # Binary file — encode as latin-1 to preserve bytes through str
                content = raw.decode("latin-1")
            await self.sandbox_manager.write_file(
                container_id,
                f"/workspace/{file_path.name}",
                content,
            )
            injected.append(file_path.name)

        if injected:
            await self._log(
                session, run_id, "info",
                f"Injected {len(injected)} workspace file(s): {', '.join(injected)}",
            )
            # Clean up host upload directory after successful injection
            import shutil
            shutil.rmtree(upload_dir, ignore_errors=True)

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
