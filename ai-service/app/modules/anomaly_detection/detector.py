"""
Anomaly Detection Module

Detects behavioral anomalies in forensic telemetry.
Note: Foundation for future ML-based detection systems.
"""

from typing import List
import statistics

from app.core.models import (
    TelemetryEvent,
    ForensicFeatureSet,
    AnomalyResult,
    SeverityLevel
)
from app.core.config import config


class AnomalyDetector:
    """Detects anomalies in forensic telemetry"""

    # Baseline thresholds (these would be learned in production)
    BASELINE_THRESHOLDS = {
        "file_create_burst": 50,
        "process_spawn_burst": 20,
        "registry_write_burst": 30,
        "network_connection_burst": 15,
        "unique_external_ips": 5,
    }

    def detect_anomalies(
        self,
        events: List[TelemetryEvent],
        features: ForensicFeatureSet
    ) -> List[AnomalyResult]:
        """Detect anomalies in telemetry events"""
        anomalies = []

        # Analyze temporal patterns
        temporal_anomalies = self._detect_temporal_anomalies(events)
        anomalies.extend(temporal_anomalies)

        # Analyze behavioral patterns
        behavioral_anomalies = self._detect_behavioral_anomalies(features)
        anomalies.extend(behavioral_anomalies)

        # Analyze process tree anomalies
        process_anomalies = self._detect_process_anomalies(events)
        anomalies.extend(process_anomalies)

        # Analyze network anomalies
        network_anomalies = self._detect_network_anomalies(features)
        anomalies.extend(network_anomalies)

        return anomalies

    def _detect_temporal_anomalies(self, events: List[TelemetryEvent]) -> List[AnomalyResult]:
        """Detect temporal anomalies (bursts of activity)"""
        anomalies = []

        if not events:
            return anomalies

        # Group events by timestamp (minute-level)
        event_counts = {}
        for event in events:
            try:
                ts = event.timestamp
                timestamp = ts[:16] if len(ts) >= 16 else ts  # Minute precision
                event_counts[timestamp] = event_counts.get(timestamp, 0) + 1
            except Exception:
                continue

        if not event_counts:
            return anomalies

        # Calculate mean and std
        counts = list(event_counts.values())
        if len(counts) < 2:
            return anomalies

        mean_count = statistics.mean(counts)
        std_count = statistics.stdev(counts) if len(counts) > 1 else 0

        if std_count == 0:
            return anomalies

        z_score_threshold = config.ANOMALY_ZSCORE_THRESHOLD

        # Find anomalous timestamps
        for timestamp, count in event_counts.items():
            if count > 0:
                z_score = (count - mean_count) / std_count

                if z_score > z_score_threshold:
                    if count >= self.BASELINE_THRESHOLDS["file_create_burst"]:
                        anomalies.append(AnomalyResult(
                            type="high_activity_burst",
                            description=f"Unusually high activity at {timestamp}: {count} events",
                            severity=SeverityLevel.HIGH if z_score > 3 else SeverityLevel.MEDIUM,
                            events_involved=[timestamp],
                            deviation_score=round(z_score, 2)
                        ))

        return anomalies

    def _detect_behavioral_anomalies(self, features: ForensicFeatureSet) -> List[AnomalyResult]:
        """Detect behavioral anomalies based on feature thresholds"""
        anomalies = []

        # Check for suspicious process spawning
        if features.total_processes > 50 and features.suspicious_processes > features.total_processes * 0.3:
            anomalies.append(AnomalyResult(
                type="suspicious_process_ratio",
                description=f"High ratio of suspicious processes: {features.suspicious_processes}/{features.total_processes}",
                severity=SeverityLevel.HIGH,
                events_involved=["process_activity"],
                deviation_score=round(features.suspicious_processes / max(features.total_processes, 1), 2)
            ))

        # Check for mass file modification
        if features.file_modifications > 100:
            anomalies.append(AnomalyResult(
                type="mass_file_modification",
                description=f"Unusually high file modifications: {features.file_modifications} files",
                severity=SeverityLevel.CRITICAL,
                events_involved=["file_operations"],
                deviation_score=min(features.file_modifications / 10, 10)
            ))

        # Check for excessive persistence attempts
        if len(features.persistence_keys) > 3:
            anomalies.append(AnomalyResult(
                type="excessive_persistence",
                description=f"Multiple persistence mechanisms detected: {len(features.persistence_keys)} keys",
                severity=SeverityLevel.HIGH,
                events_involved=features.persistence_keys[:3],
                deviation_score=len(features.persistence_keys)
            ))

        return anomalies

    def _detect_process_anomalies(self, events: List[TelemetryEvent]) -> List[AnomalyResult]:
        """Detect process-related anomalies"""
        anomalies = []

        # Collect process creation events
        process_events = [e for e in events if e.type.lower() == 'process']

        if len(process_events) > 30:
            anomalies.append(AnomalyResult(
                type="process_spawn_burst",
                description=f"High volume of process spawns detected: {len(process_events)} processes",
                severity=SeverityLevel.MEDIUM,
                events_involved=["process_creation"],
                deviation_score=min(len(process_events) / 10, 10)
            ))

        # Check for suspicious process chains
        suspicious_commands = [e for e in process_events if e.details.get('suspicious', False)]
        if len(suspicious_commands) > 5:
            anomalies.append(AnomalyResult(
                type="suspicious_process_chain",
                description=f"Suspicious process execution chain detected: {len(suspicious_commands)} events",
                severity=SeverityLevel.HIGH,
                events_involved=["process_chain"],
                deviation_score=len(suspicious_commands) / 2
            ))

        return anomalies

    def _detect_network_anomalies(self, features: ForensicFeatureSet) -> List[AnomalyResult]:
        """Detect network-related anomalies"""
        anomalies = []

        # Check for multiple external connections
        if len(features.external_ips) > self.BASELINE_THRESHOLDS["unique_external_ips"]:
            anomalies.append(AnomalyResult(
                type="multiple_external_connections",
                description=f"Connection to multiple external IPs: {len(features.external_ips)} unique IPs",
                severity=SeverityLevel.MEDIUM,
                events_involved=features.external_ips[:3],
                deviation_score=len(features.external_ips)
            ))

        # Check for suspicious ports
        if len(features.suspicious_ports) > 0:
            anomalies.append(AnomalyResult(
                type="suspicious_ports_used",
                description=f"Connection to suspicious ports: {features.suspicious_ports}",
                severity=SeverityLevel.HIGH,
                events_involved=[f"port:{p}" for p in features.suspicious_ports],
                deviation_score=len(features.suspicious_ports)
            ))

        # Check for high network activity
        if features.network_connections > 50:
            anomalies.append(AnomalyResult(
                type="high_network_activity",
                description=f"Excessive network connections: {features.network_connections} connections",
                severity=SeverityLevel.MEDIUM,
                events_involved=["network_activity"],
                deviation_score=min(features.network_connections / 10, 10)
            ))

        return anomalies


anomaly_detector = AnomalyDetector()