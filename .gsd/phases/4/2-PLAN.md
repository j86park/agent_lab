---
phase: 4
plan: 2
wave: 2
depends_on: [1]
---

# Plan 4.2: Run Dashboard UI

## Objective
Build the full Run Dashboard page with real-time log streaming, cost/token counters, run status indicators, and the "Start Run" flow from the Agent Editor page. This replaces the existing `RunDashboardPage.tsx` stub.

## Context
- .gsd/SPEC.md
- frontend/src/lib/api.ts (Run, RunLog, runApi)
- frontend/src/pages/RunDashboardPage.tsx (stub — to be replaced)
- frontend/src/pages/AgentEditorPage.tsx
- frontend/src/App.tsx
- frontend/vite.config.ts

## Tasks

<task type="auto">
  <name>Implement Run Dashboard page with live log streaming</name>
  <files>
    frontend/src/pages/RunDashboardPage.tsx
  </files>
  <action>
    1. Replace the stub `RunDashboardPage.tsx` with a full dashboard:

    **Layout** (top to bottom):
    - **Header bar**: Agent name, run ID (short), status badge (color-coded)
    - **Stats row**: 3 cards — Duration (live timer), Cost ($0.001234), Tokens (in/out)
    - **Main area**: Live log viewer — scrollable list of log entries
    - **Footer**: Back to agent link, stop/delete buttons

    **WebSocket integration**:
    - On mount: connect to `ws://host/ws/runs/{run_id}`
    - Parse incoming JSON messages:
      - `{"type": "log", "data": {...}}` → append to logs state
      - `{"type": "status", ...}` → update run status
    - Auto-scroll log viewer to bottom on new entries
    - Close WebSocket on unmount (cleanup in useEffect)
    - Reconnect logic: if connection drops while run is active, retry after 2s

    **Log entry rendering**:
    - Timestamp (HH:MM:SS format)
    - Level indicator: info=blue, warning=amber, error=red, debug=gray
    - Message text (may be multi-line)
    - Monospace font for log viewer (terminal feel)

    **Status indicators**:
    - `pending`: Yellow pulsing dot + "Queued"
    - `running`: Green pulsing dot + "Running" + live duration counter
    - `completed`: Green check + "Completed" + final stats
    - `failed`: Red X + "Failed" + error message display

    **Cost/token counters**:
    - Update on each `log` message that contains metadata_json with token/cost info
    - Parse `metadata_json` from log entries to extract cumulative values
    - Display cost with 6 decimal places ($0.001234)
    - Display tokens as "1,234 in / 567 out"

    **States to handle**:
    - Loading (run data fetch)
    - Run not found (404)
    - Active run (live streaming)
    - Completed run (show final state, no WebSocket)
    - Failed run (show error message prominently)

    IMPORTANT:
    - Use shadcn/ui components: Card, Badge, Separator, ScrollArea
    - Dark terminal-style log viewer area (bg-slate-950 with monospace text)
    - Must handle both "live" runs (WebSocket) and "historical" runs (just fetch data)
    - Auto-scroll should stop if user scrolls up (don't force scroll if reading old logs)
    - WebSocket URL: determine from window.location (supports both dev proxy and production)
  </action>
  <verify>
    cd frontend; npm run build 2>&1 | findstr /C:"error" || echo "Build OK"
  </verify>
  <done>
    - Full Run Dashboard with live log streaming via WebSocket
    - Duration/cost/token stat cards update in real-time
    - Color-coded log entries with terminal aesthetic
    - Status badges with pulsing indicators
    - Auto-scroll with user-override
    - Handles all states: loading, active, completed, failed, not found
  </done>
</task>

<task type="auto">
  <name>Add "Start Run" flow from Agent Editor</name>
  <files>
    frontend/src/pages/AgentEditorPage.tsx
  </files>
  <action>
    1. Add a "Run Agent" section to `AgentEditorPage.tsx` (only shown for saved agents, not new):
       - A text input / textarea for the task description
       - A "Start Run" button
       - On click: call `runApi.createRun(agent.id, task)` → navigate to `/runs/{run.id}`

    2. Implementation:
       - Add state: `runTask: string` and `isStartingRun: boolean`
       - Show below the save/delete section, separated by a Separator
       - Only visible when editing an existing agent (id is present)
       - Button disabled while run is starting
       - On success: `navigate(`/runs/${run.id}`)` with toast "Run started!"
       - On error: show error toast

    IMPORTANT:
    - Import `runApi` from `@/lib/api`
    - Keep it simple — just the task input and start button
    - Don't add agent history or recent runs list here (that's Phase 5)
  </action>
  <verify>
    cd frontend; npm run build 2>&1 | findstr /C:"error" || echo "Build OK"
  </verify>
  <done>
    - "Run Agent" section visible on saved agents
    - Task input + Start Run button
    - Navigates to /runs/{id} on success
    - Build passes
  </done>
</task>

## Success Criteria
- [ ] Run Dashboard shows live logs via WebSocket
- [ ] Cost/token/duration counters update in real-time
- [ ] Status badges are color-coded with pulsing indicators
- [ ] Log viewer has terminal aesthetic with auto-scroll
- [ ] Agent Editor has "Start Run" section with task input
- [ ] Starting a run navigates to the Run Dashboard
- [ ] Frontend build passes
