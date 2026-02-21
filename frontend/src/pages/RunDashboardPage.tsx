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
} from "lucide-react";

import { runApi, type Run, type RunLog } from "@/lib/api";
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

    // Auto-scroll control
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
                setError(err.message || "Failed to load run");
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
        } catch (err: any) {
            toast.error(err.message || "Failed to start re-run");
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
        } catch (err: any) {
            toast.error(err.message || "Failed to add tag");
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
        } catch (err: any) {
            toast.error(err.message || "Failed to remove tag");
        }
    };

    // ─── Derived stats ────────────────────────────────────────────────────────
    // Parse cumulative cost/tokens from log metadata if run not yet finalized
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

            {/* ── Stats Row ── */}
            <div className="grid grid-cols-3 gap-4">
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

            {/* ── Log Viewer ── */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Execution Logs</CardTitle>
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
                                logs.map((log) => (
                                    <div key={log.id} className="flex gap-3 leading-relaxed">
                                        <span className="text-slate-600 shrink-0 w-20">
                                            {formatTime(log.timestamp)}
                                        </span>
                                        <span
                                            className={`uppercase shrink-0 w-7 font-bold ${LOG_LEVEL_STYLES[log.level] ?? "text-slate-400"}`}
                                        >
                                            {log.level.slice(0, 4)}
                                        </span>
                                        <span className="text-slate-300 break-all whitespace-pre-wrap">
                                            {log.message}
                                        </span>
                                    </div>
                                ))
                            )}
                            <div ref={logEndRef} />
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
