import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { agentApi, runApi, type Agent, type Run } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
    GitCompareArrows,
    Trash2,
    ExternalLink,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Tag,
} from "lucide-react";

// ── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
}

function fmtCost(v: number | null): string {
    if (v === null) return "—";
    return `$${v.toFixed(6)}`;
}

function fmtTokens(v: number | null): string {
    if (v === null) return "—";
    return v.toLocaleString();
}

function fmtDuration(v: number | null): string {
    if (v === null) return "—";
    return `${v.toFixed(1)}s`;
}

// ── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<Run["status"], string> = {
    pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    running: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    completed: "bg-green-500/20 text-green-400 border-green-500/30",
    failed: "bg-red-500/20 text-red-400 border-red-500/30",
};

function StatusBadge({ status }: { status: Run["status"] }) {
    return (
        <Badge
            variant="outline"
            className={`capitalize text-xs font-mono ${STATUS_STYLES[status]}`}
        >
            {status}
        </Badge>
    );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

// ── Main Component ────────────────────────────────────────────────────────────

export default function HistoryPage() {
    const navigate = useNavigate();

    // Data
    const [runs, setRuns] = useState<Run[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [agentFilter, setAgentFilter] = useState<string>("all");
    const [tagFilter, setTagFilter] = useState<string>("");
    const [page, setPage] = useState(0);

    // Comparison selection (max 2)
    const [selected, setSelected] = useState<Set<string>>(new Set());

    // ── Loaders ────────────────────────────────────────────────────────────

    const loadAgents = useCallback(async () => {
        try {
            const res = await agentApi.getAgents(0, 100);
            setAgents(res.agents);
        } catch {
            // non-fatal — filter just won't populate
        }
    }, []);

    const loadRuns = useCallback(async () => {
        setLoading(true);
        try {
            const agentId = agentFilter !== "all" ? agentFilter : undefined;
            const res = await runApi.listRuns(agentId, page * PAGE_SIZE, PAGE_SIZE, tagFilter || undefined);
            // client-side status filter (API doesn't support it yet)
            const filtered =
                statusFilter === "all"
                    ? res.runs
                    : res.runs.filter((r) => r.status === statusFilter);
            setRuns(filtered);
            setTotal(res.total);
        } catch {
            toast.error("Failed to load run history");
        } finally {
            setLoading(false);
        }
    }, [agentFilter, statusFilter, page, tagFilter]);

    useEffect(() => {
        loadAgents();
    }, [loadAgents]);

    useEffect(() => {
        setPage(0);
    }, [statusFilter, agentFilter, tagFilter]);

    useEffect(() => {
        loadRuns();
    }, [loadRuns]);

    // ── Actions ────────────────────────────────────────────────────────────

    function toggleSelect(id: string) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else if (next.size < 2) {
                next.add(id);
            } else {
                toast.info("Select at most 2 runs to compare");
            }
            return next;
        });
    }

    function handleCompare() {
        const [a, b] = [...selected];
        navigate(`/history/compare?run1=${a}&run2=${b}`);
    }

    async function handleDelete(id: string, e: React.MouseEvent<HTMLButtonElement>) {
        e.stopPropagation();
        if (!confirm("Delete this run and its logs?")) return;
        try {
            await runApi.deleteRun(id);
            toast.success("Run deleted");
            loadRuns();
            setSelected((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        } catch {
            toast.error("Failed to delete run");
        }
    }

    // ── Agent name lookup ──────────────────────────────────────────────────

    const agentMap = new Map(agents.map((a) => [a.id, a.name]));

    // ── Pagination ─────────────────────────────────────────────────────────

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    // ── Render ─────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">History</h1>
                    <p className="text-muted-foreground">
                        Review past agent runs and compare results.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {selected.size === 2 && (
                        <Button onClick={handleCompare} variant="default" size="sm">
                            <GitCompareArrows className="mr-2 h-4 w-4" />
                            Compare 2 Runs
                        </Button>
                    )}
                    <Button onClick={loadRuns} variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="running">Running</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={agentFilter} onValueChange={setAgentFilter}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Agent" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Agents</SelectItem>
                        {agents.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                                {a.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="relative">
                    <SelectTrigger className="w-[100px] h-9 absolute left-0 opacity-0 pointer-events-none" /> {/* Spacer for consistent layout if needed */}
                    <Input
                        placeholder="Filter by tag..."
                        className="w-[200px] h-9 pl-8"
                        value={tagFilter}
                        onChange={(e) => setTagFilter(e.target.value)}
                    />
                    <Tag className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>

                {selected.size > 0 && (
                    <p className="text-sm text-muted-foreground self-center">
                        {selected.size}/2 selected for comparison
                    </p>
                )}
            </div>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center h-40 text-muted-foreground">
                            Loading…
                        </div>
                    ) : runs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
                            <p>No runs found.</p>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate("/agents")}
                            >
                                Go to Agents
                            </Button>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-8" />
                                    <TableHead>Status</TableHead>
                                    <TableHead>Agent</TableHead>
                                    <TableHead>Task</TableHead>
                                    <TableHead className="text-right">Cost</TableHead>
                                    <TableHead className="text-right">Tokens</TableHead>
                                    <TableHead className="text-right">Duration</TableHead>
                                    <TableHead className="text-right">Started</TableHead>
                                    <TableHead className="w-20" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {runs.map((run) => {
                                    const isSelected = selected.has(run.id);
                                    return (
                                        <TableRow
                                            key={run.id}
                                            className={`cursor-pointer hover:bg-muted/50 transition-colors ${isSelected ? "bg-primary/5 border-l-2 border-primary" : ""
                                                }`}
                                            onClick={() => navigate(`/runs/${run.id}`)}
                                        >
                                            {/* Checkbox */}
                                            <TableCell
                                                onClick={(e: React.MouseEvent<HTMLTableCellElement>) => {
                                                    e.stopPropagation();
                                                    toggleSelect(run.id);
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelect(run.id)}
                                                    className="h-4 w-4 rounded border-border"
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <StatusBadge status={run.status} />
                                            </TableCell>
                                            <TableCell className="max-w-[120px] truncate text-sm text-muted-foreground">
                                                {agentMap.get(run.agent_id) ?? run.agent_id.slice(0, 8)}
                                            </TableCell>
                                            <TableCell className="max-w-[260px] truncate text-sm">
                                                {run.task}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-sm">
                                                {fmtCost(run.cost)}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-sm">
                                                {fmtTokens(run.total_tokens)}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-sm">
                                                {fmtDuration(run.duration_seconds)}
                                            </TableCell>
                                            <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                                                {relativeTime(run.created_at)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/runs/${run.id}`);
                                                        }}
                                                        title="View run"
                                                    >
                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                                        onClick={(e) => handleDelete(run.id, e)}
                                                        title="Delete run"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Pagination */}
            {!loading && runs.length > 0 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                        Page {page + 1} of {totalPages}
                    </span>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page === 0}
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Prev
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page >= totalPages - 1}
                            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                        >
                            Next
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
