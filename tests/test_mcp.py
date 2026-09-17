"""Agent Lab — Automated Test Suite for Milestone 1: Universal Tooling (MCP).

Covers:
- M1-T1: Server Handshake & Lifecycle
- M1-T2: Dynamic Tool Schema Extraction & Format Mapping
- M1-T3: Tool Execution & Error Trapping
- M1-T4: End-to-End Agent MCP Orchestrator Execution
- Edge Cases: Non-existent tools, invalid args, unicode/special chars,
  empty parameter schemas, duplicate server names, encrypted env vars.
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

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
from app.models import Agent, MCPServer, Run, RunLog
from app.schemas import MCPServerCreate
from app.services.encryption import encrypt_value, get_or_create_key
from app.services.llm.base import LLMMessage, LLMResponse
from app.services.mcp_service import MCPService, mcp_service
from app.services.orchestrator import AgentOrchestrator


@pytest.fixture(autouse=True)
async def setup_test_db():
    """Ensure DB tables are initialized and cleaned up before/after tests."""
    settings.ensure_data_dirs()
    await init_db()
    async with async_session() as session:
        await session.execute(text("DELETE FROM mcp_servers WHERE name LIKE 'test_%' OR name LIKE 'api_%' OR name LIKE 'e2e_%' OR name LIKE 'schema_%' OR name LIKE 'exec_%' OR name LIKE 'server_%'"))
        await session.execute(text("DELETE FROM agents WHERE name LIKE '%MCP%'"))
        await session.commit()
    yield
    # Cleanup MCP connections after each test
    await mcp_service.close_all()
    async with async_session() as session:
        await session.execute(text("DELETE FROM mcp_servers WHERE name LIKE 'test_%' OR name LIKE 'api_%' OR name LIKE 'e2e_%' OR name LIKE 'schema_%' OR name LIKE 'exec_%' OR name LIKE 'server_%'"))
        await session.execute(text("DELETE FROM agents WHERE name LIKE '%MCP%'"))
        await session.commit()

def get_mock_server_model(name: str = "test_mock_server") -> MCPServer:
    """Helper to construct an MCPServer ORM instance targeting the test mock server."""
    mock_server_script = Path(__file__).resolve().parent / "mock_mcp_server.py"
    return MCPServer(
        id=f"test-{name}",
        name=name,
        description="Test Mock MCP Server",
        transport="stdio",
        command=sys.executable,
        args_json=json.dumps(["-u", str(mock_server_script)]),
        env_json="{}",
        is_active=True,
    )


# ─────────────────────────────────────────────────────────────────────────────
# M1-T1: Server Handshake & Lifecycle
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_mcp_stdio_connection():
    """M1-T1: Verify connection handshake, ping, active session, and clean teardown."""
    server = get_mock_server_model("server_lifecycle")
    
    # 1. Connect and initialize
    session = await mcp_service.get_or_create_session(server)
    assert session is not None

    # 2. Test ping
    is_alive = await mcp_service.ping_server(server)
    assert is_alive is True

    # 3. Verify session reuse
    same_session = await mcp_service.get_or_create_session(server)
    assert same_session is session

    # 4. Clean teardown
    await mcp_service.close_session(server.id)
    assert server.id not in mcp_service._sessions


# ─────────────────────────────────────────────────────────────────────────────
# M1-T2: Tool Schema Extraction & Format Mapping
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_tool_schema_conversion():
    """M1-T2: Verify dynamic discovery and conversion to OpenAI and Anthropic schemas."""
    server = get_mock_server_model("schema_test")
    tools = await mcp_service.list_tools_for_server(server)
    
    tool_names = {t.name for t in tools}
    assert "echo" in tool_names
    assert "add" in tool_names
    assert "fail_tool" in tool_names
    assert "empty_param_tool" in tool_names

    # Test namespacing convention: mcp__{server_name}__{tool_name}
    echo_tool = next(t for t in tools if t.name == "echo")
    assert echo_tool.namespaced_name == f"mcp__{server.name}__echo"

    # Test OpenAI format mapping
    openai_format = mcp_service.to_openai_tool(echo_tool)
    assert openai_format["type"] == "function"
    assert openai_format["function"]["name"] == f"mcp__{server.name}__echo"
    assert "properties" in openai_format["function"]["parameters"]
    assert "message" in openai_format["function"]["parameters"]["properties"]

    # Test Anthropic format mapping
    anthropic_format = mcp_service.to_anthropic_tool(echo_tool)
    assert anthropic_format["name"] == f"mcp__{server.name}__echo"
    assert "input_schema" in anthropic_format
    assert "message" in anthropic_format["input_schema"]["properties"]


# ─────────────────────────────────────────────────────────────────────────────
# M1-T3: Tool Execution & Error Trapping
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_tool_execution_error_handling():
    """M1-T3: Verify successful execution and structured error trapping without crashes."""
    server = get_mock_server_model("exec_test")
    
    # 1. Successful execution (echo)
    res_echo = await mcp_service.execute_tool(server, "echo", {"message": "Agent Lab Rocks!"})
    assert res_echo.is_error is False
    assert "Agent Lab Rocks!" in res_echo.raw_text

    # 2. Successful execution with multiple arguments (add)
    res_add = await mcp_service.execute_tool(server, "add", {"a": 25, "b": 17})
    assert res_add.is_error is False
    assert "42" in res_add.raw_text

    # 3. Tool internal failure: returns is_error=True without throwing an unhandled exception
    res_fail = await mcp_service.execute_tool(server, "fail_tool", {})
    assert res_fail.is_error is True
    assert "fail_tool" in res_fail.raw_text or "error" in res_fail.raw_text.lower()


# ─────────────────────────────────────────────────────────────────────────────
# Edge Cases
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_edge_case_nonexistent_tool():
    """Edge Case: Calling an unregistered tool returns structured error instead of crashing."""
    server = get_mock_server_model("nonexistent_test")
    res = await mcp_service.execute_tool(server, "definitely_not_a_real_tool", {})
    assert res.is_error is True
    assert any(k in res.raw_text.lower() for k in ["unknown tool", "failed", "not found", "error"])


@pytest.mark.asyncio
async def test_edge_case_invalid_arguments():
    """Edge Case: Missing or malformed arguments returns structured error."""
    server = get_mock_server_model("invalid_args_test")
    # 'add' requires 'a' and 'b'; pass string for integer
    res = await mcp_service.execute_tool(server, "add", {"a": "not_an_int"})
    assert res.is_error is True


@pytest.mark.asyncio
async def test_edge_case_unicode_and_special_characters():
    """Edge Case: Unicode, emojis, newlines, and special characters survive round-trip."""
    server = get_mock_server_model("unicode_test")
    payload = "Special: 🚀 \"quotes\" 'single' \n\t <XML>&\\/"
    res = await mcp_service.execute_tool(server, "echo", {"message": payload})
    assert res.is_error is False
    assert payload in res.raw_text


@pytest.mark.asyncio
async def test_edge_case_empty_params_tool():
    """Edge Case: Tool with no parameters converts to empty object schema and executes."""
    server = get_mock_server_model("empty_params_test")
    tools = await mcp_service.list_tools_for_server(server)
    empty_tool = next(t for t in tools if t.name == "empty_param_tool")
    
    openai_fmt = mcp_service.to_openai_tool(empty_tool)
    assert openai_fmt["function"]["parameters"]["type"] == "object"
    
    res = await mcp_service.execute_tool(server, "empty_param_tool", {})
    assert res.is_error is False
    assert "success_no_params" in res.raw_text


@pytest.mark.asyncio
async def test_edge_case_server_env_decryption():
    """Edge Case: Fernet-encrypted environment variables are decrypted in the child process."""
    key = get_or_create_key(settings.ENCRYPTION_KEY_PATH)
    secret_value = "top_secret_token_12345"
    encrypted_secret = encrypt_value(secret_value, key)

    server = get_mock_server_model("env_decrypt_test")
    server.env_json = json.dumps({"TEST_SECRET_KEY": encrypted_secret})

    built_env = mcp_service._build_env(server.env_json)
    assert built_env["TEST_SECRET_KEY"] == secret_value


# ─────────────────────────────────────────────────────────────────────────────
# REST API Endpoints & Validations
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_mcp_api_endpoints_and_validation():
    """Verify REST endpoints: Create, List, Discover, Execute, Conflict & Validation errors."""
    mock_server_script = Path(__file__).resolve().parent / "mock_mcp_server.py"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Duplicate server name conflict check
        server_payload = {
            "name": "api_test_server",
            "description": "API Test MCP Server",
            "transport": "stdio",
            "command": sys.executable,
            "args": ["-u", str(mock_server_script)],
            "env": {"TEST_VAR": "hello"},
        }
        r1 = await ac.post("/api/mcp/servers", json=server_payload)
        assert r1.status_code == 201
        created_server = r1.json()
        server_id = created_server["id"]

        # Duplicate create -> 409 Conflict
        r_dup = await ac.post("/api/mcp/servers", json=server_payload)
        assert r_dup.status_code == 409

        # Missing command for stdio -> 422 Unprocessable Entity
        r_invalid = await ac.post("/api/mcp/servers", json={
            "name": "invalid_server",
            "transport": "stdio",
        })
        assert r_invalid.status_code == 422

        # 2. List servers
        r_list = await ac.get("/api/mcp/servers")
        assert r_list.status_code == 200
        server_ids = [s["id"] for s in r_list.json()["servers"]]
        assert server_id in server_ids

        # 3. Discover server tools via API
        r_tools = await ac.get(f"/api/mcp/servers/{server_id}/tools")
        assert r_tools.status_code == 200
        tool_names = [t["name"] for t in r_tools.json()]
        assert "echo" in tool_names

        # 4. Direct tool execution via API
        r_exec = await ac.post("/api/mcp/execute", json={
            "server_id": server_id,
            "tool_name": "echo",
            "arguments": {"message": "Executed via REST API"},
        })
        assert r_exec.status_code == 200
        assert r_exec.json()["is_error"] is False
        assert "Executed via REST API" in r_exec.json()["raw_text"]

        # 5. Delete server
        r_del = await ac.delete(f"/api/mcp/servers/{server_id}")
        assert r_del.status_code == 204


# ─────────────────────────────────────────────────────────────────────────────
# M1-T4: End-to-End Agent Orchestrator Run with MCP Tool
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_e2e_agent_mcp_run():
    """
    M1-T4: Full agent orchestrator execution.
    Verifies that:
    1. The agent discovers the MCP tool in its enabled_tools.
    2. The LLM tool call invokes the MCP tool and receives the response.
    3. The tool output enters message history and the run finishes 'completed'.
    """
    mock_server_script = Path(__file__).resolve().parent / "mock_mcp_server.py"
    server_name = "e2e_mcp_server"
    namespaced_tool = f"mcp__{server_name}__add"

    async with async_session() as session:
        # 1. Register MCP Server
        mcp_server = MCPServer(
            name=server_name,
            transport="stdio",
            command=sys.executable,
            args_json=json.dumps(["-u", str(mock_server_script)]),
            is_active=True,
        )
        session.add(mcp_server)

        # 2. Register Agent with MCP Tool enabled
        agent = Agent(
            name="MCP Math Agent",
            system_prompt="You are a math assistant with access to an MCP calculator.",
            tools_config=json.dumps([namespaced_tool]),
            provider="openai",
            model="gpt-4o",
        )
        session.add(agent)
        await session.commit()
        await session.refresh(agent)

        # 3. Create Run record
        run = Run(
            agent_id=agent.id,
            task="Please calculate 15 + 27 using the add tool.",
            status="pending",
        )
        session.add(run)
        await session.commit()
        await session.refresh(run)
        run_id = run.id

    # Mock the LLM provider to return a tool call on turn 1 and final answer on turn 2
    mock_tool_call_response = LLMResponse(
        content="",
        tool_calls=[{
            "id": "call_add_123",
            "type": "function",
            "function": {
                "name": namespaced_tool,
                "arguments": json.dumps({"a": 15, "b": 27}),
            },
        }],
        input_tokens=50,
        output_tokens=25,
        cost=0.0005,
        model="gpt-4o",
    )
    mock_final_response = LLMResponse(
        content="The sum of 15 and 27 is 42.",
        tool_calls=None,
        input_tokens=70,
        output_tokens=15,
        cost=0.0003,
        model="gpt-4o",
    )

    mock_provider = AsyncMock()
    mock_provider.chat.side_effect = [mock_tool_call_response, mock_final_response]

    orchestrator = AgentOrchestrator()
    
    # Mock sandbox creation to avoid requiring Docker daemon during local tests
    with patch("app.services.orchestrator.get_provider", return_value=mock_provider), \
         patch.object(orchestrator.sandbox_manager, "create_sandbox", return_value="mock_container_id"), \
         patch.object(orchestrator.sandbox_manager, "destroy_sandbox", return_value=True):
        
        await orchestrator.execute_run(run_id)

    # Verify run completed successfully
    async with async_session() as session:
        updated_run = await session.get(Run, run_id)
        assert updated_run is not None
        assert updated_run.status == "completed"
        assert updated_run.cost > 0
        assert updated_run.total_tokens > 0

        # Verify run logs recorded the tool call and output
        logs_stmt = select(RunLog).where(RunLog.run_id == run_id).order_by(RunLog.id.asc())
        logs_res = await session.execute(logs_stmt)
        logs = logs_res.scalars().all()
        log_messages = [l.message for l in logs]
        
        # Ensure MCP tool call was logged
        assert any(f"Tool call: {namespaced_tool}" in msg for msg in log_messages)
        # Ensure MCP tool result was returned and logged
        assert any("42" in msg for msg in log_messages)
        # Ensure final answer was reached
        assert any("Final answer received" in msg for msg in log_messages)
