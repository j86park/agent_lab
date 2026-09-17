"""Agent Lab — Mock MCP Server for Automated Test Suites."""

import asyncio
from mcp.server.mcpserver import MCPServer

server = MCPServer("mock-server")


@server.tool()
def echo(message: str) -> str:
    """Echo the input message."""
    return f"echo: {message}"


@server.tool()
def add(a: int, b: int) -> int:
    """Add two integers."""
    return a + b


@server.tool()
def fail_tool() -> str:
    """A tool that raises an error."""
    raise ValueError("Deliberate error in fail_tool")


@server.tool()
def empty_param_tool() -> str:
    """A tool with no parameters."""
    return "success_no_params"


if __name__ == "__main__":
    asyncio.run(server.run_stdio_async())
