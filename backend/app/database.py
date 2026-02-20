"""Agent Lab — Database engine and session management."""

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import settings

# Async engine — uses aiosqlite driver for SQLite
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)

# Session factory
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_session():
    """FastAPI dependency that yields an async database session."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db() -> None:
    """Create all database tables from model metadata."""
    from app.models import Base  # noqa: F811
    from sqlalchemy import text
    from sqlalchemy.exc import OperationalError

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Additive migrations — safe to run on every startup
    migrations = [
        "ALTER TABLE runs ADD COLUMN resolved_prompt TEXT",
        "ALTER TABLE runs ADD COLUMN tags VARCHAR(500)",
    ]
    async with engine.begin() as conn:
        for stmt in migrations:
            try:
                await conn.execute(text(stmt))
            except OperationalError:
                pass  # column already exists
