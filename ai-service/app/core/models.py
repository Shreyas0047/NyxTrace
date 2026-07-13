"""
Core Data Models for AI Analysis
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from enum import Enum


class SeverityLevel(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "informational"


class ThreatCategory(str, Enum):
    RANSOMWARE_LIKE = "ransomware_like"
    SPYWARE_LIKE = "spyware_like"
    TROJAN_LIKE = "trojan_like"
    BOTNET_LIKE = "botnet_like"
    CREDENTIAL_ACCESS = "credential_access"
    PERSISTENCE = "persistence"
    PROCESS_INJECTION = "process_injection"
    DATA_EXFILTRATION = "data_exfiltration"
    DESTRUCTIVE = "destructive"
    SUSPICIOUS_BEHAVIOR = "suspicious_behavior"
    NORMAL = "normal"


class TelemetryEvent(BaseModel):
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    type: str
    source: str = "unknown"
    details: Dict[str, Any] = Field(default_factory=dict)
    suspicious_score: Optional[float] = None

    @field_validator('type')
    @classmethod
    def validate_type(cls, v: str) -> str:
        allowed = {'process', 'file', 'registry', 'network'}
        if v.lower() not in allowed:
            return 'unknown'
        return v.lower()


class TelemetryAnalysisRequest(BaseModel):
    session_id: str = Field(..., min_length=1)
    investigation_id: Optional[str] = None
    events: List[TelemetryEvent]
    metadata: Optional[Dict[str, Any]] = None

    @field_validator('session_id')
    @classmethod
    def validate_session_id(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('session_id must not be empty')
        return v.strip()

    @field_validator('events')
    @classmethod
    def validate_events(cls, v: List[TelemetryEvent]) -> List[TelemetryEvent]:
        if not v:
            raise ValueError('At least one event is required for analysis')
        if len(v) > 50000:
            raise ValueError(f'Too many events ({len(v)}). Maximum is 50000.')
        return v


class TelemetryAnalysisResult(BaseModel):
    session_id: str
    analysis_timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    total_events: int
    suspicious_events: int
    threat_classification: Dict[str, float]
    severity_score: float
    severity_level: SeverityLevel
    anomalies: List[Dict[str, Any]]
    behavioral_summary: str
    recommendations: List[str]
    confidence: float


class ForensicFeatureSet(BaseModel):
    total_processes: int = 0
    suspicious_processes: int = 0
    process_tree_depth: int = 0
    suspicious_commands: List[str] = Field(default_factory=list)

    file_operations: int = 0
    file_creates: int = 0
    file_modifications: int = 0
    file_deletes: int = 0
    suspicious_extensions: List[str] = Field(default_factory=list)

    registry_operations: int = 0
    registry_writes: int = 0
    persistence_keys: List[str] = Field(default_factory=list)

    network_connections: int = 0
    external_ips: List[str] = Field(default_factory=list)
    suspicious_ports: List[int] = Field(default_factory=list)

    encryption_indicators: int = 0
    credential_access_indicators: int = 0
    download_indicators: int = 0


class ThreatClassificationResult(BaseModel):
    category: ThreatCategory
    confidence: float
    indicators: List[str]
    reasoning: str

    @field_validator('confidence')
    @classmethod
    def validate_confidence(cls, v: float) -> float:
        return max(0.0, min(1.0, v))


class SeverityScoreResult(BaseModel):
    score: float
    level: SeverityLevel
    factors: Dict[str, float]
    reasoning: str


class AnomalyResult(BaseModel):
    type: str
    description: str
    severity: SeverityLevel
    events_involved: List[str]
    deviation_score: float


class InvestigationSummary(BaseModel):
    executive_summary: str
    analyst_summary: str
    key_findings: List[str]
    timeline_summary: str
    recommendations: List[str]
    confidence: float


class AnalysisResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
