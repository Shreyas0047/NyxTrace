"""Application configuration loaded from environment variables."""

import os
from typing import Optional


class Settings:
    API_KEY: Optional[str] = os.environ.get("SANDBOX_API_KEY")

    cors_origins_str: str = os.environ.get("SANDBOX_CORS_ORIGINS", "")
    CORS_ORIGINS: list[str] = (
        ["*"]
        if cors_origins_str in ("", "*")
        else [o.strip() for o in cors_origins_str.split(",") if o.strip()]
    )

    MAX_CPU: float = float(os.environ.get("SANDBOX_MAX_CPU", "1"))
    MAX_MEMORY_MB: int = int(os.environ.get("SANDBOX_MAX_MEMORY_MB", "512"))
    MAX_DURATION_SECONDS: int = int(os.environ.get("SANDBOX_MAX_DURATION_SECONDS", "300"))


settings = Settings()
