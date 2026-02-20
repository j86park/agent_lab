---
phase: 5
plan: 3
wave: 1
---

# Plan 5.3: Built-In Agent Templates

## Objective
Replace the TemplatesPage stub with 3 pre-configured agent templates (Q&A Agent, Code Helper, Data Analyst) that users can one-click clone into new agents.

## Context
- .gsd/SPEC.md
- frontend/src/pages/TemplatesPage.tsx (stub)
- frontend/src/lib/api.ts (agentApi.createAgent)
- frontend/src/pages/AgentEditorPage.tsx

## Tasks

<task type="auto">
  <name>Implement TemplatesPage with 3 built-in templates</name>
  <files>
    frontend/src/pages/TemplatesPage.tsx
  </files>
  <action>
    1. Define 3 template objects as a const array (no backend needed — templates are frontend-only):

    **Template 1: Q&A Agent**
    - Name: "Q&A Agent"
    - Description: "A general-purpose question-answering assistant that provides clear, comprehensive answers."
    - System Prompt: A well-crafted Q&A prompt (~3-5 lines)
    - Provider: "openai", Model: "gpt-4o"
    - Tools: [] (no tools needed)
    - Icon suggestion: MessageSquare from lucide-react

    **Template 2: Code Helper**
    - Name: "Code Helper"
    - Description: "A coding assistant that writes, reviews, and explains code with best practices."
    - System Prompt: A coding assistant prompt with language awareness
    - Provider: "openai", Model: "gpt-4o"
    - Tools: ["code_execute", "file_read", "file_write"]
    - Icon suggestion: Code from lucide-react

    **Template 3: Data Analyst**
    - Name: "Data Analyst"
    - Description: "An analytical assistant that processes data, generates insights, and creates reports."
    - System Prompt: A data analysis prompt
    - Provider: "openai", Model: "gpt-4o"
    - Tools: ["code_execute", "file_read"]
    - Icon suggestion: BarChart3 from lucide-react

    2. Replace the TemplatesPage stub:
       - Header: "Templates" + subtitle
       - **Grid of template cards** (3 columns on desktop, 1 on mobile):
         - Each card shows: icon, name, description, provider/model badge, tools list
         - "Use Template" button at the bottom of each card
       - On "Use Template" click:
         - Call `agentApi.createAgent()` with the template data
         - Navigate to `/agents/{newAgent.id}` (Agent Editor)
         - Toast: "Agent created from template!"

    IMPORTANT:
    - Templates are purely frontend data — no database or API
    - Cards should look premium with subtle hover effects
    - Use shadcn/ui Card, Badge, Button
    - System prompts should be genuinely useful (not placeholder text)
  </action>
  <verify>
    cd frontend; npx tsc --noEmit 2>&1 | findstr /C:"error" || echo "TypeScript OK"
  </verify>
  <done>
    - TemplatesPage shows 3 template cards
    - Each card has Use Template button
    - Clicking creates a new agent and navigates to editor
    - Build passes
  </done>
</task>

## Success Criteria
- [ ] 3 template cards displayed on TemplatesPage
- [ ] Use Template creates a real agent and navigates to editor
- [ ] System prompts are well-crafted and useful
- [ ] TypeScript compiles cleanly
