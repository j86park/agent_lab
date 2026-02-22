"""Agent Lab — Tool Executors.

Defines the tool registry and execution dispatcher for agent runs.
Each tool runs inside the Docker sandbox via SandboxManager.
"""

import logging

logger = logging.getLogger(__name__)

# Registry: tool name → description shown to the LLM
AVAILABLE_TOOLS: dict[str, str] = {
    "file_read":    "Read the contents of a file in the workspace",
    "file_write":   "Write content to a file in the workspace",
    "code_execute": "Execute a Python script in the sandbox and return its output",
    "web_search":   "Search the web and return relevant results",
}


def get_tool_definitions() -> list[dict]:
    """
    Return an OpenAI-compatible tools array for the registered tools.
    Used when sending functions to the LLM.
    """
    return [
        {
            "type": "function",
            "function": {
                "name": "file_read",
                "description": AVAILABLE_TOOLS["file_read"],
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "Path to the file inside /workspace",
                        }
                    },
                    "required": ["path"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "file_write",
                "description": AVAILABLE_TOOLS["file_write"],
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "Path to write the file to inside /workspace",
                        },
                        "content": {
                            "type": "string",
                            "description": "The text content to write to the file",
                        },
                    },
                    "required": ["path", "content"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "code_execute",
                "description": AVAILABLE_TOOLS["code_execute"],
                "parameters": {
                    "type": "object",
                    "properties": {
                        "code": {
                            "type": "string",
                            "description": "Python code to execute",
                        }
                    },
                    "required": ["code"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "web_search",
                "description": AVAILABLE_TOOLS["web_search"],
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The search query",
                        }
                    },
                    "required": ["query"],
                },
            },
        },
    ]


async def execute_tool(
    tool_name: str,
    arguments: dict,
    sandbox,          # SandboxManager instance (avoid circular import)
    container_id: str,
) -> str:
    """
    Dispatch a tool call to the appropriate handler and return the output string.

    Args:
        tool_name:    Name of the tool to invoke (must be in AVAILABLE_TOOLS).
        arguments:    Parsed arguments dict from the LLM tool call.
        sandbox:      A SandboxManager instance.
        container_id: The active sandbox container to run commands in.

    Returns:
        String output from the tool execution.
    """
    logger.debug("Executing tool '%s' with args: %s", tool_name, arguments)

    if tool_name == "file_read":
        path = arguments.get("path", "")
        if not path:
            return "Error: 'path' argument is required for file_read"
        try:
            content = await sandbox.read_file(container_id, path)
            return f"File contents of '{path}':\n{content}"
        except FileNotFoundError as exc:
            return f"Error reading file: {exc}"

    elif tool_name == "file_write":
        path = arguments.get("path", "")
        content = arguments.get("content", "")
        if not path:
            return "Error: 'path' argument is required for file_write"
        await sandbox.write_file(container_id, path, content)
        return f"Successfully wrote {len(content)} bytes to '{path}'"

    elif tool_name == "code_execute":
        code = arguments.get("code", "")
        if not code:
            return "Error: 'code' argument is required for code_execute"
        # Write code to a temp file and execute it for cleaner output
        await sandbox.write_file(container_id, "/workspace/_exec.py", code)
        result = await sandbox.execute_command(
            container_id,
            "python3 /workspace/_exec.py",
            timeout=30,
        )
        output_parts = []
        if result.stdout:
            output_parts.append(f"stdout:\n{result.stdout}")
        if result.stderr:
            output_parts.append(f"stderr:\n{result.stderr}")
        output_parts.append(f"exit_code: {result.exit_code}")
        return "\n".join(output_parts)

    elif tool_name == "web_search":
        from app.services.search import perform_search
        query = arguments.get("query", "")
        if not query:
            return "Error: 'query' argument is required for web_search"
        
        logger.info("Executing web_search for query: %s", query)
        return await perform_search(query)

    else:
        return f"Error: Unknown tool '{tool_name}'. Available tools: {', '.join(AVAILABLE_TOOLS)}"
