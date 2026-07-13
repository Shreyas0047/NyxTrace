"""
Alert enrichment endpoint.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request

from app.core.models import TelemetryEvent, AnalysisResponse, ThreatCategory
from app.core.rate_limiter import rate_limiter
from app.modules.feature_extraction import feature_extractor
from app.modules.threat_classification import threat_classifier
from app.modules.severity_scoring import severity_scorer

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["enrichment"])


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/enrich/alert", response_model=AnalysisResponse)
async def enrich_alert(request: Request, alert_data: dict):
    """
    Enrich an alert with AI analysis using the classification and scoring pipeline.
    """
    client_ip = _get_client_ip(request)
    allowed, retry_after = rate_limiter.check(client_ip)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Retry after {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )

    try:
        logger.info(f"Enriching alert: {alert_data.get('alert_id', 'unknown')}")

        raw_events = alert_data.get("events", [])
        events = []
        for ev in raw_events:
            events.append(
                TelemetryEvent(
                    timestamp=ev.get("timestamp", datetime.now(timezone.utc).isoformat()),
                    type=ev.get("type", "unknown"),
                    source=ev.get("source", "alert"),
                    details=ev.get("details", {}),
                )
            )

        iocs = alert_data.get("iocIndicators", alert_data.get("indicators", []))
        description = alert_data.get("description", "")
        alert_severity = alert_data.get("severity", "medium")

        if events:
            features = feature_extractor.extract_features(events)
            classifications = threat_classifier.classify(features)
            severity_result = severity_scorer.calculate_severity(features, classifications, 0)
            primary = threat_classifier.get_primary_threat(classifications)

            recommendations = []
            if primary and primary.category != ThreatCategory.NORMAL:
                recommendations.append(
                    f"Investigate {primary.category.value.replace('_', ' ')} indicators"
                )
            if features.suspicious_processes > 0:
                recommendations.append(
                    f"Review {features.suspicious_processes} suspicious processes"
                )
            if features.external_ips:
                recommendations.append(
                    f"Block/investigate external IPs: {', '.join(features.external_ips[:5])}"
                )
            if features.persistence_keys:
                recommendations.append(
                    "Check persistence mechanisms for unauthorized entries"
                )
            if not recommendations:
                recommendations.append("Continue monitoring for additional suspicious activity")

            enriched_alert = {
                "alert_id": alert_data.get("alert_id"),
                "ai_severity_assessment": severity_result.level.value,
                "severity_score": severity_result.score,
                "threat_classification": primary.category.value if primary else "normal",
                "classifications": {k.value: v for k, v in classifications.items()}
                if classifications
                else {},
                "confidence": min(0.5 + (len(events) * 0.05), 0.95),
                "analysis_summary": f"Analyzed {len(events)} events. Primary threat: {primary.category.value if primary else 'none'}. Severity: {severity_result.level.value} ({severity_result.score:.1f}/100).",
                "indicators_found": len(iocs),
                "recommendations": recommendations,
            }
        else:
            ioc_count = len(iocs)
            score = min(ioc_count * 20.0, 100.0)
            level = (
                "critical"
                if score >= 80
                else "high" if score >= 60 else "medium" if score >= 40 else "low"
            )

            enriched_alert = {
                "alert_id": alert_data.get("alert_id"),
                "ai_severity_assessment": level,
                "severity_score": score,
                "threat_classification": "suspicious_behavior" if ioc_count > 0 else "normal",
                "confidence": 0.5 if ioc_count == 0 else min(0.6 + ioc_count * 0.05, 0.85),
                "analysis_summary": f"Alert contains {ioc_count} IOCs. {description[:200] if description else 'No description.'}",
                "indicators_found": ioc_count,
                "recommendations": [
                    "Correlate with other alerts from same source",
                    "Cross-reference IOCs with threat intelligence",
                    "Review affected systems for compromise indicators",
                ],
            }

        return AnalysisResponse(success=True, message="Alert enriched successfully", data=enriched_alert)

    except Exception as e:
        logger.error(f"Alert enrichment error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Enrichment failed: {str(e)}")
