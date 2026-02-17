---
phase: 1
plan: 2
wave: 1
---

# Plan 1.2: Frontend Scaffold & Routing Shell

## Objective
Create the React + TypeScript frontend application using Vite and shadcn/ui, with a routing shell containing placeholder pages for all main views. This gives us a working frontend dev server with navigation.

## Context
- .gsd/SPEC.md
- .agent/skills/agent-lab-skills/SKILL.md

## Tasks

<task type="auto">
  <name>Initialize Vite + React + TypeScript project</name>
  <files>
    frontend/package.json
    frontend/vite.config.ts
    frontend/tsconfig.json
    frontend/index.html
    frontend/src/main.tsx
    frontend/src/App.tsx
    frontend/Dockerfile
  </files>
  <action>
    1. Initialize the frontend using Vite:
       - cd to project root and run: npx -y create-vite@latest frontend --template react-ts
       - This creates the frontend/ directory with React + TypeScript

    2. Install additional dependencies:
       - cd frontend
       - npm install react-router-dom@6
       - npm install -D tailwindcss @tailwindcss/vite

    3. **vite.config.ts** — Configure:
       - Tailwind CSS plugin via @tailwindcss/vite
       - Path alias: @ → ./src
       - Dev server proxy:
         - /api → http://localhost:8000
         - /ws → ws://localhost:8000 (WebSocket)
       - Dev server port: 3000

    4. **tsconfig.json** / **tsconfig.app.json** — Ensure:
       - paths: { "@/*": ["./src/*"] }
       - Strict mode enabled

    5. **Dockerfile** — For containerized dev:
       - FROM node:20-slim
       - WORKDIR /app
       - COPY package*.json .
       - RUN npm install
       - COPY . .
       - CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
       - EXPOSE 3000

    6. Initialize shadcn/ui:
       - Run: npx shadcn@latest init
       - Select style: New York
       - Select base color: Neutral
       - Use CSS variables: Yes
       - This creates components.json and src/components/ui/ directory
       - Install initial components: npx shadcn@latest add button card

    IMPORTANT: Follow agent-lab-skills rules:
    - Use import.meta.env.VITE_*, NOT process.env
    - Config in vite.config.ts, NOT webpack
    - tailwind.config.ts (TypeScript), NOT .js
    - shadcn components in src/components/ui/
  </action>
  <verify>
    cd frontend && npm run build
  </verify>
  <done>
    - Vite project builds successfully
    - shadcn/ui initialized with Button and Card components
    - TypeScript compiles without errors
    - Dockerfile exists
  </done>
</task>

<task type="auto">
  <name>Create routing shell with placeholder pages</name>
  <files>
    frontend/src/App.tsx
    frontend/src/pages/HomePage.tsx
    frontend/src/pages/AgentEditorPage.tsx
    frontend/src/pages/RunDashboardPage.tsx
    frontend/src/pages/HistoryPage.tsx
    frontend/src/pages/TemplatesPage.tsx
    frontend/src/pages/SettingsPage.tsx
    frontend/src/pages/SkillsPage.tsx
    frontend/src/components/layout/Sidebar.tsx
    frontend/src/components/layout/AppLayout.tsx
  </files>
  <action>
    1. Create page placeholder components in src/pages/:
       - HomePage.tsx — "Agents" list (will show saved agents)
       - AgentEditorPage.tsx — "Agent Editor" (will be the config form)
       - RunDashboardPage.tsx — "Run Dashboard" (will show live execution)
       - HistoryPage.tsx — "History" (will show past runs)
       - TemplatesPage.tsx — "Templates" (will show built-in templates)
       - SettingsPage.tsx — "Settings" (will manage API keys)
       - SkillsPage.tsx — "Skills Library" (will manage reusable skills)

       Each placeholder should:
       - Export a default functional component
       - Show the page title in an h1
       - Show a brief description of what this page will contain
       - Use shadcn Card component for visual structure

    2. Create layout components:
       - **AppLayout.tsx** — Full-page layout with sidebar + main content area
         - Sidebar on the left (fixed width ~250px)
         - Main content area with padding
         - Uses Outlet from react-router-dom for page content

       - **Sidebar.tsx** — Navigation sidebar with:
         - App logo/title at top: "Agent Lab" with a beaker/flask icon (use emoji 🧪)
         - Navigation links:
           - 🏠 Agents (/)
           - ✏️ New Agent (/agents/new)
           - 📜 History (/history)
           - 📋 Templates (/templates)
           - 🧠 Skills (/skills)
           - ⚙️ Settings (/settings)
         - Active link highlighting
         - Use NavLink from react-router-dom

    3. **App.tsx** — Set up React Router:
       - BrowserRouter wrapping the app
       - Routes:
         - / → HomePage (agent list)
         - /agents/new → AgentEditorPage
         - /agents/:id → AgentEditorPage (edit mode)
         - /runs/:id → RunDashboardPage
         - /history → HistoryPage
         - /templates → TemplatesPage
         - /skills → SkillsPage
         - /settings → SettingsPage
       - AppLayout as the parent route element

    IMPORTANT: Follow agent-lab-skills rules:
    - Functional components with hooks only
    - React.Context for state (NOT Redux)
    - cn() utility from lib/utils for class merging
  </action>
  <verify>
    cd frontend && npm run build && echo "Build succeeded"
  </verify>
  <done>
    - 7 page components exist and render
    - Sidebar shows all navigation links
    - React Router navigates between pages
    - Build completes without TypeScript errors
  </done>
</task>

## Success Criteria
- [ ] `npm run build` succeeds in /frontend
- [ ] All 7 pages render with placeholder content
- [ ] Sidebar navigation works between routes
- [ ] shadcn/ui Button and Card components available
- [ ] Dockerfile builds without error
