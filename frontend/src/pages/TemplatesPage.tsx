import { getErrorMessage } from "@/lib/utils";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { agentApi } from "@/lib/api";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MessageSquare, Code, BarChart3, Loader2, Sparkles } from "lucide-react";

// ── Template definitions ──────────────────────────────────────────────────────

interface Template {
    id: string;
    icon: React.ElementType;
    iconColor: string;
    name: string;
    description: string;
    system_prompt: string;
    provider: string;
    model: string;
    tools: string[];
    tags: string[];
}

const TEMPLATES: Template[] = [
    {
        id: "qa-agent",
        icon: MessageSquare,
        iconColor: "text-blue-400",
        name: "Q&A Agent",
        description:
            "A general-purpose question-answering assistant that provides clear, accurate, and comprehensive answers on any topic.",
        system_prompt: `You are a knowledgeable and helpful assistant. Your goal is to provide clear, accurate, and well-structured answers to any question asked.

Guidelines:
- Always be truthful — if you are uncertain, say so
- Break complex topics down into easy-to-understand explanations
- Cite key concepts and reasoning behind your answers
- Ask for clarification if the question is ambiguous
- Keep responses concise yet complete`,
        provider: "openai",
        model: "gpt-4o",
        tools: [],
        tags: ["general", "assistant"],
    },
    {
        id: "code-helper",
        icon: Code,
        iconColor: "text-green-400",
        name: "Code Helper",
        description:
            "A coding assistant that writes, reviews, debugs, and explains code across multiple languages with best practices.",
        system_prompt: `You are an expert software engineer and coding assistant. You write clean, efficient, and well-documented code.

Guidelines:
- Write idiomatic code for the language being used
- Always include brief inline comments for non-obvious logic
- When reviewing code, point out bugs, security issues, and opportunities to improve readability or performance
- Explain your reasoning for significant design choices
- Follow SOLID principles and modern best practices
- When asked to debug, reproduce the issue mentally before suggesting a fix
- Prefer existing standard library functions over reinventing the wheel`,
        provider: "openai",
        model: "gpt-4o",
        tools: ["code_execute", "file_read", "file_write"],
        tags: ["coding", "engineering"],
    },
    {
        id: "data-analyst",
        icon: BarChart3,
        iconColor: "text-purple-400",
        name: "Data Analyst",
        description:
            "An analytical assistant that processes data, extracts insights, identifies trends, and produces clear reports.",
        system_prompt: `You are a skilled data analyst. You excel at turning raw data into actionable insights and clear narratives.

Guidelines:
- Start every analysis by understanding the business question or goal
- Describe the shape and quality of the data before diving into analysis
- Use precise statistical language but explain concepts in plain terms
- Identify trends, anomalies, and correlations — and explain their significance
- Always state the limitations of your analysis (sample size, missing data, etc.)
- Structure your output: Summary → Key Findings → Recommendations
- When writing code for analysis, prefer pandas and matplotlib for Python`,
        provider: "openai",
        model: "gpt-4o",
        tools: ["code_execute", "file_read"],
        tags: ["data", "analytics"],
    },
];

// ── Template Card ─────────────────────────────────────────────────────────────

function TemplateCard({ template }: { template: Template }) {
    const navigate = useNavigate();
    const [isCreating, setIsCreating] = useState(false);
    const Icon = template.icon;

    async function handleUseTemplate() {
        setIsCreating(true);
        try {
            const agent = await agentApi.createAgent({
                name: template.name,
                description: template.description,
                system_prompt: template.system_prompt,
                provider: template.provider,
                model: template.model,
                tools_config: JSON.stringify(template.tools),
                constraints_config: JSON.stringify({}),
            });
            toast.success(`Agent created from template!`);
            navigate(`/agents/${agent.id}`);
        } catch (err) {
            toast.error(getErrorMessage(err) || "Failed to create agent");
            setIsCreating(false);
        }
    }

    return (
        <Card className="flex flex-col group hover:border-primary/50 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5">
            <CardHeader className="space-y-3">
                {/* Icon + tags row */}
                <div className="flex items-start justify-between">
                    <div className={`rounded-xl bg-muted/60 p-3 ${template.iconColor} group-hover:scale-110 transition-transform duration-200`}>
                        <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex flex-wrap gap-1 justify-end">
                        {template.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-[10px] uppercase tracking-wide">
                                {tag}
                            </Badge>
                        ))}
                    </div>
                </div>
                <div>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription className="mt-1 leading-relaxed">
                        {template.description}
                    </CardDescription>
                </div>
            </CardHeader>

            <CardContent className="flex-1 space-y-4">
                {/* Provider / model */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="font-mono text-[11px]">
                        {template.provider}
                    </Badge>
                    <span>/</span>
                    <Badge variant="outline" className="font-mono text-[11px]">
                        {template.model}
                    </Badge>
                </div>

                {/* System prompt preview */}
                <div className="rounded-md bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground leading-relaxed line-clamp-3 font-mono">
                    {template.system_prompt}
                </div>

                {/* Tools */}
                {template.tools.length > 0 ? (
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">
                            Tools
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {template.tools.map((tool) => (
                                <Badge key={tool} variant="secondary" className="text-[10px] font-mono">
                                    {tool}
                                </Badge>
                            ))}
                        </div>
                    </div>
                ) : (
                    <p className="text-[11px] text-muted-foreground/60 italic">No tools — pure reasoning</p>
                )}
            </CardContent>

            <CardFooter className="pt-4">
                <Button
                    className="w-full"
                    onClick={handleUseTemplate}
                    disabled={isCreating}
                >
                    {isCreating ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating…
                        </>
                    ) : (
                        <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Use Template
                        </>
                    )}
                </Button>
            </CardFooter>
        </Card>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold">Templates</h1>
                <p className="text-muted-foreground mt-1">
                    Start quickly with a pre-configured agent. Each template is instantly cloned
                    into your account for full customization.
                </p>
            </div>

            {/* Cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {TEMPLATES.map((t) => (
                    <TemplateCard key={t.id} template={t} />
                ))}
            </div>

            {/* Footer hint */}
            <p className="text-center text-xs text-muted-foreground pb-4">
                More templates coming soon. After cloning, customize the system prompt, tools, and provider to your needs.
            </p>
        </div>
    );
}
