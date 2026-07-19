"""
Threat Classification Module

Classifies behaviors into educational threat categories.
IMPORTANT: This is educational classification logic for forensic analysis only.
"""

from typing import List, Dict, Any

from app.core.models import (
    ForensicFeatureSet,
    ThreatCategory,
    ThreatClassificationResult
)


class ThreatClassifier:
    """Classifies forensic behaviors into threat categories"""

    # Classification rules based on forensic features
    CLASSIFICATION_RULES = {
        ThreatCategory.RANSOMWARE_LIKE: {
            "indicators": ["encryption", "file_modifications", "mass_delete"],
            "min_score": 3,
            "features": ["encryption_indicators", "file_modifications"]
        },
        ThreatCategory.SPYWARE_LIKE: {
            "indicators": ["keylog", "screen_capture", "user_monitoring"],
            "min_score": 2,
            "features": ["credential_access"]
        },
        ThreatCategory.TROJAN_LIKE: {
            "indicators": ["suspicious_execution", "dll_injection", "deceptive_appearance"],
            "min_score": 2,
            "features": ["suspicious_processes"]
        },
        ThreatCategory.BOTNET_LIKE: {
            "indicators": ["network_beacon", "command_poll", "external_connection"],
            "min_score": 2,
            "features": ["network_connections"]
        },
        ThreatCategory.CREDENTIAL_ACCESS: {
            "indicators": ["credential_dump", "password_access", "key_access"],
            "min_score": 2,
            "features": ["credential_access_indicators"]
        },
        ThreatCategory.PERSISTENCE: {
            "indicators": ["autorun", "registry_modification", "service_creation"],
            "min_score": 1,
            "features": ["persistence_keys"]
        },
        ThreatCategory.PROCESS_INJECTION: {
            "indicators": ["code_injection", "dll_injection", "process_hollow"],
            "min_score": 2,
            "features": ["suspicious_processes"]
        },
        ThreatCategory.DATA_EXFILTRATION: {
            "indicators": ["large_upload", "external_destination", "sensitive_access"],
            "min_score": 2,
            "features": ["download_indicators", "network_connections"]
        },
        ThreatCategory.DESTRUCTIVE: {
            "indicators": ["mass_delete", "disk_wipe", "system_modification"],
            "min_score": 3,
            "features": ["file_deletes"]
        }
    }

    def classify(self, features: ForensicFeatureSet) -> Dict[ThreatCategory, ThreatClassificationResult]:
        """Classify features into threat categories"""
        results = {}

        for category, rules in self.CLASSIFICATION_RULES.items():
            score = self._calculate_category_score(features, rules)

            if score > 0:
                confidence = min(score / (len(rules["features"]) * 3.0), 0.95)
                indicators = self._extract_indicators(features, rules)
                reasoning = self._generate_reasoning(category, score, features)

                results[category] = ThreatClassificationResult(
                    category=category,
                    confidence=confidence,
                    indicators=indicators,
                    reasoning=reasoning
                )

        # If no threats detected, classify as normal
        if not results:
            results[ThreatCategory.NORMAL] = ThreatClassificationResult(
                category=ThreatCategory.NORMAL,
                confidence=0.95,
                indicators=[],
                reasoning="No suspicious patterns detected in the analyzed telemetry."
            )

        return results

    def _calculate_category_score(self, features: ForensicFeatureSet, rules: Dict[str, Any]) -> float:
        """Calculate threat score for a category"""
        score = 0.0

        # Check feature-based indicators
        feature_names = rules.get("features", [])
        for feature_name in feature_names:
            value = getattr(features, feature_name, 0)
            if isinstance(value, int) and value > 0:
                score += min(value * 0.5, 3.0)  # Cap at 3 points per feature

        # Check indicator counts
        if features.suspicious_processes > 5:
            score += 1.5
        if features.suspicious_commands:
            score += len(features.suspicious_commands) * 0.3
        if features.persistence_keys:
            score += len(features.persistence_keys) * 1.0
        if features.external_ips:
            score += len(features.external_ips) * 0.5

        return score

    def _extract_indicators(self, features: ForensicFeatureSet, rules: Dict[str, Any]) -> List[str]:
        """Extract specific indicators from features"""
        indicators = []

        # Based on feature analysis
        if features.encryption_indicators > 0:
            indicators.append(f"Detected {features.encryption_indicators} encryption-related operations")
        if features.suspicious_processes > 0:
            indicators.append(f"Found {features.suspicious_processes} suspicious processes")
        if features.suspicious_commands:
            indicators.append(f"Detected {len(features.suspicious_commands)} suspicious commands")
        if features.persistence_keys:
            indicators.append(f"Found {len(features.persistence_keys)} potential persistence mechanisms")
        if features.external_ips:
            indicators.append(f"Connected to {len(features.external_ips)} external IP addresses")
        if features.download_indicators > 0:
            indicators.append(f"Detected {features.download_indicators} file download operations")

        return indicators[:5]  # Limit to top 5

    def _generate_reasoning(self, category: ThreatCategory, score: float, features: ForensicFeatureSet) -> str:
        """Generate human-readable reasoning for classification"""
        parts = ["Classification based on analysis of"]
        if features.file_modifications > 10:
            parts.append(f"{features.file_modifications} file modifications")
        if features.suspicious_processes > 0:
            parts.append(f"{features.suspicious_processes} suspicious processes")
        if features.network_connections > 0:
            parts.append(f"{features.network_connections} network connections")
        reasoning = ', '.join(parts) + "."
        if reasoning == "Classification based on analysis of.":
            reasoning = "Classification based on general behavioral analysis."
        return reasoning

    def get_primary_threat(self, classifications: Dict[ThreatCategory, ThreatClassificationResult]) -> ThreatClassificationResult:
        """Get the primary (highest confidence) threat"""
        if not classifications:
            return ThreatClassificationResult(
                category=ThreatCategory.NORMAL,
                confidence=1.0,
                indicators=[],
                reasoning="No threats detected"
            )

        # Filter out normal and get highest confidence
        non_normal = {k: v for k, v in classifications.items() if k != ThreatCategory.NORMAL}

        if not non_normal:
            return classifications.get(ThreatCategory.NORMAL, ThreatClassificationResult(
                category=ThreatCategory.NORMAL,
                confidence=1.0,
                indicators=[],
                reasoning="No threats detected"
            ))

        primary = max(non_normal.values(), key=lambda x: x.confidence)
        return primary


threat_classifier = ThreatClassifier()