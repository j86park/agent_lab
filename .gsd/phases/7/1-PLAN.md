---
phase: 7
plan: 1
wave: 1
---

# Plan 7.1: Workspace File Uploads

## Objective
Allow users to attach files to a run before it starts. Files are uploaded to the backend, stored on disk, and then injected into the Docker sandbox `/workspace` directory via the existing `SandboxManager.write_file()` tar-based mechanism before the agent loop begins.

## Context
- `backend/app/routers/runs.py` — `POST /api/runs` → add file upload endpoint alongside
- `backend/app/services/sandbox.py` — `write_file()` already handles tar injection into container
- `backend/app/services/orchestrator.py` — `execute_run()` step 5 creates sandbox; must inject files before loop starts (after sandbox creation, before iteration)
- `backend/app/models.py` — `Run` model needs no changes; files stored on host filesystem, referenced by run_id
- `frontend/src/pages/AgentEditorPage.tsx` — This is where "Start Run" is initiated; upload UI goes here
- `frontend/src/lib/api.ts` — Add `uploadRunFiles()` API function

## Tasks

<task type="auto">
  <name>Backend: file upload endpoint + orchestrator injection</name>
  <files>
    backend/app/routers/runs.py
    backend/app/services/orchestrator.py
    backend/app/config.py
  </files>
  <action>
    1. In `config.py`: add `WORKSPACE_UPLOADS_DIR: Path = Path("./uploads")` setting.

    2. In `runs.py`: add a new endpoint alongside the existing run creation:
       ```
       POST /api/runs/{run_id}/files
       ```
       - Accept `multipart/form-data` with `files: list[UploadFile]`
       - Save each file to `{WORKSPACE_UPLOADS_DIR}/{run_id}/{filename}` on the host
       - Create the directory if it doesn't exist
       - Return `{"uploaded": ["file1.csv", "file2.txt"]}`
       - Use `FastAPI.UploadFile` and `aiofiles` for async writes
       - Limit: max 10 files, max 10MB each (check content_length or buffer size)

    3. In `orchestrator.py`: after sandbox creation (currently step 5, before the iteration loop):
       - Check if `{WORKSPACE_UPLOADS_DIR}/{run_id}/` exists on the host
       - If it does, iterate all files in that directory
       - For each file, call `await self.sandbox_manager.write_file(container_id, f"/workspace/{filename}", content)`
       - Log: `"Injected {N} workspace file(s): {filenames}"`
       - After successful injection, optionally delete the host copies (or keep for audit)

    IMPORTANT: Use `aiofiles` for async reads. Do NOT use `open()` blocking I/O in the async orchestrator.
    IMPORTANT: The upload endpoint must be separate from `POST /api/runs` — upload happens after run creation, before the background task starts running. Frontend must create the run first, upload files, then the background task will inject them.
  </action>
  <verify>
    # Verify endpoint exists
    python -c "from app.routers.runs import router; routes = [r.path for r in router.routes]; print([r for r in routes if 'files' in r])"
    # Should print a list containing '/api/runs/{run_id}/files'
  </verify>
  <done>
    - `POST /api/runs/{run_id}/files` accepts multipart uploads and saves to host disk
    - Orchestrator injects uploaded files into `/workspace` before agent loop
    - Log entry "Injected N workspace file(s)" appears in run logs when files are present
  </done>
</task>

<task type="auto">
  <name>Frontend: file upload UI on "Start Run" dialog</name>
  <files>
    frontend/src/pages/AgentEditorPage.tsx
    frontend/src/lib/api.ts
  </files>
  <action>
    1. In `api.ts`: add `uploadRunFiles(runId: string, files: File[]): Promise<{uploaded: string[]}>`:
       ```typescript
       async uploadRunFiles(runId: string, files: File[]) {
           const form = new FormData();
           files.forEach(f => form.append("files", f));
           const res = await fetch(`/api/runs/${runId}/files`, { method: "POST", body: form });
           return res.json();
       }
       ```
       Note: Do NOT set Content-Type header — browser sets it with boundary automatically for FormData.

    2. In `AgentEditorPage.tsx`: find the "Start Run" section (the run dialog/form). Add:
       - A file drop zone component (use a plain `<input type="file" multiple accept="*/*" />` styled as a dashed-border drop zone)
       - Show selected filenames as a list with remove (×) buttons
       - On "Start Run" submit:
         a. `POST /api/runs` to create the run → get `run.id`
         b. If files were selected: `await uploadRunFiles(run.id, selectedFiles)`
         c. Navigate to `/runs/${run.id}` as normal
       - The upload must complete BEFORE navigating away (use async/await, not .then)

    Keep the file input minimal — no third-party drag-drop libraries.
    Show a loading state ("Uploading files...") between step a and c if files are selected.
  </action>
  <verify>
    npx tsc --noEmit 2>&1 | tail -5
  </verify>
  <done>
    - File input visible on Start Run dialog with "Attach files to workspace" label
    - TypeScript compiles clean
    - Selected files listed with remove buttons
    - Upload occurs before navigation to run dashboard
  </done>
</task>

## Success Criteria
- [ ] `POST /api/runs/{run_id}/files` endpoint exists and saves files to host
- [ ] Orchestrator injects files into sandbox `/workspace` before agent loop
- [ ] UI: file input on Start Run dialog, files listed, upload before redirect
- [ ] TypeScript compiles clean
