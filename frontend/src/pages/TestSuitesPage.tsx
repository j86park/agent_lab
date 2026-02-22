import { getErrorMessage } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PlusSquare, Trash2, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { suiteApi, agentApi, type TestSuite, type Agent } from "@/lib/api";
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

interface SuiteFormData {
    name: string;
    description: string;
    agent_id: string;
}

const EMPTY_FORM: SuiteFormData = {
    name: "",
    description: "",
    agent_id: "",
};

export default function TestSuitesPage() {
    const [suites, setSuites] = useState<TestSuite[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [formData, setFormData] = useState<SuiteFormData>(EMPTY_FORM);
    const [isSaving, setIsSaving] = useState(false);

    // Delete confirmation state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletingSuite, setDeletingSuite] = useState<TestSuite | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [suitesData, agentsData] = await Promise.all([
                suiteApi.getSuites(),
                agentApi.getAgents(),
            ]);
            setSuites(suitesData.suites);
            setAgents(agentsData.agents);
        } catch (err) {
            setError(getErrorMessage(err) || "Failed to load data");
            toast.error("Failed to load data");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const openCreateDialog = () => {
        setFormData(EMPTY_FORM);
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!formData.name.trim()) {
            toast.error("Suite name is required");
            return;
        }
        if (!formData.agent_id) {
            toast.error("Agent selection is required");
            return;
        }

        setIsSaving(true);
        try {
            const created = await suiteApi.createSuite(formData);
            setSuites((prev) => [created, ...prev]);
            toast.success("Test suite created");
            setDialogOpen(false);
        } catch (err) {
            toast.error(getErrorMessage(err) || "Failed to create suite");
        } finally {
            setIsSaving(false);
        }
    };

    const openDeleteDialog = (suite: TestSuite, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDeletingSuite(suite);
        setDeleteDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!deletingSuite) return;
        setIsDeleting(true);
        try {
            await suiteApi.deleteSuite(deletingSuite.id);
            setSuites((prev) => prev.filter((s) => s.id !== deletingSuite.id));
            toast.success("Test suite deleted");
            setDeleteDialogOpen(false);
        } catch (err) {
            toast.error(getErrorMessage(err) || "Failed to delete suite");
        } finally {
            setIsDeleting(false);
        }
    };

    const getAgentName = (agentId: string) => {
        return agents.find((a) => a.id === agentId)?.name || "Unknown Agent";
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Test Suites</h1>
                    <p className="text-muted-foreground">
                        Define evaluation protocols and test cases to measure agent quality.
                    </p>
                </div>
                <Button onClick={openCreateDialog}>
                    <PlusSquare className="mr-2 h-4 w-4" />
                    New Suite
                </Button>
            </div>

            {isLoading ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <Card key={i}>
                            <CardHeader className="space-y-2">
                                <Skeleton className="h-5 w-1/2" />
                                <Skeleton className="h-4 w-full" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-12 w-full" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : error ? (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : suites.length === 0 ? (
                <Card className="border-dashed">
                    <CardHeader className="text-center">
                        <CardTitle>No test suites yet</CardTitle>
                        <CardDescription>
                            Create a test suite to start evaluating your agents.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                        <Button variant="outline" onClick={openCreateDialog}>
                            <PlusSquare className="mr-2 h-4 w-4" />
                            Create Suite
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {suites.map((suite) => (
                        <Link key={suite.id} to={`/test-suites/${suite.id}`}>
                            <Card className="flex flex-col h-full hover:border-primary/50 transition-colors cursor-pointer group">
                                <CardHeader>
                                    <div className="flex items-start justify-between gap-2">
                                        <CardTitle className="line-clamp-1 text-lg group-hover:text-primary transition-colors">
                                            {suite.name}
                                        </CardTitle>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={(e) => openDeleteDialog(suite, e)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <CardDescription className="flex items-center gap-1.5 mt-1">
                                        <span className="font-medium text-foreground/70">
                                            Agent: {getAgentName(suite.agent_id)}
                                        </span>
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1">
                                    {suite.description && (
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                            {suite.description}
                                        </p>
                                    )}
                                    <div className="mt-4 flex items-center text-xs font-medium text-primary">
                                        View details & cases
                                        <ArrowRight className="ml-1 h-3 w-3" />
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}

            {/* Create Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>New Test Suite</DialogTitle>
                        <DialogDescription>
                            Define a new collection of test cases for an agent.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="suite-agent">Target Agent</Label>
                            <Select
                                value={formData.agent_id}
                                onValueChange={(val) => setFormData((p) => ({ ...p, agent_id: val }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select an agent..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {agents.map((agent) => (
                                        <SelectItem key={agent.id} value={agent.id}>
                                            {agent.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="suite-name">Suite Name</Label>
                            <Input
                                id="suite-name"
                                placeholder="e.g. Robustness Tests"
                                value={formData.name}
                                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="suite-desc">Description (Optional)</Label>
                            <Textarea
                                id="suite-desc"
                                placeholder="What is the goal of this test suite?"
                                value={formData.description}
                                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Suite
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Test Suite?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <strong>{deletingSuite?.name}</strong>? This will also
                            delete all associated test cases and evaluation results.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
