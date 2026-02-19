import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Ghost } from "lucide-react";

export default function NotFoundPage() {
    const navigate = useNavigate();
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-6 text-center">
            <Ghost className="h-16 w-16 text-muted-foreground/30" />
            <div className="space-y-2">
                <p className="text-[10px] font-mono tracking-widest text-muted-foreground/60 uppercase">
                    404
                </p>
                <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
                <p className="text-sm text-muted-foreground">
                    This page doesn't exist or has been moved.
                </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>
                Go home
            </Button>
        </div>
    );
}
