import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import type { Agent } from "@/lib/api";

interface AgentBasicInfoProps {
    formData: Partial<Agent>;
    handleInputChange: (field: keyof Agent, value: string | number | boolean | object | null | undefined) => void;
}

export function AgentBasicInfo({ formData, handleInputChange }: AgentBasicInfoProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Configuration</CardTitle>
                <CardDescription>Basic personality and identity of your agent.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                        id="name"
                        placeholder="e.g. Researcher Bot"
                        value={formData.name || ""}
                        onChange={(e) => handleInputChange("name", e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                        id="description"
                        placeholder="What does this agent do?"
                        value={formData.description || ""}
                        onChange={(e) => handleInputChange("description", e.target.value)}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
