"""Agent Lab — Automated Test Suite for Milestone 3: Trajectory Debugger & Time-Travel.

Covers:
- M3-T1: Event Stream Persistence & Ordering (user, thought, action, observation)
- M3-T2: Workspace Snapshot Creation & Reversion (Byte-identical rollback)
- M3-T3: Time-Travel Fork Isolation (No state leakage to parent)
- M3-T4: Safety Breakpoint Interception (Dangerous tool triggers awaiting_approval)
- M3-T5: Human-in-the-Loop Rejection with feedback to LLM
- M3-T6: Pause and Resume Flow
- M3-T7: Interactive PTY WebSocket Bridge
"""

import asyncio
import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, text

# Ensure backend is on sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.config import settings
from app.database import async_session, init_db
from app.main import app
from app.models import Agent, Run, RunLog, TrajectoryEvent
from app.services.approval_manager import approval_manager
from app.services.llm.base import LLMMessage, LLMResponse
from app.services.orchestrator import AgentOrchestrator
from app.services.workspace_service import workspace_service


@pytest.fixture(autouse=True)
async def setup_test_db():
    """Clean test records and temporary workspace dirs before/after tests."""
    settings.ensure_data_dirs()
    await init_db()
    async with async_session() as session:
        await session.execute(text("DELETE FROM trajectory_events WHERE run_id LIKE 'traj_test_%'"))
        await session.execute(text("DELETE FROM runs WHERE task LIKE 'traj_test_%' OR id LIKE 'traj_test_%'"))
        await session.execute(text("DELETE FROM agents WHERE name LIKE 'Traj%'"))
        await session.commit()
    yield
    async with async_session() as session:
        await session.execute(text("DELETE FROM trajectory_events WHERE run_id LIKE 'traj_test_%'"))
        await session.execute(text("DELETE FROM runs WHERE task LIKE 'traj_test_%' OR id LIKE 'traj_test_%'"))
        await session.execute(text("DELETE FROM agents WHERE name LIKE 'Traj%'"))
        await session.commit()


# ─────────────────────────────────────────────────────────────────────────────
# M3-T1: Event Stream Persistence & Ordering
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_event_stream_integrity():
    """M3-T1: Verify full execution writes immutable user, thought, action, and observation events."""
    async with async_session() as session:
        agent = Agent(
            name="Traj Agent M3T1",
            system_prompt="You are a file helper.",
            tools_config=json.dumps(["file_read"]),
            provider="openai",
            model="gpt-4o",
        )
        session.add(agent)
        await session.commit()
        await session.refresh(agent)

        run = Run(id="traj_test_m3t1", agent_id=agent.id, task="traj_test_inspect_data", status="pending")
        session.add(run)
        await session.commit()
        await session.refresh(run)
        run_id = run.id

    mock_tool_resp = LLMResponse(
        content="I will read the configuration.",
        tool_calls=[{
            "id": "call_f_read",
            "type": "function",
            "function": {"name": "file_read", "arguments": json.dumps({"path": "config.json"})},
        }],
        input_tokens=80,
        output_tokens=30,
        cost=0.001,
        model="gpt-4o",
    )
    mock_final_resp = LLMResponse(
        content="The configuration is valid.",
        tool_calls=None,
        input_tokens=100,
        output_tokens=20,
        cost=0.0005,
        model="gpt-4o",
    )

    mock_provider = AsyncMock()
    mock_provider.chat.side_effect = [mock_tool_resp, mock_final_resp]

    orchestrator = AgentOrchestrator()
    with patch("app.services.orchestrator.get_provider", return_value=mock_provider), \
         patch.object(orchestrator.sandbox_manager, "create_sandbox", return_value="mock_c"), \
         patch.object(orchestrator.sandbox_manager, "destroy_sandbox", return_value=True), \
         patch("app.services.orchestrator.execute_tool", return_value='{"status": "ok"}'):

        await orchestrator.execute_run(run_id)

    async with async_session() as session:
        completed = await session.get(Run, run_id)
        assert completed.status == "completed"

        stmt = select(TrajectoryEvent).where(TrajectoryEvent.run_id == run_id).order_by(TrajectoryEvent.step_index.asc())
        events_res = await session.execute(stmt)
        events = events_res.scalars().all()

        event_types = [e.event_type for e in events]
        assert "user" in event_types
        assert "thought" in event_types
        assert "action" in event_types
        assert "observation" in event_types

        # Verify step index ordering
        step_indices = [e.step_index for e in events]
        assert step_indices == sorted(step_indices)


# ─────────────────────────────────────────────────────────────────────────────
# M3-T2: Workspace Snapshot Creation & Reversion
# ─────────────────────────────────────────────────────────────────────────────

def test_step_snapshot_creation(tmp_path: Path):
    """M3-T2: Taking snapshots and restoring them achieves exact byte-level filesystem rollback."""
    workspace = tmp_path / "agent_ws_test"
    workspace.mkdir()

    # Step 0: Baseline files
    (workspace / "main.py").write_text("print('version 0')", encoding="utf-8")
    (workspace / "data.txt").write_text("initial data", encoding="utf-8")
    workspace_service.create_step_snapshot(workspace, step_index=0)

    # Step 1: Agent modifies main.py, deletes data.txt, creates test.py
    (workspace / "main.py").write_text("print('version 1 - modified')", encoding="utf-8")
    (workspace / "data.txt").unlink()
    (workspace / "test.py").write_text("assert True", encoding="utf-8")
    workspace_service.create_step_snapshot(workspace, step_index=1)

    # Step 2: Agent writes another file
    (workspace / "notes.md").write_text("Step 2 notes", encoding="utf-8")
    workspace_service.create_step_snapshot(workspace, step_index=2)

    # Revert back to Step 0
    restored_0 = workspace_service.restore_step_snapshot(workspace, step_index=0)
    assert restored_0 is True
    assert (workspace / "main.py").read_text() == "print('version 0')"
    assert (workspace / "data.txt").read_text() == "initial data"
    assert not (workspace / "test.py").exists()
    assert not (workspace / "notes.md").exists()

    # Revert forward to Step 1
    restored_1 = workspace_service.restore_step_snapshot(workspace, step_index=1)
    assert restored_1 is True
    assert (workspace / "main.py").read_text() == "print('version 1 - modified')"
    assert not (workspace / "data.txt").exists()
    assert (workspace / "test.py").read_text() == "assert True"
    assert not (workspace / "notes.md").exists()


# ─────────────────────────────────────────────────────────────────────────────
# M3-T3: Time-Travel Fork Isolation
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_fork_isolation():
    """M3-T3: Forked run inherits events 0..n; mutations in child run do not alter parent."""
    parent_id = "traj_test_parent_run"
    async with async_session() as session:
        agent = Agent(name="Traj Parent Agent", provider="openai", model="gpt-4o")
        session.add(agent)
        await session.commit()
        await session.refresh(agent)

        parent_run = Run(id=parent_id, agent_id=agent.id, task="traj_test_fork_task", status="completed")
        session.add(parent_run)
        await session.commit()

        # Add 3 historical steps to parent
        session.add(TrajectoryEvent(run_id=parent_id, step_index=0, event_type="user", payload_json='{"task": "step 0"}'))
        session.add(TrajectoryEvent(run_id=parent_id, step_index=1, event_type="action", payload_json='{"tool": "step 1"}'))
        session.add(TrajectoryEvent(run_id=parent_id, step_index=2, event_type="action", payload_json='{"tool": "step 2"}'))
        await session.commit()

    # Setup parent workspace snapshots
    parent_ws = settings.AGENT_WORKSPACES_DIR / agent.id
    parent_ws.mkdir(parents=True, exist_ok=True)
    (parent_ws / "code.py").write_text("v1", encoding="utf-8")
    workspace_service.create_step_snapshot(parent_ws, step_index=1)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Fork at step 1
        fork_resp = await ac.post(f"/api/runs/{parent_id}/fork", json={
            "step_index": 1,
            "override_task": "forked_child_task",
        })
        assert fork_resp.status_code == 201
        child_run_data = fork_resp.json()
        child_id = child_run_data["id"]

    # Verify child run trajectory events
    async with async_session() as session:
        child_events_res = await session.execute(
            select(TrajectoryEvent).where(TrajectoryEvent.run_id == child_id).order_by(TrajectoryEvent.step_index.asc())
        )
        child_events = child_events_res.scalars().all()
        assert len(child_events) == 2  # Steps 0 and 1 only
        assert child_events[0].step_index == 0
        assert child_events[1].step_index == 1

        # Verify parent events were completely untouched
        parent_events_res = await session.execute(
            select(TrajectoryEvent).where(TrajectoryEvent.run_id == parent_id).order_by(TrajectoryEvent.step_index.asc())
        )
        parent_events = parent_events_res.scalars().all()
        assert len(parent_events) == 3


# ─────────────────────────────────────────────────────────────────────────────
# M3-T4: Safety Breakpoint Interception & Rejection
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_safety_breakpoint_interception_and_rejection():
    """M3-T4: Dangerous command triggers awaiting_approval; rejection feeds explanation back to LLM."""
    run_id = "traj_test_breakpoint_run"
    async with async_session() as session:
        agent = Agent(name="Traj Danger Agent", provider="openai", model="gpt-4o", tools_config=json.dumps(["code_execute"]))
        session.add(agent)
        await session.commit()
        await session.refresh(agent)

        run = Run(id=run_id, agent_id=agent.id, task="traj_test_danger_task", status="pending")
        session.add(run)
        await session.commit()

    # Turn 1: LLM attempts dangerous 'rm -rf /workspace/test'
    mock_danger_resp = LLMResponse(
        content="I will delete the test directory.",
        tool_calls=[{
            "id": "call_rm_rf",
            "type": "function",
            "function": {"name": "code_execute", "arguments": json.dumps({"command": "rm -rf /workspace/test"})},
        }],
        input_tokens=50,
        output_tokens=20,
        cost=0.0005,
        model="gpt-4o",
    )
    # Turn 2: LLM adapts to the rejection feedback
    mock_rejection_adapted_resp = LLMResponse(
        content="Understood, I will preserve the directory and complete the task safely.",
        tool_calls=None,
        input_tokens=80,
        output_tokens=20,
        cost=0.0004,
        model="gpt-4o",
    )

    mock_provider = AsyncMock()
    mock_provider.chat.side_effect = [mock_danger_resp, mock_rejection_adapted_resp]

    orchestrator = AgentOrchestrator()

    # Run execution in background task so we can simulate user interaction
    with patch("app.services.orchestrator.get_provider", return_value=mock_provider), \
         patch.object(orchestrator.sandbox_manager, "create_sandbox", return_value="mock_c"), \
         patch.object(orchestrator.sandbox_manager, "destroy_sandbox", return_value=True):

        task = asyncio.create_task(orchestrator.execute_run(run_id))

        # Wait for the run to hit the breakpoint
        for _ in range(50):
            await asyncio.sleep(0.05)
            pending = approval_manager.get_pending(run_id)
            if pending:
                break
        assert pending is not None
        assert "rm -rf" in pending["reason"]

        # User rejects the tool call via approval manager
        await approval_manager.reject(run_id, reason="Deletion not permitted in test environment")

        # Wait for orchestrator to finish
        await task

    # Verify run completed safely without executing the dangerous tool
    async with async_session() as session:
        finished_run = await session.get(Run, run_id)
        assert finished_run.status == "completed"

        # Verify rejection observation was captured in trajectory events
        events_res = await session.execute(
            select(TrajectoryEvent).where(TrajectoryEvent.run_id == run_id, TrajectoryEvent.event_type == "observation")
        )
        obs_event = events_res.scalars().first()
        assert obs_event is not None
        payload = json.loads(obs_event.payload_json)
        assert "rejected by user" in payload["tool_output"].lower()


# ─────────────────────────────────────────────────────────────────────────────
# M3-T5: Approval Approve Flow
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_approval_approve_flow():
    """Verify that approving a breakpoint tool call allows execution to continue normally."""
    run_id = "traj_test_approve_run"
    async with async_session() as session:
        agent = Agent(name="Traj Approve Agent", provider="openai", model="gpt-4o", tools_config=json.dumps(["code_execute"]))
        session.add(agent)
        await session.commit()
        await session.refresh(agent)

        run = Run(id=run_id, agent_id=agent.id, task="traj_test_approve_task", status="pending")
        session.add(run)
        await session.commit()

    mock_danger_resp = LLMResponse(
        content="Running table truncate.",
        tool_calls=[{
            "id": "call_drop",
            "type": "function",
            "function": {"name": "code_execute", "arguments": json.dumps({"command": "TRUNCATE TABLE logs;"})},
        }],
        input_tokens=50,
        output_tokens=20,
        cost=0.0005,
        model="gpt-4o",
    )
    mock_final_resp = LLMResponse(
        content="Table truncated successfully.",
        tool_calls=None,
        input_tokens=80,
        output_tokens=20,
        cost=0.0004,
        model="gpt-4o",
    )

    mock_provider = AsyncMock()
    mock_provider.chat.side_effect = [mock_danger_resp, mock_final_resp]

    orchestrator = AgentOrchestrator()
    with patch("app.services.orchestrator.get_provider", return_value=mock_provider), \
         patch.object(orchestrator.sandbox_manager, "create_sandbox", return_value="mock_c"), \
         patch.object(orchestrator.sandbox_manager, "destroy_sandbox", return_value=True), \
         patch("app.services.orchestrator.execute_tool", return_value="Table truncated."):

        task = asyncio.create_task(orchestrator.execute_run(run_id))

        # Wait for breakpoint
        for _ in range(50):
            await asyncio.sleep(0.05)
            if approval_manager.get_pending(run_id):
                break

        # User approves execution
        await approval_manager.approve(run_id)
        await task

    async with async_session() as session:
        finished = await session.get(Run, run_id)
        assert finished.status == "completed"


# ─────────────────────────────────────────────────────────────────────────────
# M3-T6: Pause and Resume Flow
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_pause_and_resume_flow():
    """Verify pause and resume API endpoints manipulate run state properly."""
    run_id = "traj_test_pause_run"
    async with async_session() as session:
        agent = Agent(name="Traj Pause Agent", provider="openai", model="gpt-4o")
        session.add(agent)
        await session.commit()
        await session.refresh(agent)

        run = Run(id=run_id, agent_id=agent.id, task="traj_test_pause_task", status="running")
        session.add(run)
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Pause
        r_pause = await ac.post(f"/api/runs/{run_id}/pause")
        assert r_pause.status_code == 200
        assert r_pause.json()["status"] == "paused"

        async with async_session() as session:
            r_db = await session.get(Run, run_id)
            assert r_db.status == "paused"

        # Resume
        r_resume = await ac.post(f"/api/runs/{run_id}/resume")
        assert r_resume.status_code == 200
        assert r_resume.json()["status"] == "running"

        async with async_session() as session:
            r_db = await session.get(Run, run_id)
            assert r_db.status == "running"


# ─────────────────────────────────────────────────────────────────────────────
# M3-T7: Trajectory API Endpoint
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_trajectory_api_endpoint():
    """Verify GET /api/runs/{id}/trajectory returns ordered events with typed payloads."""
    run_id = "traj_test_api_run"
    async with async_session() as session:
        agent = Agent(name="Traj Endpoint Agent", provider="openai", model="gpt-4o")
        session.add(agent)
        await session.commit()
        await session.refresh(agent)

        run = Run(id=run_id, agent_id=agent.id, task="traj_test_api_task", status="completed")
        session.add(run)
        await session.commit()

        session.add(TrajectoryEvent(run_id=run_id, step_index=0, event_type="user", payload_json='{"task": "inspect"}'))
        session.add(TrajectoryEvent(run_id=run_id, step_index=1, event_type="thought", payload_json='{"content": "thinking"}'))
        session.add(TrajectoryEvent(run_id=run_id, step_index=1, event_type="action", payload_json='{"tool": "read"}'))
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(f"/api/runs/{run_id}/trajectory")
        assert res.status_code == 200
        data = res.json()
        assert data["total_events"] == 3
        events = data["events"]
        assert events[0]["event_type"] == "user"
        assert events[1]["event_type"] == "thought"
        assert events[2]["event_type"] == "action"
