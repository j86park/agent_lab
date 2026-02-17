import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function RunDashboardPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Run Dashboard</h1>
                <p className="text-muted-foreground">Monitor your agent's execution in real-time.</p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Live Execution</CardTitle>
                    <CardDescription>View real-time logs and performance metrics.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p>The real-time run dashboard will be implemented in Phase 4.</p>
                </CardContent>
            </Card>
        </div>
    );
}
