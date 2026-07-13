"""
Health check and root endpoints.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter

from app.core.config import config

logger = logging.getLogger(__name__)
router = APIRouter(tags=["health"])


@router.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": config.SERVICE_NAME,
        "version": config.SERVICE_VERSION,
        "status": "operational",
        "docs": "/docs",
    }


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": config.SERVICE_NAME,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
