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
    from sqlalchemy import text, select, func
    from sqlalchemy.exc import OperationalError

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed default snippets if none exist
    from app.models import PromptSnippet
    async with AsyncSession(engine) as session:
        count_stmt = select(func.count()).select_from(PromptSnippet)
        result = await session.execute(count_stmt)
        if result.scalar() == 0:
            defaults = [
                PromptSnippet(name="Chain of Thought", content="Think step-by-step before providing the final answer to ensure logical accuracy."),
                PromptSnippet(name="JSON Output Only", content="Respond ONLY with valid JSON. Do not include any explanation or markdown formatting outside the JSON block."),
                PromptSnippet(name="Senior Engineer Persona", content="Act as a Senior Software Engineer. Provide concise, expert-level feedback focusing on maintainability and performance."),
                PromptSnippet(name="Structured Citations", content="Synthesize information into a structured report. Cite your sources clearly using [1], [2], etc."),
            ]
            session.add_all(defaults)
            await session.commit()

    # Additive migrations — safe to run on every startup
    migrations = [
        "ALTER TABLE runs ADD COLUMN resolved_prompt TEXT",
        "ALTER TABLE runs ADD COLUMN tags VARCHAR(500)",
        "ALTER TABLE runs ADD COLUMN test_case_id VARCHAR(36)",
        "ALTER TABLE runs ADD COLUMN eval_score FLOAT",
        "ALTER TABLE runs ADD COLUMN eval_feedback TEXT",
    ]
    async with engine.begin() as conn:
        for stmt in migrations:
            try:
                await conn.execute(text(stmt))
            except OperationalError:
                pass  # column already exists
