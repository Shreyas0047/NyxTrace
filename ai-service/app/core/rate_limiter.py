"""
Simple In-Memory Rate Limiter

Tracks request counts per client IP within a sliding window.
"""

import time
import asyncio
import logging
from typing import Dict, Tuple
from collections import defaultdict

from app.core.config import config

logger = logging.getLogger(__name__)


class RateLimiter:
    """Sliding-window rate limiter per client key."""

    def __init__(self, max_requests: int = 60, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._buckets: Dict[str, list[float]] = defaultdict(list)
        self._lock = asyncio.Lock()

    async def is_allowed(self, key: str) -> Tuple[bool, int]:
        if not config.RATE_LIMIT_ENABLED:
            return True, 0

        async with self._lock:
            now = time.time()
            cutoff = now - self.window_seconds
            timestamps = self._buckets[key]

            while timestamps and timestamps[0] < cutoff:
                timestamps.pop(0)

            if len(timestamps) >= self.max_requests:
                retry_after = int(timestamps[0] + self.window_seconds - now)
                return False, max(1, retry_after)

            timestamps.append(now)
            return True, 0

    async def check(self, key: str) -> Tuple[bool, int]:
        async with self._lock:
            now = time.time()
            cutoff = now - self.window_seconds
            timestamps = self._buckets.get(key, [])

            while timestamps and timestamps[0] < cutoff:
                timestamps.pop(0)

            allowed = len(timestamps) < self.max_requests
            retry_after = 0
            if not allowed and timestamps:
                retry_after = int(timestamps[0] + self.window_seconds - now)

            return allowed, max(1, retry_after)

    def cleanup(self) -> None:
        now = time.time()
        cutoff = now - self.window_seconds
        for key in list(self._buckets.keys()):
            self._buckets[key] = [t for t in self._buckets[key] if t >= cutoff]
            if not self._buckets[key]:
                del self._buckets[key]


rate_limiter = RateLimiter(
    max_requests=config.RATE_LIMIT_REQUESTS,
    window_seconds=config.RATE_LIMIT_WINDOW,
)
