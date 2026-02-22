import { getErrorMessage } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    ArrowLeft,
    Loader2,
    Paperclip,
    Play,
    Download,
    Save,
    Trash2,
    X,
} from "lucide-react";
import { toast } from "sonner";

import { agentApi, runApi, skillApi, metadataApi, type Agent, type Skill, type WorkspaceFile, type ModelMetadata } from "@/lib/api";
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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

// Editor sub-components
import { AgentBasicInfo } from "@/components/agent-editor/AgentBasicInfo";
import { ModelProviderSettings } from "@/components/agent-editor/ModelProviderSettings";
import { PromptEditor } from "@/components/agent-editor/PromptEditor";
import { ConstraintSettings } from "@/components/agent-editor/ConstraintSettings";
import { WorkspaceMonitor } from "@/components/agent-editor/WorkspaceMonitor";

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
    const [modelsMetadata, setModelsMetadata] = useState<ModelMetadata[]>([]);
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
    // Warning: we removed some refs and state that moved to components

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

                // Fetch model metadata
                const meta = await metadataApi.getModels();
                setModelsMetadata(meta.models);
            } catch (err) {
                console.error("Failed to fetch data", err);
                setError(getErrorMessage(err) || "Failed to load data");
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

    const handleInputChange = (field: keyof Agent, value: string | boolean | number | object | null | undefined) => {
        setFormData((prev) => ({ ...prev, [field]: value } as Partial<Agent>));

        // Changed: Removed auto model update, handled in AgentBasicInfo now wait it's not handled in AgentBasicInfo! Let's keep it here!
        if (field === "provider") {
            const firstModel = value === "anthropic" ? "claude-3-5-sonnet-20240620" : value === "openrouter" ? "openai/gpt-4o" : value === "ollama" ? "llama3" : "gpt-4o";
            setFormData((prev) => ({ ...prev, provider: value as string, model: firstModel } as Partial<Agent>));
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
        } catch (err) {
            toast.error(getErrorMessage(err) || "Failed to delete file");
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
        } catch (err) {
            console.error("Failed to save agent", err);
            toast.error(getErrorMessage(err) || "Failed to save agent");
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
        } catch (err) {
            console.error("Failed to delete agent", err);
            toast.error(getErrorMessage(err) || "Failed to delete agent");
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
        } catch (err) {
            console.error("Failed to start run", err);
            toast.error(getErrorMessage(err) || "Failed to start run");
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
        } catch (err) {
            toast.error(getErrorMessage(err) || "Export failed");
        } finally {
            setIsExporting(false);
        }
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



    const tools = JSON.parse(formData.tools_config || "[]") as string[];
    const toggleTool = (tool: string) => {
        const updated = tools.includes(tool)
            ? tools.filter((t) => t !== tool)
            : [...tools, tool];
        handleInputChange("tools_config", JSON.stringify(updated));
    };

    // Cost estimation
    const getCostEstimate = () => {
        const modelMeta = modelsMetadata.find(m => m.id === formData.model);
        if (!modelMeta) return { cost: 0, high: false };

        const constraints = JSON.parse(formData.constraints_config || "{}");
        const maxTokens = constraints.max_tokens || 2000;
        const totalTokens = maxTokens + 500; // Estimated input tokens
        const cost = (totalTokens / 1000000) * modelMeta.output_price_1m; // Simplified conservative estimate
        return {
            cost: cost,
            high: cost > 0.05 // $0.05 threshold for warning
        };
    };

    const costEstimate = getCostEstimate();

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
                    <AgentBasicInfo
                        formData={formData}
                        handleInputChange={handleInputChange}
                    />
                    <PromptEditor
                        formData={formData}
                        isEditMode={isEditMode}
                        id={id}
                        handleInputChange={handleInputChange}
                    />

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
                    <ModelProviderSettings
                        formData={formData}
                        modelsMetadata={modelsMetadata}
                        costEstimate={costEstimate}
                        handleInputChange={handleInputChange}
                    />
                    <ConstraintSettings
                        constraintsConfig={formData.constraints_config || "{}"}
                        handleInputChange={handleInputChange}
                    />

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
                        <WorkspaceMonitor
                            files={agentWorkspaceFiles}
                            isLoading={isLoadingWorkspace}
                            onRefresh={loadWorkspaceFiles}
                            onDelete={handleDeleteWorkspaceFile}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
