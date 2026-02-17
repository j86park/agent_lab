import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function SettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Settings</h1>
                <p className="text-muted-foreground">Manage your API keys and global preferences.</p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>API Keys</CardTitle>
                    <CardDescription>Configure credentials for LLM providers.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p>The settings and secrets management will be implemented in Phase 2.</p>
                </CardContent>
            </Card>
        </div>
    );
}
