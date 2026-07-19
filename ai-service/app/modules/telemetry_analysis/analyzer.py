"""
Telemetry Analysis Module

Main orchestrator for forensic telemetry analysis.
"""

from typing import List, Dict, Any
from datetime import datetime
import asyncio

from app.core.models import (
    TelemetryAnalysisRequest,
    TelemetryAnalysisResult,
    SeverityLevel,
    ThreatCategory
)

# Import analysis modules
from app.modules.feature_extraction import feature_extractor
from app.modules.threat_classification import threat_classifier
from app.modules.severity_scoring import severity_scorer
from app.modules.anomaly_detection import anomaly_detector
from app.modules.summarization import summarizer


class TelemetryAnalyzer:
    """Orchestrates the complete telemetry analysis pipeline"""

    async def analyze_telemetry(self, request: TelemetryAnalysisRequest) -> TelemetryAnalysisResult:
        """Execute complete telemetry analysis pipeline"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._run_sync_analysis, request)

    def _run_sync_analysis(self, request: TelemetryAnalysisRequest) -> TelemetryAnalysisResult:
        """Synchronous analysis pipeline (runs in thread pool)"""

        # Step 1: Feature extraction
        features = feature_extractor.extract_features(request.events)

        # Step 2: Threat classification
        classifications = threat_classifier.classify(features)
        primary_threat = threat_classifier.get_primary_threat(classifications)

        # Step 3: Anomaly detection
        anomalies = anomaly_detector.detect_anomalies(request.events, features)

        # Step 4: Severity scoring
        severity_result = severity_scorer.calculate_severity(
            features,
            classifications,
            len(anomalies)
        )

        # Step 5: Generate summary
        summary = summarizer.generate_summary(
            features=features,
            severity_score=severity_result.score,
            severity_level=severity_result.level,
            classifications=classifications,
            anomalies=anomalies,
            session_id=request.session_id
        )

        # Build behavioral summary
        behavioral_summary = self._build_behavioral_summary(
            features,
            classifications,
            primary_threat
        )

        # Generate recommendations from analysis
        recommendations = self._generate_recommendations(
            severity_result.level,
            classifications,
            anomalies
        )

        # Build threat classification dict
        threat_classification = {
            cat.value: result.confidence
            for cat, result in classifications.items()
        }

        # Prepare anomalies for output
        anomaly_list = [
            {
                "type": a.type,
                "description": a.description,
                "severity": a.severity.value,
                "deviation_score": a.deviation_score
            }
            for a in anomalies
        ]

        return TelemetryAnalysisResult(
            session_id=request.session_id,
            analysis_timestamp=datetime.now(),
            total_events=len(request.events),
            suspicious_events=min(
                features.suspicious_processes +
                features.file_modifications +
                len(features.suspicious_extensions) +
                features.credential_access_indicators +
                len(features.persistence_keys),
                len(request.events)
            ),
            threat_classification=threat_classification,
            severity_score=severity_result.score,
            severity_level=severity_result.level,
            anomalies=anomaly_list,
            behavioral_summary=behavioral_summary,
            recommendations=recommendations,
            confidence=summary.confidence
        )

    def _build_behavioral_summary(
        self,
        features,
        classifications,
        primary_threat
    ) -> str:
        """Build a behavioral summary string"""
        summary_parts = []

        # Add primary threat
        if primary_threat.category != ThreatCategory.NORMAL:
            summary_parts.append(f"Primary threat: {primary_threat.category.value.replace('_', ' ').title()}")

        # Add key behavioral indicators
        if features.suspicious_processes > 0:
            summary_parts.append(f"{features.suspicious_processes} suspicious processes")

        if features.encryption_indicators > 0:
            summary_parts.append(f"{features.encryption_indicators} encryption operations")

        if features.persistence_keys:
            summary_parts.append(f"{len(features.persistence_keys)} persistence mechanisms")

        if features.external_ips:
            summary_parts.append(f"{len(features.external_ips)} external connections")

        if not summary_parts:
            return "No significant behavioral indicators detected."

        return "; ".join(summary_parts)

    def _generate_recommendations(
        self,
        severity_level: SeverityLevel,
        classifications: Dict[ThreatCategory, Any],
        anomalies: List[Any]
    ) -> List[str]:
        """Generate recommendations from analysis results"""
        recommendations = []

        # Severity-based
        if severity_level == SeverityLevel.CRITICAL:
            recommendations.append("IMMEDIATE ACTION: Critical severity detected - escalate to SOC immediately")
        elif severity_level == SeverityLevel.HIGH:
            recommendations.append("URGENT: High severity threats require immediate investigation")

        # Threat-specific
        if ThreatCategory.RANSOMWARE_LIKE in classifications:
            recommendations.append("Check for ransom notes and verify backup availability")

        if ThreatCategory.CREDENTIAL_ACCESS in classifications:
            recommendations.append("Audit affected credentials and implement password reset")

        if ThreatCategory.PERSISTENCE in classifications:
            recommendations.append("Remove identified persistence mechanisms and audit startup items")

        if ThreatCategory.DATA_EXFILTRATION in classifications:
            recommendations.append("Review potentially exfiltrated data and enhance DLP monitoring")

        # Anomaly-based
        if len(anomalies) > 3:
            recommendations.append("Multiple anomalies detected - requires detailed behavioral analysis")

        return recommendations[:5] if recommendations else ["Continue monitoring"]


telemetry_analyzer = TelemetryAnalyzer()