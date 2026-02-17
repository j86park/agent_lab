import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function HistoryPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">History</h1>
                <p className="text-muted-foreground">Review your past agent runs and compare results.</p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Previous Runs</CardTitle>
                    <CardDescription>A list of all completed and failed agent executions.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p>The run history view will be implemented in Phase 5.</p>
                </CardContent>
            </Card>
        </div>
    );
}
