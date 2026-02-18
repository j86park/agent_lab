import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    ArrowLeft,
    Save,
    Trash2,
    Loader2,
    AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

import { agentApi, skillApi, type Agent, type Skill } from "@/lib/api";
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
    }, [id, isEditMode]);

    const handleInputChange = (field: keyof Agent, value: any) => {
        setFormData((prev) => ({ ...prev, [field]: value }));

        // Auto-update model if provider changes
        if (field === "provider") {
            const firstModel = MODELS[value as string]?.[0]?.id || "";
            setFormData((prev) => ({ ...prev, provider: value, model: firstModel }));
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
                                <Textarea
                                    id="prompt"
                                    className="min-h-[200px] font-mono text-sm"
                                    placeholder="You are an expert in..."
                                    value={formData.system_prompt}
                                    onChange={(e) => handleInputChange("system_prompt", e.target.value)}
                                />
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
                            <CardTitle>Model & Provider</CardTitle>
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
                </div>
            </div>
        </div>
    );
}
