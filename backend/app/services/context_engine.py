"""Agent Lab — Cache-Conscious Context Engine.

Handles:
1. Tool observation truncation and offloading to disk artifacts.
2. Token estimation and context capacity tracking.
3. Selective deletion-based context compaction for long-horizon agent runs.
"""

import logging
from pathlib import Path
from typing import Optional

from app.config import settings
from app.services.llm.base import LLMMessage

logger = logging.getLogger(__name__)

# Default truncation threshold (~1,500 tokens / 4,000 characters)
DEFAULT_MAX_OBSERVATION_CHARS = 4000


class ContextEngine:
    """Context and token management service."""

    def __init__(self, artifacts_root: Optional[Path] = None):
        self._artifacts_root = artifacts_root or settings.ARTIFACTS_DIR

    @property
    def artifacts_root(self) -> Path:
        """Root directory for artifacts."""
        return self._artifacts_root

    def get_run_artifacts_dir(self, run_id: str) -> Path:
        """Get or create the directory for a specific run's artifacts."""
        d = self._artifacts_root / run_id
        d.mkdir(parents=True, exist_ok=True)
        return d

    def save_artifact(self, run_id: str, artifact_name: str, content: str) -> Path:
        """
        Persist full untruncated content to a run artifact file.
        Validates path to prevent directory traversal.
        """
        run_dir = self.get_run_artifacts_dir(run_id).resolve()
        target_path = (run_dir / artifact_name).resolve()

        # Prevent directory traversal
        if not str(target_path).startswith(str(run_dir)):
            raise ValueError(f"Path traversal detected: {artifact_name}")

        target_path.write_text(content, encoding="utf-8")
        return target_path

    def read_artifact(self, run_id: str, artifact_name: str) -> str:
        """
        Read the content of a run artifact file.
        Validates path and raises FileNotFoundError if absent.
        """
        run_dir = (self._artifacts_root / run_id).resolve()
        target_path = (run_dir / artifact_name).resolve()

        if not str(target_path).startswith(str(run_dir)):
            raise ValueError(f"Path traversal detected: {artifact_name}")

        if not target_path.exists() or not target_path.is_file():
            # Try appending .log if not present
            alt_path = (run_dir / f"{artifact_name}.log").resolve()
            if alt_path.exists() and alt_path.is_file() and str(alt_path).startswith(str(run_dir)):
                return alt_path.read_text(encoding="utf-8")
            raise FileNotFoundError(f"Artifact '{artifact_name}' not found for run '{run_id}'")

        return target_path.read_text(encoding="utf-8")

    def process_tool_observation(
        self,
        run_id: str,
        tool_call_id: str,
        tool_output: str,
        max_chars: int = DEFAULT_MAX_OBSERVATION_CHARS,
    ) -> tuple[str, Optional[str]]:
        """
        Process a tool's output before inserting into message history.

        If output exceeds max_chars:
        1. Persists the full untruncated output to disk at ~/.agent-lab/artifacts/{run_id}/{tool_call_id}.log.
        2. Generates a head/tail truncated summary with the artifact:// URI.
        3. Returns (truncated_text, artifact_uri).

        If within limits:
        Returns (tool_output, None).
        """
        if len(tool_output) <= max_chars:
            return tool_output, None

        # Offload full output to artifact file
        artifact_filename = f"{tool_call_id}.log"
        self.save_artifact(run_id, artifact_filename, tool_output)
        artifact_uri = f"artifact://{run_id}/{artifact_filename}"

        # Extract head and tail
        lines = tool_output.splitlines(keepends=True)
        omitted_chars = len(tool_output)

        if len(lines) >= 20:
            head_lines = lines[:10]
            tail_lines = lines[-10:]
            head_text = "".join(head_lines).rstrip()
            tail_text = "".join(tail_lines).lstrip()
        else:
            # Fall back to char slice if few very long lines
            head_text = tool_output[:500].rstrip()
            tail_text = tool_output[-500:].lstrip()

        truncated_text = (
            f"[Observation truncated: {omitted_chars} chars total. Full output saved: {artifact_uri}]\n"
            f"--- HEAD (First lines) ---\n"
            f"{head_text}\n"
            f"...\n"
            f"--- TAIL (Last lines) ---\n"
            f"{tail_text}"
        )

        logger.info(
            "Truncated tool observation for run %s / tool %s (%d chars -> %d chars). Saved to %s",
            run_id, tool_call_id, len(tool_output), len(truncated_text), artifact_uri
        )
        return truncated_text, artifact_uri

    @staticmethod
    def estimate_tokens(text: str) -> int:
        """Estimate token count for a string with fast heuristic."""
        if not text:
            return 0
        # Average English text is ~4 characters per token
        return max(1, len(text) // 4)

    def estimate_messages_tokens(self, messages: list[LLMMessage]) -> int:
        """Estimate total tokens across a list of LLM messages."""
        total = 0
        for m in messages:
            total += 4  # Message framing overhead
            total += self.estimate_tokens(m.content)
            if m.tool_calls:
                for tc in m.tool_calls:
                    fn = tc.get("function", {})
                    total += self.estimate_tokens(fn.get("name", ""))
                    total += self.estimate_tokens(fn.get("arguments", ""))
        total += 2  # Conversation framing
        return total

    def compact_context(
        self,
        messages: list[LLMMessage],
        max_context_tokens: int = 8000,
        threshold_ratio: float = 0.80,
        keep_recent_tool_turns: int = 2,
    ) -> list[LLMMessage]:
        """
        Selective deletion-based context compaction.

        When estimated tokens exceed threshold_ratio of max_context_tokens:
        Prunes historical tool observations older than keep_recent_tool_turns,
        replacing them with '[Tool output cleared: see artifact]'.

        Leaves all system, user, and assistant reasoning messages untouched,
        preserving prompt cache prefixes and avoiding hallucinated summarization.
        """
        current_tokens = self.estimate_messages_tokens(messages)
        token_ceiling = int(max_context_tokens * threshold_ratio)

        if current_tokens < token_ceiling:
            return messages

        # Find indices of all tool messages
        tool_indices = [i for i, m in enumerate(messages) if m.role == "tool"]
        if len(tool_indices) <= keep_recent_tool_turns:
            return messages

        # Identify which tool indices to prune
        prune_indices = set(tool_indices[:-keep_recent_tool_turns])
        compacted: list[LLMMessage] = []

        pruned_count = 0
        for i, msg in enumerate(messages):
            if i in prune_indices:
                pruned_count += 1
                compacted.append(
                    LLMMessage(
                        role="tool",
                        content="[Tool output cleared to preserve context window: see prior logs or artifact]",
                        tool_call_id=msg.tool_call_id,
                        cache_control=msg.cache_control,
                    )
                )
            else:
                compacted.append(msg)

        new_tokens = self.estimate_messages_tokens(compacted)
        logger.info(
            "Compacted context: pruned %d older tool observations (%d -> %d tokens)",
            pruned_count, current_tokens, new_tokens
        )
        return compacted


# Global singleton instance
context_engine = ContextEngine()
