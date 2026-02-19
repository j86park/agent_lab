import React from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export default class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    ErrorBoundaryState
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error("[ErrorBoundary]", error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-screen gap-6 text-center px-8">
                    <AlertCircle className="h-12 w-12 text-destructive/70" />
                    <div className="space-y-2 max-w-md">
                        <p className="text-[10px] font-mono tracking-widest text-muted-foreground/60 uppercase">
                            Runtime Error
                        </p>
                        <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
                        <p className="text-xs text-muted-foreground font-mono bg-muted/50 rounded px-3 py-2 text-left break-words">
                            {this.state.error?.message ?? "Unknown error"}
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.reload()}
                    >
                        Reload page
                    </Button>
                </div>
            );
        }
        return this.props.children;
    }
}
