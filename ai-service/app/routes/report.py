"""
Executive report generation endpoint.
"""

import logging

from fastapi import APIRouter, HTTPException, Request

from app.core.models import AnalysisResponse
from app.core.rate_limiter import rate_limiter
from app.modules.forensic_pipeline import forensic_pipeline

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["report"])


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/report/executive", response_model=AnalysisResponse)
async def generate_executive_report(request: Request, report_request: dict):
    """
    Generate an executive narrative report from forensic events.
    Converts raw JSON telemetry into human-readable prose with attack tree structure.
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
        logger.info("Generating executive report")

        events = report_request.get("events", [])
        investigation_title = report_request.get("title", "Forensic Investigation")
        investigation_id = report_request.get("investigation_id", "unknown")

        if not events:
            return AnalysisResponse(
                success=True,
                message="No events to report on",
                data={
                    "narrative": "No telemetry events available for report generation.",
                    "sections": [],
                },
            )

        result = forensic_pipeline.analyze(events)

        sections = []

        severity_label = (
            "Critical"
            if result.severity_score >= 80
            else "High"
            if result.severity_score >= 60
            else "Moderate"
            if result.severity_score >= 40
            else "Low"
        )
        exec_summary = (
            f"This report documents the forensic analysis of investigation '{investigation_title}'. "
            f"The analysis examined {len(events)} telemetry events and identified a {severity_label.lower()}-severity "
            f"{result.threat_classification.replace('_', ' ')} threat "
            f"with a confidence-weighted severity score of {result.severity_score:.1f}/100."
        )
        sections.append({"title": "Executive Summary", "content": exec_summary})

        if result.reconstruction_summary:
            sections.append(
                {"title": "Attack Reconstruction", "content": result.reconstruction_summary}
            )

        if result.attack_chain:
            chain_text = "The attack progressed through the following kill-chain phases:\n"
            for i, link in enumerate(result.attack_chain, 1):
                techs = ", ".join(t.technique_name for t in link.techniques[:3])
                chain_text += (
                    f"  {i}. {link.phase.value.replace('_', ' ').title()} — {techs}\n"
                )
            sections.append({"title": "Kill Chain Analysis", "content": chain_text})

        if result.mitre_mapping:
            mitre_text = f"{len(result.mitre_mapping)} MITRE ATT&CK techniques were observed:\n"
            for hit in result.mitre_mapping[:10]:
                mitre_text += f"  • {hit.technique_id} ({hit.technique_name}) — {hit.tactic}, confidence {hit.confidence:.0%}\n"
            sections.append({"title": "MITRE ATT&CK Mapping", "content": mitre_text})

        if result.anti_forensics_detected:
            af_text = (
                f"The threat actor employed anti-forensics measures (stealth rating: {result.stealth_rating}). "
                f"Detected indicators: {', '.join(result.anti_forensics_indicators)}."
            )
            sections.append({"title": "Anti-Forensics Detection", "content": af_text})

        sections.append({"title": "Predicted Next Actions", "content": result.predicted_next_step})

        recommendations = [
            "Immediately isolate affected systems from the network.",
            "Preserve all forensic artifacts before remediation.",
            "Cross-reference identified IOCs with threat intelligence feeds.",
            "Implement detection rules for the identified MITRE techniques.",
            "Conduct a full scope assessment to identify additional compromised assets.",
        ]
        sections.append(
            {
                "title": "Recommendations",
                "content": "\n".join(f"  {i+1}. {r}" for i, r in enumerate(recommendations)),
            }
        )

        full_narrative = "\n\n".join(f"## {s['title']}\n{s['content']}" for s in sections)

        return AnalysisResponse(
            success=True,
            message="Executive report generated",
            data={
                "narrative": full_narrative,
                "sections": sections,
                "metadata": {
                    "investigation_id": investigation_id,
                    "total_events": len(events),
                    "severity_score": result.severity_score,
                    "threat_classification": result.threat_classification,
                    "stealth_rating": result.stealth_rating,
                    "techniques_detected": len(result.mitre_mapping),
                    "kill_chain_phases": len(result.attack_chain),
                },
            },
        )

    except Exception as e:
        logger.error(f"Report generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")
