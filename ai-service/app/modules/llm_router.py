"""
LLM Router Module

Single comprehensive prompt that replaces 5 heuristic analysis modules
with one structured LLM call. Falls back gracefully to the existing pipeline.
"""

import json
import logging
from dataclasses import dataclass
from typing import Optional

import httpx

from app.core.config import config
from app.core.models import ForensicFeatureSet

logger = logging.getLogger(__name__)


@dataclass
class LlmRouterOutput:
    threat_classification: Optional[dict] = None
    severity_score: Optional[float] = None
    severity_level: Optional[str] = None
    behavioral_summary: Optional[str] = None
    recommendations: Optional[list] = None
    confidence: Optional[float] = None
    executive_summary: Optional[str] = None
    key_findings: Optional[list] = None
    mitre_mapping: Optional[list] = None
    attack_chain: Optional[list] = None
    anti_forensics_detected: Optional[bool] = None
    anti_forensics_indicators: Optional[list] = None
    reconstruction_summary: Optional[str] = None
    predicted_next_step: Optional[str] = None
    stealth_rating: Optional[str] = None


THREAT_CATEGORIES = [
    "ransomware_like", "credential_access", "persistence", "data_exfiltration",
    "spyware_like", "trojan_like", "botnet_like", "process_injection",
    "destructive", "suspicious_behavior", "normal",
]

JSON_SCHEMA = """{
  "threat_classification": {
    "ransomware_like": 0.85,
    "credential_access": 0.3,
    "persistence": 0.7,
    "data_exfiltration": 0.0,
    "spyware_like": 0.0,
    "trojan_like": 0.0,
    "botnet_like": 0.0,
    "process_injection": 0.0,
    "destructive": 0.0,
    "suspicious_behavior": 0.9,
    "normal": 0.0
  },
  "severity_score": 72,
  "severity_level": "high",
  "behavioral_summary": "A short 1-2 sentence summary of observed behavior",
  "recommendations": ["actionable recommendation 1", "actionable recommendation 2"],
  "confidence": 0.85,
  "executive_summary": "2-3 sentence executive summary for non-technical stakeholders",
  "key_findings": ["specific finding 1", "specific finding 2"],
  "mitre_mapping": [
    {
      "technique_id": "T1059.001",
      "technique_name": "PowerShell",
      "tactic": "execution",
      "confidence": 0.9,
      "evidence_snippets": ["powershell -enc"]
    }
  ],
  "attack_chain": [
    {
      "phase": "execution",
      "techniques": ["T1059.001"],
      "event_count": 2
    }
  ],
  "anti_forensics_detected": false,
  "anti_forensics_indicators": [],
  "reconstruction_summary": "A paragraph describing the reconstructed attack flow",
  "predicted_next_step": "What the attacker is likely to do next based on the kill chain",
  "stealth_rating": "medium"
}"""

CATEGORY_GUIDE = """
- ransomware_like: file encryption, ransom notes, shadow copy deletion
- credential_access: LSASS access, registry SAM access, credential dumping tools
- persistence: registry run keys, scheduled tasks, startup folder modifications
- data_exfiltration: large outbound transfers, archive creation, unusual protocols
- spyware_like: keylogging, screen capture, surveillance behavior
- trojan_like: backdoor RAT behavior, disguised executables
- botnet_like: C2 beaconing, DDoS tools, IRC activity
- process_injection: CreateRemoteThread, process hollowing, DLL injection
- destructive: disk wipes, boot record modification, system file deletion
- suspicious_behavior: general suspicious activity that doesn't fit other categories
- normal: no suspicious indicators; set to 1.0 only when activity is clearly benign
"""

SYSTEM_PROMPT = f"""You are a forensic analysis AI specializing in malware sandbox analysis. Analyze the provided telemetry and return ONLY valid JSON matching the schema below.

Classification guidelines:
{CATEGORY_GUIDE}

- Assign confidence scores 0.0-1.0 for each threat category based on the evidence.
- Multiple categories can have high confidence if multiple threats are detected.
- Set "normal" to 1.0 ONLY if no suspicious activity is present.
- severity_score should be 0-100 based on impact, persistence, and sophistication.
- For the attack_chain, identify which kill chain phase(s) the activity represents.
- Map observed commands and behaviors to specific MITRE ATT&CK technique IDs where possible.
- predicted_next_step should identify the most likely next attacker action.

Return ONLY valid JSON. No preamble. No explanation. No markdown formatting."""


def _features_to_text(features: ForensicFeatureSet) -> str:
    lines = []
    lines.append(f"Total processes: {features.total_processes}")
    lines.append(f"Suspicious processes: {features.suspicious_processes}")
    lines.append(f"Process tree depth: {features.process_tree_depth}")
    if features.suspicious_commands:
        lines.append(f"Suspicious commands: {', '.join(features.suspicious_commands[:10])}")
    lines.append(f"File operations: {features.file_operations} (creates: {features.file_creates}, modifications: {features.file_modifications}, deletes: {features.file_deletes})")
    if features.suspicious_extensions:
        lines.append(f"Suspicious file extensions: {', '.join(features.suspicious_extensions[:10])}")
    lines.append(f"Registry operations: {features.registry_operations} (writes: {features.registry_writes})")
    if features.persistence_keys:
        lines.append(f"Persistence keys: {', '.join(features.persistence_keys[:10])}")
    lines.append(f"Network connections: {features.network_connections}")
    if features.external_ips:
        lines.append(f"External IPs: {', '.join(features.external_ips[:10])}")
    if features.suspicious_ports:
        lines.append(f"Suspicious ports: {', '.join(str(p) for p in features.suspicious_ports[:10])}")
    lines.append(f"Encryption indicators: {features.encryption_indicators}")
    lines.append(f"Credential access indicators: {features.credential_access_indicators}")
    lines.append(f"Download indicators: {features.download_indicators}")
    return "\n".join(lines)


def _events_to_text(events: list) -> str:
    max_events = config.LLM_MAX_EVENTS_IN_PROMPT
    lines = []

    for i, ev in enumerate(events[:max_events]):
        ts = ev.get("timestamp", "")
        ev_type = ev.get("type", "")
        ev_source = ev.get("source", "")
        details = ev.get("details", {})
        if isinstance(details, dict):
            trimmed = {k: v for k, v in list(details.items())[:6]}
        else:
            trimmed = str(details)[:200]
        lines.append(f"[{i}] ts={ts} type={ev_type} source={ev_source} details={json.dumps(trimmed, default=str)}")

    remaining = len(events) - max_events
    if remaining > 0:
        type_counts = {}
        for ev in events:
            t = ev.get("type", "unknown")
            type_counts[t] = type_counts.get(t, 0) + 1
        lines.append(f"... and {remaining} more events (summary: {type_counts})")

    return "\n".join(lines)


def _anomalies_to_text(anomalies: list) -> str:
    if not anomalies:
        return "No anomalies detected."

    def _field(anomaly, name: str, default: str) -> str:
        if isinstance(anomaly, dict):
            value = anomaly.get(name, default)
        else:
            value = getattr(anomaly, name, default)
        return str(getattr(value, "value", value))

    return "\n".join(
        f"- [{_field(a, 'severity', 'info')}] {_field(a, 'type', 'unknown')}: {_field(a, 'description', '')}"
        for a in anomalies[:10]
    )


def _build_prompt(
    features_text: str,
    events_text: str,
    anomalies_text: str,
) -> str:
    return f"""Analyze the following forensic sandbox telemetry and return the JSON analysis result.

## Extracted Features
{features_text}

## Anomalies
{anomalies_text}

## Raw Events
{events_text}

## Required JSON Schema
{JSON_SCHEMA}

Return ONLY valid JSON matching the schema above. No preamble. No explanation. No markdown."""


def _parse_response(response_text: str) -> Optional[dict]:
    text = response_text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
        if text.endswith("```"):
            text = text[:-3].strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def _map_to_output(data: dict) -> LlmRouterOutput:
    return LlmRouterOutput(
        threat_classification=data.get("threat_classification"),
        severity_score=data.get("severity_score"),
        severity_level=data.get("severity_level"),
        behavioral_summary=data.get("behavioral_summary"),
        recommendations=data.get("recommendations"),
        confidence=data.get("confidence"),
        executive_summary=data.get("executive_summary"),
        key_findings=data.get("key_findings"),
        mitre_mapping=data.get("mitre_mapping"),
        attack_chain=data.get("attack_chain"),
        anti_forensics_detected=data.get("anti_forensics_detected"),
        anti_forensics_indicators=data.get("anti_forensics_indicators"),
        reconstruction_summary=data.get("reconstruction_summary"),
        predicted_next_step=data.get("predicted_next_step"),
        stealth_rating=data.get("stealth_rating"),
    )


async def ping_ollama() -> bool:
    try:
        async with httpx.AsyncClient(timeout=config.LLM_OLLAMA_PING_TIMEOUT) as client:
            resp = await client.get(f"{config.LLM_OLLAMA_URL}/api/tags")
            return resp.status_code == 200
    except Exception:
        return False


async def call_ollama(prompt: str) -> Optional[str]:
    async with httpx.AsyncClient(timeout=config.LLM_TIMEOUT) as client:
        resp = await client.post(
            f"{config.LLM_OLLAMA_URL}/api/generate",
            json={
                "model": config.LLM_OLLAMA_MODEL,
                "system": SYSTEM_PROMPT,
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "options": {
                    "temperature": config.LLM_TEMPERATURE,
                    "num_predict": config.LLM_MAX_RESPONSE_TOKENS,
                },
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("response")


async def analyze_with_llm(
    features: ForensicFeatureSet,
    events: list,
    anomalies: list,
) -> Optional[LlmRouterOutput]:
    if not config.LLM_ENABLED or not config.LLM_PRIMARY_PATH:
        return None

    alive = await ping_ollama()
    if not alive:
        logger.warning("Ollama not reachable, falling back to heuristic pipeline")
        return None

    features_text = _features_to_text(features)
    events_text = _events_to_text(events)
    anomalies_text = _anomalies_to_text(anomalies)

    prompt = _build_prompt(features_text, events_text, anomalies_text)

    for attempt in range(2 if config.LLM_RETRY_ON_FAILURE else 1):
        try:
            raw = await call_ollama(prompt)
            if not raw:
                continue
            parsed = _parse_response(raw)
            if not parsed:
                logger.warning(f"LLM returned invalid JSON (attempt {attempt + 1})")
                continue
            return _map_to_output(parsed)
        except Exception as e:
            logger.warning(f"LLM call failed (attempt {attempt + 1}): {e}")

    logger.warning("LLM analysis failed after all attempts")
    return None
