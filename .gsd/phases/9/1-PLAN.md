---
phase: 9
plan: 1
wave: 1
---

# Plan 9.1: Testing & Evaluation Core Models

## Objective
Establish the database foundation for Test Suites, Test Cases, and Prompt Snippets, and extend the Run model to support evaluation data.

## Context
- .gsd/SPEC.md
- .gsd/phases/9/RESEARCH.md
- backend/app/models.py
- backend/app/schemas.py

## Tasks

<task type="auto">
  <name>Database Models</name>
  <files>backend/app/models.py</files>
  <action>
    Define the following models:
    1. TestSuite: agent_id, name, description.
    2. TestCase: suite_id, task, expected_behavior, rubric.
    3. PromptSnippet: name, content.
    Update existing Run model:
    - Add test_case_id (FK to test_cases.id, nullable).
    - Add eval_score (Float, nullable).
    - Add eval_feedback (Text, nullable).
  </action>
  <verify>Check models.py for class definitions and correct relations.</verify>
  <done>Models are defined with SQLAlchemy Mapped types and ForeignKeys.</done>
</task>

<task type="auto">
  <name>Pydantic Schemas</name>
  <files>backend/app/schemas.py</files>
  <action>
    Create Base, Create, Update, and Response schemas for:
    - TestSuite
    - TestCase
    - PromptSnippet
    Update RunResponse schema to include the new fields (test_case_id, eval_score, eval_feedback).
  </action>
  <verify>Check schemas.py for correct field mapping.</verify>
  <done>Schemas are ready for API consumption.</done>
</task>

## Success Criteria
- [ ] Database models defined and aligned with Phase 9 research.
- [ ] API schemas implemented for all new entities.
