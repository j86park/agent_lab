import { getErrorMessage } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
    ArrowLeft,
    AlertCircle,
    CheckCircle2,
    Clock,
    Coins,
    Hash,
    Loader2,
    Plus,
    RefreshCw,
    X,
    XCircle,
    Activity,
    ShieldCheck,
    Pause,
    Play,
    Terminal,
    Database,
    FileText,
    AlertTriangle,
    GitFork,
    Copy,
    Send,
} from "lucide-react";
import { runApi, type Run, type RunLog, type TrajectoryEvent, type ToolApprovalStatus } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(seconds: number | null): string {
    if (seconds === null) return "—";
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}m ${s}s`;
}

function formatCost(cost: number | null): string {
    if (cost === null) return "—";
    return `$${cost.toFixed(6)}`;
}

function formatTokens(total: number | null): string {
    if (total === null) return "—";
    return total.toLocaleString();
}

function formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function getWsUrl(runId: string): string {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    return `${proto}//${host}/ws/runs/${runId}`;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Run["status"] }) {
    if (status === "pending") {
        return (
            <Badge variant="secondary" className="gap-1.5">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500" />
                </span>
                Queued
            </Badge>
        );
    }
    if (status === "running") {
        return (
            <Badge variant="secondary" className="gap-1.5 text-blue-400 border-blue-400/30 bg-blue-400/10">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400" />
                </span>
                Running
            </Badge>
        );
    }
    if (status === "awaiting_approval") {
        return (
            <Badge variant="secondary" className="gap-1.5 text-amber-400 border-amber-400/30 bg-amber-400/10">
                <AlertTriangle className="h-3.5 w-3.5 animate-pulse" />
                Breakpoint
            </Badge>
        );
    }
    if (status === "paused") {
        return (
            <Badge variant="outline" className="gap-1.5 text-slate-400 border-slate-500/30">
                <Pause className="h-3.5 w-3.5" />
                Paused
            </Badge>
        );
    }
    if (status === "completed") {
        return (
            <Badge variant="secondary" className="gap-1.5 text-green-400 border-green-400/30 bg-green-400/10">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Completed
            </Badge>
        );
    }
    return (
        <Badge variant="destructive" className="gap-1.5">
            <XCircle className="h-3.5 w-3.5" />
            Failed
        </Badge>
    );
}

function EvaluationBadge({ score }: { score: number | null }) {
    if (score === null) return null;

    let colorClass = "text-amber-400 border-amber-400/30 bg-amber-400/10";
    let label = "Partial";

    if (score >= 0.9) {
        colorClass = "text-green-400 border-green-400/30 bg-green-400/10";
        label = "Pass";
    } else if (score <= 0.1) {
        colorClass = "text-red-400 border-red-400/30 bg-red-400/10";
        label = "Fail";
    }

    return (
        <Badge variant="secondary" className={`gap-1.5 ${colorClass}`}>
            <ShieldCheck className="h-3.5 w-3.5" />
            <span className="font-bold">{(score * 100).toFixed(0)}%</span>
            <span>{label}</span>
        </Badge>
    );
}

// ─── Log Level Styles ─────────────────────────────────────────────────────────

const LOG_LEVEL_STYLES: Record<string, string> = {
    info: "text-blue-400",
    warning: "text-amber-400",
    error: "text-red-400",
    debug: "text-slate-500",
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
    icon: Icon,
    label,
    value,
}: {
    icon: React.ElementType;
    label: string;
    value: string;
}) {
    return (
        <Card>
            <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                </div>
                <div className="text-lg font-semibold tabular-nums">{value}</div>
            </CardContent>
        </Card>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RunDashboardPage() {
    const { id: runId } = useParams<{ id: string }>();
    const [run, setRun] = useState<Run | null>(null);
    const [logs, setLogs] = useState<RunLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    // Re-run state
    const [showReRun, setShowReRun] = useState(false);
    const [reRunTask, setReRunTask] = useState("");
    const [isReRunning, setIsReRunning] = useState(false);

    // Tags state
    const [isEditingTags, setIsEditingTags] = useState(false);
    const [newTag, setNewTag] = useState("");
    // Live duration counter
    const [elapsed, setElapsed] = useState<number | null>(null);

    // Debugger & Trajectory state
    const [activeTab, setActiveTab] = useState<"logs" | "trajectory" | "terminal">("logs");
    const [approvalStatus, setApprovalStatus] = useState<ToolApprovalStatus | null>(null);
    const [trajectory, setTrajectory] = useState<TrajectoryEvent[]>([]);
    const [isLoadingTrajectory, setIsLoadingTrajectory] = useState(false);

    // Artifact Dialog state
    const [activeArtifact, setActiveArtifact] = useState<{ name: string; content: string } | null>(null);
    // Fork Dialog state
    const [forkDialogOpen, setForkDialogOpen] = useState(false);
    const [forkStepIndex, setForkStepIndex] = useState(0);
    const [forkOverrideTask, setForkOverrideTask] = useState("");
    const [isForking, setIsForking] = useState(false);

    // Interactive Terminal state
    const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
    const [terminalInput, setTerminalInput] = useState("");
    const terminalWsRef = useRef<WebSocket | null>(null);
    const terminalEndRef = useRef<HTMLDivElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const logEndRef = useRef<HTMLDivElement>(null);
    const userScrolled = useRef(false);

    const scrollToBottom = useCallback(() => {
        if (!userScrolled.current) {
            logEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, []);

    // ── Auto-scroll detection ───────────────────────────────────────────────
    useEffect(() => {
        const el = scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]");
        if (!el) return;
        const handleScroll = () => {
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
            userScrolled.current = !atBottom;
        };
        el.addEventListener("scroll", handleScroll);
        return () => el.removeEventListener("scroll", handleScroll);
    }, []);

    // ── Auto-scroll on new logs ─────────────────────────────────────────────
    useEffect(() => {
        scrollToBottom();
    }, [logs.length, scrollToBottom]);

    // ── Live duration timer ─────────────────────────────────────────────────
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (run?.status === "running") {
            const startedAt = new Date(run.created_at).getTime();
            interval = setInterval(() => {
                setElapsed((Date.now() - startedAt) / 1000);
            }, 1000);
        } else if (run?.duration_seconds !== undefined) {
            setElapsed(run.duration_seconds);
        }
        return () => clearInterval(interval);
    }, [run?.status, run?.created_at, run?.duration_seconds]);

    // ── Initial fetch + WebSocket ───────────────────────────────────────────
    useEffect(() => {
        if (!runId) return;

        let ws: WebSocket | null = null;
        let reconnectTimeout: ReturnType<typeof setTimeout>;
        let cancelled = false;

        const connect = () => {
            if (cancelled) return;
            ws = new WebSocket(getWsUrl(runId));

            ws.onmessage = (ev) => {
                try {
                    const msg = JSON.parse(ev.data);
                    if (msg.type === "log") {
                        setLogs((prev) => {
                            // Deduplicate by log id
                            if (prev.some((l) => l.id === msg.data.id)) return prev;
                            return [...prev, msg.data as RunLog];
                        });
                    } else if (msg.type === "status") {
                        setRun(msg.run as Run);
                    } else if (msg.type === "error") {
                        setError(msg.message);
                    }
                } catch {
                    // ignore malformed frames
                }
            };

            ws.onerror = () => {
                // Will be followed by onclose
            };

            ws.onclose = () => {
                // Don't reconnect if run is done or component is unmounted
                if (cancelled) return;
                setRun((prev) => {
                    if (prev && (prev.status === "completed" || prev.status === "failed")) {
                        return prev;
                    }
                    // Reconnect after 2s if run still active
                    reconnectTimeout = setTimeout(connect, 2000);
                    return prev;
                });
            };

            ws.onopen = () => {
                setIsLoading(false);
                setError(null);
            };
        };

        // Fetch initial run state while WS connects
        runApi
            .getRun(runId)
            .then((r) => {
                setRun(r);
                setIsLoading(false);
            })
            .catch((err) => {
                setError(getErrorMessage(err) || "Failed to load run");
                setIsLoading(false);
            });

        connect();

        return () => {
            cancelled = true;
            clearTimeout(reconnectTimeout);
            ws?.close();
        };
    }, [runId]);

    // ─── Actions ─────────────────────────────────────────────────────────────

    const handleReRun = async () => {
        if (!run || !reRunTask.trim()) return;
        setIsReRunning(true);
        try {
            const newRun = await runApi.createRun(run.agent_id, reRunTask.trim(), undefined, run.tags);
            toast.success("New run started");
            navigate(`/runs/${newRun.id}`);
        } catch (err) {
            toast.error(getErrorMessage(err) || "Failed to start re-run");
        } finally {
            setIsReRunning(false);
        }
    };

    const handleAddTag = async () => {
        if (!run || !newTag.trim()) {
            setIsEditingTags(false);
            return;
        }
        const tag = newTag.trim();
        const existing = run.tags ? run.tags.split(",").map(t => t.trim()) : [];
        if (existing.includes(tag)) {
            setNewTag("");
            setIsEditingTags(false);
            return;
        }

        const updatedTags = [...existing, tag].join(",");
        try {
            const updatedRun = await runApi.updateRunTags(run.id, updatedTags);
            setRun(updatedRun);
            setNewTag("");
        } catch (err) {
            toast.error(getErrorMessage(err) || "Failed to add tag");
        } finally {
            setIsEditingTags(false);
        }
    };

    const handleRemoveTag = async (tagToRemove: string) => {
        if (!run || !run.tags) return;
        const updatedTags = run.tags
            .split(",")
            .map(t => t.trim())
            .filter(t => t !== tagToRemove)
            .join(",");

        try {
            const updatedRun = await runApi.updateRunTags(run.id, updatedTags || null);
            setRun(updatedRun);
        } catch (err) {
            toast.error(getErrorMessage(err) || "Failed to remove tag");
        }
    };

    // ─── Debugger & Breakpoint Polling ────────────────────────────────────────
    useEffect(() => {
        if (!runId || run?.status !== "awaiting_approval") return;
        const pollApproval = async () => {
            try {
                const data = await runApi.getApprovalStatus(runId);
                setApprovalStatus(data);
            } catch { /* ignore */ }
        };
        pollApproval();
        const interval = setInterval(pollApproval, 1500);
        return () => clearInterval(interval);
    }, [runId, run?.status]);

    // ─── Trajectory Fetching ──────────────────────────────────────────────────
    const fetchTrajectory = useCallback(async () => {
        if (!runId) return;
        setIsLoadingTrajectory(true);
        try {
            const data = await runApi.getTrajectory(runId);
            setTrajectory(data.events || []);
        } catch (e) {
            console.error("Failed to load trajectory:", e);
        } finally {
            setIsLoadingTrajectory(false);
        }
    }, [runId]);

    useEffect(() => {
        if (activeTab === "trajectory" || run?.status === "completed") {
            fetchTrajectory();
        }
    }, [activeTab, run?.status, fetchTrajectory]);

    // ─── Terminal WebSocket ───────────────────────────────────────────────────
    useEffect(() => {
        if (activeTab !== "terminal" || !runId) {
            if (terminalWsRef.current) {
                terminalWsRef.current.close();
                terminalWsRef.current = null;
            }
            return;
        }

        const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${proto}//${window.location.host}/ws/runs/${runId}/pty`;
        const ws = new WebSocket(wsUrl);
        terminalWsRef.current = ws;

        ws.onopen = () => {
            setTerminalOutput((prev) => [...prev, "--- Connected to Interactive Workspace Terminal ---\n"]);
        };

        ws.onmessage = (e) => {
            setTerminalOutput((prev) => [...prev, e.data]);
            terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
        };

        ws.onclose = () => {
            setTerminalOutput((prev) => [...prev, "\n--- Terminal session disconnected ---\n"]);
        };

        return () => {
            ws.close();
            terminalWsRef.current = null;
        };
    }, [activeTab, runId]);

    const handleSendTerminal = (e: React.FormEvent) => {
        e.preventDefault();
        if (!terminalInput.trim() || !terminalWsRef.current) return;
        terminalWsRef.current.send(terminalInput + "\n");
        setTerminalInput("");
    };

    // ─── Approval Handlers ───────────────────────────────────────────────────
    const handleApproveTool = async () => {
        if (!runId) return;
        try {
            await runApi.approveTool(runId);
            toast.success("Tool call approved! Execution resuming...");
            setApprovalStatus(null);
            setRun((prev) => (prev ? { ...prev, status: "running" } : null));
        } catch (err) {
            toast.error(getErrorMessage(err) || "Failed to approve tool call");
        }
    };

    const handleRejectTool = async () => {
        if (!runId) return;
        try {
            await runApi.rejectTool(runId, "Rejected by user from dashboard");
            toast.info("Tool call rejected. Feedback sent to agent.");
            setApprovalStatus(null);
            setRun((prev) => (prev ? { ...prev, status: "running" } : null));
        } catch (err) {
            toast.error(getErrorMessage(err) || "Failed to reject tool call");
        }
    };

    const handlePauseRun = async () => {
        if (!runId) return;
        try {
            await runApi.pauseRun(runId);
            toast.info("Run paused");
            setRun((prev) => (prev ? { ...prev, status: "paused" } : null));
        } catch (err) {
            toast.error(getErrorMessage(err) || "Failed to pause run");
        }
    };

    const handleResumeRun = async () => {
        if (!runId) return;
        try {
            await runApi.resumeRun(runId);
            toast.success("Run resumed");
            setRun((prev) => (prev ? { ...prev, status: "running" } : null));
        } catch (err) {
            toast.error(getErrorMessage(err) || "Failed to resume run");
        }
    };

    const handleOpenFork = (stepIdx: number) => {
        setForkStepIndex(stepIdx);
        setForkOverrideTask(run?.task || "");
        setForkDialogOpen(true);
    };

    const handleConfirmFork = async () => {
        if (!runId) return;
        setIsForking(true);
        try {
            const childRun = await runApi.forkRun(runId, forkStepIndex, forkOverrideTask || undefined);
            toast.success(`Forked run from step ${forkStepIndex}!`);
            setForkDialogOpen(false);
            navigate(`/runs/${childRun.id}`);
        } catch (err) {
            toast.error(getErrorMessage(err) || "Failed to fork run");
        } finally {
            setIsForking(false);
        }
    };

    const handleViewArtifact = async (logMsg: string) => {
        if (!runId) return;
        const match = logMsg.match(/artifact:\/\/([^\s\]]+)/);
        if (!match) return;
        const uri = match[1];
        const artifactName = uri.split("/").pop() || uri;
        try {
            const content = await runApi.getArtifactContent(runId, artifactName);
            setActiveArtifact({ name: artifactName, content });
        } catch (err) {
            toast.error(getErrorMessage(err) || "Failed to load artifact");
        }
    };

    // ─── Derived stats ────────────────────────────────────────────────────────
    const liveCost = run?.cost ?? (() => {
        let c = 0;
        logs.forEach((l) => {
            try {
                const m = JSON.parse(l.metadata_json || "{}");
                if (m.cost) c += m.cost;
            } catch { /* ignore */ }
        });
        return c > 0 ? c : null;
    })();

    // Compute total cached tokens from prompt caching
    let cacheTokens = 0;
    logs.forEach((l) => {
        try {
            const m = JSON.parse(l.metadata_json || "{}");
            if (m.cache_read_tokens) cacheTokens += m.cache_read_tokens;
        } catch { /* ignore */ }
    });
    // ─── Render ───────────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="flex items-center gap-4">
                    {error}
                    <Button variant="outline" size="sm" asChild>
                        <Link to="/">Go Home</Link>
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    if (!run) return null;

    return (
        <div className="space-y-6">
            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link to={`/agents/${run.agent_id}`}>
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold">Run Dashboard</h1>
                            <StatusBadge status={run.status} />
                            {run.status === "running" && (
                                <Button size="sm" variant="outline" className="gap-1 text-xs h-7 ml-2" onClick={handlePauseRun}>
                                    <Pause className="h-3.5 w-3.5" /> Pause
                                </Button>
                            )}
                            {run.status === "paused" && (
                                <Button size="sm" variant="default" className="gap-1 text-xs h-7 ml-2 bg-blue-600 hover:bg-blue-700" onClick={handleResumeRun}>
                                    <Play className="h-3.5 w-3.5" /> Resume
                                </Button>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-muted-foreground font-mono">
                                ID: {run.id}
                            </p>
                            <div className="flex items-center gap-1.5 ml-2">
                                {run.tags?.split(",").filter(t => t.trim()).map(tag => (
                                    <Badge key={tag} variant="outline" className="text-[10px] py-0 px-1.5 h-4 gap-1 group">
                                        {tag}
                                        <button
                                            onClick={() => handleRemoveTag(tag)}
                                            className="hover:text-destructive text-muted-foreground/50 transition-colors"
                                        >
                                            <X className="h-2.5 w-2.5" />
                                        </button>
                                    </Badge>
                                ))}
                                {isEditingTags ? (
                                    <Input
                                        autoFocus
                                        className="h-5 w-24 text-[10px] py-0 px-1.5"
                                        placeholder="Tag..."
                                        value={newTag}
                                        onChange={(e) => setNewTag(e.target.value)}
                                        onBlur={handleAddTag}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleAddTag();
                                            if (e.key === "Escape") setIsEditingTags(false);
                                        }}
                                    />
                                ) : (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-4 px-1.5 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                                        onClick={() => setIsEditingTags(true)}
                                    >
                                        <Plus className="h-2.5 w-2.5" />
                                        Add tag
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                            setReRunTask(run.task);
                            setShowReRun(!showReRun);
                        }}
                    >
                        <RefreshCw className={`h-4 w-4 ${showReRun ? "text-primary" : ""}`} />
                        Re-run
                    </Button>
                </div>
            </div>

            {/* ── Re-run Panel ── */}
            {showReRun && (
                <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="pt-4 space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Modify Task for Re-run</label>
                            <Textarea
                                value={reRunTask}
                                onChange={(e) => setReRunTask(e.target.value)}
                                placeholder="Enter task description..."
                                className="min-h-[100px] bg-background"
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setShowReRun(false)}>
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleReRun}
                                disabled={isReRunning || !reRunTask.trim()}
                                className="gap-2"
                            >
                                {isReRunning ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="h-4 w-4" />
                                )}
                                Start New Run
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Task Description ── */}
            <Card>
                <CardContent className="pt-4 pb-4">
                    <p className="text-sm text-muted-foreground mb-1 font-medium">Task</p>
                    <p className="text-sm">{run.task}</p>
                </CardContent>
            </Card>

            {/* ── Breakpoint Approval Banner ── */}
            {run.status === "awaiting_approval" && approvalStatus?.pending_tool && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-3 animate-in fade-in-50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500 animate-pulse" />
                            <span className="font-semibold text-sm text-amber-400">Action Approval Required (Breakpoint)</span>
                        </div>
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="text-red-400 border-red-500/40 hover:bg-red-500/10 h-8" onClick={handleRejectTool}>
                                Reject Call
                            </Button>
                            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-black font-semibold h-8" onClick={handleApproveTool}>
                                Approve &amp; Execute
                            </Button>
                        </div>
                    </div>
                    <p className="text-xs text-amber-200/90">{approvalStatus.pending_tool.reason}</p>
                    <pre className="p-3 rounded bg-black/60 font-mono text-xs overflow-x-auto text-slate-300 border border-amber-500/20">
                        {approvalStatus.pending_tool.tool_name}({JSON.stringify(approvalStatus.pending_tool.arguments, null, 2)})
                    </pre>
                </div>
            )}

            {/* ── Stats Row ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    icon={Clock}
                    label="Duration"
                    value={formatDuration(elapsed)}
                />
                <StatCard
                    icon={Coins}
                    label="Cost"
                    value={formatCost(liveCost)}
                />
                <StatCard
                    icon={Hash}
                    label="Tokens"
                    value={formatTokens(run.total_tokens)}
                />
                <StatCard
                    icon={Database}
                    label="Cached Tokens"
                    value={cacheTokens > 0 ? `${cacheTokens.toLocaleString()} tokens` : "None"}
                />
            </div>

            {/* ── Evaluation Section ── */}
            {(run.eval_score !== null || run.eval_feedback) && (
                <Card className="border-primary/20 bg-primary/5">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Activity className="h-4 w-4 text-primary" />
                                LLM-as-a-Judge Evaluation
                            </CardTitle>
                            <EvaluationBadge score={run.eval_score} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        {run.eval_feedback ? (
                            <div className="text-sm text-slate-300 bg-background/50 p-3 rounded border border-primary/10 italic">
                                "{run.eval_feedback}"
                            </div>
                        ) : (
                            <div className="text-sm text-muted-foreground italic">
                                No feedback provided.
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ── Failed Error ── */}
            {run.status === "failed" && run.error_message && (
                <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>Run Failed</AlertTitle>
                    <AlertDescription className="font-mono text-xs whitespace-pre-wrap">
                        {run.error_message}
                    </AlertDescription>
                </Alert>
            )}

            {/* ── Execution Tabs: Logs, Trajectory & Forking, Interactive Terminal ── */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "logs" | "trajectory" | "terminal")} className="w-full">
                <TabsList className="grid grid-cols-3 w-full sm:w-[500px]">
                    <TabsTrigger value="logs" className="gap-1.5 text-xs">
                        <FileText className="h-3.5 w-3.5" />
                        Logs ({logs.length})
                    </TabsTrigger>
                    <TabsTrigger value="trajectory" className="gap-1.5 text-xs">
                        <GitFork className="h-3.5 w-3.5" />
                        Trajectory ({trajectory.length})
                    </TabsTrigger>
                    <TabsTrigger value="terminal" className="gap-1.5 text-xs">
                        <Terminal className="h-3.5 w-3.5" />
                        Terminal
                    </TabsTrigger>
                </TabsList>

                {/* Tab 1: Execution Logs with Artifact Offload Buttons */}
                <TabsContent value="logs" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base">Real-Time Execution Logs</CardTitle>
                                <span className="text-xs text-muted-foreground">
                                    {logs.length} {logs.length === 1 ? "entry" : "entries"}
                                </span>
                            </div>
                        </CardHeader>
                        <Separator />
                        <CardContent className="p-0">
                            <ScrollArea ref={scrollAreaRef} className="h-[420px]">
                                <div className="p-4 font-mono text-xs space-y-1">
                                    {logs.length === 0 ? (
                                        <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Waiting for logs…
                                        </div>
                                    ) : (
                                        logs.map((log) => {
                                            const hasArtifact = log.message.includes("artifact://");
                                            return (
                                                <div key={log.id} className="flex flex-col gap-1 py-0.5">
                                                    <div className="flex gap-3 leading-relaxed">
                                                        <span className="text-slate-600 shrink-0 w-20">
                                                            {formatTime(log.timestamp)}
                                                        </span>
                                                        <span
                                                            className={`uppercase shrink-0 w-7 font-bold ${LOG_LEVEL_STYLES[log.level] ?? "text-slate-400"}`}
                                                        >
                                                            {log.level.slice(0, 4)}
                                                        </span>
                                                        <span className="text-slate-300 break-all whitespace-pre-wrap flex-1">
                                                            {log.message}
                                                        </span>
                                                    </div>
                                                    {hasArtifact && (
                                                        <div className="ml-24">
                                                            <Button
                                                                size="sm"
                                                                variant="secondary"
                                                                className="h-6 text-[11px] gap-1 px-2 text-primary"
                                                                onClick={() => handleViewArtifact(log.message)}
                                                            >
                                                                <FileText className="h-3 w-3" />
                                                                View Offloaded Log File
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                    <div ref={logEndRef} />
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 2: Trajectory Step Timeline with Time-Travel Forking */}
                <TabsContent value="trajectory" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base">Step Timeline (Trajectory)</CardTitle>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Chronological event trace with step-level rollback and time-travel forking.
                                    </p>
                                </div>
                                <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={fetchTrajectory}>
                                    <RefreshCw className="h-3.5 w-3.5" /> Refresh
                                </Button>
                            </div>
                        </CardHeader>
                        <Separator />
                        <CardContent className="p-4">
                            {isLoadingTrajectory ? (
                                <div className="flex items-center justify-center py-12 text-muted-foreground">
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Loading trajectory trace...
                                </div>
                            ) : trajectory.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground text-sm">
                                    No trajectory events recorded for this run.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {trajectory.map((event) => (
                                        <div key={event.id} className="rounded-lg border p-4 bg-muted/20 space-y-2 relative">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="font-mono text-xs">
                                                        Step {event.step_index}
                                                    </Badge>
                                                    <Badge
                                                        className={`uppercase font-mono text-[10px] ${
                                                            event.event_type === "action"
                                                                ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                                                                : event.event_type === "observation"
                                                                ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
                                                                : event.event_type === "thought"
                                                                ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                                                : "bg-slate-500/20 text-slate-300"
                                                        }`}
                                                        variant="secondary"
                                                    >
                                                        {event.event_type}
                                                    </Badge>
                                                    <span className="text-[11px] text-muted-foreground">
                                                        {formatTime(event.created_at)}
                                                    </span>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs gap-1 text-primary border-primary/20 hover:bg-primary/10"
                                                    onClick={() => handleOpenFork(event.step_index)}
                                                >
                                                    <GitFork className="h-3 w-3" />
                                                    Fork from Step {event.step_index}
                                                </Button>
                                            </div>

                                            <pre className="p-2.5 rounded bg-black/50 font-mono text-xs overflow-x-auto text-slate-200">
                                                {JSON.stringify(event.payload, null, 2)}
                                            </pre>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 3: Interactive Workspace Terminal */}
                <TabsContent value="terminal" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Terminal className="h-4 w-4 text-primary" />
                                        Interactive Workspace Terminal
                                    </CardTitle>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Live interactive shell attached directly to the agent's workspace directory.
                                    </p>
                                </div>
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setTerminalOutput([])}>
                                    Clear
                                </Button>
                            </div>
                        </CardHeader>
                        <Separator />
                        <CardContent className="p-4 space-y-3">
                            <div className="h-[360px] rounded-lg bg-black p-4 font-mono text-xs text-green-400 overflow-y-auto border border-border/40 whitespace-pre-wrap">
                                {terminalOutput.length === 0 ? (
                                    <span className="text-slate-600">Connecting to interactive shell...</span>
                                ) : (
                                    terminalOutput.join("")
                                )}
                                <div ref={terminalEndRef} />
                            </div>
                            <form onSubmit={handleSendTerminal} className="flex gap-2">
                                <Input
                                    placeholder="Type a bash command (e.g. ls -la, cat file.txt) and press Enter..."
                                    value={terminalInput}
                                    onChange={(e) => setTerminalInput(e.target.value)}
                                    className="font-mono text-xs bg-black/40"
                                />
                                <Button type="submit" size="sm" className="gap-1.5 shrink-0">
                                    <Send className="h-3.5 w-3.5" /> Send
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* ── Offloaded Artifact Content Modal ── */}
            <Dialog open={Boolean(activeArtifact)} onOpenChange={(open) => !open && setActiveArtifact(null)}>
                <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 font-mono text-sm">
                            <FileText className="h-4 w-4 text-primary" />
                            {activeArtifact?.name}
                        </DialogTitle>
                        <DialogDescription>
                            Full offloaded tool observation log stored in local storage.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto py-2">
                        <pre className="p-4 rounded-lg bg-black font-mono text-xs text-slate-200 whitespace-pre-wrap overflow-x-auto border">
                            {activeArtifact?.content}
                        </pre>
                    </div>
                    <DialogFooter className="flex justify-between sm:justify-between items-center">
                        <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs"
                            onClick={() => {
                                if (activeArtifact) {
                                    navigator.clipboard.writeText(activeArtifact.content);
                                    toast.success("Artifact copied to clipboard");
                                }
                            }}
                        >
                            <Copy className="h-3.5 w-3.5" /> Copy Log
                        </Button>
                        <Button size="sm" onClick={() => setActiveArtifact(null)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Time-Travel Fork Dialog ── */}
            <Dialog open={forkDialogOpen} onOpenChange={setForkDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <GitFork className="h-5 w-5 text-primary" />
                            Fork Run at Step {forkStepIndex}
                        </DialogTitle>
                        <DialogDescription>
                            Create a new independent execution branch initialized with the exact filesystem and history state of Step {forkStepIndex}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Task for Forked Run</label>
                            <Textarea
                                value={forkOverrideTask}
                                onChange={(e) => setForkOverrideTask(e.target.value)}
                                placeholder="Describe the goal for this forked execution branch..."
                                className="min-h-[90px] text-xs"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setForkDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={handleConfirmFork} disabled={isForking || !forkOverrideTask.trim()}>
                            {isForking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Fork &amp; Execute
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
