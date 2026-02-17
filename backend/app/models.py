"""Agent Lab — SQLAlchemy 2.0 database models."""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import ForeignKey, String, Text, Float, Integer, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def generate_uuid() -> str:
    """Generate a new UUID string."""
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    """Base class for all models."""
    pass


class Agent(Base):
    """Agent configuration — stores prompt, tools, constraints, and provider settings."""

    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=generate_uuid
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False, default="")
    tools_config: Mapped[str] = mapped_column(
        Text, nullable=False, default="[]"
    )  # JSON array of enabled tools
    constraints_config: Mapped[str] = mapped_column(
        Text, nullable=False, default="{}"
    )  # JSON: {max_tokens, timeout, budget}
    provider: Mapped[str] = mapped_column(
        String(50), nullable=False, default="openai"
    )
    model: Mapped[str] = mapped_column(
        String(100), nullable=False, default="gpt-4o"
    )
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    runs: Mapped[list["Run"]] = relationship(back_populates="agent", cascade="all, delete-orphan")
    skills: Mapped[list["AgentSkill"]] = relationship(back_populates="agent", cascade="all, delete-orphan")


class Skill(Base):
    """Reusable instruction block that can be assigned to agents."""

    __tablename__ = "skills"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=generate_uuid
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    instructions: Mapped[str] = mapped_column(
        Text, nullable=False, default=""
    )  # The actual skill content/rules
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    agents: Mapped[list["AgentSkill"]] = relationship(back_populates="skill", cascade="all, delete-orphan")


class AgentSkill(Base):
    """Many-to-many junction table between agents and skills."""

    __tablename__ = "agent_skills"

    agent_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("agents.id", ondelete="CASCADE"), primary_key=True
    )
    skill_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True
    )

    # Relationships
    agent: Mapped["Agent"] = relationship(back_populates="skills")
    skill: Mapped["Skill"] = relationship(back_populates="agents")


class Run(Base):
    """Record of a single agent execution."""

    __tablename__ = "runs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=generate_uuid
    )
    agent_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False
    )
    task: Mapped[str] = mapped_column(Text, nullable=False)  # User's task description
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )  # pending, running, completed, failed
    cost: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    total_tokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    duration_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    # Relationships
    agent: Mapped["Agent"] = relationship(back_populates="runs")
    logs: Mapped[list["RunLog"]] = relationship(back_populates="run", cascade="all, delete-orphan")


class RunLog(Base):
    """Individual log entry from an agent execution."""

    __tablename__ = "run_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("runs.id", ondelete="CASCADE"), nullable=False
    )
    timestamp: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )
    level: Mapped[str] = mapped_column(
        String(10), nullable=False, default="info"
    )  # info, warning, error, debug
    message: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # JSON — extra data like token counts

    # Relationships
    run: Mapped["Run"] = relationship(back_populates="logs")
