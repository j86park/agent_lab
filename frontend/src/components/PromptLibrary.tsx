import { useEffect, useState } from "react";
import { Loader2, Plus, Search, Terminal } from "lucide-react";
import { toast } from "sonner";

import { snippetApi, type PromptSnippet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";

interface PromptLibraryProps {
    onInsert: (content: string) => void;
}

export function PromptLibrary({ onInsert }: PromptLibraryProps) {
    const [snippets, setSnippets] = useState<PromptSnippet[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        const fetchSnippets = async () => {
            setIsLoading(true);
            try {
                const data = await snippetApi.getSnippets();
                setSnippets(data.snippets);
            } catch (err: any) {
                console.error("Failed to fetch snippets", err);
                toast.error("Failed to load snippet library");
            } finally {
                setIsLoading(false);
            }
        };
        fetchSnippets();
    }, []);

    const filteredSnippets = snippets.filter((s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full space-y-4">
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search snippets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                />
            </div>

            <ScrollArea className="flex-1">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin mb-2" />
                        <p className="text-sm">Loading library...</p>
                    </div>
                ) : filteredSnippets.length === 0 ? (
                    <div className="text-center py-12 text-sm text-muted-foreground border rounded-lg bg-muted/20">
                        {searchQuery ? "No matching snippets" : "Library is empty"}
                    </div>
                ) : (
                    <div className="space-y-3 pr-4">
                        {filteredSnippets.map((snippet) => (
                            <Card key={snippet.id} className="group overflow-hidden">
                                <CardContent className="p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Terminal className="h-3.5 w-3.5 text-primary" />
                                            <span className="text-sm font-semibold truncate max-w-[140px]">
                                                {snippet.name}
                                            </span>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => {
                                                onInsert(snippet.content);
                                                toast.success("Snippet inserted");
                                            }}
                                            title="Insert into prompt"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="text-[11px] font-mono text-muted-foreground line-clamp-3 bg-muted/40 p-1.5 rounded border border-border/50">
                                        {snippet.content}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </ScrollArea>

            <div className="pt-2 border-t text-[10px] text-muted-foreground italic">
                Manage snippets in the "Prompt Snippets" section of the dashboard.
            </div>
        </div>
    );
}
