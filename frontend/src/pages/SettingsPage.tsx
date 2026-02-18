import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2, KeyRound, Server } from "lucide-react";
import { toast } from "sonner";

import { settingsApi, type SettingsStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface ProviderKeyState {
    value: string;
    isSaving: boolean;
}

const PROVIDERS = [
    {
        id: "openai" as const,
        name: "OpenAI",
        statusKey: "openai_api_key_set" as keyof SettingsStatus,
        updateKey: "openai_api_key",
        placeholder: "sk-...",
        description: "Required for GPT-4o, GPT-4 Turbo, and other OpenAI models.",
    },
    {
        id: "anthropic" as const,
        name: "Anthropic",
        statusKey: "anthropic_api_key_set" as keyof SettingsStatus,
        updateKey: "anthropic_api_key",
        placeholder: "sk-ant-...",
        description: "Required for Claude 3.5 Sonnet, Haiku, and Opus models.",
    },
    {
        id: "openrouter" as const,
        name: "OpenRouter",
        statusKey: "openrouter_api_key_set" as keyof SettingsStatus,
        updateKey: "openrouter_api_key",
        placeholder: "sk-or-...",
        description: "Access 100+ models from a single API key.",
    },
];

export default function SettingsPage() {
    const [status, setStatus] = useState<SettingsStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [keys, setKeys] = useState<Record<string, ProviderKeyState>>({
        openai: { value: "", isSaving: false },
        anthropic: { value: "", isSaving: false },
        openrouter: { value: "", isSaving: false },
    });

    const fetchStatus = async () => {
        setIsLoading(true);
        try {
            const data = await settingsApi.getSettings();
            setStatus(data);
        } catch (err: any) {
            toast.error(err.message || "Failed to load settings");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    const handleSaveKey = async (provider: typeof PROVIDERS[number]) => {
        const keyValue = keys[provider.id].value.trim();
        if (!keyValue) {
            toast.error("Please enter an API key before saving");
            return;
        }

        setKeys((prev) => ({
            ...prev,
            [provider.id]: { ...prev[provider.id], isSaving: true },
        }));

        try {
            const updated = await settingsApi.updateSettings({
                [provider.updateKey]: keyValue,
            });
            setStatus(updated);
            // Clear the field after successful save
            setKeys((prev) => ({
                ...prev,
                [provider.id]: { value: "", isSaving: false },
            }));
            toast.success(`${provider.name} API key saved`);
        } catch (err: any) {
            toast.error(err.message || `Failed to save ${provider.name} key`);
            setKeys((prev) => ({
                ...prev,
                [provider.id]: { ...prev[provider.id], isSaving: false },
            }));
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Settings</h1>
                <p className="text-muted-foreground">
                    Configure your LLM provider API keys and other preferences.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <KeyRound className="h-5 w-5 text-muted-foreground" />
                        <CardTitle>LLM Provider Keys</CardTitle>
                    </div>
                    <CardDescription>
                        API keys are encrypted and stored locally. They are never sent to any external service.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        PROVIDERS.map((provider, index) => {
                            const isSet = status ? status[provider.statusKey] : false;
                            const keyState = keys[provider.id];

                            return (
                                <div key={provider.id}>
                                    {index > 0 && <Separator className="mb-6" />}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <div className="flex items-center gap-2">
                                                    <Label className="text-base font-semibold">{provider.name}</Label>
                                                    {isSet ? (
                                                        <Badge variant="secondary" className="gap-1 text-green-600">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            Configured
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="gap-1 text-muted-foreground">
                                                            <XCircle className="h-3 w-3" />
                                                            Not Set
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground">{provider.description}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Input
                                                type="password"
                                                placeholder={isSet ? "Key is set. Enter new key to update." : provider.placeholder}
                                                value={keyState.value}
                                                onChange={(e) =>
                                                    setKeys((prev) => ({
                                                        ...prev,
                                                        [provider.id]: { ...prev[provider.id], value: e.target.value },
                                                    }))
                                                }
                                                className="font-mono"
                                            />
                                            <Button
                                                onClick={() => handleSaveKey(provider)}
                                                disabled={keyState.isSaving || !keyState.value.trim()}
                                                className="shrink-0"
                                            >
                                                {keyState.isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Save
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Server className="h-5 w-5 text-muted-foreground" />
                        <CardTitle>Ollama (Local)</CardTitle>
                    </div>
                    <CardDescription>
                        Run open-source models locally with Ollama.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        <p>
                            Ollama connects to your local machine — <strong>no API key is required</strong>.
                            Make sure Ollama is running on{" "}
                            <code className="rounded bg-muted px-1 py-0.5 text-xs">http://localhost:11434</code>{" "}
                            before using Ollama models.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
