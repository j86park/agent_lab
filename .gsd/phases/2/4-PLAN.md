---
phase: 2
plan: 4
wave: 2
depends_on: [2]
---

# Plan 2.4: Skills Library & Settings UI

## Objective
Build the frontend pages for Skills management (CRUD UI for reusable instruction blocks) and Settings (API key configuration). These connect to the Skills and Settings APIs from Plan 2.2.

## Context
- .gsd/SPEC.md
- .agent/skills/agent-lab-skills/SKILL.md
- frontend/src/pages/SkillsPage.tsx
- frontend/src/pages/SettingsPage.tsx
- frontend/src/lib/api.ts

## Tasks

<task type="auto">
  <name>Build Skills Library page</name>
  <files>
    frontend/src/pages/SkillsPage.tsx
    frontend/src/lib/api.ts
  </files>
  <action>
    1. Add to `frontend/src/lib/api.ts` — Skill API functions:
       - `getSkills(skip?, limit?)` — GET /api/skills
       - `getSkill(id)` — GET /api/skills/{id}
       - `createSkill(data)` — POST /api/skills
       - `updateSkill(id, data)` — PUT /api/skills/{id}
       - `deleteSkill(id)` — DELETE /api/skills/{id}

    2. **SkillsPage.tsx** — Replace placeholder with full Skills UI:
       - List view showing all skills as Card components
       - Each card shows: name, description, truncated instructions preview
       - "New Skill" button opens a create dialog
       - Click on a skill opens an edit dialog
       - Dialog (use shadcn Dialog) contains:
         - Name: Input (required)
         - Description: Textarea
         - Instructions: Large textarea with monospace font
         - Save / Cancel buttons
       - Delete button on each card with confirmation
       - Empty state when no skills exist
       - Loading state

    IMPORTANT:
    - Keep skills management on a single page (list + dialog for create/edit)
    - This is different from agents which use separate pages
    - Use `useState` for managing dialog state
  </action>
  <verify>
    cd frontend && npx tsc --noEmit
  </verify>
  <done>
    - Skills page lists all skills
    - Create/edit dialog works
    - Delete with confirmation works
    - API calls integrated
  </done>
</task>

<task type="auto">
  <name>Build Settings page for API key management</name>
  <files>
    frontend/src/pages/SettingsPage.tsx
    frontend/src/lib/api.ts
  </files>
  <action>
    1. Add to `frontend/src/lib/api.ts` — Settings API functions:
       - `getSettings()` — GET /api/settings
       - `updateSettings(data)` — PUT /api/settings
       - Settings types:
         - `SettingsResponse { openai_api_key_set: boolean, anthropic_api_key_set: boolean, openrouter_api_key_set: boolean }`
         - `SettingsUpdate { openai_api_key?: string, anthropic_api_key?: string, openrouter_api_key?: string }`

    2. **SettingsPage.tsx** — Replace placeholder with API key management:
       - Section: "LLM Provider Keys"
       - For each provider (OpenAI, Anthropic, OpenRouter):
         - Label with provider name and icon/badge
         - Status indicator: ✅ Configured / ❌ Not Set (fetched from GET /api/settings)
         - Password input field for the key
         - Placeholder text: "Enter API key..." or "Key is set. Enter new key to update."
         - Individual save button per key (or a global "Save All")
       - Section: "Ollama"
         - Info text: "Ollama connects locally — no API key needed"
         - Connection status check (nice-to-have but not required)
       - Success/error toast after saving
       - NEVER display stored key values — only show if they are set

    IMPORTANT:
    - Input type="password" for all key fields
    - Clear field after successful save
    - Show which keys are currently configured
  </action>
  <verify>
    cd frontend && npm run build
  </verify>
  <done>
    - Settings page shows provider key status
    - Can enter and save API keys
    - Keys are masked in password fields
    - Success/error feedback shown
    - Build succeeds
  </done>
</task>

## Success Criteria
- [ ] Skills page has full CRUD via dialog
- [ ] Settings page shows key configuration status
- [ ] API keys are masked and never displayed
- [ ] Both pages compile and build without errors
