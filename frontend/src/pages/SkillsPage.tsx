import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function SkillsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Skills Library</h1>
                <p className="text-muted-foreground">Manage reusable instruction blocks for your agents.</p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Reusable Skills</CardTitle>
                    <CardDescription>Create and edit skills that can be assigned to multiple agents.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p>The skills library management will be implemented in Phase 2.</p>
                </CardContent>
            </Card>
        </div>
    );
}
