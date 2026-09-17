"""Agent Lab — Model Context Protocol (MCP) API routes."""

import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_session
from app.models import MCPServer
from app.schemas import (
    MCPServerCreate,
    MCPServerListResponse,
    MCPServerResponse,
    MCPServerUpdate,
    MCPToolCallRequest,
    MCPToolCallResponse,
    MCPToolInfo,
)
from app.services.encryption import encrypt_value, get_or_create_key
from app.services.mcp_service import mcp_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/mcp", tags=["mcp"])


def _format_server_response(server: MCPServer) -> dict[str, Any]:
    """Format ORM model into dictionary matching MCPServerResponse with masked env values."""
    args = []
    if server.args_json:
        try:
            args = json.loads(server.args_json)
        except Exception:
            args = []

    env_masked = {}
    if server.env_json:
        try:
            raw_env = json.loads(server.env_json)
            if isinstance(raw_env, dict):
                env_masked = {k: "******" for k in raw_env}
        except Exception:
            env_masked = {}

    return {
        "id": server.id,
        "name": server.name,
        "description": server.description,
        "transport": server.transport,
        "command": server.command,
        "args": args,
        "env": env_masked,
        "url": server.url,
        "is_active": server.is_active,
        "created_at": server.created_at,
        "updated_at": server.updated_at,
    }


@router.get("/servers", response_model=MCPServerListResponse)
async def list_mcp_servers(
    session: AsyncSession = Depends(get_session),
):
    """List all registered MCP servers."""
    stmt = select(MCPServer).order_by(MCPServer.created_at.asc())
    result = await session.execute(stmt)
    servers = result.scalars().all()

    count_stmt = select(func.count()).select_from(MCPServer)
    total_result = await session.execute(count_stmt)
    total = total_result.scalar() or 0

    formatted = [_format_server_response(s) for s in servers]
    return {"servers": formatted, "total": total}


@router.post("/servers", response_model=MCPServerResponse, status_code=status.HTTP_201_CREATED)
async def create_mcp_server(
    server_in: MCPServerCreate,
    session: AsyncSession = Depends(get_session),
):
    """Register a new MCP server."""
    # Check for duplicate name
    dup_stmt = select(MCPServer).where(MCPServer.name == server_in.name)
    dup_res = await session.execute(dup_stmt)
    if dup_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"MCP server with name '{server_in.name}' already exists",
        )

    # Encrypt env values
    enc_key = get_or_create_key(settings.ENCRYPTION_KEY_PATH)
    encrypted_env = {}
    for k, v in server_in.env.items():
        encrypted_env[k] = encrypt_value(v, enc_key) if v else ""

    server = MCPServer(
        name=server_in.name,
        description=server_in.description,
        transport=server_in.transport,
        command=server_in.command,
        args_json=json.dumps(server_in.args),
        env_json=json.dumps(encrypted_env),
        url=server_in.url,
        is_active=server_in.is_active,
    )
    session.add(server)
    await session.commit()
    await session.refresh(server)

    return _format_server_response(server)


@router.get("/servers/{server_id}", response_model=MCPServerResponse)
async def get_mcp_server(
    server_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Retrieve details of a registered MCP server."""
    server = await session.get(MCPServer, server_id)
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"MCP server '{server_id}' not found",
        )
    return _format_server_response(server)


@router.put("/servers/{server_id}", response_model=MCPServerResponse)
async def update_mcp_server(
    server_id: str,
    server_in: MCPServerUpdate,
    session: AsyncSession = Depends(get_session),
):
    """Update configuration of an existing MCP server."""
    server = await session.get(MCPServer, server_id)
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"MCP server '{server_id}' not found",
        )

    if server_in.name is not None and server_in.name != server.name:
        dup_stmt = select(MCPServer).where(
            MCPServer.name == server_in.name, MCPServer.id != server_id
        )
        dup_res = await session.execute(dup_stmt)
        if dup_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"MCP server with name '{server_in.name}' already exists",
            )
        server.name = server_in.name

    if server_in.description is not None:
        server.description = server_in.description
    if server_in.transport is not None:
        server.transport = server_in.transport
    if server_in.command is not None:
        server.command = server_in.command
    if server_in.args is not None:
        server.args_json = json.dumps(server_in.args)
    if server_in.url is not None:
        server.url = server_in.url
    if server_in.is_active is not None:
        server.is_active = server_in.is_active

    if server_in.env is not None:
        enc_key = get_or_create_key(settings.ENCRYPTION_KEY_PATH)
        encrypted_env = {}
        for k, v in server_in.env.items():
            encrypted_env[k] = encrypt_value(v, enc_key) if v else ""
        server.env_json = json.dumps(encrypted_env)

    # Invalidate running session so new settings apply
    await mcp_service.close_session(server.id)

    await session.commit()
    await session.refresh(server)
    return _format_server_response(server)


@router.delete("/servers/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mcp_server(
    server_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Delete an MCP server and release connection resources."""
    server = await session.get(MCPServer, server_id)
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"MCP server '{server_id}' not found",
        )

    await mcp_service.close_session(server_id)
    await session.delete(server)
    await session.commit()


@router.post("/servers/{server_id}/ping")
async def ping_mcp_server(
    server_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Test connection to an MCP server."""
    server = await session.get(MCPServer, server_id)
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"MCP server '{server_id}' not found",
        )

    success = await mcp_service.ping_server(server)
    if not success:
        return {"status": "error", "message": "Failed to connect or list tools"}
    return {"status": "ok", "message": "Connection established successfully"}


@router.get("/servers/{server_id}/tools", response_model=list[MCPToolInfo])
async def get_server_tools(
    server_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Discover all tools exposed by a specific MCP server."""
    server = await session.get(MCPServer, server_id)
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"MCP server '{server_id}' not found",
        )

    try:
        tools = await mcp_service.list_tools_for_server(server)
        return tools
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to discover tools from MCP server '{server.name}': {str(e)}",
        )


@router.get("/tools", response_model=list[MCPToolInfo])
async def get_all_mcp_tools(
    session: AsyncSession = Depends(get_session),
):
    """Discover all tools across all active registered MCP servers."""
    tools = await mcp_service.list_all_tools(session)
    return tools


@router.post("/execute", response_model=MCPToolCallResponse)
async def execute_mcp_tool_direct(
    call_req: MCPToolCallRequest,
    session: AsyncSession = Depends(get_session),
):
    """Directly execute an MCP tool (useful for manual testing and verification)."""
    server = await session.get(MCPServer, call_req.server_id)
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"MCP server '{call_req.server_id}' not found",
        )

    result = await mcp_service.execute_tool(
        server=server,
        tool_name=call_req.tool_name,
        arguments=call_req.arguments,
    )
    return result
