"""Agent Lab — Human-in-the-Loop (HITL) & Breakpoint Approval Manager.

Provides:
1. Dangerous tool and command pattern detection.
2. Async approval / rejection state machines for pausing agent runs.
3. Pause and resume controls during agent execution.
"""

import asyncio
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

# Dangerous command keywords and regex triggers
DANGEROUS_PATTERNS = [
    "rm -rf",
    "rm -r",
    "drop table",
    "drop database",
    "delete from",
    "truncate table",
    "mkfs",
    "dd if=",
    "chmod -r 777",
    "git push --force",
    "git push -f",
    ":(){ :|:& };:",  # Fork bomb
    "shutdown",
    "reboot",
]


class ApprovalManager:
    """In-memory coordinator for breakpoints, approvals, and pause/resume states."""

    def __init__(self):
        # run_id -> asyncio.Future[tuple[bool, Optional[str]]] (approved: bool, rejection_reason: str | None)
        self._pending_approvals: dict[str, asyncio.Future[tuple[bool, Optional[str]]]] = {}
        # run_id -> dict with details of pending tool call
        self._pending_details: dict[str, dict[str, Any]] = {}
        # run_id -> asyncio.Event (cleared when paused, set when running)
        self._pause_events: dict[str, asyncio.Event] = {}
        self._lock = asyncio.Lock()

    def is_dangerous(self, tool_name: str, arguments: dict[str, Any]) -> tuple[bool, str]:
        """
        Evaluate whether a tool invocation matches dangerous criteria requiring approval.
        Returns (is_dangerous, reason).
        """
        # 1. Check commands inside bash/code execution arguments
        cmd_text = ""
        if "command" in arguments:
            cmd_text = str(arguments["command"]).lower()
        elif "code" in arguments:
            cmd_text = str(arguments["code"]).lower()
        elif "script" in arguments:
            cmd_text = str(arguments["script"]).lower()
        elif "query" in arguments:
            cmd_text = str(arguments["query"]).lower()

        # Check raw serialized arguments as fallback
        arg_str = str(arguments).lower()

        for pattern in DANGEROUS_PATTERNS:
            if pattern in cmd_text or pattern in arg_str:
                return True, f"Dangerous command pattern detected: '{pattern}'"

        return False, ""

    async def request_approval(
        self,
        run_id: str,
        tool_name: str,
        arguments: dict[str, Any],
        reason: str,
    ) -> tuple[bool, Optional[str]]:
        """
        Halt the orchestrator loop and await user approval or rejection.
        Returns (is_approved, rejection_reason).
        """
        loop = asyncio.get_running_loop()
        future: asyncio.Future[tuple[bool, Optional[str]]] = loop.create_future()

        async with self._lock:
            self._pending_approvals[run_id] = future
            self._pending_details[run_id] = {
                "tool_name": tool_name,
                "arguments": arguments,
                "reason": reason,
            }

        logger.info(
            "Run %s halted for tool approval: %s. Reason: %s",
            run_id, tool_name, reason
        )

        try:
            # Wait for user action (with 10-minute timeout for human review)
            is_approved, rej_reason = await asyncio.wait_for(future, timeout=600.0)
            return is_approved, rej_reason
        except asyncio.TimeoutError:
            logger.warning("Approval request for run %s timed out after 600s", run_id)
            return False, "Approval timed out after 10 minutes without user response."
        finally:
            async with self._lock:
                self._pending_approvals.pop(run_id, None)
                self._pending_details.pop(run_id, None)

    async def approve(self, run_id: str) -> bool:
        """Approve a pending tool call for the given run."""
        async with self._lock:
            future = self._pending_approvals.get(run_id)
            if future and not future.done():
                future.set_result((True, None))
                logger.info("Run %s tool call approved by user", run_id)
                return True
        return False

    async def reject(self, run_id: str, reason: str = "Tool call rejected by user.") -> bool:
        """Reject a pending tool call for the given run."""
        async with self._lock:
            future = self._pending_approvals.get(run_id)
            if future and not future.done():
                future.set_result((False, reason))
                logger.info("Run %s tool call rejected by user: %s", run_id, reason)
                return True
        return False

    def get_pending(self, run_id: str) -> Optional[dict[str, Any]]:
        """Retrieve details of any pending approval for the run."""
        return self._pending_details.get(run_id)

    def pause(self, run_id: str) -> None:
        """Request the run to pause before its next iteration."""
        if run_id not in self._pause_events:
            self._pause_events[run_id] = asyncio.Event()
        self._pause_events[run_id].clear()
        logger.info("Run %s paused by user", run_id)

    def resume(self, run_id: str) -> None:
        """Resume a paused run."""
        event = self._pause_events.get(run_id)
        if event:
            event.set()
            logger.info("Run %s resumed by user", run_id)

    async def wait_if_paused(self, run_id: str) -> None:
        """Wait if the run is currently in a paused state."""
        event = self._pause_events.get(run_id)
        if event and not event.is_set():
            logger.info("Run %s is paused; waiting for resume signal...", run_id)
            await event.wait()

    def cleanup(self, run_id: str) -> None:
        """Clear all in-memory state associated with a completed run."""
        self._pending_approvals.pop(run_id, None)
        self._pending_details.pop(run_id, None)
        self._pause_events.pop(run_id, None)


approval_manager = ApprovalManager()
