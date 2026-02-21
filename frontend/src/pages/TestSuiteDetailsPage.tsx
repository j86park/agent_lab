import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
    ChevronLeft,
    Plus,
    Pencil,
    Trash2,
    Loader2,
    AlertCircle,
    Play,
    Terminal,
} from "lucide-react";
import { toast } from "sonner";

import { suiteApi, type TestSuite, type TestCase } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

interface CaseFormData {
    task: string;
    expected_behavior: string;
    rubric: string;
}

const EMPTY_FORM: CaseFormData = {
    task: "",
    expected_behavior: "",
    rubric: "",
};

export default function TestSuiteDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const [suite, setSuite] = useState<TestSuite | null>(null);
    const [cases, setCases] = useState<TestCase[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Case Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingCase, setEditingCase] = useState<TestCase | null>(null);
    const [formData, setFormData] = useState<CaseFormData>(EMPTY_FORM);
    const [isSaving, setIsSaving] = useState(false);

    // Delete confirmation state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletingCase, setDeletingCase] = useState<TestCase | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Batch run state
    const [isRunningBatch, setIsRunningBatch] = useState(false);

    const fetchData = async () => {
        if (!id) return;
        setIsLoading(true);
        setError(null);
        try {
            const [suiteData, casesData] = await Promise.all([
                suiteApi.getSuite(id),
                suiteApi.getSuiteCases(id),
            ]);
            setSuite(suiteData);
            setCases(casesData.cases);
        } catch (err: any) {
            setError(err.message || "Failed to load suite details");
            toast.error("Failed to load suite details");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    const openCreateDialog = () => {
        setEditingCase(null);
        setFormData(EMPTY_FORM);
        setDialogOpen(true);
    };

    const openEditDialog = (testCase: TestCase) => {
        setEditingCase(testCase);
        setFormData({
            task: testCase.task,
            expected_behavior: testCase.expected_behavior,
            rubric: testCase.rubric || "",
        });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!id) return;
        if (!formData.task.trim()) {
            toast.error("Task description is required");
            return;
        }
        if (!formData.expected_behavior.trim()) {
            toast.error("Expected behavior is required");
            return;
        }

        setIsSaving(true);
        try {
            if (editingCase) {
                const updated = await suiteApi.updateTestCase(editingCase.id, formData);
                setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
                toast.success("Test case updated");
            } else {
                const created = await suiteApi.createTestCase(id, formData);
                setCases((prev) => [...prev, created]);
                toast.success("Test case added");
            }
            setDialogOpen(false);
        } catch (err: any) {
            toast.error(err.message || "Failed to save test case");
        } finally {
            setIsSaving(false);
        }
    };

    const openDeleteDialog = (testCase: TestCase) => {
        setDeletingCase(testCase);
        setDeleteDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!deletingCase) return;
        setIsDeleting(true);
        try {
            await suiteApi.deleteTestCase(deletingCase.id);
            setCases((prev) => prev.filter((c) => c.id !== deletingCase.id));
            toast.success("Test case deleted");
            setDeleteDialogOpen(false);
        } catch (err: any) {
            toast.error(err.message || "Failed to delete test case");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleRunBatch = async () => {
        if (!id) return;
        setIsRunningBatch(true);
        try {
            const res = await suiteApi.runSuite(id);
            toast.success(res.message);
        } catch (err: any) {
            toast.error(err.message || "Failed to trigger batch execution");
        } finally {
            setIsRunningBatch(false);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-32 w-full" />
                    ))}
                </div>
            </div>
        );
    }

    if (error || !suite) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error || "Suite not found"}</AlertDescription>
                <div className="mt-4">
                    <Button variant="outline" asChild>
                        <Link to="/test-suites">Back to Suites</Link>
                    </Button>
                </div>
            </Alert>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <Link
                    to="/test-suites"
                    className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors w-fit"
                >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Back to Test Suites
                </Link>

                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">{suite.name}</h1>
                        <p className="text-muted-foreground mt-1">
                            Evaluating Agent: <Link to={`/agents/${suite.agent_id}`} className="text-primary hover:underline font-medium">Link to Agent</Link>
                        </p>
                        {suite.description && (
                            <p className="max-w-2xl mt-3 text-sm">{suite.description}</p>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRunBatch}
                            disabled={isRunningBatch || cases.length === 0}
                        >
                            {isRunningBatch ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Play className="mr-2 h-4 w-4" />
                            )}
                            Run Batch
                        </Button>
                        <Button onClick={openCreateDialog} size="sm">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Case
                        </Button>
                    </div>
                </div>
            </div>

            <Separator />

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Test Cases ({cases.length})</h2>
                </div>

                {cases.length === 0 ? (
                    <Card className="border-dashed bg-muted/20">
                        <CardHeader className="text-center py-12">
                            <Terminal className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
                            <CardTitle>No test cases yet</CardTitle>
                            <CardDescription>
                                Add cases to define exactly what your agent should be tested against.
                            </CardDescription>
                            <div className="mt-4">
                                <Button variant="outline" onClick={openCreateDialog}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add your first case
                                </Button>
                            </div>
                        </CardHeader>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {cases.map((testCase, index) => (
                            <Card key={testCase.id} className="group overflow-hidden">
                                <CardHeader className="py-4 flex flex-row items-start justify-between">
                                    <div className="space-y-1">
                                        <Badge variant="outline" className="font-mono text-[10px] mb-1">
                                            TestCase #{index + 1}
                                        </Badge>
                                        <CardTitle className="text-base font-mono">
                                            {testCase.task}
                                        </CardTitle>
                                    </div>
                                    <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => openEditDialog(testCase)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                            onClick={() => openDeleteDialog(testCase)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="py-4 pt-0 space-y-4">
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                Expected Behavior
                                            </p>
                                            <p className="text-sm border-l-2 border-primary/30 pl-3 py-1 bg-muted/30 rounded-r">
                                                {testCase.expected_behavior}
                                            </p>
                                        </div>
                                        {testCase.rubric && (
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                    Evaluation Rubric
                                                </p>
                                                <p className="text-sm border-l-2 border-muted-foreground/30 pl-3 py-1 bg-muted/30 rounded-r text-muted-foreground italic">
                                                    {testCase.rubric}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Case Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>{editingCase ? "Edit Test Case" : "Add Test Case"}</DialogTitle>
                        <DialogDescription>
                            Define the input task and the criteria for success.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="case-task">Input Task</Label>
                            <Textarea
                                id="case-task"
                                placeholder="What should the agent do? (e.g. Write a python script to...)"
                                value={formData.task}
                                onChange={(e) => setFormData((p) => ({ ...p, task: e.target.value }))}
                                className="font-mono text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="case-expected">Expected Behavior</Label>
                            <Textarea
                                id="case-expected"
                                placeholder="What is the correct output or behavior?"
                                value={formData.expected_behavior}
                                onChange={(e) => setFormData((p) => ({ ...p, expected_behavior: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="case-rubric">Evaluation Rubric (Optional)</Label>
                            <Textarea
                                id="case-rubric"
                                placeholder="Specific grading criteria for the LLM-as-a-judge."
                                value={formData.rubric}
                                onChange={(e) => setFormData((p) => ({ ...p, rubric: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingCase ? "Update Case" : "Add Case"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Test Case?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this test case? Current evaluation results for this case
                            will be archived.
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
