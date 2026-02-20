---
phase: 2
plan: 2
wave: 1
---

# Plan 2.2: Skills CRUD API & Settings (API Key Management)

## Objective
Create Skills CRUD endpoints (so users can manage reusable instruction blocks) and a Settings API for encrypted API key storage (so users can configure LLM providers). These two domains are independent of agents and can be built in parallel with Plan 2.1.

## Context
- .gsd/SPEC.md
- .agent/skills/agent-lab-skills/SKILL.md
- backend/app/models.py
- backend/app/database.py
- backend/app/config.py

## Tasks

<task type="auto">
  <name>Create Skills CRUD schemas and router</name>
  <files>
    backend/app/schemas.py
    backend/app/routers/skills.py
    backend/app/main.py
  </files>
  <action>
    1. Add to `backend/app/schemas.py` (append, do NOT replace existing code):

       - **SkillCreate**:
         - name: str (required, non-empty)
         - description: Optional[str] = None
         - instructions: str = ""

       - **SkillUpdate**:
         - name: Optional[str] = None
         - description: Optional[str] = None
         - instructions: Optional[str] = None

       - **SkillResponse**:
         - id: str
         - name: str
         - description: Optional[str]
         - instructions: str
         - created_at: datetime
         - updated_at: datetime
         - model_config = ConfigDict(from_attributes=True)

       - **SkillListResponse**:
         - skills: list[SkillResponse]
         - total: int

    2. Create `backend/app/routers/skills.py` with APIRouter:
       - Prefix: `/api/skills`
       - Tags: `["skills"]`

       Endpoints (mirror agents pattern):
       - `POST /api/skills` → Create skill (201)
       - `GET /api/skills` → List skills (with skip/limit)
       - `GET /api/skills/{skill_id}` → Get single skill (404 if missing)
       - `PUT /api/skills/{skill_id}` → Update skill (404 if missing)
       - `DELETE /api/skills/{skill_id}` → Delete skill (204)

       Follow exact same patterns as agents router (async, Depends, SQLAlchemy 2.0).

    3. Wire the skills router into `backend/app/main.py`.
  </action>
  <verify>
    cd backend && python -c "
from app.main import app
routes = [r.path for r in app.routes]
assert any('skills' in r for r in routes), f'Missing skills route. Routes: {routes}'
print('Skills router OK')
"
  </verify>
  <done>
    - 5 Skills CRUD endpoints accessible under /api/skills
    - Schema validation working (non-empty name)
    - Router included in main app
  </done>
</task>

<task type="auto">
  <name>Create Settings API for encrypted API key management</name>
  <files>
    backend/app/services/__init__.py
    backend/app/services/encryption.py
    backend/app/routers/settings.py
    backend/app/main.py
  </files>
  <action>
    1. Create `backend/app/services/__init__.py` (empty file).

    2. Create `backend/app/services/encryption.py`:
       - `get_or_create_key(key_path: Path) -> bytes`:
         - If key_path exists, read and return the key
         - Otherwise, generate a new Fernet key, write to key_path, return it
       - `encrypt_value(value: str, key: bytes) -> str`:
         - Use Fernet to encrypt, return base64 string
       - `decrypt_value(encrypted: str, key: bytes) -> str`:
         - Use Fernet to decrypt, return plaintext

    3. Add schemas to `backend/app/schemas.py`:

       - **SettingsUpdate** — for saving API keys:
         - openai_api_key: Optional[str] = None
         - anthropic_api_key: Optional[str] = None
         - openrouter_api_key: Optional[str] = None
         - Each field represents a provider's key; only non-None fields get stored

       - **SettingsResponse** — for reading settings:
         - openai_api_key_set: bool
         - anthropic_api_key_set: bool
         - openrouter_api_key_set: bool
         - (NEVER return actual key values — only whether they are configured)

    4. Create `backend/app/routers/settings.py`:
       - Prefix: `/api/settings`
       - Tags: `["settings"]`

       Storage strategy: Save encrypted keys as JSON in `~/.agent-lab/settings.json`.

       Endpoints:
       - `GET /api/settings` → Return SettingsResponse (which keys are set)
         - Read settings.json, check which keys exist and are non-empty
       - `PUT /api/settings` → Accept SettingsUpdate
         - Read existing settings.json (or create empty)
         - Encrypt each non-None key value using encryption service
         - Save back to settings.json
         - Return SettingsResponse

       CRITICAL:
       - NEVER log, print, or return actual API key values
       - Always encrypt before storing
       - Load/store in `settings.DATA_DIR / "settings.json"`
       - Use `get_or_create_key(settings.ENCRYPTION_KEY_PATH)` for the Fernet key

    5. Wire the settings router into `backend/app/main.py`.
  </action>
  <verify>
    cd backend && python -c "
from app.services.encryption import get_or_create_key, encrypt_value, decrypt_value
from pathlib import Path
import tempfile, os
key_path = Path(tempfile.mktemp())
key = get_or_create_key(key_path)
encrypted = encrypt_value('test-key-123', key)
assert decrypt_value(encrypted, key) == 'test-key-123'
os.unlink(key_path)
print('Encryption service OK')
from app.main import app
routes = [r.path for r in app.routes]
assert any('settings' in r for r in routes), f'Missing settings route. Routes: {routes}'
print('Settings router OK')
"
  </verify>
  <done>
    - Encryption service encrypts/decrypts correctly
    - GET /api/settings returns which keys are configured
    - PUT /api/settings stores encrypted keys
    - API keys are NEVER returned or logged in plaintext
  </done>
</task>

## Success Criteria
- [ ] Skills CRUD mirrors agent CRUD pattern
- [ ] Encryption service works with Fernet
- [ ] API keys stored encrypted in settings.json
- [ ] GET /api/settings only returns booleans, never keys
