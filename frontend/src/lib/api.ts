/**
 * Agent Lab — Frontend API client.
 * Connects to the FastAPI backend via Vite proxy.
 */

// --- Types ---
import { getErrorMessage } from "./utils";

export interface Agent {
    id: string;
    name: string;
    description: string | null;
    system_prompt: string;
    tools_config: string;
    constraints_config: string;
    provider: string;
    model: string;
    created_at: string;
    updated_at: string;
}

export interface WorkspaceFile {
    name: string;
    size_bytes: number;
    modified_at: string;
}

export interface Skill {
    id: string;
    name: string;
    description: string | null;
    instructions: string;
    created_at: string;
    updated_at: string;
}
export interface PromptSnippet {
    id: string;
    name: string;
    content: string;
    created_at: string;
    updated_at: string;
}

export interface TestSuite {
    id: string;
    agent_id: string;
    name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
}

export interface TestCase {
    id: string;
    suite_id: string;
    task: string;
    expected_behavior: string;
    rubric: string | null;
    last_run_id?: string;
    last_run_score?: number | null;
    last_run_status?: string;
    created_at: string;
    updated_at: string;
}

export interface SettingsStatus {
    openai_api_key_set: boolean;
    anthropic_api_key_set: boolean;
    openrouter_api_key_set: boolean;
}

export interface ApiError {
    message: string;
    status?: number;
    detail?: unknown;
}

// --- Helper ---

async function fetchApi<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${path}`; // Base URL is handled by Vite proxy

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {}),
    };

    try {
        const response = await fetch(url, { ...options, headers });

        if (response.status === 204) {
            return {} as T;
        }

        const data = await response.json();

        if (!response.ok) {
            throw {
                message: data.detail || "API request failed",
                status: response.status,
                detail: data,
            } as ApiError;
        }

        return data as T;
    } catch (error: unknown) {
        if (error && typeof error === "object" && "message" in error) throw error;
        throw { message: getErrorMessage(error) || "Network error or server unavailable" } as ApiError;
    }
}

// --- Agent API ---

export const agentApi = {
    getAgents: (skip = 0, limit = 50) =>
        fetchApi<{ agents: Agent[]; total: number }>(`/api/agents?skip=${skip}&limit=${limit}`),

    getAgent: (id: string) =>
        fetchApi<Agent>(`/api/agents/${id}`),

    createAgent: (data: Partial<Agent>) =>
        fetchApi<Agent>("/api/agents", {
            method: "POST",
            body: JSON.stringify(data),
        }),

    updateAgent: (id: string, data: Partial<Agent>) =>
        fetchApi<Agent>(`/api/agents/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        }),

    deleteAgent: (id: string) =>
        fetchApi<void>(`/api/agents/${id}`, {
            method: "DELETE",
        }),

    exportAgent: (id: string, format: string) =>
        fetchApi<{ filename: string; content: string; format: string }>(
            `/api/agents/${id}/export?format=${format}`
        ),

    listAgentWorkspace: (agentId: string) =>
        fetchApi<{ files: WorkspaceFile[] }>(`/api/agents/${agentId}/workspace`),

    deleteWorkspaceFile: (agentId: string, filename: string) =>
        fetchApi<void>(`/api/agents/${agentId}/workspace/${encodeURIComponent(filename)}`, {
            method: "DELETE",
        }),

    getPromptPreview: (id: string) =>
        fetchApi<{ prompt: string }>(`/api/agents/${id}/preview`),
};

// --- Skill API ---

export const skillApi = {
    getSkills: (skip = 0, limit = 100) =>
        fetchApi<{ skills: Skill[]; total: number }>(`/api/skills?skip=${skip}&limit=${limit}`),

    getSkill: (id: string) =>
        fetchApi<Skill>(`/api/skills/${id}`),

    createSkill: (data: Partial<Skill>) =>
        fetchApi<Skill>("/api/skills", {
            method: "POST",
            body: JSON.stringify(data),
        }),

    updateSkill: (id: string, data: Partial<Skill>) =>
        fetchApi<Skill>(`/api/skills/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        }),

    deleteSkill: (id: string) =>
        fetchApi<void>(`/api/skills/${id}`, {
            method: "DELETE",
        }),
};

// --- Snippet API ---

export const snippetApi = {
    getSnippets: (skip = 0, limit = 100) =>
        fetchApi<{ snippets: PromptSnippet[]; total: number }>(`/api/snippets?skip=${skip}&limit=${limit}`),

    getSnippet: (id: string) =>
        fetchApi<PromptSnippet>(`/api/snippets/${id}`),

    createSnippet: (data: Partial<PromptSnippet>) =>
        fetchApi<PromptSnippet>("/api/snippets", {
            method: "POST",
            body: JSON.stringify(data),
        }),

    updateSnippet: (id: string, data: Partial<PromptSnippet>) =>
        fetchApi<PromptSnippet>(`/api/snippets/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        }),

    deleteSnippet: (id: string) =>
        fetchApi<void>(`/api/snippets/${id}`, {
            method: "DELETE",
        }),
};

// --- Test Suite API ---

export const suiteApi = {
    getSuites: (agentId?: string, skip = 0, limit = 100) =>
        fetchApi<{ suites: TestSuite[]; total: number }>(`/api/suites?skip=${skip}&limit=${limit}${agentId ? `&agent_id=${agentId}` : ""}`),

    getSuite: (id: string) =>
        fetchApi<TestSuite>(`/api/suites/${id}`),

    createSuite: (data: { agent_id: string; name: string; description?: string }) =>
        fetchApi<TestSuite>("/api/suites", {
            method: "POST",
            body: JSON.stringify(data),
        }),

    updateSuite: (id: string, data: Partial<TestSuite>) =>
        fetchApi<TestSuite>(`/api/suites/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        }),

    deleteSuite: (id: string) =>
        fetchApi<void>(`/api/suites/${id}`, {
            method: "DELETE",
        }),

    runSuite: (id: string) =>
        fetchApi<{ message: string }>(`/api/suites/${id}/run`, { method: "POST" }),

    getSuiteCases: (suiteId: string) =>
        fetchApi<{ cases: TestCase[]; total: number }>(`/api/suites/${suiteId}/cases`),

    createTestCase: (suiteId: string, data: { task: string; expected_behavior: string; rubric?: string }) =>
        fetchApi<TestCase>(`/api/suites/${suiteId}/cases`, {
            method: "POST",
            body: JSON.stringify(data),
        }),

    updateTestCase: (caseId: string, data: Partial<TestCase>) =>
        fetchApi<TestCase>(`/api/suites/cases/${caseId}`, {
            method: "PUT",
            body: JSON.stringify(data),
        }),

    deleteTestCase: (caseId: string) =>
        fetchApi<void>(`/api/suites/cases/${caseId}`, {
            method: "DELETE",
        }),
};

export interface ModelMetadata {
    id: string;
    provider: string;
    name: string;
    input_price_1m: number;
    output_price_1m: number;
}

// --- Settings API ---

export const settingsApi = {
    getSettings: () =>
        fetchApi<SettingsStatus>("/api/settings"),

    updateSettings: (data: { openai_api_key?: string; anthropic_api_key?: string; openrouter_api_key?: string }) =>
        fetchApi<SettingsStatus>("/api/settings", {
            method: "PUT",
            body: JSON.stringify(data),
        }),
};

// --- Metadata API ---

export const metadataApi = {
    getModels: () =>
        fetchApi<{ models: ModelMetadata[] }>("/api/metadata/models"),
};

// --- Analytics API ---

export interface AnalyticsSummary {
    total_runs: number;
    total_cost: number;
    total_tokens: number;
    success_rate: number;
    most_active_agent: string;
}

export interface AgentAnalytics {
    agent_name: string;
    total_runs: number;
    success_rate: number;
    total_cost: number;
    avg_cost: number;
    total_tokens: number;
    avg_tokens: number;
    trend: Array<{ date: string; runs: number; cost: number }>;
}

export interface AgentPerformance {
    agent_id: string;
    agent_name: string;
    provider: string;
    total_runs: number;
    total_cost: number;
    total_tokens: number;
    success_rate: number;
}

export const analyticsApi = {
    getSummary: () =>
        fetchApi<AnalyticsSummary>("/api/analytics/summary"),

    getAgentAnalytics: (agentId: string) =>
        fetchApi<AgentAnalytics>(`/api/analytics/agents/${agentId}`),

    getAllAgentsAnalytics: () =>
        fetchApi<{ agents: AgentPerformance[] }>("/api/analytics/agents"),
};

// --- Run Types ---

export interface Run {
    id: string;
    agent_id: string;
    task: string;
    status: "pending" | "running" | "completed" | "failed" | "awaiting_approval" | "paused";
    cost: number | null;
    total_tokens: number | null;
    duration_seconds: number | null;
    error_message: string | null;
    resolved_prompt: string | null;
    tags: string | null;
    eval_score: number | null;
    eval_feedback: string | null;
    created_at: string;
    completed_at: string | null;
}

export interface RunLog {
    id: number;
    run_id: string;
    timestamp: string;
    level: "info" | "warning" | "error" | "debug";
    message: string;
    metadata_json: string | null;
}

// --- Run API ---

export const runApi = {
    createRun: (agent_id: string, task: string, variable_values?: Record<string, string>, tags?: string | null) =>
        fetchApi<Run>("/api/runs", {
            method: "POST",
            body: JSON.stringify({ agent_id, task, variable_values, tags }),
        }),

    getRun: (id: string) =>
        fetchApi<Run>(`/api/runs/${id}`),

    listRuns: (agent_id?: string, skip = 0, limit = 50, tag?: string) =>
        fetchApi<{ runs: Run[]; total: number }>(
            `/api/runs?skip=${skip}&limit=${limit}${agent_id ? `&agent_id=${agent_id}` : ""}${tag ? `&tag=${encodeURIComponent(tag)}` : ""}`
        ),

    updateRunTags: (runId: string, tags: string | null) =>
        fetchApi<Run>(`/api/runs/${runId}/tags`, {
            method: "PATCH",
            body: JSON.stringify({ tags }),
        }),

    getRunLogs: (runId: string) =>
        fetchApi<RunLog[]>(`/api/runs/${runId}/logs`),

    deleteRun: (id: string) =>
        fetchApi<void>(`/api/runs/${id}`, {
            method: "DELETE",
        }),

    uploadRunFiles: async (runId: string, files: File[]): Promise<{ uploaded: string[] }> => {
        const form = new FormData();
        files.forEach((f) => form.append("files", f));
        // Do NOT pass Content-Type — browser must set it with the multipart boundary
        const response = await fetch(`/api/runs/${runId}/files`, {
            method: "POST",
            body: form,
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({ detail: "Upload failed" }));
            throw new Error(err.detail || "Upload failed");
        }
        return response.json();
    },

    listArtifacts: (runId: string) =>
        fetchApi<{ artifacts: RunArtifact[] }>(`/api/runs/${runId}/artifacts`),

    getArtifactContent: async (runId: string, artifactId: string): Promise<string> => {
        const res = await fetch(`/api/runs/${runId}/artifacts/${encodeURIComponent(artifactId)}`);
        if (!res.ok) throw new Error("Failed to fetch artifact content");
        return res.text();
    },

    getTrajectory: (runId: string) =>
        fetchApi<TrajectoryResponse>(`/api/runs/${runId}/trajectory`),

    forkRun: (runId: string, stepIndex: number, overrideTask?: string, overrideModel?: string, overridePrompt?: string) =>
        fetchApi<Run>(`/api/runs/${runId}/fork`, {
            method: "POST",
            body: JSON.stringify({
                step_index: stepIndex,
                override_task: overrideTask,
                override_model: overrideModel,
                override_prompt: overridePrompt,
            }),
        }),

    getApprovalStatus: (runId: string) =>
        fetchApi<ToolApprovalStatus>(`/api/runs/${runId}/approval`),

    approveTool: (runId: string) =>
        fetchApi<{ status: string; run_id: string }>(`/api/runs/${runId}/approve`, {
            method: "POST",
        }),

    rejectTool: (runId: string, reason?: string) =>
        fetchApi<{ status: string; run_id: string }>(`/api/runs/${runId}/reject`, {
            method: "POST",
            body: JSON.stringify({ decision: "reject", rejection_reason: reason }),
        }),

    pauseRun: (runId: string) =>
        fetchApi<{ status: string; run_id: string }>(`/api/runs/${runId}/pause`, {
            method: "POST",
        }),

    resumeRun: (runId: string) =>
        fetchApi<{ status: string; run_id: string }>(`/api/runs/${runId}/resume`, {
            method: "POST",
        }),

    getMetrics: (runId: string) =>
        fetchApi<DeterministicMetrics>(`/api/runs/${runId}/metrics`),

    evaluateRun: (runId: string, testCaseId?: string) =>
        fetchApi<TrajectoryEvaluationReport>(
            `/api/runs/${runId}/evaluate${testCaseId ? `?test_case_id=${testCaseId}` : ""}`,
            { method: "POST" }
        ),

    compareDiff: (runAId: string, runBId: string) =>
        fetchApi<TrajectoryDiffResult>("/api/runs/compare/diff", {
            method: "POST",
            body: JSON.stringify({ run_a_id: runAId, run_b_id: runBId }),
        }),

    comparePairwise: (runAId: string, runBId: string, task?: string, expectedBehavior?: string) =>
        fetchApi<PairwiseEvaluationResult>("/api/runs/compare/pairwise", {
            method: "POST",
            body: JSON.stringify({ run_a_id: runAId, run_b_id: runBId, task, expected_behavior: expectedBehavior }),
        }),
};


// --- MCP Types & API ---

export interface MCPServer {
    id: string;
    name: string;
    description: string | null;
    transport: "stdio" | "sse";
    command: string | null;
    args: string[];
    env: Record<string, string>;
    url: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface MCPToolInfo {
    server_id: string;
    server_name: string;
    name: string;
    namespaced_name: string;
    description: string | null;
    input_schema: Record<string, unknown>;
}

export interface MCPToolCallResponse {
    content: Array<Record<string, unknown>>;
    is_error: boolean;
    raw_text: string;
}

export const mcpApi = {
    getServers: () =>
        fetchApi<{ servers: MCPServer[]; total: number }>("/api/mcp/servers"),

    getServer: (id: string) =>
        fetchApi<MCPServer>(`/api/mcp/servers/${id}`),

    createServer: (data: Partial<MCPServer>) =>
        fetchApi<MCPServer>("/api/mcp/servers", {
            method: "POST",
            body: JSON.stringify(data),
        }),

    updateServer: (id: string, data: Partial<MCPServer>) =>
        fetchApi<MCPServer>(`/api/mcp/servers/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        }),

    deleteServer: (id: string) =>
        fetchApi<void>(`/api/mcp/servers/${id}`, {
            method: "DELETE",
        }),

    pingServer: (id: string) =>
        fetchApi<{ status: string; message: string }>(`/api/mcp/servers/${id}/ping`, {
            method: "POST",
        }),

    getServerTools: (id: string) =>
        fetchApi<MCPToolInfo[]>(`/api/mcp/servers/${id}/tools`),

    getAllTools: () =>
        fetchApi<MCPToolInfo[]>("/api/mcp/tools"),

    executeTool: (server_id: string, tool_name: string, args: Record<string, unknown>) =>
        fetchApi<MCPToolCallResponse>("/api/mcp/execute", {
            method: "POST",
            body: JSON.stringify({ server_id, tool_name, arguments: args }),
        }),
};


// --- Artifact, Trajectory, and Evaluation Types ---

export interface RunArtifact {
    name: string;
    size_bytes: number;
    uri: string;
}

export interface TrajectoryEvent {
    id: string;
    run_id: string;
    step_index: number;
    event_type: "user" | "thought" | "action" | "observation" | "system";
    payload: Record<string, unknown>;
    created_at: string;
}

export interface TrajectoryResponse {
    run_id: string;
    events: TrajectoryEvent[];
    total_events: number;
}

export interface ToolApprovalStatus {
    run_id: string;
    status: string;
    pending_tool: {
        tool_name: string;
        arguments: Record<string, unknown>;
        reason: string;
    } | null;
}

export interface DeterministicMetrics {
    total_steps: number;
    tool_call_count: number;
    redundant_call_count: number;
    tool_error_count: number;
    recovery_rate: number;
    duration_seconds: number;
    total_tokens: number;
}

export interface GEvalRubricScores {
    planning_score: number;
    tool_accuracy_score: number;
    recovery_score: number;
    task_completion_score: number;
    overall_score: number;
    reasoning_trace: string;
    feedback: string;
}

export interface TrajectoryEvaluationReport {
    run_id: string;
    deterministic_metrics: DeterministicMetrics;
    geval_scores: GEvalRubricScores;
    normalized_score: number;
}

export interface StepDiff {
    step_index: number;
    run_a_tool?: string | null;
    run_a_args?: Record<string, unknown> | null;
    run_b_tool?: string | null;
    run_b_args?: Record<string, unknown> | null;
    is_divergent: boolean;
}

export interface TrajectoryDiffResult {
    run_a_id: string;
    run_b_id: string;
    divergence_step: number | null;
    step_diffs: StepDiff[];
    has_divergence: boolean;
}

export interface PairwiseEvaluationResult {
    run_a_id: string;
    run_b_id: string;
    winner: string;
    position_bias_stable: boolean;
    trial_1_winner: string;
    trial_2_winner: string;
    explanation: string;
}
