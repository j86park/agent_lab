import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import type { Agent, ModelMetadata } from "@/lib/api";

const PROVIDERS = [
    { id: "openai", name: "OpenAI" },
    { id: "anthropic", name: "Anthropic" },
    { id: "openrouter", name: "OpenRouter" },
    { id: "ollama", name: "Ollama (Local)" },
];

const MODELS: Record<string, { id: string; name: string }[]> = {
    openai: [
        { id: "gpt-4o", name: "GPT-4o" },
        { id: "gpt-4o-mini", name: "GPT-4o mini" },
        { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
        { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
    ],
    anthropic: [
        { id: "claude-3-5-sonnet-20240620", name: "Claude 3.5 Sonnet" },
        { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" },
        { id: "claude-3-opus-20240229", name: "Claude 3 Opus" },
    ],
    openrouter: [
        { id: "openai/gpt-4o", name: "OpenAI: GPT-4o" },
        { id: "anthropic/claude-3.5-sonnet", name: "Anthropic: Claude 3.5 Sonnet" },
        { id: "google/gemini-pro-1.5", name: "Google: Gemini Pro 1.5" },
        { id: "meta-llama/llama-3-70b-instruct", name: "Meta: Llama 3 70B" },
    ],
    ollama: [
        { id: "llama3", name: "Llama 3" },
        { id: "codellama", name: "Code Llama" },
        { id: "mistral", name: "Mistral" },
        { id: "phi3", name: "Phi-3" },
    ],
};

interface ModelProviderSettingsProps {
    formData: Partial<Agent>;
    modelsMetadata: ModelMetadata[];
    costEstimate: { cost: number; high: boolean };
    handleInputChange: (field: keyof Agent, value: any) => void;
}

export function ModelProviderSettings({ formData, modelsMetadata, costEstimate, handleInputChange }: ModelProviderSettingsProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Model &amp; Provider</CardTitle>
                <CardDescription>Select the brain for your agent.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select
                        value={formData.provider}
                        onValueChange={(v) => handleInputChange("provider", v)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select Provider" />
                        </SelectTrigger>
                        <SelectContent>
                            {PROVIDERS.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>Model</Label>
                    <Select
                        value={formData.model}
                        onValueChange={(v) => handleInputChange("model", v)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select Model" />
                        </SelectTrigger>
                        <SelectContent>
                            {(MODELS[formData.provider || "openai"] || []).map((m) => {
                                const meta = modelsMetadata.find(meta => meta.id === m.id);
                                const pricingLabel = meta
                                    ? `(${(meta.input_price_1m / 1000).toFixed(3)} / ${(meta.output_price_1m / 1000).toFixed(3)} per 1k)`
                                    : "";
                                return (
                                    <SelectItem key={m.id} value={m.id}>
                                        <div className="flex items-center justify-between w-full gap-2">
                                            <span>{m.name}</span>
                                            <span className="text-[10px] text-muted-foreground tabular-nums">
                                                {pricingLabel}
                                            </span>
                                        </div>
                                    </SelectItem>
                                );
                            })}
                        </SelectContent>
                    </Select>
                </div>

                {costEstimate.cost > 0 && (
                    <div className="rounded-md border p-3 space-y-2 bg-muted/30">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Est. Cost (Max tokens)</span>
                            <span className={costEstimate.high ? "text-orange-500 font-bold" : "text-foreground"}>
                                ${costEstimate.cost.toFixed(4)}
                            </span>
                        </div>
                        {costEstimate.high && (
                            <Alert variant="default" className="border-orange-500/50 bg-orange-500/10 py-2">
                                <AlertCircle className="h-3 w-3 text-orange-500" />
                                <AlertDescription className="text-[10px] text-orange-700">
                                    This model might be expensive for long runs.
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
