import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PlusSquare, RefreshCw, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import { agentApi, type Agent } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export default function HomePage() {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const fetchAgents = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await agentApi.getAgents();
            setAgents(data.agents);
        } catch (err: unknown) {
            console.error("Failed to fetch agents", err);
            const msg = getErrorMessage(err);
            setError(msg);
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAgents();
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Agents</h1>
                    <p className="text-muted-foreground">Manage and test your AI agents.</p>
                </div>
                <Button onClick={() => navigate("/agents/new")}>
                    <PlusSquare className="mr-2 h-4 w-4" />
                    New Agent
                </Button>
            </div>

            {isLoading ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <Card key={i} className="overflow-hidden">
                            <CardHeader className="space-y-2">
                                <Skeleton className="h-5 w-1/2" />
                                <Skeleton className="h-4 w-full" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-4 w-3/4" />
                            </CardContent>
                            <CardFooter>
                                <Skeleton className="h-8 w-1/4" />
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            ) : error ? (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription className="flex items-center gap-4">
                        {error}
                        <Button variant="outline" size="sm" onClick={fetchAgents}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Retry
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : agents.length === 0 ? (
                <Card className="border-dashed">
                    <CardHeader className="text-center">
                        <CardTitle>No agents found</CardTitle>
                        <CardDescription>
                            You haven't created any agents yet. Get started by creating your first one.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                        <Button variant="outline" onClick={() => navigate("/agents/new")}>
                            <PlusSquare className="mr-2 h-4 w-4" />
                            Create Agent
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {agents.map((agent) => (
                        <Link key={agent.id} to={`/agents/${agent.id}`}>
                            <Card className="h-full cursor-pointer transition-colors hover:bg-accent/50">
                                <CardHeader>
                                    <div className="flex items-start justify-between gap-2">
                                        <CardTitle className="line-clamp-1">{agent.name}</CardTitle>
                                        <Badge variant="secondary" className="shrink-0">
                                            {agent.provider}
                                        </Badge>
                                    </div>
                                    <CardDescription className="line-clamp-2">
                                        {agent.description || "No description provided."}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-sm text-muted-foreground">
                                        Model: <code className="text-xs">{agent.model}</code>
                                    </div>
                                </CardContent>
                                <CardFooter className="text-xs text-muted-foreground">
                                    Created {format(new Date(agent.created_at), "MMM d, yyyy")}
                                </CardFooter>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
