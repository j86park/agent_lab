---
phase: 11
plan: 3
wave: 3
---

# Plan 11.3: Wave 3 - Purge & Type Integrity

Final cleanup of dead code and full TypeScript hardening.

## Objective
Zero `any` policy and removal of all identified technical debt.

## Context
- Entire codebase (Audit scope)

## Tasks

<task type="auto">
  <name>Type Hardening Audit</name>
  <files>
    - All .ts/.tsx files
  </files>
  <action>
    - Search for remaining `: any` across the frontend.
    - Create missing interfaces for API responses where implicit `any` exists.
    - Strictly type all event handlers and state setters in the extracted components from Wave 2.
  </action>
  <verify>npm run build (TypeScript check) passes with no warnings.</verify>
  <done>The frontend codebase contains 0 instances of `: any` in business logic.</done>
</task>

<task type="auto">
  <name>Final Cleanup & Purge</name>
  <files>
    - Entire project
  </files>
  <action>
    - Remove unused imports across all files.
    - Delete any orphaned files identified during restructuring.
    - Verify `models.py` matches actual usage; remove any unused columns/tables (if any).
  </action>
  <verify>Run all unit tests to ensure no accidental deletions broke the system.</verify>
  <done>Project is clean of orphaned code and unused dependencies.</done>
</task>

## Success Criteria
- [ ] Zero TypeScript `any` warnings in critical paths.
- [ ] Clean package.json and project structure.
