import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function HomePage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Agents</h1>
                <p className="text-muted-foreground">Manage and test your AI agents.</p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Welcome to Agent Lab</CardTitle>
                    <CardDescription>You haven't created any agents yet.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p>Click "New Agent" in the sidebar to get started.</p>
                </CardContent>
            </Card>
        </div>
    );
}
