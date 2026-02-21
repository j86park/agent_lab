---
name: Agent Lab Project Skills
description: Library-specific rules, best practices, and gotchas for the Agent Lab tech stack
---

# Agent Lab Project Skills

> **MANDATORY**: Read this file BEFORE writing any code for the Agent Lab project.
> This is a living document — update it when you discover new gotchas or patterns.

---

## Backend — Python 3.11+

### FastAPI

**Rules:**
- Always use `async def` for route handlers — this project is fully async
- Use Pydantic v2 model_validator / field_validator, NOT the deprecated v1 `@validator`
- Return explicit status codes: `status_code=201` for creation, `204` for deletion
- Use `Depends()` for dependency injection (DB sessions, auth, settings)
- Use `APIRouter` to organize routes by domain (agents, runs, skills, settings)
- WebSocket endpoints go through FastAPI's `@app.websocket()`, not a separate library
- Use `lifespan` context manager for startup/shutdown, NOT the deprecated `@app.on_event()`

**Patterns:**
```python
# ✅ Correct — lifespan context manager
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup
    await init_db()
    yield
    # shutdown

app = FastAPI(lifespan=lifespan)

# ❌ Wrong — deprecated events
@app.on_event("startup")
async def startup():
    ...
```

```python
# ✅ Correct — Pydantic v2 validators
from pydantic import BaseModel, field_validator

class AgentCreate(BaseModel):
    name: str
    system_prompt: str

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip()

# ❌ Wrong — Pydantic v1 style
from pydantic import validator  # deprecated
```

**Gotchas:**
- `JSONResponse` auto-serializes dicts but NOT SQLAlchemy models — always convert to Pydantic first
- WebSocket connections must be explicitly accepted with `await websocket.accept()`
- Background tasks via `BackgroundTasks` are fire-and-forget; use for non-critical work only

---

### SQLAlchemy 2.0

**Rules:**
- Use the **2.0-style** query API (`select()`, `session.execute()`), NOT the legacy `session.query()`
- Use `Mapped[]` and `mapped_column()` for model definitions, NOT the old `Column()` style
- Always use `async_sessionmaker` and `AsyncSession` — this project is fully async
- Use `AsyncEngine` created via `create_async_engine()`
- SQLite async requires `aiosqlite` driver: `sqlite+aiosqlite:///path/to/db`

**Patterns:**
```python
# ✅ Correct — 2.0 style with async
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    pass

class Agent(Base):
    __tablename__ = "agents"
    id: Mapped[str] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(default=func.now())

# Querying
async def get_agent(session: AsyncSession, agent_id: str):
    result = await session.execute(select(Agent).where(Agent.id == agent_id))
    return result.scalar_one_or_none()

# ❌ Wrong — legacy 1.x style
class Agent(Base):
    id = Column(String, primary_key=True)  # old style
agent = session.query(Agent).filter_by(id=id).first()  # old style
```

**Gotchas:**
- SQLite does NOT support `ALTER TABLE` for all operations — use batch mode in Alembic migrations
- Async SQLite sessions are NOT thread-safe; don't share across threads
- Always `await session.commit()` — forgetting the `await` silently does nothing
- Use `session.refresh(obj)` after commit if you need auto-generated fields (like `id`)

---

### Python Docker SDK (`docker` package)

**Rules:**
- Use `docker.DockerClient.from_env()` to connect (this reads `DOCKER_HOST` or the socket)
- Always set resource limits: `mem_limit`, `cpu_period`, `cpu_quota`
- Always set `auto_remove=True` or clean up containers manually in a `finally` block
- Mount user files as **read-only** volumes: `{'/host/path': {'bind': '/container/path', 'mode': 'ro'}}`
- Use `container.logs(stream=True)` for real-time log streaming
- Set timeouts with `container.stop(timeout=N)` to avoid hanging containers

**Patterns:**
```python
# ✅ Correct — container lifecycle with cleanup
import docker

client = docker.DockerClient.from_env()

try:
    container = client.containers.run(
        image="python:3.11-slim",
        command="python /app/agent.py",
        volumes={input_dir: {"bind": "/app/inputs", "mode": "ro"}},
        mem_limit="512m",
        cpu_quota=50000,  # 50% of one CPU
        detach=True,
        network_mode="none",  # no network access by default
    )
    for log_line in container.logs(stream=True, follow=True):
        yield log_line.decode("utf-8")
    container.wait(timeout=300)
finally:
    try:
        container.remove(force=True)
    except docker.errors.NotFound:
        pass
```

**Gotchas:**
- Docker socket path differs by OS: `/var/run/docker.sock` (Linux/Mac) vs named pipe on Windows
- `container.logs()` without `stream=True` blocks until container finishes
- `container.wait()` can hang forever if no timeout is set
- Image pulls are slow — pre-pull base images on startup

---

### LLM Provider SDKs

#### OpenAI SDK (`openai`)

**Rules:**
- Use the new client-based API: `OpenAI()` / `AsyncOpenAI()`, NOT the old module-level `openai.ChatCompletion`
- Always use `AsyncOpenAI` in this project (we're fully async)
- Use streaming (`stream=True`) for real-time log output
- Track `usage.prompt_tokens` and `usage.completion_tokens` from the response for cost calculation

**Patterns:**
```python
# ✅ Correct — new async client
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key=api_key)
response = await client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "system", "content": prompt}],
    stream=True,
)
async for chunk in response:
    if chunk.choices[0].delta.content:
        yield chunk.choices[0].delta.content

# ❌ Wrong — old module-level API
import openai
openai.api_key = "..."
openai.ChatCompletion.create(...)  # deprecated
```

#### Anthropic SDK (`anthropic`)

**Rules:**
- Use `AsyncAnthropic()` client, NOT synchronous
- Anthropic uses `max_tokens` (required), NOT `max_completion_tokens`
- System prompt goes in the `system` parameter, NOT as a message
- Use `client.messages.stream()` for streaming

**Patterns:**
```python
# ✅ Correct
from anthropic import AsyncAnthropic

client = AsyncAnthropic(api_key=api_key)
async with client.messages.stream(
    model="claude-sonnet-4-20250514",
    max_tokens=4096,
    system="You are a helpful assistant.",
    messages=[{"role": "user", "content": task}],
) as stream:
    async for text in stream.text_stream:
        yield text

# ❌ Wrong — system prompt as message
messages=[{"role": "system", "content": "..."}]  # Anthropic doesn't use this
```

#### OpenRouter (via OpenAI-compatible API)

**Rules:**
- Use `AsyncOpenAI` with `base_url="https://openrouter.ai/api/v1"`
- Set `HTTP-Referer` and `X-Title` headers for proper attribution
- Model names use provider prefix: `"openai/gpt-4o"`, `"anthropic/claude-sonnet-4-20250514"`

#### Ollama

**Rules:**
- Use `AsyncOpenAI` with `base_url="http://host.docker.internal:11434/v1"` (from inside Docker)
- No API key needed — pass `api_key="ollama"` (placeholder)
- Token usage may not be reported — handle `None` usage gracefully
- Model pull must happen before first use

---

### Cryptography (`cryptography` library)

**Rules:**
- Use `Fernet` for symmetric encryption of API keys
- Generate the encryption key ONCE and store in `~/.agent-lab/.key`
- NEVER log or print decrypted API keys
- NEVER commit the key file to git

**Patterns:**
```python
from cryptography.fernet import Fernet

# Generate key (once, on first run)
key = Fernet.generate_key()

# Encrypt
f = Fernet(key)
encrypted = f.encrypt(api_key.encode())

# Decrypt
decrypted = f.decrypt(encrypted).decode()
```

---

## Frontend — React 18+ with TypeScript

### Vite

**Rules:**
- Config in `vite.config.ts`, NOT `webpack.config.js`
- Use `import.meta.env.VITE_*` for environment variables, NOT `process.env`
- Proxy API requests to backend in dev via `server.proxy` in vite config

**Patterns:**
```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/ws': { target: 'ws://localhost:8000', ws: true },
    },
  },
});
```

### shadcn/ui

**Rules:**
- Components are **copied into your project** (not imported from a package) — they live in `src/components/ui/`
- Install components via CLI: `npx shadcn@latest add button` (NOT `npm install`)
- shadcn uses Radix primitives under the hood — refer to Radix docs for advanced behavior
- Use the `cn()` utility from `lib/utils.ts` for conditional class merging (it wraps `clsx` + `tailwind-merge`)
- Do NOT override shadcn component files directly — create wrapper components instead

**Patterns:**
```typescript
// ✅ Correct — wrapper component
import { Button } from "@/components/ui/button";

export function PrimaryButton({ children, ...props }) {
  return <Button variant="default" size="lg" {...props}>{children}</Button>;
}

// ❌ Wrong — editing src/components/ui/button.tsx directly
```

### Tailwind CSS

**Rules:**
- Configure in `tailwind.config.ts` (TypeScript), NOT `.js`
- Use CSS variables for theming (shadcn pattern): `hsl(var(--primary))`
- Use `@apply` sparingly — prefer utility classes in JSX
- Dark mode via `class` strategy (not `media`)

### React Patterns

**Rules:**
- Use functional components with hooks — NO class components
- Use `React.Context` + custom hooks for state management, NOT Redux
- WebSocket connections go in a custom hook (`useWebSocket`) with cleanup in `useEffect` return
- Use `useCallback` and `useMemo` for expensive operations passed as props
- File upload: use native `<input type="file">` wrapped in a styled drop zone, NOT a third-party library

**Patterns:**
```typescript
// ✅ Correct — WebSocket hook with cleanup
function useWebSocket(url: string) {
  const [messages, setMessages] = useState<string[]>([]);
  
  useEffect(() => {
    const ws = new WebSocket(url);
    ws.onmessage = (e) => setMessages(prev => [...prev, e.data]);
    return () => ws.close();  // cleanup
  }, [url]);
  
  return messages;
}
```

---

## Docker Compose

**Rules:**
- Use `docker-compose.yml` v3.8+ syntax
- Backend mounts Docker socket: `/var/run/docker.sock:/var/run/docker.sock`
- Use named volumes for persistent data, NOT bind mounts for the database
- Frontend dev server proxies to backend — no direct backend access from browser
- Set `restart: unless-stopped` for production, `restart: "no"` for dev
- Use `healthcheck` on backend service before frontend depends on it

---

## General Project Rules

1. **All backend code is async** — never use synchronous I/O in route handlers
2. **All database operations go through SQLAlchemy async sessions** — no raw `sqlite3` calls
3. **API keys are NEVER logged, printed, or included in error messages**
4. **Every Docker container created must be cleaned up** — use try/finally
5. **Cost tracking is mandatory for every LLM call** — track tokens and compute cost
6. **WebSocket messages use JSON format** with a `type` field for message discrimination
7. **File uploads are validated** — check file size, type, and sanitize names before storage
8. **All user-facing errors return structured JSON** — `{"error": "message", "detail": "..."}`
---

## Environment & Shell — PowerShell (Windows)

**Rules:**
- **NEVER use `&&` for command chaining** — most versions of PowerShell (including the user's) do not support it and will throw a `ParserError`.
- Use `;` (semicolon) for unconditional sequential execution.
- Use `$?;` for conditional execution (equivalent to `&&`) if the previous command SUCCESS is mandatory.
- Prefer separate `run_command` calls for multi-step operations to improve error visibility and reliability.

**Patterns:**
```powershell
# ✅ Correct
git add .; git commit -m "update"

# ❌ Wrong
git add . && git commit -m "update"
```
