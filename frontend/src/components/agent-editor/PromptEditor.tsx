import { useRef, useState } from "react";
import { Eye, BookTemplate, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { PromptPreview } from "@/components/PromptPreview";
import { PromptLibrary } from "@/components/PromptLibrary";
import type { Agent } from "@/lib/api";

interface PromptEditorProps {
    formData: Partial<Agent>;
    isEditMode: boolean;
    id?: string;
    handleInputChange: (field: keyof Agent, value: string | number | boolean | object | null | undefined) => void;
}

export function PromptEditor({ formData, isEditMode, id, handleInputChange }: PromptEditorProps) {
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);
    const systemPromptRef = useRef<HTMLTextAreaElement>(null);

    const handleInsertSnippet = (content: string) => {
        const textarea = systemPromptRef.current;
        if (!textarea) {
            handleInputChange("system_prompt", (formData.system_prompt || "") + "\n" + content);
            return;
        }

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = formData.system_prompt || "";
        const before = text.substring(0, start);
        const after = text.substring(end);
        const newValue = before + content + after;

        handleInputChange("system_prompt", newValue);

        setTimeout(() => {
            textarea.focus();
            const newPos = start + content.length;
            textarea.setSelectionRange(newPos, newPos);
        }, 0);
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>System Prompt</CardTitle>
                    <CardDescription>The core instructions that define the agent's behavior.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="prompt">Prompt Content</Label>
                            {isEditMode && id && (
                                <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                                    <DialogTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 gap-2 text-muted-foreground hover:text-primary"
                                            onClick={() => setPreviewRefreshKey(k => k + 1)}
                                        >
                                            <Eye className="h-4 w-4" />
                                            Preview Resolved
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-3xl">
                                        <DialogHeader>
                                            <DialogTitle>Prompt Preview</DialogTitle>
                                            <DialogDescription>
                                                This shows the final prompt sent to the LLM, including all resolved template variables and attached skills.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <PromptPreview agentId={id} triggerRefresh={previewRefreshKey} />
                                        <DialogFooter>
                                            <Button onClick={() => setIsPreviewOpen(false)}>Close</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </div>
                        <div className="relative">
                            <Textarea
                                id="prompt"
                                ref={systemPromptRef}
                                className="min-h-[400px] font-mono text-sm pr-12"
                                placeholder="You are an expert in..."
                                value={formData.system_prompt}
                                onChange={(e) => handleInputChange("system_prompt", e.target.value)}
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-2 top-2 h-8 w-8 text-muted-foreground hover:text-primary"
                                onClick={() => setIsLibraryOpen(!isLibraryOpen)}
                                title="Toggle Snippet Library"
                            >
                                <BookTemplate className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {isLibraryOpen && (
                <div className="fixed right-0 top-0 bottom-0 w-80 bg-background border-l border-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
                    <div className="p-4 border-b flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <BookTemplate className="h-5 w-5 text-primary" />
                            <h2 className="font-bold">Snippet Library</h2>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsLibraryOpen(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="flex-1 p-4 overflow-hidden">
                        <PromptLibrary onInsert={handleInsertSnippet} />
                    </div>
                </div>
            )}
        </>
    );
}
