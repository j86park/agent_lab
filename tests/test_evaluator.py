"""Agent Lab — Automated Test Suite for Milestone 4: Calibrated Trajectory Evaluation.

Covers:
- M4-T1: Deterministic Trace Metrics Calculation (redundant calls, errors, recovery rate)
- M4-T2: Multi-dimensional G-Eval Rubric Validation (1.0 to 5.0 scale)
- M4-T3: Position-Swapped Pairwise Comparison (Eliminating LLM judge order bias)
- M4-T4: Synthetic Loop Trap Detection (100% detection of circular execution thrashing)
- M4-T5: Trajectory Step Divergence Diffing
- Live REST API endpoints: /metrics, /evaluate, /compare/diff, /compare/pairwise.
"""

import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

# Ensure backend is on sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.config import settings
from app.database import async_session, init_db
from app.main import app
from app.models import Agent, Run, TestCase, TrajectoryEvent
from app.services.evaluator import EvaluationService
from app.services.llm.base import LLMResponse


@pytest.fixture(autouse=True)
async def setup_test_db():
    """Clean test records before/after tests."""
    settings.ensure_data_dirs()
    await init_db()
    async with async_session() as session:
        await session.execute(text("DELETE FROM trajectory_events WHERE run_id LIKE 'eval_test_%'"))
        await session.execute(text("DELETE FROM runs WHERE task LIKE 'eval_test_%' OR id LIKE 'eval_test_%'"))
        await session.execute(text("DELETE FROM agents WHERE name LIKE 'Eval%'"))
        await session.commit()
    yield
    async with async_session() as session:
        await session.execute(text("DELETE FROM trajectory_events WHERE run_id LIKE 'eval_test_%'"))
        await session.execute(text("DELETE FROM runs WHERE task LIKE 'eval_test_%' OR id LIKE 'eval_test_%'"))
        await session.execute(text("DELETE FROM agents WHERE name LIKE 'Eval%'"))
        await session.commit()


# ─────────────────────────────────────────────────────────────────────────────
# M4-T1: Deterministic Trace Metrics Calculation
# ─────────────────────────────────────────────────────────────────────────────

def test_deterministic_metrics():
    """M4-T1: Calculate steps, duplicate tool calls, errors, and recovery rate from events."""
    run = Run(id="eval_test_m4t1", duration_seconds=12.5, total_tokens=1500)

    events = [
        # Step 0: User prompt
        TrajectoryEvent(run_id=run.id, step_index=0, event_type="user", payload_json='{"task": "inspect"}'),
        # Step 1: Tool call 1 (file_read on config.json)
        TrajectoryEvent(run_id=run.id, step_index=1, event_type="action", payload_json=json.dumps({
            "tool_name": "file_read", "arguments": {"path": "config.json"}
        })),
        TrajectoryEvent(run_id=run.id, step_index=1, event_type="observation", payload_json=json.dumps({
            "tool_output": "FileNotFoundError: config.json not found", "is_error": True
        })),
        # Step 2: Tool call 2 (recovery: file_read on default.json)
        TrajectoryEvent(run_id=run.id, step_index=2, event_type="action", payload_json=json.dumps({
            "tool_name": "file_read", "arguments": {"path": "default.json"}
        })),
        TrajectoryEvent(run_id=run.id, step_index=2, event_type="observation", payload_json=json.dumps({
            "tool_output": '{"env": "production"}', "is_error": False
        })),
        # Step 3: Redundant Tool call (repeats step 2 with identical arguments!)
        TrajectoryEvent(run_id=run.id, step_index=3, event_type="action", payload_json=json.dumps({
            "tool_name": "file_read", "arguments": {"path": "default.json"}
        })),
        TrajectoryEvent(run_id=run.id, step_index=3, event_type="observation", payload_json=json.dumps({
            "tool_output": '{"env": "production"}', "is_error": False
        })),
    ]

    metrics = EvaluationService.compute_deterministic_metrics(run, events)

    assert metrics.total_steps == 4
    assert metrics.tool_call_count == 3
    assert metrics.redundant_call_count == 1  # Step 3 duplicated Step 2
    assert metrics.tool_error_count == 1      # Step 1 failed
    assert metrics.recovery_rate == 1.0       # Step 2 successfully recovered from Step 1 error
    assert metrics.duration_seconds == 12.5
    assert metrics.total_tokens == 1500


# ─────────────────────────────────────────────────────────────────────────────
# M4-T2: Multi-Dimensional G-Eval Rubric Validation
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_geval_schema():
    """M4-T2: LLM Judge returns validated 1.0-5.0 rubric scores and normalized score."""
    evaluator = EvaluationService()
    run = Run(id="eval_test_m4t2", duration_seconds=5.0, total_tokens=800, status="completed")
    test_case = TestCase(
        task="Sort an array of integers",
        expected_behavior="Return sorted numbers in ascending order",
        rubric="Efficiency, code correctness",
    )
    events = [
        TrajectoryEvent(run_id=run.id, step_index=0, event_type="user", payload_json='{"task": "sort"}'),
        TrajectoryEvent(run_id=run.id, step_index=1, event_type="action", payload_json='{"tool_name": "code_execute", "arguments": {"code": "print(sorted([3,1,2]))"}}'),
        TrajectoryEvent(run_id=run.id, step_index=1, event_type="observation", payload_json='{"tool_output": "[1, 2, 3]"}'),
    ]

    mock_llm_json = json.dumps({
        "planning_score": 4.5,
        "tool_accuracy_score": 5.0,
        "recovery_score": 5.0,
        "task_completion_score": 4.8,
        "overall_score": 4.8,
        "reasoning_trace": "The agent directly wrote python sort code without wasted steps.",
        "feedback": "Flawless execution.",
    })

    mock_provider = AsyncMock()
    mock_provider.chat.return_value = LLMResponse(
        content=mock_llm_json,
        model="gpt-4o-mini",
        input_tokens=200,
        output_tokens=80,
        cost=0.0002,
    )

    with patch.object(evaluator, "provider", mock_provider):
        report = await evaluator.evaluate_trajectory(run, test_case, events)

    assert 1.0 <= report.geval_scores.planning_score <= 5.0
    assert 1.0 <= report.geval_scores.tool_accuracy_score <= 5.0
    assert 1.0 <= report.geval_scores.recovery_score <= 5.0
    assert 1.0 <= report.geval_scores.task_completion_score <= 5.0
    assert 1.0 <= report.geval_scores.overall_score <= 5.0
    assert 0.0 <= report.normalized_score <= 1.0
    assert "directly wrote" in report.geval_scores.reasoning_trace


# ─────────────────────────────────────────────────────────────────────────────
# M4-T3: Position-Swapped Pairwise Comparison (Bias Mitigation)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_position_swap_bias():
    """M4-T3: Inconsistent verdicts between Trial 1 (A,B) and Trial 2 (B,A) are flagged as biased."""
    evaluator = EvaluationService()
    run_a = Run(id="eval_test_run_a", status="completed")
    run_b = Run(id="eval_test_run_b", status="completed")
    events_a = [TrajectoryEvent(run_id=run_a.id, step_index=0, event_type="user", payload_json="{}")]
    events_b = [TrajectoryEvent(run_id=run_b.id, step_index=0, event_type="user", payload_json="{}")]

    # Scenario 1: Statistically consistent winner (Candidate in slot A wins both trials)
    # Trial 1: Candidate 1 (A) vs Candidate 2 (B) -> Candidate 1 wins (run_a)
    # Trial 2: Candidate 1 (B) vs Candidate 2 (A) -> Candidate 2 wins (run_a)
    mock_provider_consistent = AsyncMock()
    mock_provider_consistent.chat.side_effect = [
        LLMResponse(content=json.dumps({"winner": "Candidate 1", "explanation": "A was faster"}), model="m", input_tokens=0, output_tokens=0, cost=0),
        LLMResponse(content=json.dumps({"winner": "Candidate 2", "explanation": "A was faster"}), model="m", input_tokens=0, output_tokens=0, cost=0),
    ]

    with patch.object(evaluator, "provider", mock_provider_consistent):
        res_consistent = await evaluator.evaluate_pairwise(
            run_a, run_b, "Task", "Expected", events_a, events_b
        )
        assert res_consistent.position_bias_stable is True
        assert res_consistent.winner == "run_a"

    # Scenario 2: Position bias detected!
    # The judge lazily always picks whoever is in Slot 1 ("Candidate 1")
    # Trial 1: Candidate 1 (A) vs Candidate 2 (B) -> picks Candidate 1 (A)
    # Trial 2: Candidate 1 (B) vs Candidate 2 (A) -> picks Candidate 1 (B)
    mock_provider_biased = AsyncMock()
    mock_provider_biased.chat.side_effect = [
        LLMResponse(content=json.dumps({"winner": "Candidate 1", "explanation": "Slot 1 favoured"}), model="m", input_tokens=0, output_tokens=0, cost=0),
        LLMResponse(content=json.dumps({"winner": "Candidate 1", "explanation": "Slot 1 favoured"}), model="m", input_tokens=0, output_tokens=0, cost=0),
    ]

    with patch.object(evaluator, "provider", mock_provider_biased):
        res_biased = await evaluator.evaluate_pairwise(
            run_a, run_b, "Task", "Expected", events_a, events_b
        )
        # MUST be flagged as position biased and inconclusive!
        assert res_biased.position_bias_stable is False
        assert res_biased.winner == "inconclusive"
        assert "Position bias detected" in res_biased.explanation


# ─────────────────────────────────────────────────────────────────────────────
# M4-T4: Synthetic Loop Trap Test
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_synthetic_loop_trap():
    """M4-T4: 100% detection of infinite loops; planning score is severely penalized."""
    evaluator = EvaluationService()
    run = Run(id="eval_test_loop_trap", status="failed", duration_seconds=30.0, total_tokens=4000)
    test_case = TestCase(task="Find file", expected_behavior="Locate file")

    # Synthetic loop: agent executes identical command 4 times in a row
    loop_events = [
        TrajectoryEvent(run_id=run.id, step_index=0, event_type="user", payload_json='{"task": "find"}'),
    ]
    for i in range(1, 5):
        loop_events.append(
            TrajectoryEvent(run_id=run.id, step_index=i, event_type="action", payload_json=json.dumps({
                "tool_name": "bash", "arguments": {"cmd": "ls -la /wrong_dir"}
            }))
        )
        loop_events.append(
            TrajectoryEvent(run_id=run.id, step_index=i, event_type="observation", payload_json=json.dumps({
                "tool_output": "Directory not found", "is_error": True
            }))
        )

    # Even if an uncalibrated judge outputs 4.5 planning, our heuristic clamp catches the loop!
    mock_provider = AsyncMock()
    mock_provider.chat.return_value = LLMResponse(
        content=json.dumps({
            "planning_score": 4.5,
            "tool_accuracy_score": 2.0,
            "recovery_score": 1.0,
            "task_completion_score": 1.0,
            "overall_score": 2.5,
            "reasoning_trace": "Agent tried hard",
            "feedback": "Repeated command too much",
        }),
        model="m", input_tokens=0, output_tokens=0, cost=0
    )

    with patch.object(evaluator, "provider", mock_provider):
        report = await evaluator.evaluate_trajectory(run, test_case, loop_events)

    # Verifies loop was flagged
    assert report.deterministic_metrics.redundant_call_count >= 2
    # Planning score clamped to <= 2.0
    assert report.geval_scores.planning_score <= 2.0


# ─────────────────────────────────────────────────────────────────────────────
# M4-T5: Trajectory Step Divergence Diffing
# ─────────────────────────────────────────────────────────────────────────────

def test_trajectory_diff_divergence():
    """M4-T5: Turn-by-turn comparison identifies exact step where two runs diverged."""
    run_a_id = "run_a_diff"
    run_b_id = "run_b_diff"

    events_a = [
        TrajectoryEvent(run_id=run_a_id, step_index=0, event_type="action", payload_json=json.dumps({
            "tool_name": "file_read", "arguments": {"path": "main.py"}
        })),
        TrajectoryEvent(run_id=run_a_id, step_index=1, event_type="action", payload_json=json.dumps({
            "tool_name": "code_execute", "arguments": {"code": "python main.py"}
        })),
    ]

    events_b = [
        TrajectoryEvent(run_id=run_b_id, step_index=0, event_type="action", payload_json=json.dumps({
            "tool_name": "file_read", "arguments": {"path": "main.py"}
        })),
        TrajectoryEvent(run_id=run_b_id, step_index=1, event_type="action", payload_json=json.dumps({
            "tool_name": "code_execute", "arguments": {"code": "pytest test_main.py"}  # Diverged here!
        })),
    ]

    diff = EvaluationService.compute_trajectory_divergence(run_a_id, run_b_id, events_a, events_b)

    assert diff.has_divergence is True
    assert diff.divergence_step == 1
    assert diff.step_diffs[0].is_divergent is False
    assert diff.step_diffs[1].is_divergent is True
    assert diff.step_diffs[1].run_a_args == {"code": "python main.py"}
    assert diff.step_diffs[1].run_b_args == {"code": "pytest test_main.py"}


# ─────────────────────────────────────────────────────────────────────────────
# Live REST API Endpoints: /metrics, /evaluate, /compare/diff, /compare/pairwise
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_evaluation_api_endpoints():
    """Verify REST API routes for metrics, evaluation, divergence diff, and pairwise comparison."""
    async with async_session() as session:
        agent = Agent(name="Eval REST Agent", provider="openai", model="gpt-4o")
        session.add(agent)
        await session.commit()
        await session.refresh(agent)

        run_1 = Run(id="eval_test_api_r1", agent_id=agent.id, task="eval_test_api_task", status="completed", duration_seconds=4.2, total_tokens=600)
        run_2 = Run(id="eval_test_api_r2", agent_id=agent.id, task="eval_test_api_task", status="completed", duration_seconds=5.8, total_tokens=900)
        session.add(run_1)
        session.add(run_2)
        await session.commit()

        session.add(TrajectoryEvent(run_id=run_1.id, step_index=0, event_type="action", payload_json='{"tool_name": "tool_a", "arguments": {"x": 1}}'))
        session.add(TrajectoryEvent(run_id=run_2.id, step_index=0, event_type="action", payload_json='{"tool_name": "tool_b", "arguments": {"x": 2}}'))
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. GET /api/runs/{id}/metrics
        r_m = await ac.get(f"/api/runs/{run_1.id}/metrics")
        assert r_m.status_code == 200
        metrics = r_m.json()
        assert metrics["tool_call_count"] == 1
        assert metrics["duration_seconds"] == 4.2

        # 2. POST /api/runs/{id}/evaluate
        r_eval = await ac.post(f"/api/runs/{run_1.id}/evaluate")
        assert r_eval.status_code == 200
        eval_data = r_eval.json()
        assert "geval_scores" in eval_data
        assert "deterministic_metrics" in eval_data

        # 3. POST /api/runs/compare/diff
        r_diff = await ac.post("/api/runs/compare/diff", json={"run_a_id": run_1.id, "run_b_id": run_2.id})
        assert r_diff.status_code == 200
        diff_data = r_diff.json()
        assert diff_data["has_divergence"] is True
        assert diff_data["divergence_step"] == 0

        # 4. POST /api/runs/compare/pairwise
        r_pair = await ac.post("/api/runs/compare/pairwise", json={"run_a_id": run_1.id, "run_b_id": run_2.id})
        assert r_pair.status_code == 200
        pair_data = r_pair.json()
        assert "winner" in pair_data
        assert "position_bias_stable" in pair_data
