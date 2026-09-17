"""Agent Lab — Model Context Protocol (MCP) Service.

Manages connections, dynamic tool discovery, and execution across local (stdio)
and remote (SSE) MCP servers.
"""

import asyncio
import json
import logging
import os
from contextlib import AsyncExitStack
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from mcp.client.sse import sse_client
import mcp.types as types

from app.config import settings
from app.models import MCPServer
from app.schemas import MCPToolCallResponse, MCPToolInfo
from app.services.encryption import decrypt_value, get_or_create_key

logger = logging.getLogger(__name__)


class MCPService:
    """Service managing MCP server connections, tool discovery, and invocations."""

    def __init__(self):
        self._sessions: dict[str, ClientSession] = {}
        self._exit_stacks: dict[str, AsyncExitStack] = {}
        self._lock = asyncio.Lock()

    def _get_encryption_key(self) -> bytes:
        """Get the Fernet key for decrypting secrets."""
        return get_or_create_key(settings.ENCRYPTION_KEY_PATH)

    def _build_env(self, env_json_str: str) -> dict[str, str]:
        """Parse and decrypt server environment variables, overlaying system env."""
        base_env = os.environ.copy()
        base_env["PYTHONUNBUFFERED"] = "1"
        if not env_json_str:
            return base_env

        try:
            raw_dict = json.loads(env_json_str)
            if not isinstance(raw_dict, dict):
                return base_env
            key = self._get_encryption_key()
            for k, v in raw_dict.items():
                if isinstance(v, str):
                    try:
                        # Try to decrypt, fall back to plaintext if not encrypted
                        decrypted = decrypt_value(v, key)
                        base_env[k] = decrypted if decrypted else v
                    except Exception:
                        base_env[k] = v
        except Exception as e:
            logger.warning("Failed to parse MCP server env: %s", e)

        return base_env

    async def get_or_create_session(self, server: MCPServer) -> ClientSession:
        """Retrieve an active session or establish a new connection to the MCP server."""
        async with self._lock:
            if server.id in self._sessions:
                return self._sessions[server.id]

            stack = AsyncExitStack()
            try:
                if server.transport == "stdio":
                    if not server.command:
                        raise ValueError(f"MCP server '{server.name}' has no command specified for stdio")

                    args = []
                    if server.args_json:
                        try:
                            args = json.loads(server.args_json)
                        except Exception:
                            args = []

                    env = self._build_env(server.env_json)
                    server_params = StdioServerParameters(
                        command=server.command,
                        args=args,
                        env=env,
                    )

                    read_stream, write_stream = await stack.enter_async_context(
                        stdio_client(server_params)
                    )
                elif server.transport == "sse":
                    if not server.url:
                        raise ValueError(f"MCP server '{server.name}' has no URL specified for SSE")

                    read_stream, write_stream = await stack.enter_async_context(
                        sse_client(server.url)
                    )
                else:
                    raise ValueError(f"Unsupported MCP transport: '{server.transport}'")

                session = await stack.enter_async_context(
                    ClientSession(read_stream, write_stream)
                )
                await session.initialize()

                self._sessions[server.id] = session
                self._exit_stacks[server.id] = stack
                logger.info("Connected to MCP server '%s' (%s)", server.name, server.id)
                return session

            except Exception as e:
                await stack.aclose()
                logger.error("Failed to connect to MCP server '%s': %s", server.name, e)
                raise

    async def close_session(self, server_id: str) -> None:
        """Close an active MCP session and release transport resources."""
        async with self._lock:
            session = self._sessions.pop(server_id, None)
            stack = self._exit_stacks.pop(server_id, None)
            if stack:
                try:
                    await stack.aclose()
                    logger.info("Closed MCP server session for '%s'", server_id)
                except Exception as e:
                    logger.warning("Error closing MCP session '%s': %s", server_id, e)

    async def close_all(self) -> None:
        """Close all active MCP sessions."""
        async with self._lock:
            for server_id, stack in list(self._exit_stacks.items()):
                try:
                    await stack.aclose()
                except Exception as e:
                    logger.warning("Error closing MCP session '%s': %s", server_id, e)
            self._sessions.clear()
            self._exit_stacks.clear()

    async def ping_server(self, server: MCPServer) -> bool:
        """Test whether an MCP server can connect successfully."""
        try:
            session = await self.get_or_create_session(server)
            await session.list_tools()
            return True
        except Exception as e:
            logger.warning("Ping failed for MCP server '%s': %s", server.name, e)
            await self.close_session(server.id)
            return False

    async def list_tools_for_server(self, server: MCPServer) -> list[MCPToolInfo]:
        """Discover all tools exposed by an MCP server."""
        session = await self.get_or_create_session(server)
        tools_response = await session.list_tools()

        tool_infos = []
        for tool in tools_response.tools:
            namespaced = f"mcp__{server.name}__{tool.name}"
            raw_schema = getattr(tool, "input_schema", None) or getattr(tool, "inputSchema", None)
            schema = raw_schema if isinstance(raw_schema, dict) else {}
            tool_infos.append(
                MCPToolInfo(
                    server_id=server.id,
                    server_name=server.name,
                    name=tool.name,
                    namespaced_name=namespaced,
                    description=tool.description or f"Tool {tool.name} from {server.name}",
                    input_schema=schema,
                )
            )
        return tool_infos

    async def list_all_tools(self, db_session: AsyncSession) -> list[MCPToolInfo]:
        """List tools across all active MCP servers registered in the database."""
        stmt = select(MCPServer).where(MCPServer.is_active == True)  # noqa: E712
        result = await db_session.execute(stmt)
        servers = result.scalars().all()

        all_tools: list[MCPToolInfo] = []
        for server in servers:
            try:
                tools = await self.list_tools_for_server(server)
                all_tools.extend(tools)
            except Exception as e:
                logger.error("Error discovering tools from MCP server '%s': %s", server.name, e)
        return all_tools

    async def execute_tool(
        self,
        server: MCPServer,
        tool_name: str,
        arguments: dict[str, Any],
    ) -> MCPToolCallResponse:
        """Execute a tool call against the target MCP server."""
        try:
            session = await self.get_or_create_session(server)
            res = await session.call_tool(name=tool_name, arguments=arguments)

            # Check if result indicates an error
            is_error = getattr(res, "is_error", False) or getattr(res, "isError", False)
            content_list: list[dict[str, Any]] = []
            text_parts: list[str] = []

            for block in getattr(res, "content", []):
                if isinstance(block, types.TextContent) or getattr(block, "type", "") == "text":
                    text = getattr(block, "text", "")
                    content_list.append({"type": "text", "text": text})
                    text_parts.append(text)
                elif isinstance(block, types.ImageContent) or getattr(block, "type", "") == "image":
                    content_list.append({
                        "type": "image",
                        "data": getattr(block, "data", ""),
                        "mimeType": getattr(block, "mimeType", ""),
                    })
                    text_parts.append("[Image Content]")
                elif isinstance(block, types.EmbeddedResource) or getattr(block, "type", "") == "resource":
                    content_list.append({"type": "resource", "resource": str(getattr(block, "resource", ""))})
                    text_parts.append("[Embedded Resource]")
                else:
                    content_list.append({"type": "unknown", "raw": str(block)})
                    text_parts.append(str(block))

            raw_text = "\n".join(text_parts) if text_parts else ""
            return MCPToolCallResponse(
                content=content_list,
                is_error=bool(is_error),
                raw_text=raw_text,
            )

        except Exception as e:
            logger.error("MCP tool execution error on '%s': %s", tool_name, e)
            # Reconnect on next call in case of broken pipe/process termination
            await self.close_session(server.id)
            err_msg = f"MCP tool execution failed: {str(e)}"
            return MCPToolCallResponse(
                content=[{"type": "text", "text": err_msg}],
                is_error=True,
                raw_text=err_msg,
            )

    @staticmethod
    def parse_namespaced_tool(namespaced_name: str) -> Optional[tuple[str, str]]:
        """
        Parse a namespaced tool identifier: 'mcp__{server_name}__{tool_name}'
        Returns (server_name, tool_name) or None if format does not match.
        """
        if not namespaced_name.startswith("mcp__"):
            return None
        parts = namespaced_name.split("__")
        if len(parts) >= 3:
            server_name = parts[1]
            tool_name = "__".join(parts[2:])
            return server_name, tool_name
        return None

    @staticmethod
    def to_openai_tool(tool_info: MCPToolInfo) -> dict[str, Any]:
        """Convert MCP tool schema into OpenAI function tool format."""
        params = tool_info.input_schema if tool_info.input_schema else {"type": "object", "properties": {}}
        return {
            "type": "function",
            "function": {
                "name": tool_info.namespaced_name,
                "description": tool_info.description or f"MCP tool {tool_info.name} from {tool_info.server_name}",
                "parameters": params,
            },
        }

    @staticmethod
    def to_anthropic_tool(tool_info: MCPToolInfo) -> dict[str, Any]:
        """Convert MCP tool schema into Anthropic tool format."""
        params = tool_info.input_schema if tool_info.input_schema else {"type": "object", "properties": {}}
        return {
            "name": tool_info.namespaced_name,
            "description": tool_info.description or f"MCP tool {tool_info.name} from {tool_info.server_name}",
            "input_schema": params,
        }


# Global singleton instance
mcp_service = MCPService()
