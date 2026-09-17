"""Agent Lab — Automated Test Suite for Milestone 2: Cache-Aware Context & Token Engine.

Covers:
- M2-T1: Observation Truncation & Disk Artifact Offloading
- M2-T2: Artifact Retrieval API Endpoint & Security (Path Traversal Prevention)
- M2-T3: Anthropic Ephemeral Cache Control Headers
- M2-T4: Cache-Discounted Cost Accounting (Anthropic 90% discount, OpenAI 50% discount)
- M2-T5: Selective Deletion-Based Context Compaction
- Edge cases: Single giant line truncation, path traversal attacks, non-existent artifacts.
- E2E: Orchestrator tool observation offload and prompt cache logging.
"""

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
from app.models import Agent, Run, RunLog
from app.services.context_engine import ContextEngine, context_engine
from app.services.llm.anthropic_provider import ANTHROPIC_PRICING, AnthropicProvider
from app.services.llm.base import LLMMessage, LLMResponse
from app.services.llm.openai_provider import OPENAI_PRICING, OpenAIProvider
from app.services.orchestrator import AgentOrchestrator


@pytest.fixture(autouse=True)
async def setup_test_db():
    """Ensure data directories and DB are clean before/after tests."""
    settings.ensure_data_dirs()
    await init_db()
    async with async_session() as session:
        await session.execute(text("DELETE FROM runs WHERE task LIKE 'context_test_%'"))
        await session.execute(text("DELETE FROM agents WHERE name LIKE 'Context%'"))
        await session.commit()
    yield
    async with async_session() as session:
        await session.execute(text("DELETE FROM runs WHERE task LIKE 'context_test_%'"))
        await session.execute(text("DELETE FROM agents WHERE name LIKE 'Context%'"))
        await session.commit()


# ─────────────────────────────────────────────────────────────────────────────
# M2-T1: Observation Truncation & Disk Artifacts
# ─────────────────────────────────────────────────────────────────────────────

def test_observation_truncation():
    """M2-T1: Output > threshold is truncated and offloaded; output <= threshold is kept intact."""
    run_id = "test_run_m2_t1"
    call_id = "tool_call_001"

    # 1. Output below threshold is NOT truncated
    small_output = "Short output: all tests passed."
    res_small, uri_small = context_engine.process_tool_observation(
        run_id=run_id, tool_call_id=call_id, tool_output=small_output, max_chars=4000
    )
    assert res_small == small_output
    assert uri_small is None

    # 2. Output exceeding threshold (e.g. 10,000 characters) is truncated
    large_lines = [f"Line {i:04d}: Compiler diagnostic info log statement..." for i in range(250)]
    large_output = "\n".join(large_lines)
    assert len(large_output) > 4000

    res_large, uri_large = context_engine.process_tool_observation(
        run_id=run_id, tool_call_id=call_id, tool_output=large_output, max_chars=4000
    )

    assert uri_large == f"artifact://{run_id}/{call_id}.log"
    assert "Observation truncated" in res_large
    assert "--- HEAD" in res_large
    assert "--- TAIL" in res_large
    assert len(res_large) < len(large_output)

    # 3. Verify artifact file on disk contains full untruncated content
    artifact_path = settings.ARTIFACTS_DIR / run_id / f"{call_id}.log"
    assert artifact_path.exists()
    assert artifact_path.read_text(encoding="utf-8") == large_output


# ─────────────────────────────────────────────────────────────────────────────
# M2-T2: Artifact Retrieval API Endpoint & Path Traversal Security
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_artifact_endpoint():
    """M2-T2: Verify GET /api/runs/{id}/artifacts and /{artifact_id}, including traversal protection."""
    async with async_session() as session:
        agent = Agent(
            name="Context Test Agent",
            provider="openai",
            model="gpt-4o",
        )
        session.add(agent)
        await session.commit()
        await session.refresh(agent)

        run = Run(agent_id=agent.id, task="context_test_artifacts", status="completed")
        session.add(run)
        await session.commit()
        await session.refresh(run)
        run_id = run.id

    # Create test artifact
    artifact_content = "FULL COMPILER LOG: Error at line 42.\nWarning at line 108.\nFinished with code 1."
    context_engine.save_artifact(run_id, "build.log", artifact_content)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. List artifacts for run
        r_list = await ac.get(f"/api/runs/{run_id}/artifacts")
        assert r_list.status_code == 200
        artifacts = r_list.json()["artifacts"]
        assert any(a["name"] == "build.log" for a in artifacts)

        # 2. Retrieve raw artifact content
        r_get = await ac.get(f"/api/runs/{run_id}/artifacts/build.log")
        assert r_get.status_code == 200
        assert r_get.text == artifact_content

        # 3. Non-existent artifact -> 404
        r_404 = await ac.get(f"/api/runs/{run_id}/artifacts/does_not_exist.log")
        assert r_404.status_code == 404

        # 4. Path traversal attempt -> 400 Bad Request
        r_traversal = await ac.get(f"/api/runs/{run_id}/artifacts/..%2F..%2Fetc%2Fpasswd")
        assert r_traversal.status_code in [400, 404]


# ─────────────────────────────────────────────────────────────────────────────
# M2-T3: Anthropic Ephemeral Cache Control Headers
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_anthropic_cache_headers():
    """M2-T3: Verify system content and tools are formatted with cache_control: ephemeral."""
    provider = AnthropicProvider()

    messages = [
        LLMMessage(role="system", content="You are a senior testing architect."),
        LLMMessage(role="user", content="Calculate primes."),
    ]
    tools = [
        {
            "type": "function",
            "function": {
                "name": "calc_primes",
                "description": "Calculate primes up to N",
                "parameters": {"type": "object", "properties": {"n": {"type": "integer"}}},
            },
        }
    ]

    mock_msg_response = MagicMock()
    mock_msg_response.content = [MagicMock(type="text", text="Found primes.")]
    mock_msg_response.model = "claude-3-5-sonnet-20240620"
    mock_msg_response.usage.input_tokens = 500
    mock_msg_response.usage.output_tokens = 40
    mock_msg_response.usage.cache_creation_input_tokens = 450
    mock_msg_response.usage.cache_read_input_tokens = 0
    mock_msg_response.model_dump.return_value = {}

    with patch.object(provider, "_get_client") as mock_get_client:
        mock_client = AsyncMock()
        mock_client.messages.create.return_value = mock_msg_response
        mock_get_client.return_value = mock_client

        res = await provider.chat(messages=messages, model="claude-3-5-sonnet-20240620", tools=tools)

        # Verify arguments passed to messages.create
        call_kwargs = mock_client.messages.create.call_args.kwargs
        
        # 1. System prompt formatted as list with cache_control
        system_arg = call_kwargs["system"]
        assert isinstance(system_arg, list)
        assert system_arg[0]["cache_control"] == {"type": "ephemeral"}
        assert system_arg[0]["text"] == "You are a senior testing architect."

        # 2. Tool schemas have cache_control on the last tool
        tools_arg = call_kwargs["tools"]
        assert tools_arg[-1]["cache_control"] == {"type": "ephemeral"}
        assert tools_arg[-1]["name"] == "calc_primes"

        # 3. Response contains cache metadata
        assert res.cache_write_tokens == 450
        assert res.cache_read_tokens == 0


# ─────────────────────────────────────────────────────────────────────────────
# M2-T4: Cache-Discounted Cost Accounting
# ─────────────────────────────────────────────────────────────────────────────

def test_caching_cost_accounting():
    """M2-T4: Verify 90% discount on Anthropic cache reads and 50% discount on OpenAI."""
    # 1. Anthropic Pricing
    anthropic = AnthropicProvider()
    model = "claude-3-5-sonnet-20240620"
    base_in_rate, out_rate = ANTHROPIC_PRICING[model]  # 3.00, 15.00

    # Without caching: 100,000 input tokens
    uncached_cost = anthropic.estimate_cost(input_tokens=100_000, output_tokens=0, model=model)
    expected_uncached = (100_000 / 1_000_000) * base_in_rate  # $0.30
    assert uncached_cost == pytest.approx(expected_uncached, rel=1e-4)

    # With 90% cache hits: 10,000 regular input + 90,000 cache read
    # Cache read rate is 0.10 * base_in_rate
    cached_cost = anthropic.estimate_cost(
        input_tokens=100_000,
        output_tokens=0,
        model=model,
        cache_read_tokens=90_000,
        cache_write_tokens=0,
    )
    expected_cached = (
        (10_000 / 1_000_000) * base_in_rate
        + (90_000 / 1_000_000) * (base_in_rate * 0.10)
    )  # $0.03 + $0.027 = $0.057 (81% savings!)
    assert cached_cost == pytest.approx(expected_cached, rel=1e-4)
    assert cached_cost < uncached_cost * 0.25  # >75% cost reduction!

    # 2. OpenAI Pricing
    openai = OpenAIProvider()
    o_model = "gpt-4o"
    o_in_rate, o_out_rate = OPENAI_PRICING[o_model]

    # Without caching: 100,000 input tokens
    o_uncached = openai.estimate_cost(input_tokens=100_000, output_tokens=0, model=o_model)
    # With 80,000 cached tokens (50% discount on cached portion)
    o_cached = openai.estimate_cost(input_tokens=100_000, output_tokens=0, model=o_model, cached_tokens=80_000)
    expected_o_cached = (
        (20_000 / 1_000_000) * o_in_rate
        + (80_000 / 1_000_000) * (o_in_rate * 0.50)
    )
    assert o_cached == pytest.approx(expected_o_cached, rel=1e-4)
    assert o_cached < o_uncached


# ─────────────────────────────────────────────────────────────────────────────
# M2-T5: Context Compaction at Capacity Threshold
# ─────────────────────────────────────────────────────────────────────────────

def test_compaction_at_threshold():
    """M2-T5: Compaction prunes older tool observations while preserving system/user/reasoning."""
    messages = [
        LLMMessage(role="system", content="System instructions..."),
        LLMMessage(role="user", content="User goal..."),
        LLMMessage(role="assistant", content="Thinking step 1...", tool_calls=[{"id": "call_1"}]),
        LLMMessage(role="tool", content="Very long tool output 1 " * 200, tool_call_id="call_1"),
        LLMMessage(role="assistant", content="Thinking step 2...", tool_calls=[{"id": "call_2"}]),
        LLMMessage(role="tool", content="Very long tool output 2 " * 200, tool_call_id="call_2"),
        LLMMessage(role="assistant", content="Thinking step 3...", tool_calls=[{"id": "call_3"}]),
        LLMMessage(role="tool", content="Recent tool output 3", tool_call_id="call_3"),
        LLMMessage(role="assistant", content="Thinking step 4...", tool_calls=[{"id": "call_4"}]),
        LLMMessage(role="tool", content="Recent tool output 4", tool_call_id="call_4"),
    ]

    # When ceiling is high, no compaction happens
    unchanged = context_engine.compact_context(messages, max_context_tokens=50_000)
    assert len(unchanged) == len(messages)
    assert "Very long tool output 1" in unchanged[3].content

    # When ceiling is low, older tool turns (turn 1 and 2) are pruned, recent (turn 3 and 4) kept
    compacted = context_engine.compact_context(
        messages,
        max_context_tokens=1000,
        threshold_ratio=0.50,
        keep_recent_tool_turns=2,
    )

    # Tool 1 and 2 pruned
    assert "[Tool output cleared" in compacted[3].content
    assert "[Tool output cleared" in compacted[5].content

    # Tool 3 and 4 kept intact
    assert compacted[7].content == "Recent tool output 3"
    assert compacted[9].content == "Recent tool output 4"

    # Non-tool messages preserved completely
    assert compacted[0].content == "System instructions..."
    assert compacted[1].content == "User goal..."
    assert compacted[2].content == "Thinking step 1..."


# ─────────────────────────────────────────────────────────────────────────────
# Edge Cases: Single Giant Line Truncation
# ─────────────────────────────────────────────────────────────────────────────

def test_edge_case_single_giant_line_truncation():
    """Edge Case: Huge minified JSON without newline characters is truncated safely."""
    run_id = "test_run_minified"
    call_id = "call_minified"
    giant_json = '{"data": "' + ("A" * 15000) + '"}'

    truncated, uri = context_engine.process_tool_observation(
        run_id=run_id, tool_call_id=call_id, tool_output=giant_json, max_chars=4000
    )

    assert uri is not None
    assert "Observation truncated" in truncated
    assert len(truncated) < 3000
    # Artifact on disk has full JSON
    stored = context_engine.read_artifact(run_id, f"{call_id}.log")
    assert stored == giant_json


# ─────────────────────────────────────────────────────────────────────────────
# E2E: Orchestrator Tool Observation Offload & Cache Logging
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_e2e_orchestrator_observation_offload_and_cache_logging():
    """Verify that orchestrator logs large tool artifact offloading and cache read hits."""
    async with async_session() as session:
        agent = Agent(
            name="Context E2E Agent",
            system_prompt="You are a file inspector.",
            tools_config=json.dumps(["file_read"]),
            provider="anthropic",
            model="claude-3-5-sonnet-20240620",
        )
        session.add(agent)
        await session.commit()
        await session.refresh(agent)

        run = Run(agent_id=agent.id, task="context_test_e2e", status="pending")
        session.add(run)
        await session.commit()
        await session.refresh(run)
        run_id = run.id

    # Simulated huge tool output (e.g. 8,000 chars)
    giant_file_content = "LOG_ROW_DATA: " * 500
    assert len(giant_file_content) > 4000

    mock_tool_call_resp = LLMResponse(
        content="",
        tool_calls=[{
            "id": "call_big_file",
            "type": "function",
            "function": {"name": "file_read", "arguments": json.dumps({"path": "huge.log"})},
        }],
        input_tokens=100,
        output_tokens=30,
        cost=0.001,
        model="claude-3-5-sonnet-20240620",
        cache_read_tokens=0,
    )
    mock_final_resp = LLMResponse(
        content="Read the file successfully.",
        tool_calls=None,
        input_tokens=500,
        output_tokens=20,
        cost=0.0003,
        model="claude-3-5-sonnet-20240620",
        cache_read_tokens=450,  # Prompt cache hit!
    )

    mock_provider = AsyncMock()
    mock_provider.chat.side_effect = [mock_tool_call_resp, mock_final_resp]

    orchestrator = AgentOrchestrator()

    with patch("app.services.orchestrator.get_provider", return_value=mock_provider), \
         patch.object(orchestrator.sandbox_manager, "create_sandbox", return_value="mock_container"), \
         patch.object(orchestrator.sandbox_manager, "destroy_sandbox", return_value=True), \
         patch("app.services.orchestrator.execute_tool", return_value=giant_file_content):

        await orchestrator.execute_run(run_id)

    async with async_session() as session:
        completed_run = await session.get(Run, run_id)
        assert completed_run.status == "completed"

        logs_stmt = select(RunLog).where(RunLog.run_id == run_id).order_by(RunLog.id.asc())
        logs_res = await session.execute(logs_stmt)
        logs = logs_res.scalars().all()
        log_messages = [l.message for l in logs]

        # 1. Verified artifact offloading was logged
        assert any("Large tool observation offloaded to artifact" in m for m in log_messages)
        # 2. Verified prompt cache hit was logged
        assert any("Prompt cache hit: 450 tokens read from cache" in m for m in log_messages)

    # 3. Verified artifact exists on disk
    artifact_text = context_engine.read_artifact(run_id, "call_big_file.log")
    assert artifact_text == giant_file_content
