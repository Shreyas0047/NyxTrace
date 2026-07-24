"""
LRU Cache for Analysis Results

Caches telemetry analysis results keyed by a hash of the input.
"""

import hashlib
import json
import time
import logging
from typing import Optional, Dict, Any, OrderedDict

from app.core.config import config

logger = logging.getLogger(__name__)


class AnalysisCache:
    """Thread-safe LRU cache for analysis results."""

    def __init__(self, max_size: int = 128, ttl: int = 300):
        self.max_size = max_size
        self.ttl = ttl
        self._cache: OrderedDict[str, tuple[float, Dict[str, Any]]] = OrderedDict()

    def _make_key(self, session_id: str, events: list) -> str:
        if not events:
            return hashlib.sha256(session_id.encode()).hexdigest()
        raw = f"{session_id}:{json.dumps(events, sort_keys=True, default=str)}"
        return hashlib.sha256(raw.encode()).hexdigest()

    def get(self, session_id: str, events: list) -> Optional[Dict[str, Any]]:
        if not config.CACHE_ENABLED:
            return None
        key = self._make_key(session_id, events)
        if key not in self._cache:
            return None
        timestamp, result = self._cache[key]
        if time.time() - timestamp > self.ttl:
            del self._cache[key]
            return None
        self._cache.move_to_end(key)
        return result

    def set(self, session_id: str, events: list, result: Dict[str, Any]) -> None:
        if not config.CACHE_ENABLED:
            return
        key = self._make_key(session_id, events)
        while len(self._cache) >= self.max_size:
            self._cache.popitem(last=False)
        self._cache[key] = (time.time(), result)

    def clear(self) -> None:
        self._cache.clear()

    @property
    def size(self) -> int:
        return len(self._cache)


analysis_cache = AnalysisCache(
    max_size=config.CACHE_MAX_SIZE,
    ttl=config.CACHE_TTL,
)
