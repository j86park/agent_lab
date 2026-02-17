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

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
