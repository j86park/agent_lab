import { FolderOpen, RefreshCw, Trash2 } from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import type { WorkspaceFile } from "@/lib/api";

interface WorkspaceMonitorProps {
    files: WorkspaceFile[];
    isLoading: boolean;
    onRefresh: () => void;
    onDelete: (filename: string) => void;
}

export function WorkspaceMonitor({ files, isLoading, onRefresh, onDelete }: WorkspaceMonitorProps) {
    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <FolderOpen className="h-4 w-4" />
                            Workspace
                            {files.length > 0 && (
                                <span className="text-xs font-normal text-muted-foreground">
                                    ({files.length} file{files.length !== 1 ? "s" : ""})
                                </span>
                            )}
                        </CardTitle>
                        <CardDescription className="mt-1">
                            Persistent files available in every run.
                        </CardDescription>
                    </div>
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={isLoading}
                        className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                        title="Refresh"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </CardHeader>
            <CardContent>
                {files.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                        No workspace files yet. Attach files when starting a run.
                    </p>
                ) : (
                    <ul className="space-y-1">
                        {files.map((f) => (
                            <li
                                key={f.name}
                                className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs"
                            >
                                <span className="font-mono truncate max-w-[150px]" title={f.name}>
                                    {f.name}
                                </span>
                                <span className="text-muted-foreground ml-2 shrink-0">
                                    {f.size_bytes < 1024
                                        ? `${f.size_bytes} B`
                                        : f.size_bytes < 1024 * 1024
                                            ? `${(f.size_bytes / 1024).toFixed(1)} KB`
                                            : `${(f.size_bytes / 1024 / 1024).toFixed(1)} MB`}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => onDelete(f.name)}
                                    className="ml-2 shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                                    title="Delete file"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
