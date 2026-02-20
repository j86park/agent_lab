---
phase: 2
plan: 3
wave: 2
depends_on: [1]
---

# Plan 2.3: Agent List & Agent Editor UI

## Objective
Build the frontend pages for agent management — a home page listing all agents and a full-featured agent editor page with form fields for system prompt, tools, constraints, provider/model selection, and skill assignment. This connects to the Agent CRUD API from Plan 2.1.

## Context
- .gsd/SPEC.md
- .agent/skills/agent-lab-skills/SKILL.md
- frontend/src/App.tsx
- frontend/src/pages/HomePage.tsx
- frontend/src/pages/AgentEditorPage.tsx
- frontend/src/components/layout/Sidebar.tsx
- model_capabilities.yaml

## Tasks

<task type="auto">
  <name>Install additional shadcn/ui components and create API client</name>
  <files>
    frontend/src/lib/api.ts
  </files>
  <action>
    1. Install required shadcn/ui components:
       ```
       cd frontend
       npx shadcn@latest add input textarea label select badge separator dialog alert-description tabs switch scroll-area toast
       ```

    2. Create `frontend/src/lib/api.ts` — typed API client:
       - Base URL: `/api` (uses Vite proxy)
       - Generic `fetchApi<T>(path, options)` helper that:
         - Adds Content-Type: application/json
         - Throws structured errors on non-OK responses
         - Parses JSON response
       - Agent-specific functions:
         - `getAgents(skip?, limit?): Promise<{agents: Agent[], total: number}>`
         - `getAgent(id): Promise<Agent>`
         - `createAgent(data): Promise<Agent>`
         - `updateAgent(id, data): Promise<Agent>`
         - `deleteAgent(id): Promise<void>`
       - Skill-specific functions (for later use):
         - `getSkills(skip?, limit?): Promise<{skills: Skill[], total: number}>`
       - Types:
         - `Agent` — mirrors AgentResponse
         - `Skill` — mirrors SkillResponse

    IMPORTANT:
    - Use fetch(), NOT axios
    - All functions are async
    - Error handling returns structured messages
  </action>
  <verify>
    cd frontend && npx tsc --noEmit
  </verify>
  <done>
    - API client module exists with typed functions
    - shadcn components installed
    - TypeScript compiles without errors
  </done>
</task>

<task type="auto">
  <name>Build Agent List (HomePage) and Agent Editor page</name>
  <files>
    frontend/src/pages/HomePage.tsx
    frontend/src/pages/AgentEditorPage.tsx
  </files>
  <action>
    1. **HomePage.tsx** — Replace placeholder with real agent list:
       - Fetch agents from API on mount using `useEffect`
       - Display agents in a grid of Card components
       - Each card shows:
         - Agent name (bold)
         - Description (truncated)
         - Provider/model badge
         - Created date
         - Click → navigates to `/agents/{id}` for editing
       - Empty state: prompt to create a new agent
       - "New Agent" button in top-right → navigates to `/agents/new`
       - Loading state with skeleton cards
       - Error state with retry button

    2. **AgentEditorPage.tsx** — Full agent configuration form:
       - If URL has `:id` param → fetch agent and populate form (edit mode)
       - If URL is `/agents/new` → empty form (create mode)

       Form fields (use shadcn components):
       - **Name**: Input field (required)
       - **Description**: Textarea (optional)
       - **System Prompt**: Large textarea with monospace font
       - **Provider**: Select dropdown — openai, anthropic, openrouter, ollama
       - **Model**: Select dropdown — options change based on selected provider
         - OpenAI: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo
         - Anthropic: claude-sonnet-4-20250514, claude-3-5-haiku-20241022, claude-3-opus-20240229
         - OpenRouter: openai/gpt-4o, anthropic/claude-sonnet-4-20250514
         - Ollama: llama3, codellama, mistral
       - **Tools**: Checkbox list — file_read, file_write, code_execute, web_search
       - **Constraints**: Number inputs for max_tokens, timeout_seconds, max_cost
       - **Skills**: Multi-select list (fetch from /api/skills, show checkboxes)

       Actions:
       - "Save" button → POST (create) or PUT (update)
       - "Delete" button → DELETE with confirmation dialog (edit mode only)
       - "Cancel" button → navigate back to /
       - Show success/error toast after save

       Use React state (`useState`) for form management.
       Use `useParams()` to detect edit vs create mode.
       Use `useNavigate()` for redirects after save/delete.

    IMPORTANT:
    - Functional components with hooks only
    - cn() utility for class merging
    - shadcn components for ALL form elements
    - Handle loading/error states gracefully
  </action>
  <verify>
    cd frontend && npm run build
  </verify>
  <done>
    - HomePage displays agent list from API (or empty state)
    - AgentEditorPage has all form fields
    - Create and edit modes work
    - Save/delete actions call API
    - TypeScript builds without errors
  </done>
</task>

## Success Criteria
- [ ] Agent list page fetches and displays agents from API
- [ ] Agent editor supports create and edit modes
- [ ] Provider/model dropdowns are dynamically linked
- [ ] Save creates or updates agent via API
- [ ] Delete removes agent with confirmation
- [ ] `npm run build` succeeds
