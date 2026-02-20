# Plan 7.1 Summary: Workspace File Uploads

## What Was Built

### Task 1: Backend — upload endpoint + orchestrator injection

**`backend/app/config.py`**
- Added `WORKSPACE_UPLOADS_DIR` property → `DATA_DIR/workspace_uploads/`
- Added to `ensure_data_dirs()` so it auto-creates on startup

**`backend/app/routers/runs.py`**
- Added `POST /api/runs/{run_id}/files` multipart endpoint
- Accepts up to 10 files, max 10 MB each (enforced before write)
- Files saved to `WORKSPACE_UPLOADS_DIR/{run_id}/{filename}` using `aiofiles`
- Strips path components from filenames (security: path traversal prevention)
- Returns `{"uploaded": ["file1.txt", "file2.csv", ...]}`
- Added `aiofiles` and `settings` imports

**`backend/app/services/orchestrator.py`**
- Added `aiofiles` import and `settings` import
- Added `_inject_uploaded_files(session, run_id, container_id)` method
- Reads each file from `WORKSPACE_UPLOADS_DIR/{run_id}/`, writes to `/workspace/{name}` in container via `sandbox_manager.write_file()`
- Binary files handled via `latin-1` encode fallback
- Logs injected filenames, then cleans up host upload dir with `shutil.rmtree()`
- Called as step 4b right after sandbox creation, before LLM invocation

**`backend/requirements.txt`**
- Added `aiofiles>=23.0.0` (installed: 25.1.0)

### Task 2: Frontend — file upload UI

**`frontend/src/lib/api.ts`**
- Added `uploadRunFiles(runId, files)` to `runApi`
- Uses raw `FormData` (no Content-Type header — browser sets multipart boundary)
- Throws on non-OK response with backend error detail

**`frontend/src/pages/AgentEditorPage.tsx`**
- Added `Paperclip`, `X` icons; `useRef` import
- Added `workspaceFiles: File[]` state + `fileInputRef`
- Added `handleFileSelect()` — deduplicates by filename, caps at 10 files
- Added `removeFile()` — removes file from list by name
- Updated `handleStartRun()` — calls `uploadRunFiles()` after run creation if files attached
- "Attach workspace files (N/10)" button below task textarea
- File list: filename, KB size, remove (×) button — mono font, contained per row
- Start Run button shows "Uploading files…" during upload phase

## Success Criteria ✅
- [x] Files selected in UI, displayed as list with remove buttons
- [x] On Start Run: run created → files uploaded → navigate to run dashboard
- [x] Backend saves files to `WORKSPACE_UPLOADS_DIR/{run_id}/`
- [x] Orchestrator injects files into `/workspace/` before LLM runs
- [x] TypeScript clean (zero errors)
- [x] Committed: `feat(phase-7): plan 7.1`
