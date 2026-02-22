import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

interface ConstraintSettingsProps {
    constraintsConfig: string;
    handleInputChange: (field: "constraints_config", value: string) => void;
}

export function ConstraintSettings({ constraintsConfig, handleInputChange }: ConstraintSettingsProps) {
    const constraints = JSON.parse(constraintsConfig || "{}");

    const updateConstraint = (field: string, value: number) => {
        const updated = { ...constraints, [field]: value };
        handleInputChange("constraints_config", JSON.stringify(updated));
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Constraints</CardTitle>
                <CardDescription>Runtime limits and cost controls.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="max_tokens">Max Tokens</Label>
                    <Input
                        id="max_tokens"
                        type="number"
                        value={constraints.max_tokens}
                        onChange={(e) => updateConstraint("max_tokens", parseInt(e.target.value))}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="timeout">Timeout (seconds)</Label>
                    <Input
                        id="timeout"
                        type="number"
                        value={constraints.timeout_seconds}
                        onChange={(e) => updateConstraint("timeout_seconds", parseInt(e.target.value))}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="max_cost">Max Cost ($)</Label>
                    <Input
                        id="max_cost"
                        type="number"
                        step="0.01"
                        value={constraints.max_cost}
                        onChange={(e) => updateConstraint("max_cost", parseFloat(e.target.value))}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
