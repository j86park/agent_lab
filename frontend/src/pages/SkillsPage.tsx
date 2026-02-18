import { useEffect, useState } from "react";
import { PlusSquare, Pencil, Trash2, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { skillApi, type Skill } from "@/lib/api";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

interface SkillFormData {
    name: string;
    description: string;
    instructions: string;
}

const EMPTY_FORM: SkillFormData = {
    name: "",
    description: "",
    instructions: "",
};

export default function SkillsPage() {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
    const [formData, setFormData] = useState<SkillFormData>(EMPTY_FORM);
    const [isSaving, setIsSaving] = useState(false);

    // Delete confirmation state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletingSkill, setDeletingSkill] = useState<Skill | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchSkills = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await skillApi.getSkills();
            setSkills(data.skills);
        } catch (err: any) {
            setError(err.message || "Failed to load skills");
            toast.error("Failed to load skills");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSkills();
    }, []);

    const openCreateDialog = () => {
        setEditingSkill(null);
        setFormData(EMPTY_FORM);
        setDialogOpen(true);
    };

    const openEditDialog = (skill: Skill) => {
        setEditingSkill(skill);
        setFormData({
            name: skill.name,
            description: skill.description || "",
            instructions: skill.instructions,
        });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!formData.name.trim()) {
            toast.error("Skill name is required");
            return;
        }

        setIsSaving(true);
        try {
            if (editingSkill) {
                const updated = await skillApi.updateSkill(editingSkill.id, formData);
                setSkills((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
                toast.success("Skill updated");
            } else {
                const created = await skillApi.createSkill(formData);
                setSkills((prev) => [created, ...prev]);
                toast.success("Skill created");
            }
            setDialogOpen(false);
        } catch (err: any) {
            toast.error(err.message || "Failed to save skill");
        } finally {
            setIsSaving(false);
        }
    };

    const openDeleteDialog = (skill: Skill) => {
        setDeletingSkill(skill);
        setDeleteDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!deletingSkill) return;
        setIsDeleting(true);
        try {
            await skillApi.deleteSkill(deletingSkill.id);
            setSkills((prev) => prev.filter((s) => s.id !== deletingSkill.id));
            toast.success("Skill deleted");
            setDeleteDialogOpen(false);
        } catch (err: any) {
            toast.error(err.message || "Failed to delete skill");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Skills</h1>
                    <p className="text-muted-foreground">
                        Reusable instruction blocks that can be attached to agents.
                    </p>
                </div>
                <Button onClick={openCreateDialog}>
                    <PlusSquare className="mr-2 h-4 w-4" />
                    New Skill
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
                                <Skeleton className="h-16 w-full" />
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
            ) : skills.length === 0 ? (
                <Card className="border-dashed">
                    <CardHeader className="text-center">
                        <CardTitle>No skills yet</CardTitle>
                        <CardDescription>
                            Create reusable instruction blocks to attach to your agents.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                        <Button variant="outline" onClick={openCreateDialog}>
                            <PlusSquare className="mr-2 h-4 w-4" />
                            Create Skill
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {skills.map((skill) => (
                        <Card key={skill.id} className="flex flex-col">
                            <CardHeader>
                                <div className="flex items-start justify-between gap-2">
                                    <CardTitle className="line-clamp-1 text-lg">{skill.name}</CardTitle>
                                    <div className="flex shrink-0 gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => openEditDialog(skill)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                            onClick={() => openDeleteDialog(skill)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                {skill.description && (
                                    <CardDescription className="line-clamp-2">
                                        {skill.description}
                                    </CardDescription>
                                )}
                            </CardHeader>
                            <CardContent className="flex-1">
                                <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-hidden line-clamp-4 whitespace-pre-wrap">
                                    {skill.instructions || "No instructions provided."}
                                </pre>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create / Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>{editingSkill ? "Edit Skill" : "New Skill"}</DialogTitle>
                        <DialogDescription>
                            {editingSkill
                                ? "Update the skill's name, description, and instructions."
                                : "Create a reusable instruction block for your agents."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="skill-name">Name</Label>
                            <Input
                                id="skill-name"
                                placeholder="e.g. Code Review Expert"
                                value={formData.name}
                                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="skill-desc">Description</Label>
                            <Textarea
                                id="skill-desc"
                                placeholder="What does this skill do?"
                                value={formData.description}
                                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="skill-instructions">Instructions</Label>
                            <Textarea
                                id="skill-instructions"
                                className="min-h-[200px] font-mono text-sm"
                                placeholder="When reviewing code, always check for..."
                                value={formData.instructions}
                                onChange={(e) => setFormData((p) => ({ ...p, instructions: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingSkill ? "Update Skill" : "Create Skill"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Skill?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <strong>{deletingSkill?.name}</strong>? This action
                            cannot be undone.
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
