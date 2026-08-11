"""
Investigation summarization endpoint.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.models import TelemetryEvent, AnalysisResponse
from app.core.rate_limiter import rate_limiter
from app.modules.feature_extraction import feature_extractor
from app.modules.threat_classification import threat_classifier
from app.modules.severity_scoring import severity_scorer
from app.modules.anomaly_detection import anomaly_detector
from app.modules.summarization import summarizer as ai_summarizer


class InvestigationSummaryRequest(BaseModel):
    id: Optional[str] = None
    title: str = "Untitled Investigation"
    description: str = ""
    events: List[Dict[str, Any]] = Field(default_factory=list)
    telemetry: List[Dict[str, Any]] = Field(default_factory=list)
    evidence: List[Dict[str, Any]] = Field(default_factory=list)
    alerts: List[Dict[str, Any]] = Field(default_factory=list)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["summarization"])


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/summarize/investigation", response_model=AnalysisResponse)
async def summarize_investigation(request: Request, investigation_data: InvestigationSummaryRequest):
    """
    Generate AI-powered investigation summary from investigation data
    by running available events through the full analysis pipeline.
    """
    client_ip = _get_client_ip(request)
    allowed, retry_after = await rate_limiter.check(client_ip)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Retry after {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )

    try:
        logger.info("Generating investigation summary")

        data = investigation_data.model_dump()

        raw_events = data.get("events", data.get("telemetry", []))
        events = []
        for ev in raw_events:
            events.append(
                TelemetryEvent(
                    timestamp=ev.get("timestamp", datetime.now(timezone.utc).isoformat()),
                    type=ev.get("type", "unknown"),
                    source=ev.get("source", "investigation"),
                    details=ev.get("details", {}),
                )
            )

        evidence_count = len(data.get("evidence", []))
        alert_count = len(data.get("alerts", []))
        title = data.get("title", "Untitled Investigation")
        description = data.get("description", "")

        if events:
            features = feature_extractor.extract_features(events)
            classifications = threat_classifier.classify(features)
            anomalies = anomaly_detector.detect_anomalies(events, features)
            severity_result = severity_scorer.calculate_severity(
                features, classifications, len(anomalies)
            )

            summary = ai_summarizer.generate_summary(
                features=features,
                severity_score=severity_result.score,
                severity_level=severity_result.level,
                classifications=classifications,
                anomalies=anomalies,
                session_id=data.get("id", "investigation"),
            )

            return AnalysisResponse(
                success=True,
                message="Investigation summary generated",
                data={
                    "executive_summary": summary.executive_summary,
                    "analyst_summary": summary.analyst_summary,
                    "key_findings": summary.key_findings,
                    "timeline_summary": summary.timeline_summary,
                    "recommendations": summary.recommendations,
                    "confidence": summary.confidence,
                    "severity_score": severity_result.score,
                    "severity_level": severity_result.level.value,
                    "total_events_analyzed": len(events),
                    "anomalies_detected": len(anomalies),
                },
            )
        else:
            return AnalysisResponse(
                success=True,
                message="Investigation summary generated (metadata only)",
                data={
                    "executive_summary": f"Investigation '{title}' contains {evidence_count} evidence items and {alert_count} alerts. {description[:300] if description else 'No telemetry events available for deep analysis.'}",
                    "analyst_summary": f"This investigation currently has no telemetry events for automated analysis. Manual review of {evidence_count} evidence items is recommended.",
                    "key_findings": [
                        f"{evidence_count} evidence items attached",
                        f"{alert_count} alerts associated",
                        "No telemetry events available for automated behavioral analysis",
                    ],
                    "timeline_summary": "Timeline cannot be constructed without telemetry events.",
                    "recommendations": [
                        "Run sandbox analysis to generate telemetry events",
                        "Review attached evidence manually",
                        "Correlate alerts with external threat intelligence",
                    ],
                    "confidence": 0.3,
                    "total_events_analyzed": 0,
                    "anomalies_detected": 0,
                },
            )

    except Exception as e:
        logger.error(f"Summarization error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")
