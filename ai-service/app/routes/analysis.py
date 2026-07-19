"""
Telemetry and forensic report analysis endpoints.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, ValidationError

from app.core.config import config
from app.core.models import TelemetryAnalysisRequest, TelemetryEvent, AnalysisResponse, ThreatCategory
from app.core.cache import analysis_cache
from app.core.rate_limiter import rate_limiter
from app.modules.telemetry_analysis import telemetry_analyzer
from app.modules.forensic_pipeline import forensic_pipeline
from app.modules.feature_extraction import feature_extractor
from app.modules.threat_classification import threat_classifier
from app.modules.severity_scoring import severity_scorer
from app.modules.summarization import summarizer as ai_summarizer
from app.modules.llm_integration import generate_llm_narrative


class ForensicReportRequest(BaseModel):
    events: List[Dict[str, Any]] = Field(default_factory=list)
    iocIndicators: List[Dict[str, Any]] = Field(default_factory=list)
    iocs: List[Dict[str, Any]] = Field(default_factory=list)
    summary: str = ""

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["analysis"])


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/analyze/telemetry", response_model=AnalysisResponse)
async def analyze_telemetry(request: Request, body: TelemetryAnalysisRequest):
    """
    Analyze forensic telemetry from sandbox execution.

    This endpoint performs comprehensive AI analysis on telemetry events,
    including threat classification, severity scoring, anomaly detection,
    and generates investigation summaries.
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
        logger.info(f"Starting telemetry analysis for session: {body.session_id}")

        cached = analysis_cache.get(body.session_id, [e.model_dump() for e in body.events[:10]])
        if cached:
            logger.info(f"Cache hit for session: {body.session_id}")
            return AnalysisResponse(
                success=True,
                message="Telemetry analysis completed successfully (cached)",
                data=cached,
            )

        CHUNK_SIZE = config.MAX_TELEMETRY_EVENTS
        events = body.events
        if len(events) > CHUNK_SIZE:
            logger.info(
                f"Large telemetry ({len(events)} events) — processing in {len(events) // CHUNK_SIZE + 1} chunks"
            )
            events = events[:CHUNK_SIZE] + events[
                CHUNK_SIZE :: max(1, len(events[CHUNK_SIZE:]) // 500)
            ]
            body = TelemetryAnalysisRequest(
                session_id=body.session_id,
                investigation_id=body.investigation_id,
                events=events[:CHUNK_SIZE],
                metadata=body.metadata,
            )

        result = await telemetry_analyzer.analyze_telemetry(body)

        events_raw = [
            {"type": e.type, "source": e.source, "details": e.details, "timestamp": e.timestamp}
            for e in body.events
        ]
        pipeline_result = forensic_pipeline.analyze(events_raw)

        logger.info(
            f"Analysis complete for session: {body.session_id}, severity: {result.severity_level.value}"
        )

        analysis_data = {
            "session_id": result.session_id,
            "analysis_timestamp": result.analysis_timestamp.isoformat(),
            "total_events": result.total_events,
            "suspicious_events": result.suspicious_events,
            "threat_classification": pipeline_result.threat_classification,
            "severity_score": max(result.severity_score, pipeline_result.severity_score),
            "severity_level": result.severity_level.value,
            "anomalies": result.anomalies,
            "behavioral_summary": result.behavioral_summary,
            "recommendations": result.recommendations,
            "confidence": result.confidence,
            "mitre_mapping": [
                {
                    "technique_id": h.technique_id,
                    "technique_name": h.technique_name,
                    "tactic": h.tactic,
                    "confidence": h.confidence,
                    "evidence_snippets": h.evidence_snippets,
                }
                for h in pipeline_result.mitre_mapping
            ],
            "attack_chain": [
                {
                    "phase": link.phase.value,
                    "techniques": [t.technique_id for t in link.techniques],
                    "event_count": link.event_count,
                }
                for link in pipeline_result.attack_chain
            ],
            "anti_forensics_detected": pipeline_result.anti_forensics_detected,
            "anti_forensics_indicators": pipeline_result.anti_forensics_indicators,
            "reconstruction_summary": pipeline_result.reconstruction_summary,
            "predicted_next_step": pipeline_result.predicted_next_step,
            "stealth_rating": pipeline_result.stealth_rating,
        }

        analysis_cache.set(body.session_id, [e.model_dump() for e in body.events[:10]], analysis_data)

        # Try LLM enhancement (non-blocking)
        try:
            llm_narrative = await generate_llm_narrative(
                threat_type=pipeline_result.threat_classification,
                severity_score=analysis_data["severity_score"],
                severity_level=analysis_data["severity_level"],
                mitre_techniques=[h.technique_id for h in pipeline_result.mitre_mapping],
                key_findings=result.anomalies[:5] if result.anomalies else [],
                event_count=analysis_data["total_events"],
            )
            if llm_narrative:
                analysis_data["executive_summary"] = llm_narrative.get(
                    "executive_summary", analysis_data["behavioral_summary"]
                )
                if "recommendations" in llm_narrative and llm_narrative["recommendations"]:
                    analysis_data["recommendations"] = llm_narrative["recommendations"]
        except Exception as llm_err:
            logger.debug(f"LLM enhancement skipped: {llm_err}")

        return AnalysisResponse(
            success=True,
            message="Telemetry analysis completed successfully",
            data=analysis_data,
        )

    except ValidationError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(status_code=422, detail=str(e))

    except Exception as e:
        logger.error(f"Analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.post("/analyze/report", response_model=AnalysisResponse)
async def analyze_forensic_report(request: Request, report_data: ForensicReportRequest, investigation_id: Optional[str] = None):
    """
    Analyze a forensic report by running its events/indicators through
    the same classification and scoring pipeline used for telemetry.
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
        if investigation_id and not isinstance(investigation_id, str):
            raise HTTPException(status_code=400, detail="investigation_id must be a string")

        logger.info(f"Starting report analysis for investigation: {investigation_id}")

        raw_events = report_data.get("events", [])
        events = []
        for ev in raw_events:
            events.append(
                TelemetryEvent(
                    timestamp=ev.get("timestamp", datetime.now(timezone.utc).isoformat()),
                    type=ev.get("type", "unknown"),
                    source=ev.get("source", "report"),
                    details=ev.get("details", {}),
                )
            )

        iocs = report_data.get("iocIndicators", report_data.get("iocs", []))
        summary_text = report_data.get("summary", "")

        if not events and not iocs:
            return AnalysisResponse(
                success=True,
                message="No analysable data in report",
                data={
                    "investigation_id": investigation_id,
                    "threat_indicators": [],
                    "recommendations": ["Provide events or IOCs for analysis"],
                },
            )

        if events:
            features = feature_extractor.extract_features(events)
            classifications = threat_classifier.classify(features)
            severity_result = severity_scorer.calculate_severity(features, classifications, 0)
            primary = threat_classifier.get_primary_threat(classifications)
            primary_threat_cat = primary.category if primary else ThreatCategory.NORMAL

            report_summary = ai_summarizer.generate_summary(
                features=features,
                severity_score=severity_result.score,
                severity_level=severity_result.level,
                classifications=classifications,
                anomalies=[],
                session_id=investigation_id or "report",
            )

            analysis_result = {
                "investigation_id": investigation_id,
                "severity_score": severity_result.score,
                "severity_level": severity_result.level.value,
                "primary_threat": primary_threat_cat.value,
                "classifications": {k.value: v for k, v in classifications.items()}
                if classifications
                else {},
                "findings_summary": report_summary.executive_summary,
                "key_findings": report_summary.key_findings,
                "threat_indicators": iocs,
                "recommendations": report_summary.recommendations,
                "confidence": report_summary.confidence,
            }
        else:
            analysis_result = {
                "investigation_id": investigation_id,
                "severity_score": min(len(iocs) * 15.0, 100.0),
                "severity_level": "high" if len(iocs) > 3 else "medium",
                "primary_threat": "suspicious_behavior",
                "findings_summary": f"Report contains {len(iocs)} indicators of compromise requiring investigation.",
                "threat_indicators": iocs,
                "recommendations": [
                    "Cross-reference IOCs with threat intelligence feeds",
                    "Check for lateral movement from affected hosts",
                    "Update detection rules with identified indicators",
                ],
                "confidence": 0.6,
            }

        return AnalysisResponse(success=True, message="Report analysis completed", data=analysis_result)

    except Exception as e:
        logger.error(f"Report analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
