"""Agent Lab — FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers.agents import router as agents_router
from app.routers.analytics import router as analytics_router
from app.routers.metadata import router as metadata_router
from app.routers.runs import router as runs_router
from app.routers.settings import router as settings_router
from app.routers.skills import router as skills_router
from app.routers.snippets import router as snippets_router
from app.routers.test_suites import router as suites_router
from app.routers.ws import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    # Startup
    print(f"DEBUG: settings.tavily_api_key status: {'SET' if settings.tavily_api_key else 'NOT SET'}")
    settings.ensure_data_dirs()
    await init_db()
    yield
    # Shutdown (cleanup if needed)


app = FastAPI(
    title="Agent Lab API",
    description="Local-first platform for building and testing AI agents",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(agents_router)
app.include_router(analytics_router)
app.include_router(metadata_router)
app.include_router(runs_router)
app.include_router(skills_router)
app.include_router(snippets_router)
app.include_router(suites_router)
app.include_router(settings_router)
app.include_router(ws_router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "version": "0.1.0"}
