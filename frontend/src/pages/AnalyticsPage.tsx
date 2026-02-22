import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, TrendingUp, DollarSign, Zap, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { analyticsApi, type AnalyticsSummary, type AgentPerformance } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsPage() {
    const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
    const [agents, setAgents] = useState<AgentPerformance[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [summaryData, agentsData] = await Promise.all([
                analyticsApi.getSummary(),
                analyticsApi.getAllAgentsAnalytics()
            ]);
            setSummary(summaryData);
            setAgents(agentsData.agents);
        } catch (err: unknown) {
            console.error("Failed to fetch analytics", err);
            const msg = getErrorMessage(err) || "Failed to load analytics";
            setError(msg);
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <h1 className="text-3xl font-bold">Analytics</h1>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Card key={i}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <Skeleton className="h-4 w-24" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-8 w-16" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-32" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-32 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <h1 className="text-3xl font-bold">Analytics</h1>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription className="flex items-center gap-4">
                        {error}
                        <Button variant="outline" size="sm" onClick={fetchData}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Retry
                        </Button>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Analytics</h1>
                    <p className="text-muted-foreground">Monitor performance and costs across your agents.</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Project Spend</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${summary?.total_cost.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">across {summary?.total_runs} runs</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg. Success Rate</CardTitle>
                        <Zap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{((summary?.success_rate || 0) * 100).toFixed(1)}%</div>
                        <p className="text-xs text-muted-foreground">Goal: &gt; 90%</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary?.total_tokens.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">cumulative usage</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Most Active Agent</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold truncate" title={summary?.most_active_agent}>
                            {summary?.most_active_agent}
                        </div>
                        <p className="text-xs text-muted-foreground">by run volume</p>
                    </CardContent>
                </Card>
            </div>

            {/* Per-Agent Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Agent Performance</CardTitle>
                    <CardDescription>Detailed metrics per agent, sorted by activity.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Agent</TableHead>
                                <TableHead>Provider</TableHead>
                                <TableHead className="text-right">Runs</TableHead>
                                <TableHead className="text-right">Success Rate</TableHead>
                                <TableHead className="text-right">Total Cost</TableHead>
                                <TableHead className="text-right">Avg. Tokens</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {agents.map((agent) => (
                                <TableRow key={agent.agent_id}>
                                    <TableCell className="font-medium">
                                        <Link to={`/agents/${agent.agent_id}`} className="hover:underline">
                                            {agent.agent_name}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{agent.provider}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">{agent.total_runs}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
                                                <div
                                                    className="h-full bg-primary"
                                                    style={{ width: `${agent.success_rate * 100}%` }}
                                                />
                                            </div>
                                            {(agent.success_rate * 100).toFixed(0)}%
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">${agent.total_cost.toFixed(4)}</TableCell>
                                    <TableCell className="text-right">
                                        {(agent.total_tokens / agent.total_runs || 0).toFixed(0)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
