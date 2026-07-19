"""
Summarization Module

Generates AI-powered investigation summaries from forensic analysis.
"""

from typing import List, Dict, Any

from app.core.models import (
    ForensicFeatureSet,
    InvestigationSummary,
    SeverityLevel,
    ThreatCategory,
    AnomalyResult
)
from app.core.config import config


class ForensicSummarizer:
    """Generates investigation summaries from forensic features"""

    def generate_summary(
        self,
        features: ForensicFeatureSet,
        severity_score: float,
        severity_level: SeverityLevel,
        classifications: Dict[ThreatCategory, Any],
        anomalies: List[AnomalyResult],
        session_id: str
    ) -> InvestigationSummary:
        """Generate comprehensive investigation summary"""

        # Generate executive summary
        executive_summary = self._generate_executive_summary(
            features, severity_score, severity_level, classifications
        )

        # Generate analyst summary
        analyst_summary = self._generate_analyst_summary(
            features, classifications, anomalies
        )

        # Generate key findings
        key_findings = self._generate_key_findings(
            features, classifications, anomalies
        )

        # Generate timeline summary
        timeline_summary = self._generate_timeline_summary(features)

        # Generate recommendations
        recommendations = self._generate_recommendations(
            severity_level, classifications, anomalies
        )

        # Calculate confidence based on data completeness
        confidence = self._calculate_confidence(features, classifications)

        return InvestigationSummary(
            executive_summary=executive_summary,
            analyst_summary=analyst_summary,
            key_findings=key_findings,
            timeline_summary=timeline_summary,
            recommendations=recommendations,
            confidence=confidence
        )

    def _generate_executive_summary(
        self,
        features: ForensicFeatureSet,
        severity_score: float,
        severity_level: SeverityLevel,
        classifications: Dict[ThreatCategory, Any]
    ) -> str:
        """Generate executive-level summary"""

        # Determine threat category
        threats = [c.value.replace('_', ' ').title() for c in classifications.keys() if c != ThreatCategory.NORMAL]

        summary = "Analysis of sandbox session identified "

        if severity_level == SeverityLevel.CRITICAL:
            summary += "CRITICAL severity threats requiring immediate attention. "
        elif severity_level == SeverityLevel.HIGH:
            summary += "HIGH severity threats requiring urgent investigation. "
        elif severity_level == SeverityLevel.MEDIUM:
            summary += "MODERATE severity indicators requiring analysis. "
        else:
            summary += "low severity activity. "

        # Add threat context
        if threats:
            summary += f"Detected {len(threats)} threat categories: {', '.join(threats[:2])}. "

        # Add statistics
        summary += f"Analyzed {features.total_processes} processes, {features.file_operations} file operations, "
        summary += f"{features.network_connections} network connections. "

        # Add severity context
        summary += f"Overall severity score: {severity_score:.0f}/100 ({severity_level.value.upper()})."

        # Truncate to executive length (at word boundary)
        if len(summary) > config.EXECUTIVE_SUMMARY_LENGTH:
            summary = summary[:config.EXECUTIVE_SUMMARY_LENGTH].rsplit(' ', 1)[0] + "..."

        return summary

    def _generate_analyst_summary(
        self,
        features: ForensicFeatureSet,
        classifications: Dict[ThreatCategory, Any],
        anomalies: List[AnomalyResult]
    ) -> str:
        """Generate detailed analyst summary"""

        summary = "Detailed forensic analysis reveals the following behavioral patterns:\n\n"

        # Process activity
        if features.suspicious_processes > 0:
            summary += f"- Process Activity: {features.suspicious_processes} suspicious processes identified "
            summary += f"out of {features.total_processes} total processes.\n"

        if features.suspicious_commands:
            summary += f"- Command Execution: Detected {len(features.suspicious_commands)} suspicious commands "
            summary += "including potential encoded PowerShell execution and other potentially malicious patterns.\n"

        # File operations
        if features.file_modifications > 10:
            summary += f"- File Operations: {features.file_modifications} file modifications detected"
            if features.encryption_indicators > 0:
                summary += ", including encryption activity"
            summary += ".\n"

        if features.file_deletes > 0:
            summary += f"- File Deletion: {features.file_deletes} file deletion operations detected.\n"

        # Registry
        if features.persistence_keys:
            summary += f"- Persistence: {len(features.persistence_keys)} potential persistence mechanisms identified "
            summary += "in Windows registry.\n"

        # Network
        if features.network_connections > 0:
            summary += f"- Network: {features.network_connections} network connections observed"
            if features.external_ips:
                summary += f" to {len(features.external_ips)} external IP addresses"
            summary += ".\n"

        # Anomalies
        if anomalies:
            summary += f"- Anomalies: {len(anomalies)} behavioral anomalies detected requiring investigation.\n"

        # Classification summary
        non_normal = {k: v for k, v in classifications.items() if k != ThreatCategory.NORMAL}
        if non_normal:
            summary += "\nThreat Classifications:\n"
            for category, result in sorted(non_normal.items(), key=lambda x: x[1].confidence, reverse=True):
                summary += f"- {category.value.replace('_', ' ').title()}: {result.confidence:.0%} confidence\n"

        return summary

    def _generate_key_findings(
        self,
        features: ForensicFeatureSet,
        classifications: Dict[ThreatCategory, Any],
        anomalies: List[AnomalyResult]
    ) -> List[str]:
        """Generate key findings list"""
        findings = []

        # Critical findings based on severity
        if features.encryption_indicators > 0:
            findings.append(f"Detected {features.encryption_indicators} potential file encryption operations")

        if features.credential_access_indicators > 0:
            findings.append(f"Detected {features.credential_access_indicators} potential credential access attempts")

        if len(features.persistence_keys) > 0:
            findings.append(f"Identified {len(features.persistence_keys)} potential persistence mechanisms")

        if features.suspicious_processes > features.total_processes * 0.3:
            findings.append(f"High ratio of suspicious processes ({features.suspicious_processes}/{features.total_processes})")

        if len(features.external_ips) > 3:
            findings.append(f"Multiple external connections detected: {len(features.external_ips)} unique IPs")

        if features.download_indicators > 0:
            findings.append(f"File download activity detected: {features.download_indicators} downloads")

        if features.file_deletes > 5:
            findings.append(f"Mass file deletion detected: {features.file_deletes} files")

        # Anomaly-based findings
        critical_anomalies = [a for a in anomalies if a.severity == SeverityLevel.CRITICAL]
        if critical_anomalies:
            for anomaly in critical_anomalies[:2]:
                findings.append(f"Critical anomaly: {anomaly.description}")

        # Limit to top findings
        return findings[:10]

    def _generate_timeline_summary(self, features: ForensicFeatureSet) -> str:
        """Generate timeline-based summary"""

        # Simple timeline based on event counts
        timeline = []

        if features.file_operations > 0:
            timeline.append(f"File operations: {features.file_operations} events")

        if features.registry_operations > 0:
            timeline.append(f"Registry activity: {features.registry_operations} events")

        if features.network_connections > 0:
            timeline.append(f"Network connections: {features.network_connections} events")

        if features.total_processes > 0:
            timeline.append(f"Process activity: {features.total_processes} processes")

        if not timeline:
            return "Limited activity detected during analysis window."

        return " | ".join(timeline)

    def _generate_recommendations(
        self,
        severity_level: SeverityLevel,
        classifications: Dict[ThreatCategory, Any],
        anomalies: List[AnomalyResult]
    ) -> List[str]:
        """Generate investigation recommendations"""
        recommendations = []

        # Severity-based recommendations
        if severity_level in [SeverityLevel.CRITICAL, SeverityLevel.HIGH]:
            recommendations.append("Immediate investigation required - escalate to security team")
            recommendations.append("Preserve all forensic evidence for potential legal proceedings")
            recommendations.append("Isolate affected systems if confirmed malicious")

        # Classification-based recommendations
        if ThreatCategory.RANSOMWARE_LIKE in classifications:
            recommendations.append("Check for ransom notes or encryption indicators")
            recommendations.append("Verify backup integrity and recovery options")

        if ThreatCategory.PERSISTENCE in classifications:
            recommendations.append("Review and remove identified persistence mechanisms")
            recommendations.append("Check for additional compromised accounts")

        if ThreatCategory.CREDENTIAL_ACCESS in classifications:
            recommendations.append("Review credential exposure and reset affected credentials")
            recommendations.append("Audit privileged account access")

        if ThreatCategory.DATA_EXFILTRATION in classifications:
            recommendations.append("Identify potentially exfiltrated data")
            recommendations.append("Review data loss prevention logs")

        # Anomaly-based recommendations
        if anomalies:
            recommendations.append("Review detected anomalies for additional context")

        # Default recommendation
        if not recommendations:
            recommendations.append("Continue monitoring for additional suspicious activity")

        return recommendations[:5]

    def _calculate_confidence(
        self,
        features: ForensicFeatureSet,
        classifications: Dict[ThreatCategory, Any]
    ) -> float:
        """Calculate confidence score for the analysis"""

        # Base confidence
        confidence = 0.7

        # Increase with more events analyzed
        if features.total_processes > 10:
            confidence += 0.1
        if features.file_operations > 20:
            confidence += 0.1
        if features.network_connections > 5:
            confidence += 0.1

        # Cap at 0.95
        return min(confidence, 0.95)


summarizer = ForensicSummarizer()