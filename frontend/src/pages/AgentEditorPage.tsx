import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function AgentEditorPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Agent Editor</h1>
                <p className="text-muted-foreground">Configure your agent's personality, tools, and constraints.</p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Configuration</CardTitle>
                    <CardDescription>Configure the system prompt and model settings.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p>The agent configuration form will be implemented in Phase 2.</p>
                </CardContent>
            </Card>
        </div>
    );
}
