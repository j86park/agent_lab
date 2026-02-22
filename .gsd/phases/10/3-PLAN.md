---
phase: 10
plan: 3
wave: 2
---

# Plan 10.3: Analytics Service & Dashboard

Provide aggregate performance and efficiency metrics for agents.

## Objective
Enable users to identify their most reliable and cost-effective agents at a glance.

## Context
- backend/app/models.py (Run table)
- backend/app/routers/analytics.py
- frontend/src/components/Sidebar.tsx
- frontend/src/pages/AnalyticsPage.tsx

## Tasks

<task type="auto">
  <name>Implement Analytics API</name>
  <files>
    - backend/app/routers/analytics.py
    - backend/main.py
  </files>
  <action>
    - Create `backend/app/routers/analytics.py`.
    - Implement `GET /api/analytics/agents/{agent_id}` to return:
        - Total runs, Success rate (completed/failed).
        - Avg cost per run, Avg tokens per run.
        - Performance Trend (List of cost/tokens for last 30 days).
    - Register router in `main.py`.
  </action>
  <verify>curl http://localhost:8000/api/analytics/agents/{agent_id}</verify>
  <done>Backend returns accurate aggregate stats for a specific agent.</done>
</task>

<task type="auto">
  <name>Build Analytics Dashboard UI</name>
  <files>
    - frontend/src/pages/AnalyticsPage.tsx
    - frontend/src/components/Sidebar.tsx
    - frontend/src/App.tsx
  </files>
  <action>
    - Create `AnalyticsPage.tsx` with a high-level summary of all agents.
    - Use cards for "Total Project Spend", "Most Active Agent", etc.
    - Add navigation menu item to `Sidebar.tsx`.
  </action>
  <verify>Click 'Analytics' in sidebar and see the dashboard with per-agent stats.</verify>
  <done>User can view aggregate data and trends across all their agents.</done>
</task>

## Success Criteria
- [ ] Backend provides calculated metrics from historical runs.
- [ ] Frontend displays trends and efficiency stats in a dashboard.
