import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { runApi, type Run, type RunLog } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, TrendingDown, TrendingUp, Minus } from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<Run["status"], string> = {
    pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    running: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    completed: "bg-green-500/20 text-green-400 border-green-500/30",
    failed: "bg-red-500/20 text-red-400 border-red-500/30",
};

function StatusBadge({ status }: { status: Run["status"] }) {
    return (
        <Badge variant="outline" className={`capitalize text-xs font-mono ${STATUS_STYLES[status]}`}>
            {status}
        </Badge>
    );
}

function fmtCost(v: number | null): string {
    if (v === null) return "N/A";
    return `$${v.toFixed(6)}`;
}

function fmtTokens(v: number | null): string {
    if (v === null) return "N/A";
    return v.toLocaleString();
}

function fmtDuration(v: number | null): string {
    if (v === null) return "N/A";
    return `${v.toFixed(2)}s`;
}

function fmtDate(s: string): string {
    return new Date(s).toLocaleString();
}

const LOG_LEVEL_STYLES: Record<string, string> = {
    info: "text-slate-300",
    debug: "text-slate-500",
    warning: "text-yellow-400",
    error: "text-red-400",
};

// ── Diff Summary ─────────────────────────────────────────────────────────────

function DiffArrow({ a, b, lower_is_better = true }: { a: number | null; b: number | null; lower_is_better?: boolean }) {
    if (a === null || b === null) return <Minus className="h-4 w-4 text-muted-foreground" />;
    const better = lower_is_better ? b < a : b > a;
    const worse = lower_is_better ? b > a : b < a;
    if (better) return <TrendingDown className="h-4 w-4 text-green-400" />;
    if (worse) return <TrendingUp className="h-4 w-4 text-red-400" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
}

// ── Run Column ────────────────────────────────────────────────────────────────

function RunColumn({ run, logs, label }: { run: Run; logs: RunLog[]; label: string }) {
    return (
        <div className="flex flex-col gap-4 min-w-0">
            {/* Header */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {label}
                    </span>
                    <StatusBadge status={run.status} />
                </div>
                <p className="text-sm font-medium leading-snug line-clamp-2">{run.task}</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded bg-muted/50 px-2 py-1.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cost</p>
                        <p className="text-sm font-mono font-medium">{fmtCost(run.cost)}</p>
                    </div>
                    <div className="rounded bg-muted/50 px-2 py-1.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tokens</p>
                        <p className="text-sm font-mono font-medium">{fmtTokens(run.total_tokens)}</p>
                    </div>
                    <div className="rounded bg-muted/50 px-2 py-1.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Duration</p>
                        <p className="text-sm font-mono font-medium">{fmtDuration(run.duration_seconds)}</p>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground">{fmtDate(run.created_at)}</p>
            </div>

            {/* Logs */}
            <div className="rounded-lg border bg-slate-950 flex flex-col h-[420px]">
                <div className="px-3 py-2 border-b border-slate-800 text-xs text-slate-400 font-mono">
                    {logs.length} log entries
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-1 font-mono text-xs">
                    {logs.length === 0 ? (
                        <p className="text-slate-600">No logs.</p>
                    ) : (
                        logs.map((log) => {
                            const ts = new Date(log.timestamp).toLocaleTimeString("en-US", {
                                hour12: false,
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                            });
                            return (
                                <div key={log.id} className="flex gap-2 leading-relaxed">
                                    <span className="text-slate-600 shrink-0">{ts}</span>
                                    <span
                                        className={`uppercase text-[10px] font-bold shrink-0 mt-px ${LOG_LEVEL_STYLES[log.level] ?? "text-slate-300"
                                            }`}
                                    >
                                        {log.level}
                                    </span>
                                    <span className={LOG_LEVEL_STYLES[log.level] ?? "text-slate-300"}>
                                        {log.message}
                                    </span>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function CompareRunsPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const run1Id = searchParams.get("run1") ?? "";
    const run2Id = searchParams.get("run2") ?? "";

    const [run1, setRun1] = useState<Run | null>(null);
    const [run2, setRun2] = useState<Run | null>(null);
    const [logs1, setLogs1] = useState<RunLog[]>([]);
    const [logs2, setLogs2] = useState<RunLog[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!run1Id || !run2Id) {
            setError("Two run IDs are required. Go back to History and select 2 runs.");
            setLoading(false);
            return;
        }

        Promise.all([
            runApi.getRun(run1Id),
            runApi.getRun(run2Id),
            runApi.getRunLogs(run1Id),
            runApi.getRunLogs(run2Id),
        ])
            .then(([r1, r2, l1, l2]) => {
                setRun1(r1);
                setRun2(r2);
                setLogs1(l1);
                setLogs2(l2);
            })
            .catch(() => setError("Failed to load one or both runs."))
            .finally(() => setLoading(false));
    }, [run1Id, run2Id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-60 text-muted-foreground">
                Loading comparison…
            </div>
        );
    }

    if (error || !run1 || !run2) {
        return (
            <div className="space-y-4">
                <Button variant="ghost" size="sm" onClick={() => navigate("/history")}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to History
                </Button>
                <Alert variant="destructive">
                    <AlertDescription>{error ?? "Unknown error"}</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Title */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => navigate("/history")}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> History
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">Run Comparison</h1>
                    <p className="text-sm text-muted-foreground">Side-by-side analysis of two agent runs</p>
                </div>
            </div>

            {/* Diff summary bar */}
            <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Run B vs Run A
                </p>
                <div className="grid grid-cols-3 gap-6 text-sm">
                    <div className="flex items-center gap-2">
                        <DiffArrow a={run1.cost} b={run2.cost} lower_is_better />
                        <div>
                            <p className="text-xs text-muted-foreground">Cost diff</p>
                            <p className="font-mono font-medium">
                                {run1.cost !== null && run2.cost !== null
                                    ? `${run2.cost <= run1.cost ? "-" : "+"}$${Math.abs(run2.cost - run1.cost).toFixed(6)}`
                                    : "N/A"}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <DiffArrow a={run1.total_tokens} b={run2.total_tokens} lower_is_better />
                        <div>
                            <p className="text-xs text-muted-foreground">Token diff</p>
                            <p className="font-mono font-medium">
                                {run1.total_tokens !== null && run2.total_tokens !== null
                                    ? `${run2.total_tokens <= run1.total_tokens ? "-" : "+"}${Math.abs(run2.total_tokens - run1.total_tokens).toLocaleString()}`
                                    : "N/A"}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <DiffArrow a={run1.duration_seconds} b={run2.duration_seconds} lower_is_better />
                        <div>
                            <p className="text-xs text-muted-foreground">Duration diff</p>
                            <p className="font-mono font-medium">
                                {run1.duration_seconds !== null && run2.duration_seconds !== null
                                    ? `${run2.duration_seconds <= run1.duration_seconds ? "-" : "+"}${Math.abs(run2.duration_seconds - run1.duration_seconds).toFixed(2)}s`
                                    : "N/A"}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Side-by-side columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <RunColumn run={run1} logs={logs1} label="Run A" />
                <RunColumn run={run2} logs={logs2} label="Run B" />
            </div>
        </div>
    );
}
