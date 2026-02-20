# Troubleshooting

---

## Quick Diagnostics

```bash
# Check all services are running
docker compose ps

# Tail all logs
docker compose logs -f

# Backend only
docker compose logs backend

# Frontend only
docker compose logs frontend
```

---

## Common Issues

### 1. Backend won't start

**Symptom:** `docker compose up` exits immediately or shows Python errors.

**Fix:**
```bash
# Check logs for the specific error
docker compose logs backend

# Common cause: missing .env file
cp .env.example .env

# Rebuild after code changes
docker compose up --build
```

---

### 2. "API key not set" error when running an agent

**Symptom:** Run fails immediately with a message like `No API key configured for openai`.

**Fix:**
1. Go to **Settings** in the sidebar
2. Enter your API key for the provider the agent uses
3. Click **Save**
4. Try the run again

> At least one key is required. If using OpenRouter, you can access models from multiple providers with a single key.

---

### 3. WebSocket connection fails on Run Dashboard

**Symptom:** Log stream shows "Connection failed" or spins indefinitely.

**Checks:**
- Is the backend running? `docker compose ps` — backend status should be `running`
- Is port 8000 accessible? `curl http://localhost:8000/health`
- Browser WebSocket support: open DevTools → Network → WS tab for errors

---

### 4. Agent run fails with "provider not found"

**Symptom:** Run status immediately `failed`, error message mentions unknown provider.

**Fix:** The agent's configured provider must match a key set in Settings. Go to the agent editor and verify the **Provider** and **Model** match what you have a key for.

---

### 5. Frontend shows white blank screen

**Symptom:** Navigating to `http://localhost:5173` shows an empty page.

**Checks:**
```bash
# Check frontend logs
docker compose logs frontend

# Try rebuilding
docker compose up frontend --build
```

If running without Docker, check the terminal running `npm run dev` for errors.

---

### 6. Port conflict — `address already in use`

**Symptom:** `docker compose up` fails with `bind: address already in use` on port 8000 or 5173.

**Fix — find and stop the conflicting process:**
```bash
# Find what's using port 8000 (PowerShell)
netstat -ano | findstr :8000

# Kill the process by PID
taskkill /PID <PID> /F
```

Or change the port in `docker-compose.yml`:
```yaml
ports:
  - "8001:8000"   # change host port only
```

---

### 7. Docker Desktop not running

**Symptom:** `docker compose up` gives `Cannot connect to the Docker daemon`.

**Fix:** Start Docker Desktop and wait for the whale icon in the system tray to stop animating (fully initialized), then retry.

---

### 8. Dev server port conflict (development)

**Symptom:** `npm run dev` starts on an unexpected port (e.g., 3001 instead of 5173).

**Cause:** Port was already in use. Vite auto-selects the next available port.

**Fix:** Stop the conflicting process, or update the `VITE_API_URL` in your `.env` to match the actual port.

---

### 9. Database / schema errors on startup

**Symptom:** Backend logs show `OperationalError` or column not found.

**Cause:** Agent Lab uses SQLAlchemy `create_all()` on startup. Schema changes between versions may conflict with existing data.

**Fix (wipes all data — use only if willing to start fresh):**
```bash
docker compose down -v   # removes volumes
docker compose up        # fresh DB created on startup
```

---

### 10. Resetting everything

```bash
# Stop and remove all containers + volumes (data will be lost)
docker compose down -v

# Start fresh
docker compose up
```

---

## Getting More Help

- **Swagger UI**: http://localhost:8000/docs — interactive API explorer
- **Architecture**: [docs/architecture.md](architecture.md)
- **API Reference**: [docs/api-reference.md](api-reference.md)
