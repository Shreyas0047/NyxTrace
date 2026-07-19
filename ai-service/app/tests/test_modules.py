"""
Tests for core analysis modules and utility modules.
"""

import pytest

from app.core.models import (
    TelemetryEvent,
    TelemetryAnalysisRequest,
    ThreatClassificationResult,
    ThreatCategory,
)
from app.core.cache import analysis_cache
from app.core.rate_limiter import rate_limiter


class TestTelemetryEventValidation:
    def test_valid_event(self):
        event = TelemetryEvent(type="process", source="sandbox", details={"pid": 1234})
        assert event.type == "process"

    def test_invalid_event_type_defaults_to_unknown(self):
        event = TelemetryEvent(type="invalid_type")
        assert event.type == "unknown"

    def test_registry_type(self):
        event = TelemetryEvent(type="registry", details={"key": "HKLM\\...\\Run"})
        assert event.type == "registry"


class TestTelemetryAnalysisRequestValidation:
    def test_valid_request(self):
        events = [TelemetryEvent(type="process")]
        req = TelemetryAnalysisRequest(session_id="test-session", events=events)
        assert req.session_id == "test-session"

    def test_empty_session_id(self):
        events = [TelemetryEvent(type="process")]
        with pytest.raises(ValueError):
            TelemetryAnalysisRequest(session_id="", events=events)

    def test_empty_events(self):
        with pytest.raises(ValueError):
            TelemetryAnalysisRequest(session_id="test", events=[])

    def test_too_many_events(self):
        events = [TelemetryEvent(type="process") for _ in range(50001)]
        with pytest.raises(ValueError, match="Too many events"):
            TelemetryAnalysisRequest(session_id="test", events=events)


class TestThreatClassificationResult:
    def test_valid_result(self):
        result = ThreatClassificationResult(
            category=ThreatCategory.RANSOMWARE_LIKE,
            confidence=0.85,
            indicators=["file_encryption"],
            reasoning="Multiple encryption events detected",
        )
        assert result.confidence == 0.85

    def test_confidence_clamped_high(self):
        result = ThreatClassificationResult(
            category=ThreatCategory.RANSOMWARE_LIKE,
            confidence=2.0,
            indicators=[],
            reasoning="",
        )
        assert result.confidence == 1.0

    def test_confidence_clamped_low(self):
        result = ThreatClassificationResult(
            category=ThreatCategory.NORMAL,
            confidence=-0.5,
            indicators=[],
            reasoning="",
        )
        assert result.confidence == 0.0


class TestCache:
    def test_set_and_get(self):
        analysis_cache.clear()
        analysis_cache.set("sess-1", [], {"result": "ok"})
        cached = analysis_cache.get("sess-1", [])
        assert cached == {"result": "ok"}

    def test_cache_miss(self):
        analysis_cache.clear()
        cached = analysis_cache.get("nonexistent", [{"test": "data"}])
        assert cached is None

    def test_cache_clear(self):
        analysis_cache.set("sess-2", [], {"data": 1})
        analysis_cache.clear()
        assert analysis_cache.size == 0


class TestRateLimiter:
    @pytest.mark.asyncio
    async def test_is_allowed(self):
        rate_limiter._buckets.clear()
        allowed, retry = await rate_limiter.is_allowed("test-client")
        assert allowed is True
        assert retry == 0

    @pytest.mark.asyncio
    async def test_block_after_limit(self):
        rate_limiter._buckets.clear()
        rate_limiter.max_requests = 3
        for _ in range(3):
            allowed, _ = await rate_limiter.is_allowed("test-block")
            assert allowed is True
        allowed, retry = await rate_limiter.is_allowed("test-block")
        assert allowed is False
        assert retry > 0

    @pytest.mark.asyncio
    async def test_cleanup(self):
        import time
        rate_limiter._buckets.clear()
        rate_limiter.window_seconds = 0.01
        await rate_limiter.is_allowed("test-cleanup")
        time.sleep(0.02)
        rate_limiter.cleanup()
        assert "test-cleanup" not in rate_limiter._buckets
