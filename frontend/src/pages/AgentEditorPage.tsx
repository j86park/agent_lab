import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    ArrowLeft,
    FolderOpen,
    Loader2,
    Paperclip,
    Play,
    Download,
    RefreshCw,
    Save,
    Trash2,
    X,
    AlertCircle,
    BookTemplate,
} from "lucide-react";
import { toast } from "sonner";

import { agentApi, runApi, skillApi, type Agent, type Skill, type WorkspaceFile } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PromptLibrary } from "@/components/PromptLibrary";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const PROVIDERS = [
    { id: "openai", name: "OpenAI" },
    { id: "anthropic", name: "Anthropic" },
    { id: "openrouter", name: "OpenRouter" },
    { id: "ollama", name: "Ollama (Local)" },
];

const MODELS: Record<string, { id: string; name: string }[]> = {
    openai: [
        { id: "gpt-4o", name: "GPT-4o" },
        { id: "gpt-4o-mini", name: "GPT-4o mini" },
        { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
        { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
    ],
    anthropic: [
        { id: "claude-3-5-sonnet-20240620", name: "Claude 3.5 Sonnet" },
        { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" },
        { id: "claude-3-opus-20240229", name: "Claude 3 Opus" },
    ],
    openrouter: [
        { id: "openai/gpt-4o", name: "OpenAI: GPT-4o" },
        { id: "anthropic/claude-3.5-sonnet", name: "Anthropic: Claude 3.5 Sonnet" },
        { id: "google/gemini-pro-1.5", name: "Google: Gemini Pro 1.5" },
        { id: "meta-llama/llama-3-70b-instruct", name: "Meta: Llama 3 70B" },
    ],
    ollama: [
        { id: "llama3", name: "Llama 3" },
        { id: "codellama", name: "Code Llama" },
        { id: "mistral", name: "Mistral" },
        { id: "phi3", name: "Phi-3" },
    ],
};

const DEFAULT_AGENT: Partial<Agent> = {
    name: "",
    description: "",
    system_prompt: "You are a helpful AI assistant.",
    provider: "openai",
    model: "gpt-4o",
    tools_config: "[]",
    constraints_config: JSON.stringify({
        max_tokens: 2000,
        timeout_seconds: 60,
        max_cost: 0.1,
    }),
};

export default function AgentEditorPage() {
    const { id } = useParams<{ id: string }>();
    const isEditMode = Boolean(id);
    const navigate = useNavigate();

    const [formData, setFormData] = useState<Partial<Agent>>(DEFAULT_AGENT);
    const [skills, setSkills] = useState<Skill[]>([]);
    const [isLoading, setIsLoading] = useState(isEditMode);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [runTask, setRunTask] = useState("");
    const [isStartingRun, setIsStartingRun] = useState(false);
    const [workspaceFiles, setWorkspaceFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    // Workspace panel state (persistent workspace on server)
    const [agentWorkspaceFiles, setAgentWorkspaceFiles] = useState<WorkspaceFile[]>([]);
    const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false);
    // Prompt variable detection
    const [variableValues, setVariableValues] = useState<Record<string, string>>({});
    const [exportFormat, setExportFormat] = useState<"python" | "fastapi" | "docker">("python");
    const [isExporting, setIsExporting] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);
    const systemPromptRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // Fetch all skills
                const skillsData = await skillApi.getSkills();
                setSkills(skillsData.skills);

                if (isEditMode && id) {
                    const agent = await agentApi.getAgent(id);
                    setFormData(agent);
                }
            } catch (err: any) {
                console.error("Failed to fetch data", err);
                setError(err.message || "Failed to load data");
                toast.error("Failed to load data");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
        if (isEditMode && id) {
            // Load workspace files separately (non-blocking)
            loadWorkspaceFiles();
        }
    }, [id, isEditMode]);

    const handleInputChange = (field: keyof Agent, value: any) => {
        setFormData((prev) => ({ ...prev, [field]: value }));

        // Auto-update model if provider changes
        if (field === "provider") {
            const firstModel = MODELS[value as string]?.[0]?.id || "";
            setFormData((prev) => ({ ...prev, provider: value, model: firstModel }));
        }
    };

    const loadWorkspaceFiles = async () => {
        if (!id) return;
        setIsLoadingWorkspace(true);
        try {
            const result = await agentApi.listAgentWorkspace(id);
            setAgentWorkspaceFiles(result.files);
        } catch {
            // workspace dir may not exist yet — ignore
        } finally {
            setIsLoadingWorkspace(false);
        }
    };

    const handleDeleteWorkspaceFile = async (filename: string) => {
        if (!id) return;
        if (!confirm(`Delete "${filename}" from the workspace? This cannot be undone.`)) return;
        try {
            await agentApi.deleteWorkspaceFile(id, filename);
            toast.success(`Deleted ${filename}`);
            await loadWorkspaceFiles();
        } catch (err: any) {
            toast.error(err.message || "Failed to delete file");
        }
    };

    const handleSave = async () => {
        if (!formData.name?.trim()) {
            toast.error("Agent name is required");
            return;
        }

        setIsSaving(true);
        try {
            if (isEditMode && id) {
                await agentApi.updateAgent(id, formData);
                toast.success("Agent updated successfully");
            } else {
                const newAgent = await agentApi.createAgent(formData);
                toast.success("Agent created successfully");
                navigate(`/agents/${newAgent.id}`);
            }
        } catch (err: any) {
            console.error("Failed to save agent", err);
            toast.error(err.message || "Failed to save agent");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!id) return;
        setIsDeleting(true);
        try {
            await agentApi.deleteAgent(id);
            toast.success("Agent deleted successfully");
            navigate("/");
        } catch (err: any) {
            console.error("Failed to delete agent", err);
            toast.error(err.message || "Failed to delete agent");
            setIsDeleting(false);
        }
    };

    /** Extract unique {{variable}} names from a prompt template. */
    const extractVariables = (prompt: string): string[] => {
        const matches = [...prompt.matchAll(/\{\{([^}]+)\}\}/g)];
        return [...new Set(matches.map((m) => m[1].trim()))];
    };

    const detectedVars = extractVariables(formData.system_prompt ?? "");

    const handleStartRun = async () => {
        if (!id || !runTask.trim()) {
            toast.error("Please enter a task description");
            return;
        }
        setIsStartingRun(true);
        try {
            const varPayload = detectedVars.length > 0 ? variableValues : undefined;
            const run = await runApi.createRun(id, runTask.trim(), varPayload);
            if (workspaceFiles.length > 0) {
                await runApi.uploadRunFiles(run.id, workspaceFiles);
            }
            toast.success("Run started!");
            navigate(`/runs/${run.id}`);
        } catch (err: any) {
            console.error("Failed to start run", err);
            toast.error(err.message || "Failed to start run");
        } finally {
            setIsStartingRun(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = Array.from(e.target.files || []);
        setWorkspaceFiles((prev) => {
            const combined = [...prev, ...selected];
            // deduplicate by name, keep latest
            const seen = new Set<string>();
            return combined.filter((f) => {
                if (seen.has(f.name)) return false;
                seen.add(f.name);
                return true;
            }).slice(0, 10);
        });
        // reset so same file can be re-added after removal
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeFile = (name: string) => {
        setWorkspaceFiles((prev) => prev.filter((f) => f.name !== name));
    };

    const handleExport = async () => {
        if (!id) return;
        setIsExporting(true);
        try {
            const { filename, content } = await agentApi.exportAgent(id, exportFormat);
            const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
            toast.success(`Downloaded ${filename}`);
            setExportOpen(false);
        } catch (err: any) {
            toast.error(err.message || "Export failed");
        } finally {
            setIsExporting(false);
        }
    };

    const handleInsertSnippet = (content: string) => {
        const textarea = systemPromptRef.current;
        if (!textarea) {
            // Fallback if ref isn't available
            handleInputChange("system_prompt", (formData.system_prompt || "") + "\n" + content);
            return;
        }

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = formData.system_prompt || "";
        const before = text.substring(0, start);
        const after = text.substring(end);
        const newValue = before + content + after;

        handleInputChange("system_prompt", newValue);

        // Defer focus and cursor position update
        setTimeout(() => {
            textarea.focus();
            const newPos = start + content.length;
            textarea.setSelectionRange(newPos, newPos);
        }, 0);
    };

    if (isLoading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error && isEditMode) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="flex items-center gap-4">
                    {error}
                    <Button variant="outline" size="sm" onClick={() => navigate("/")}>
                        Go Back
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    const constraints = JSON.parse(formData.constraints_config || "{}");
    const updateConstraint = (field: string, value: number) => {
        const updated = { ...constraints, [field]: value };
        handleInputChange("constraints_config", JSON.stringify(updated));
    };

    const tools = JSON.parse(formData.tools_config || "[]") as string[];
    const toggleTool = (tool: string) => {
        const updated = tools.includes(tool)
            ? tools.filter((t) => t !== tool)
            : [...tools, tool];
        handleInputChange("tools_config", JSON.stringify(updated));
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-3xl font-bold">
                        {isEditMode ? "Edit Agent" : "New Agent"}
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    {isEditMode && (
                        <>
                            {/* Export Dialog */}
                            <Dialog open={exportOpen} onOpenChange={setExportOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline">
                                        <Download className="mr-2 h-4 w-4" />
                                        Export
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>Export Agent</DialogTitle>
                                        <DialogDescription>
                                            Download this agent as standalone, production-ready code.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-2">
                                        {/* Format picker */}
                                        <div className="grid grid-cols-3 gap-2">
                                            {[
                                                { value: "python" as const, label: "Python Script", desc: "CLI agent.py" },
                                                { value: "fastapi" as const, label: "FastAPI App", desc: "REST API server" },
                                                { value: "docker" as const, label: "Dockerfile", desc: "Container-ready" },
                                            ].map(({ value, label, desc }) => (
                                                <button
                                                    key={value}
                                                    type="button"
                                                    onClick={() => setExportFormat(value)}
                                                    className={`rounded-lg border p-3 text-left transition-colors ${exportFormat === value
                                                        ? "border-primary bg-primary/10"
                                                        : "border-border hover:bg-muted/50"
                                                        }`}
                                                >
                                                    <p className="text-sm font-semibold">{label}</p>
                                                    <p className="text-xs text-muted-foreground">{desc}</p>
                                                </button>
                                            ))}
                                        </div>
                                        {/* What's included */}
                                        <div className="rounded-md bg-muted/50 px-4 py-3 text-sm space-y-1">
                                            <p className="font-medium">Includes</p>
                                            <ul className="text-muted-foreground text-xs space-y-0.5 list-disc list-inside">
                                                <li>Full system prompt</li>
                                                <li>Provider & model config ({formData.provider} / {formData.model})</li>
                                                <li>API key loaded from environment variable</li>
                                                {exportFormat === "fastapi" && <li>POST /chat endpoint + GET /health</li>}
                                                {exportFormat === "docker" && <li>Dockerfile + embedded requirements</li>}
                                            </ul>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setExportOpen(false)}>Cancel</Button>
                                        <Button onClick={handleExport} disabled={isExporting}>
                                            {isExporting
                                                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</>
                                                : <><Download className="mr-2 h-4 w-4" /> Download</>}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                            {/* Delete Dialog */}
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="destructive" disabled={isDeleting}>
                                        {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                        Delete
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Are you absolutely sure?</DialogTitle>
                                        <DialogDescription>
                                            This action cannot be undone. This will permanently delete the agent
                                            and all associated run history.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => { }}>Cancel</Button>
                                        <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                                            {isDeleting ? "Deleting..." : "Permanently Delete"}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </>
                    )}
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {isEditMode ? "Update Agent" : "Create Agent"}
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Main Settings */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Configuration</CardTitle>
                            <CardDescription>Basic personality and identity of your agent.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g. Researcher Bot"
                                    value={formData.name}
                                    onChange={(e) => handleInputChange("name", e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    placeholder="What does this agent do?"
                                    value={formData.description || ""}
                                    onChange={(e) => handleInputChange("description", e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="prompt">System Prompt</Label>
                                <div className="relative">
                                    <Textarea
                                        id="prompt"
                                        ref={systemPromptRef}
                                        className="min-h-[400px] font-mono text-sm pr-12"
                                        placeholder="You are an expert in..."
                                        value={formData.system_prompt}
                                        onChange={(e) => handleInputChange("system_prompt", e.target.value)}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-2 top-2 h-8 w-8 text-muted-foreground hover:text-primary"
                                        onClick={() => setIsLibraryOpen(!isLibraryOpen)}
                                        title="Toggle Snippet Library"
                                    >
                                        <BookTemplate className="h-5 w-5" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Tabs defaultValue="tools">
                        <TabsList>
                            <TabsTrigger value="tools">Available Tools</TabsTrigger>
                            <TabsTrigger value="skills">Attached Skills</TabsTrigger>
                        </TabsList>
                        <TabsContent value="tools" className="mt-4">
                            <Card>
                                <CardContent className="pt-6 space-y-4">
                                    {[
                                        { id: "file_read", name: "File Reader", desc: "Read local project files" },
                                        { id: "file_write", name: "File Writer", desc: "Modify or create files" },
                                        { id: "code_execute", name: "Code Execution", desc: "Run code in a sandbox" },
                                        { id: "web_search", name: "Web Search", desc: "Search and browse the internet" },
                                    ].map((tool) => (
                                        <div key={tool.id} className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                                            <div className="space-y-0.5">
                                                <Label className="text-base">{tool.name}</Label>
                                                <p className="text-sm text-muted-foreground">{tool.desc}</p>
                                            </div>
                                            <Switch
                                                checked={tools.includes(tool.id)}
                                                onCheckedChange={() => toggleTool(tool.id)}
                                            />
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="skills" className="mt-4">
                            <Card>
                                <CardContent className="pt-6">
                                    {skills.length === 0 ? (
                                        <div className="text-center py-6 text-muted-foreground">
                                            No skills created yet.
                                        </div>
                                    ) : (
                                        <ScrollArea className="h-[300px] pr-4">
                                            <div className="space-y-4">
                                                {skills.map((skill) => (
                                                    <div key={skill.id} className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                                                        <div className="space-y-0.5">
                                                            <Label className="text-base">{skill.name}</Label>
                                                            <p className="text-sm text-muted-foreground line-clamp-1">{skill.description}</p>
                                                        </div>
                                                        <Switch disabled title="Skill persistence coming soon in Phase 3" />
                                                    </div>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Sidebar - Provider & Model */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Model &amp; Provider</CardTitle>
                            <CardDescription>Select the brain for your agent.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Provider</Label>
                                <Select
                                    value={formData.provider}
                                    onValueChange={(v) => handleInputChange("provider", v)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Provider" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PROVIDERS.map((p) => (
                                            <SelectItem key={p.id} value={p.id}>
                                                {p.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Model</Label>
                                <Select
                                    value={formData.model}
                                    onValueChange={(v) => handleInputChange("model", v)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Model" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(MODELS[formData.provider || "openai"] || []).map((m) => (
                                            <SelectItem key={m.id} value={m.id}>
                                                {m.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Constraints</CardTitle>
                            <CardDescription>Runtime limits and cost controls.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="max_tokens">Max Tokens</Label>
                                <Input
                                    id="max_tokens"
                                    type="number"
                                    value={constraints.max_tokens}
                                    onChange={(e) => updateConstraint("max_tokens", parseInt(e.target.value))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="timeout">Timeout (seconds)</Label>
                                <Input
                                    id="timeout"
                                    type="number"
                                    value={constraints.timeout_seconds}
                                    onChange={(e) => updateConstraint("timeout_seconds", parseInt(e.target.value))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="max_cost">Max Cost ($)</Label>
                                <Input
                                    id="max_cost"
                                    type="number"
                                    step="0.01"
                                    value={constraints.max_cost}
                                    onChange={(e) => updateConstraint("max_cost", parseFloat(e.target.value))}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Run Agent — only for saved agents */}
                    {isEditMode && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Run Agent</CardTitle>
                                <CardDescription>Start a new agent run with a task.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {/* Template variable inputs — only shown when {{vars}} detected */}
                                {detectedVars.length > 0 && (
                                    <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
                                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                            <span className="font-mono text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{"{{…}}"}</span>
                                            Template Variables
                                        </p>
                                        {detectedVars.map((varName) => (
                                            <div key={varName} className="space-y-1">
                                                <label className="text-xs text-muted-foreground font-mono">{`{{${varName}}}`}</label>
                                                <Input
                                                    placeholder={`Value for ${varName}`}
                                                    value={variableValues[varName] ?? ""}
                                                    onChange={(e) =>
                                                        setVariableValues((prev) => ({ ...prev, [varName]: e.target.value }))
                                                    }
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <Textarea
                                    id="run-task"
                                    placeholder="Describe the task for this agent…"
                                    value={runTask}
                                    onChange={(e) => setRunTask(e.target.value)}
                                    className="min-h-[100px] resize-none text-sm"
                                />

                                {/* Workspace file attachments */}
                                <div className="space-y-2">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        className="hidden"
                                        onChange={handleFileSelect}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <Paperclip className="h-3.5 w-3.5" />
                                        Attach workspace files ({workspaceFiles.length}/10)
                                    </button>
                                    {workspaceFiles.length > 0 && (
                                        <ul className="space-y-1">
                                            {workspaceFiles.map((f) => (
                                                <li
                                                    key={f.name}
                                                    className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs font-mono"
                                                >
                                                    <span className="truncate max-w-[160px]" title={f.name}>
                                                        {f.name}
                                                    </span>
                                                    <span className="text-muted-foreground ml-2 shrink-0">
                                                        {(f.size / 1024).toFixed(1)} KB
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeFile(f.name)}
                                                        className="ml-2 shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                <Button
                                    className="w-full"
                                    onClick={handleStartRun}
                                    disabled={isStartingRun || !runTask.trim()}
                                >
                                    {isStartingRun ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            {workspaceFiles.length > 0 ? "Uploading files…" : "Starting…"}
                                        </>
                                    ) : (
                                        <><Play className="mr-2 h-4 w-4" /> Start Run</>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* Workspace — only for saved agents */}
                    {isEditMode && (
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <FolderOpen className="h-4 w-4" />
                                            Workspace
                                            {agentWorkspaceFiles.length > 0 && (
                                                <span className="text-xs font-normal text-muted-foreground">
                                                    ({agentWorkspaceFiles.length} file{agentWorkspaceFiles.length !== 1 ? "s" : ""})
                                                </span>
                                            )}
                                        </CardTitle>
                                        <CardDescription className="mt-1">
                                            Persistent files available in every run.
                                        </CardDescription>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={loadWorkspaceFiles}
                                        disabled={isLoadingWorkspace}
                                        className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                                        title="Refresh"
                                    >
                                        <RefreshCw className={`h-3.5 w-3.5 ${isLoadingWorkspace ? "animate-spin" : ""}`} />
                                    </button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {agentWorkspaceFiles.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic">
                                        No workspace files yet. Attach files when starting a run.
                                    </p>
                                ) : (
                                    <ul className="space-y-1">
                                        {agentWorkspaceFiles.map((f) => (
                                            <li
                                                key={f.name}
                                                className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs"
                                            >
                                                <span className="font-mono truncate max-w-[150px]" title={f.name}>
                                                    {f.name}
                                                </span>
                                                <span className="text-muted-foreground ml-2 shrink-0">
                                                    {f.size_bytes < 1024
                                                        ? `${f.size_bytes} B`
                                                        : f.size_bytes < 1024 * 1024
                                                            ? `${(f.size_bytes / 1024).toFixed(1)} KB`
                                                            : `${(f.size_bytes / 1024 / 1024).toFixed(1)} MB`}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteWorkspaceFile(f.name)}
                                                    className="ml-2 shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                                                    title="Delete file"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Snippet Library Sidebar */}
            {isLibraryOpen && (
                <div className="fixed right-0 top-0 bottom-0 w-80 bg-background border-l border-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
                    <div className="p-4 border-b flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <BookTemplate className="h-5 w-5 text-primary" />
                            <h2 className="font-bold">Snippet Library</h2>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsLibraryOpen(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="flex-1 p-4 overflow-hidden">
                        <PromptLibrary onInsert={handleInsertSnippet} />
                    </div>
                </div>
            )}
        </div>
    );
}
