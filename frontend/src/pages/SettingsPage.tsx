import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2, KeyRound, Server, Plug, Plus, Trash2, Wrench, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { settingsApi, mcpApi, type SettingsStatus, type MCPServer, type MCPToolInfo } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
interface ProviderKeyState {
    value: string;
    isSaving: boolean;
}

const PROVIDERS = [
    {
        id: "openai" as const,
        name: "OpenAI",
        statusKey: "openai_api_key_set" as keyof SettingsStatus,
        updateKey: "openai_api_key",
        placeholder: "sk-...",
        description: "Required for GPT-4o, GPT-4 Turbo, and other OpenAI models.",
    },
    {
        id: "anthropic" as const,
        name: "Anthropic",
        statusKey: "anthropic_api_key_set" as keyof SettingsStatus,
        updateKey: "anthropic_api_key",
        placeholder: "sk-ant-...",
        description: "Required for Claude 3.5 Sonnet, Haiku, and Opus models.",
    },
    {
        id: "openrouter" as const,
        name: "OpenRouter",
        statusKey: "openrouter_api_key_set" as keyof SettingsStatus,
        updateKey: "openrouter_api_key",
        placeholder: "sk-or-...",
        description: "Access 100+ models from a single API key.",
    },
];

export default function SettingsPage() {
    const [status, setStatus] = useState<SettingsStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [keys, setKeys] = useState<Record<string, ProviderKeyState>>({
        openai: { value: "", isSaving: false },
        anthropic: { value: "", isSaving: false },
        openrouter: { value: "", isSaving: false },
    });

    // MCP Servers State
    const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
    const [isLoadingMcp, setIsLoadingMcp] = useState(false);
    const [isAddMcpOpen, setIsAddMcpOpen] = useState(false);
    const [isCreatingMcp, setIsCreatingMcp] = useState(false);
    const [pingStatus, setPingStatus] = useState<Record<string, "idle" | "pinging" | "connected" | "error">>({});
    
    // Add Server Form State
    const [mcpName, setMcpName] = useState("");
    const [mcpTransport, setMcpTransport] = useState<"stdio" | "sse">("stdio");
    const [mcpCommand, setMcpCommand] = useState("");
    const [mcpArgs, setMcpArgs] = useState("");
    const [mcpUrl, setMcpUrl] = useState("");
    const [mcpDesc, setMcpDesc] = useState("");

    // View Tools Dialog State
    const [activeToolsServer, setActiveToolsServer] = useState<MCPServer | null>(null);
    const [serverTools, setServerTools] = useState<MCPToolInfo[]>([]);
    const [isLoadingTools, setIsLoadingTools] = useState(false);

    const fetchMcpServers = async () => {
        setIsLoadingMcp(true);
        try {
            const res = await mcpApi.getServers();
            setMcpServers(res.servers || []);
        } catch (err: unknown) {
            console.error("Failed to load MCP servers:", err);
        } finally {
            setIsLoadingMcp(false);
        }
    };

    const fetchStatus = async () => {
        try {
            const data = await settingsApi.getSettings();
            setStatus(data);
        } catch (err: unknown) {
            toast.error(getErrorMessage(err) || "Failed to load settings");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        fetchMcpServers();
    }, []);

    const handlePingMcp = async (server: MCPServer) => {
        setPingStatus((prev) => ({ ...prev, [server.id]: "pinging" }));
        try {
            const res = await mcpApi.pingServer(server.id);
            if (res.status === "ok") {
                setPingStatus((prev) => ({ ...prev, [server.id]: "connected" }));
                toast.success(`Connected to MCP server '${server.name}'`);
            } else {
                setPingStatus((prev) => ({ ...prev, [server.id]: "error" }));
                toast.error(`Ping failed for '${server.name}': ${res.message}`);
            }
        } catch (err) {
            setPingStatus((prev) => ({ ...prev, [server.id]: "error" }));
            toast.error(getErrorMessage(err) || `Failed to connect to '${server.name}'`);
        }
    };

    const handleViewTools = async (server: MCPServer) => {
        setActiveToolsServer(server);
        setIsLoadingTools(true);
        try {
            const tools = await mcpApi.getServerTools(server.id);
            setServerTools(tools);
        } catch (err) {
            toast.error(getErrorMessage(err) || `Failed to fetch tools for '${server.name}'`);
            setServerTools([]);
        } finally {
            setIsLoadingTools(false);
        }
    };

    const handleDeleteMcp = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete MCP server '${name}'?`)) return;
        try {
            await mcpApi.deleteServer(id);
            toast.success(`Deleted MCP server '${name}'`);
            fetchMcpServers();
        } catch (err) {
            toast.error(getErrorMessage(err) || "Failed to delete MCP server");
        }
    };

    const handleCreateMcp = async () => {
        if (!mcpName.trim()) {
            toast.error("Server name is required");
            return;
        }
        if (mcpTransport === "stdio" && !mcpCommand.trim()) {
            toast.error("Command is required for stdio transport");
            return;
        }
        if (mcpTransport === "sse" && !mcpUrl.trim()) {
            toast.error("URL is required for SSE transport");
            return;
        }

        setIsCreatingMcp(true);
        try {
            let parsedArgs: string[] = [];
            if (mcpArgs.trim()) {
                try {
                    parsedArgs = JSON.parse(mcpArgs);
                } catch {
                    parsedArgs = mcpArgs.split(" ").map((s) => s.trim()).filter(Boolean);
                }
            }

            await mcpApi.createServer({
                name: mcpName.trim(),
                description: mcpDesc.trim() || undefined,
                transport: mcpTransport,
                command: mcpTransport === "stdio" ? mcpCommand.trim() : undefined,
                args: parsedArgs,
                url: mcpTransport === "sse" ? mcpUrl.trim() : undefined,
                is_active: true,
            });

            toast.success(`MCP server '${mcpName.trim()}' registered successfully!`);
            setIsAddMcpOpen(false);
            setMcpName("");
            setMcpCommand("");
            setMcpArgs("");
            setMcpUrl("");
            setMcpDesc("");
            fetchMcpServers();
        } catch (err) {
            toast.error(getErrorMessage(err) || "Failed to create MCP server");
        } finally {
            setIsCreatingMcp(false);
        }
    };
    const handleSaveKey = async (provider: typeof PROVIDERS[number]) => {
        const keyValue = keys[provider.id].value.trim();
        if (!keyValue) {
            toast.error("Please enter an API key before saving");
            return;
        }

        setKeys((prev) => ({
            ...prev,
            [provider.id]: { ...prev[provider.id], isSaving: true },
        }));

        try {
            const updated = await settingsApi.updateSettings({
                [provider.updateKey]: keyValue,
            });
            setStatus(updated);
            // Clear the field after successful save
            setKeys((prev) => ({
                ...prev,
                [provider.id]: { value: "", isSaving: false },
            }));
            toast.success(`${provider.name} API key saved`);
        } catch (err: unknown) {
            toast.error(getErrorMessage(err) || `Failed to save ${provider.name} key`);
            setKeys((prev) => ({
                ...prev,
                [provider.id]: { ...prev[provider.id], isSaving: false },
            }));
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Settings</h1>
                <p className="text-muted-foreground">
                    Configure your LLM provider API keys and other preferences.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <KeyRound className="h-5 w-5 text-muted-foreground" />
                        <CardTitle>LLM Provider Keys</CardTitle>
                    </div>
                    <CardDescription>
                        API keys are encrypted and stored locally. They are never sent to any external service.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        PROVIDERS.map((provider, index) => {
                            const isSet = status ? status[provider.statusKey] : false;
                            const keyState = keys[provider.id];

                            return (
                                <div key={provider.id}>
                                    {index > 0 && <Separator className="mb-6" />}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <div className="flex items-center gap-2">
                                                    <Label className="text-base font-semibold">{provider.name}</Label>
                                                    {isSet ? (
                                                        <Badge variant="secondary" className="gap-1 text-green-600">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            Configured
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="gap-1 text-muted-foreground">
                                                            <XCircle className="h-3 w-3" />
                                                            Not Set
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground">{provider.description}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Input
                                                type="password"
                                                placeholder={isSet ? "Key is set. Enter new key to update." : provider.placeholder}
                                                value={keyState.value}
                                                onChange={(e) =>
                                                    setKeys((prev) => ({
                                                        ...prev,
                                                        [provider.id]: { ...prev[provider.id], value: e.target.value },
                                                    }))
                                                }
                                                className="font-mono"
                                            />
                                            <Button
                                                onClick={() => handleSaveKey(provider)}
                                                disabled={keyState.isSaving || !keyState.value.trim()}
                                                className="shrink-0"
                                            >
                                                {keyState.isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Save
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Server className="h-5 w-5 text-muted-foreground" />
                        <CardTitle>Ollama (Local)</CardTitle>
                    </div>
                    <CardDescription>
                        Run open-source models locally with Ollama.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        <p>
                            Ollama connects to your local machine — <strong>no API key is required</strong>.
                            Make sure Ollama is running on{" "}
                            <code className="rounded bg-muted px-1 py-0.5 text-xs">http://localhost:11434</code>{" "}
                            before using Ollama models.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* MCP Servers Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Plug className="h-5 w-5 text-primary" />
                            <div>
                                <CardTitle>Model Context Protocol (MCP) Servers</CardTitle>
                                <CardDescription>
                                    Connect external tool providers (PostgreSQL, GitHub, SQLite, Filesystem) over stdio or SSE.
                                </CardDescription>
                            </div>
                        </div>
                        <Button size="sm" className="gap-1.5" onClick={() => setIsAddMcpOpen(true)}>
                            <Plus className="h-4 w-4" />
                            Add MCP Server
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoadingMcp ? (
                        <div className="flex items-center justify-center py-6 text-muted-foreground">
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Loading MCP servers...
                        </div>
                    ) : mcpServers.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                            <Plug className="mx-auto h-8 w-8 mb-2 opacity-50" />
                            <p className="font-medium text-sm">No MCP servers registered yet.</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Connect community or local MCP servers to expose tools directly to your agents without writing Python code.
                            </p>
                            <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={() => setIsAddMcpOpen(true)}>
                                <Plus className="h-4 w-4" />
                                Add Your First Server
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {mcpServers.map((server) => {
                                const pStatus = pingStatus[server.id] || "idle";
                                return (
                                    <div key={server.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border bg-card">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-sm">{server.name}</span>
                                                <Badge variant="outline" className="font-mono text-[10px] uppercase">
                                                    {server.transport}
                                                </Badge>
                                                {pStatus === "connected" && (
                                                    <Badge variant="secondary" className="gap-1 text-green-500 bg-green-500/10 text-xs">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        Connected
                                                    </Badge>
                                                )}
                                                {pStatus === "error" && (
                                                    <Badge variant="destructive" className="gap-1 text-xs">
                                                        <XCircle className="h-3 w-3" />
                                                        Offline
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground font-mono truncate max-w-md">
                                                {server.transport === "stdio" ? `${server.command} ${(server.args || []).join(" ")}` : server.url}
                                            </p>
                                            {server.description && (
                                                <p className="text-xs text-muted-foreground">{server.description}</p>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="gap-1 text-xs"
                                                disabled={pStatus === "pinging"}
                                                onClick={() => handlePingMcp(server)}
                                            >
                                                <RefreshCw className={`h-3.5 w-3.5 ${pStatus === "pinging" ? "animate-spin" : ""}`} />
                                                Ping
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="gap-1 text-xs"
                                                onClick={() => handleViewTools(server)}
                                            >
                                                <Wrench className="h-3.5 w-3.5" />
                                                Tools
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                onClick={() => handleDeleteMcp(server.id, server.name)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Add MCP Server Dialog */}
            <Dialog open={isAddMcpOpen} onOpenChange={setIsAddMcpOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Register MCP Server</DialogTitle>
                        <DialogDescription>
                            Configure a local command (stdio) or remote endpoint (SSE) implementing the Model Context Protocol.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label>Server Name</Label>
                            <Input
                                placeholder="e.g. postgres_db or local_files"
                                value={mcpName}
                                onChange={(e) => setMcpName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Transport Type</Label>
                            <Select value={mcpTransport} onValueChange={(v: "stdio" | "sse") => setMcpTransport(v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="stdio">stdio (Local Subprocess)</SelectItem>
                                    <SelectItem value="sse">sse (Remote Server-Sent Events)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {mcpTransport === "stdio" ? (
                            <>
                                <div className="space-y-1.5">
                                    <Label>Command Executable</Label>
                                    <Input
                                        placeholder="e.g. python, npx, uvx, docker"
                                        value={mcpCommand}
                                        onChange={(e) => setMcpCommand(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Arguments (JSON array or space-separated)</Label>
                                    <Input
                                        placeholder='e.g. -y @modelcontextprotocol/server-filesystem /tmp'
                                        value={mcpArgs}
                                        onChange={(e) => setMcpArgs(e.target.value)}
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="space-y-1.5">
                                <Label>SSE Server URL</Label>
                                <Input
                                    placeholder="http://localhost:8080/sse"
                                    value={mcpUrl}
                                    onChange={(e) => setMcpUrl(e.target.value)}
                                />
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <Label>Description (Optional)</Label>
                            <Input
                                placeholder="Brief summary of provided tools"
                                value={mcpDesc}
                                onChange={(e) => setMcpDesc(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddMcpOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreateMcp} disabled={isCreatingMcp}>
                            {isCreatingMcp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save &amp; Connect
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Discovered Tools Dialog */}
            <Dialog open={Boolean(activeToolsServer)} onOpenChange={(open) => !open && setActiveToolsServer(null)}>
                <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Wrench className="h-5 w-5 text-primary" />
                            Tools in '{activeToolsServer?.name}'
                        </DialogTitle>
                        <DialogDescription>
                            Dynamic tool schemas discovered from this MCP server.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1">
                        {isLoadingTools ? (
                            <div className="flex items-center justify-center py-8 text-muted-foreground">
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Discovering tools...
                            </div>
                        ) : serverTools.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6">No tools advertised by this server.</p>
                        ) : (
                            serverTools.map((tool) => (
                                <div key={tool.name} className="p-3 rounded-md border bg-muted/40 space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono text-sm font-semibold text-primary">{tool.name}</span>
                                        <Badge variant="outline" className="text-[10px] font-mono">
                                            {tool.namespaced_name}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{tool.description || "No description provided."}</p>
                                    {tool.input_schema && Object.keys(tool.input_schema).length > 0 && (
                                        <details className="text-[11px] text-muted-foreground mt-1">
                                            <summary className="cursor-pointer font-mono text-xs hover:text-foreground">Input Schema</summary>
                                            <pre className="p-2 mt-1 rounded bg-black/40 overflow-x-auto text-[10px]">
                                                {JSON.stringify(tool.input_schema, null, 2)}
                                            </pre>
                                        </details>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setActiveToolsServer(null)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
