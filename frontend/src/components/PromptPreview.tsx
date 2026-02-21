import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { agentApi } from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface PromptPreviewProps {
    agentId: string;
    triggerRefresh?: number;
}

export function PromptPreview({ agentId, triggerRefresh = 0 }: PromptPreviewProps) {
    const [preview, setPreview] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchPreview = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await agentApi.getPromptPreview(agentId);
            setPreview(data.prompt);
        } catch (err: any) {
            console.error("Failed to fetch prompt preview", err);
            setError(err.message || "Failed to load preview");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (agentId) {
            fetchPreview();
        }
    }, [agentId, triggerRefresh]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mb-2" />
                <p className="text-sm">Resolving variables and skills...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 text-destructive bg-destructive/10 rounded-md text-sm">
                <p className="font-semibold">Error</p>
                <p>{error}</p>
                <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={fetchPreview}
                >
                    <RefreshCw className="mr-2 h-3 w-3" />
                    Retry
                </Button>
            </div>
        );
    }

    if (!preview) {
        return (
            <div className="p-8 text-center text-muted-foreground text-sm italic">
                No prompt content to preview.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Final System Prompt
                </h4>
                <Button variant="ghost" size="sm" onClick={fetchPreview}>
                    <RefreshCw className="h-3 w-3" />
                </Button>
            </div>
            <ScrollArea className="h-[400px] w-full rounded-md border bg-black p-4">
                <pre className="font-mono text-sm text-green-400 whitespace-pre-wrap">
                    {preview}
                </pre>
            </ScrollArea>
        </div>
    );
}
