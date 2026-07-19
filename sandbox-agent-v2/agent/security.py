"""Security utilities: API key authentication and resource limit validation."""

from fastapi import HTTPException, Request, status
from pydantic import BaseModel, Field

from agent.config import settings


class SandboxResourceLimits(BaseModel):
    max_cpu: float = Field(default=1, ge=0.25, le=64, description="Max CPU cores")
    max_memory_mb: int = Field(default=512, ge=64, le=65536, description="Max memory in MB")
    max_duration_seconds: int = Field(default=300, ge=10, le=3600, description="Max execution duration in seconds")


def verify_api_key(request: Request) -> None:
    """Dependency that checks X-API-Key header against configured API key.

    When SANDBOX_API_KEY is not set, authentication is disabled (dev mode).
    """
    if not settings.API_KEY:
        return
    api_key = request.headers.get("X-API-Key")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-API-Key header",
        )
    if api_key != settings.API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )


def validate_resource_limits(
    cpu: float = 1,
    memory_mb: int = 512,
    duration_seconds: int = 300,
) -> SandboxResourceLimits:
    if cpu > settings.MAX_CPU:
        raise HTTPException(
            status_code=422,
            detail=f"Requested CPU ({cpu}) exceeds limit ({settings.MAX_CPU})",
        )
    if memory_mb > settings.MAX_MEMORY_MB:
        raise HTTPException(
            status_code=422,
            detail=f"Requested memory ({memory_mb}MB) exceeds limit ({settings.MAX_MEMORY_MB}MB)",
        )
    if duration_seconds > settings.MAX_DURATION_SECONDS:
        raise HTTPException(
            status_code=422,
            detail=f"Requested duration ({duration_seconds}s) exceeds limit ({settings.MAX_DURATION_SECONDS}s)",
        )
    return SandboxResourceLimits(
        max_cpu=cpu,
        max_memory_mb=memory_mb,
        max_duration_seconds=duration_seconds,
    )
