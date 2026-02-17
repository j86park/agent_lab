import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function TemplatesPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Templates</h1>
                <p className="text-muted-foreground">Start quickly with pre-configured agent templates.</p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Available Templates</CardTitle>
                    <CardDescription>Select a template to bootstrap your agent configuration.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p>Built-in templates will be implemented in Phase 5.</p>
                </CardContent>
            </Card>
        </div>
    );
}
