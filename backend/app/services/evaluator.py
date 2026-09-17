"""Agent Lab — Calibrated Trajectory Evaluation & G-Eval Service.

Provides:
1. Deterministic trace metrics extraction (redundant calls, errors, recovery rate).
2. Multi-dimensional G-Eval rubric evaluation (planning, tool accuracy, recovery).
3. Position-swapped pairwise comparison to eliminate LLM judge order bias.
4. Step-by-step trajectory divergence diffing between runs.
"""

import json
import logging
from typing import Any, Optional

from app.models import Run, RunLog, TestCase, TrajectoryEvent
from app.schemas import (
    DeterministicMetrics,
    GEvalRubricScores,
    PairwiseEvaluationResult,
    StepDiff,
    TrajectoryDiffResult,
    TrajectoryEvaluationReport,
)
from app.services.llm.base import LLMMessage
from app.services.llm.factory import get_provider

logger = logging.getLogger(__name__)

EVAL_MODEL = "openai/gpt-4o-mini"
EVAL_PROVIDER = "openrouter"

GEVAL_SYSTEM_PROMPT = """You are an expert evaluator assessing an autonomous AI agent's execution trajectory.
Evaluate the agent across four core dimensions on a 1.0 to 5.0 scale (where 1.0 is total failure and 5.0 is outstanding):
1. planning_score (1.0-5.0): Coherence of plan, evidence-based exploration, lack of circular loops or thrashing.
2. tool_accuracy_score (1.0-5.0): Appropriate tool selection, schema conformity, accurate parameter values without hallucination.
3. recovery_score (1.0-5.0): Ability to diagnose tool failures/errors and adapt on subsequent turns (score 5.0 if zero errors occurred).
4. task_completion_score (1.0-5.0): How completely and accurately the final outcome answers the user's objective.

Compute overall_score as the weighted average:
overall_score = (planning_score * 0.25) + (tool_accuracy_score * 0.25) + (recovery_score * 0.20) + (task_completion_score * 0.30)

You MUST respond with a valid JSON object matching this schema:
{
  "planning_score": float,
  "tool_accuracy_score": float,
  "recovery_score": float,
  "task_completion_score": float,
  "overall_score": float,
  "reasoning_trace": "Detailed chain-of-thought analysis",
  "feedback": "Actionable feedback for improvement"
}
"""

PAIRWISE_SYSTEM_PROMPT = """You are an expert impartial judge comparing two AI agent execution trajectories for the same task.
Compare Candidate 1 and Candidate 2 based on:
- Planning efficiency (fewer redundant steps, no infinite loops)
- Accuracy of tool arguments and error avoidance
- Directness and quality of the final result

You MUST select one winner: "Candidate 1", "Candidate 2", or "Tie".
Respond with a valid JSON object matching this schema:
{
  "winner": "Candidate 1" | "Candidate 2" | "Tie",
  "explanation": "Concise reasoning for the choice"
}
"""


class EvaluationService:
    """Calibrated trajectory evaluation and benchmarking service."""

    def __init__(self, provider_name: str = EVAL_PROVIDER, model: str = EVAL_MODEL):
        try:
            self.provider = get_provider(provider_name)
        except Exception:
            # Fall back to OpenAI or dummy if provider not configured
            self.provider = None
        self.model = model

    @staticmethod
    def compute_deterministic_metrics(
        run: Run,
        events: list[TrajectoryEvent],
        logs: list[RunLog] | None = None,
    ) -> DeterministicMetrics:
        """
        Compute deterministic behavioral metrics directly from trajectory events.
        Identifies loop thrashing, repeated tool calls with identical arguments, and error recovery.
        """
        step_indices: set[int] = set()
        tool_calls: list[tuple[str, str]] = []  # (tool_name, json_args_str)
        error_count = 0
        recovered_count = 0
        prior_step_had_error = False

        for e in events:
            step_indices.add(e.step_index)
            payload: dict[str, Any] = {}
            if e.payload_json:
                try:
                    payload = json.loads(e.payload_json) if isinstance(e.payload_json, str) else e.payload_json
                except Exception:
                    payload = {}

            if e.event_type == "action":
                tool_name = payload.get("tool_name", "")
                args = payload.get("arguments", {})
                args_str = json.dumps(args, sort_keys=True)
                tool_calls.append((tool_name, args_str))

            elif e.event_type == "observation":
                out_text = str(payload.get("tool_output", ""))
                has_error = (
                    payload.get("is_error", False)
                    or "error" in out_text.lower()
                    or "exception" in out_text.lower()
                    or "failed" in out_text.lower()
                    or "exit code 1" in out_text.lower()
                )
                if has_error:
                    error_count += 1
                    prior_step_had_error = True
                else:
                    if prior_step_had_error:
                        recovered_count += 1
                        prior_step_had_error = False

        # Detect redundant tool calls (same tool + identical arguments)
        seen_calls: dict[tuple[str, str], int] = {}
        redundant_count = 0
        for call in tool_calls:
            if call in seen_calls:
                redundant_count += 1
            seen_calls[call] = seen_calls.get(call, 0) + 1

        recovery_rate = 1.0 if error_count == 0 else min(1.0, recovered_count / error_count)

        return DeterministicMetrics(
            total_steps=max(len(step_indices), 1),
            tool_call_count=len(tool_calls),
            redundant_call_count=redundant_count,
            tool_error_count=error_count,
            recovery_rate=round(recovery_rate, 4),
            duration_seconds=float(run.duration_seconds or 0.0),
            total_tokens=int(run.total_tokens or 0),
        )

    async def evaluate_trajectory(
        self,
        run: Run,
        test_case: TestCase,
        events: list[TrajectoryEvent],
        logs: list[RunLog] | None = None,
    ) -> TrajectoryEvaluationReport:
        """
        Multi-dimensional G-Eval rubric evaluation of a run trajectory.
        Combines deterministic trace metrics with LLM judge rubric scoring.
        """
        # 1. Compute deterministic trace metrics
        det_metrics = self.compute_deterministic_metrics(run, events, logs)

        # 2. Format trajectory narrative for G-Eval judge
        trajectory_lines = []
        for e in events:
            try:
                p = json.loads(e.payload_json) if isinstance(e.payload_json, str) else e.payload_json
            except Exception:
                p = {}
            trajectory_lines.append(f"[Step {e.step_index}] {e.event_type.upper()}: {json.dumps(p)}")

        formatted_trajectory = "\n".join(trajectory_lines)

        user_content = f"""
### Task:
{test_case.task}

### Expected Target Behavior:
{test_case.expected_behavior}

### Rubric / Criteria:
{test_case.rubric or "Standard agentic accuracy and efficiency."}

### Deterministic Trace Metrics:
- Total Steps: {det_metrics.total_steps}
- Tool Calls: {det_metrics.tool_call_count}
- Redundant (Duplicate) Calls: {det_metrics.redundant_call_count}
- Tool Errors Encountered: {det_metrics.tool_error_count}
- Recovery Rate: {det_metrics.recovery_rate:.2%}

### Full Chronological Trajectory:
{formatted_trajectory}
"""

        messages = [
            LLMMessage(role="system", content=GEVAL_SYSTEM_PROMPT),
            LLMMessage(role="user", content=user_content),
        ]

        try:
            if not self.provider:
                raise ValueError("No LLM provider available for evaluation")

            resp = await self.provider.chat(
                messages=messages,
                model=self.model,
                response_format={"type": "json_object"},
            )
            data = json.loads(resp.content)

            # Heuristic penalty: If agent had redundant tool loops, clamp planning score
            planning = float(data.get("planning_score", 3.0))
            if det_metrics.redundant_call_count >= 2:
                planning = min(planning, 2.0)

            geval = GEvalRubricScores(
                planning_score=max(1.0, min(5.0, planning)),
                tool_accuracy_score=max(1.0, min(5.0, float(data.get("tool_accuracy_score", 3.0)))),
                recovery_score=max(1.0, min(5.0, float(data.get("recovery_score", 3.0)))),
                task_completion_score=max(1.0, min(5.0, float(data.get("task_completion_score", 3.0)))),
                overall_score=max(1.0, min(5.0, float(data.get("overall_score", 3.0)))),
                reasoning_trace=str(data.get("reasoning_trace", "No reasoning provided")),
                feedback=str(data.get("feedback", "No feedback provided")),
            )

        except Exception as e:
            logger.warning("G-Eval LLM scoring failed or unconfigured, generating rule-based scores: %s", e)
            # Rule-based fallback calculation
            plan_score = 5.0 - min(4.0, det_metrics.redundant_call_count * 1.5)
            tool_score = 5.0 - min(4.0, det_metrics.tool_error_count * 1.0)
            rec_score = 5.0 if det_metrics.tool_error_count == 0 else (1.0 + det_metrics.recovery_rate * 4.0)
            comp_score = 5.0 if run.status == "completed" else 1.0
            ov_score = (plan_score * 0.25) + (tool_score * 0.25) + (rec_score * 0.20) + (comp_score * 0.30)

            geval = GEvalRubricScores(
                planning_score=round(plan_score, 2),
                tool_accuracy_score=round(tool_score, 2),
                recovery_score=round(rec_score, 2),
                task_completion_score=round(comp_score, 2),
                overall_score=round(ov_score, 2),
                reasoning_trace=f"Computed from deterministic trace metrics. Redundant loops: {det_metrics.redundant_call_count}, errors: {det_metrics.tool_error_count}.",
                feedback="Automated trace rule evaluation applied.",
            )

        # Normalized 0.0 - 1.0 score for backward compatibility with Run.eval_score
        normalized = round((geval.overall_score - 1.0) / 4.0, 4)

        return TrajectoryEvaluationReport(
            run_id=run.id,
            deterministic_metrics=det_metrics,
            geval_scores=geval,
            normalized_score=normalized,
        )

    async def evaluate_pairwise(
        self,
        run_a: Run,
        run_b: Run,
        task: str,
        expected_behavior: str,
        events_a: list[TrajectoryEvent],
        events_b: list[TrajectoryEvent],
    ) -> PairwiseEvaluationResult:
        """
        Evaluate two runs pairwise with position-swapping to detect and eliminate order bias.
        Trial 1: Judge(Candidate 1=A, Candidate 2=B)
        Trial 2: Judge(Candidate 1=B, Candidate 2=A)
        """
        trace_a = "\n".join([f"[Step {e.step_index}] {e.event_type}: {e.payload_json}" for e in events_a])
        trace_b = "\n".join([f"[Step {e.step_index}] {e.event_type}: {e.payload_json}" for e in events_b])

        # Trial 1: A as Candidate 1, B as Candidate 2
        trial_1_prompt = f"""
### Task:
{task}

### Target Expectation:
{expected_behavior}

### Candidate 1 Trajectory:
{trace_a}

### Candidate 2 Trajectory:
{trace_b}
"""
        # Trial 2: B as Candidate 1, A as Candidate 2
        trial_2_prompt = f"""
### Task:
{task}

### Target Expectation:
{expected_behavior}

### Candidate 1 Trajectory:
{trace_b}

### Candidate 2 Trajectory:
{trace_a}
"""

        async def run_trial(prompt: str) -> tuple[str, str]:
            if not self.provider:
                # Deterministic rule fallback: fewer steps wins
                return ("Candidate 1", "Rule fallback") if len(events_a) <= len(events_b) else ("Candidate 2", "Rule fallback")
            try:
                res = await self.provider.chat(
                    messages=[
                        LLMMessage(role="system", content=PAIRWISE_SYSTEM_PROMPT),
                        LLMMessage(role="user", content=prompt),
                    ],
                    model=self.model,
                    response_format={"type": "json_object"},
                )
                j = json.loads(res.content)
                return j.get("winner", "Tie"), j.get("explanation", "")
            except Exception as e:
                logger.warning("Pairwise trial failed: %s", e)
                return "Tie", str(e)

        winner_1_raw, exp_1 = await run_trial(trial_1_prompt)
        winner_2_raw, exp_2 = await run_trial(trial_2_prompt)

        # Map candidate slot back to run identity
        # In Trial 1: Candidate 1 = A, Candidate 2 = B
        if "1" in winner_1_raw:
            trial_1_winner = "run_a"
        elif "2" in winner_1_raw:
            trial_1_winner = "run_b"
        else:
            trial_1_winner = "tie"

        # In Trial 2: Candidate 1 = B, Candidate 2 = A
        if "1" in winner_2_raw:
            trial_2_winner = "run_b"
        elif "2" in winner_2_raw:
            trial_2_winner = "run_a"
        else:
            trial_2_winner = "tie"

        # Order Consistency Check
        if trial_1_winner == trial_2_winner:
            position_bias_stable = True
            overall_winner = trial_1_winner
            explanation = f"Statistically consistent winner: {overall_winner}. {exp_1}"
        else:
            position_bias_stable = False
            overall_winner = "inconclusive"
            explanation = (
                f"Position bias detected: Presentation order inverted judge verdict. "
                f"Trial 1 favored {trial_1_winner} while Trial 2 favored {trial_2_winner}."
            )

        return PairwiseEvaluationResult(
            run_a_id=run_a.id,
            run_b_id=run_b.id,
            winner=overall_winner,
            position_bias_stable=position_bias_stable,
            trial_1_winner=trial_1_winner,
            trial_2_winner=trial_2_winner,
            explanation=explanation,
        )

    @staticmethod
    def compute_trajectory_divergence(
        run_a_id: str,
        run_b_id: str,
        events_a: list[TrajectoryEvent],
        events_b: list[TrajectoryEvent],
    ) -> TrajectoryDiffResult:
        """
        Compare two trajectories step-by-step to identify the exact step where decisions diverged.
        """
        # Filter action events (tool invocations)
        actions_a = [e for e in events_a if e.event_type == "action"]
        actions_b = [e for e in events_b if e.event_type == "action"]

        max_steps = max(len(actions_a), len(actions_b))
        step_diffs: list[StepDiff] = []
        divergence_step: Optional[int] = None

        for idx in range(max_steps):
            act_a = actions_a[idx] if idx < len(actions_a) else None
            act_b = actions_b[idx] if idx < len(actions_b) else None

            p_a = json.loads(act_a.payload_json) if act_a and act_a.payload_json else {}
            p_b = json.loads(act_b.payload_json) if act_b and act_b.payload_json else {}

            tool_a = p_a.get("tool_name")
            args_a = p_a.get("arguments")
            tool_b = p_b.get("tool_name")
            args_b = p_b.get("arguments")

            is_diff = (tool_a != tool_b) or (args_a != args_b)

            if is_diff and divergence_step is None:
                divergence_step = idx

            step_diffs.append(
                StepDiff(
                    step_index=idx,
                    run_a_tool=tool_a,
                    run_a_args=args_a,
                    run_b_tool=tool_b,
                    run_b_args=args_b,
                    is_divergent=is_diff,
                )
            )

        return TrajectoryDiffResult(
            run_a_id=run_a_id,
            run_b_id=run_b_id,
            divergence_step=divergence_step,
            step_diffs=step_diffs,
            has_divergence=divergence_step is not None,
        )
