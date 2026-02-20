"""Agent Lab — Application configuration."""

import os
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Data directory — defaults to ~/.agent-lab
    DATA_DIR: Path = Path.home() / ".agent-lab"

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS
    FRONTEND_URL: str = "http://localhost:3000"

    @property
    def DATABASE_URL(self) -> str:
        """SQLite database URL for async driver."""
        db_path = self.DATA_DIR / "database.sqlite"
        return f"sqlite+aiosqlite:///{db_path}"

    @property
    def ENCRYPTION_KEY_PATH(self) -> Path:
        """Path to the Fernet encryption key file."""
        return self.DATA_DIR / ".key"

    @property
    def WORKSPACE_UPLOADS_DIR(self) -> Path:
        """Directory for run workspace file uploads, organised by run_id."""
        return self.DATA_DIR / "workspace_uploads"

    def ensure_data_dirs(self) -> None:
        """Create all required data directories if they don't exist."""
        dirs = [
            self.DATA_DIR,
            self.DATA_DIR / "agents",
            self.DATA_DIR / "skills",
            self.DATA_DIR / "runs",
            self.WORKSPACE_UPLOADS_DIR,
        ]
        for d in dirs:
            d.mkdir(parents=True, exist_ok=True)

    model_config = {"env_prefix": "AGENT_LAB_"}


# Singleton settings instance
settings = Settings()
