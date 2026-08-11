"""
Tests for telemetry analysis endpoint.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.modules.llm_router import LlmRouterOutput, _anomalies_to_text
from app.core.models import AnomalyResult, SeverityLevel


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


SAMPLE_EVENTS = [
    {
        "timestamp": "2024-01-01T00:00:00Z",
        "type": "process",
        "source": "sandbox",
        "details": {
            "process_name": "cmd.exe",
            "command_line": "encrypt *.docx",
            "pid": 1234,
            "parent_pid": 567,
        },
    },
    {
        "timestamp": "2024-01-01T00:00:01Z",
        "type": "file",
        "source": "sandbox",
        "details": {
            "path": "C:\\Users\\test\\Documents\\encrypted.docx",
            "operation": "write",
            "size_bytes": 65536,
        },
    },
    {
        "timestamp": "2024-01-01T00:00:02Z",
        "type": "network",
        "source": "sandbox",
        "details": {
            "destination_ip": "185.130.5.203",
            "destination_port": 443,
            "protocol": "TLS",
        },
    },
]


@pytest.mark.asyncio
async def test_analyze_telemetry_success(client):
    async with client as ac:
        resp = await ac.post(
            "/api/v1/analyze/telemetry",
            json={"session_id": "test-session-001", "events": SAMPLE_EVENTS},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["session_id"] == "test-session-001"
    assert data["data"]["total_events"] == 3
    assert "severity_level" in data["data"]
    assert "recommendations" in data["data"]


@pytest.mark.asyncio
async def test_analyze_telemetry_empty_events(client):
    async with client as ac:
        resp = await ac.post(
            "/api/v1/analyze/telemetry",
            json={"session_id": "test-session-002", "events": []},
        )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_analyze_telemetry_missing_session(client):
    async with client as ac:
        resp = await ac.post(
            "/api/v1/analyze/telemetry",
            json={"events": SAMPLE_EVENTS},
        )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_analyze_telemetry_empty_session(client):
    async with client as ac:
        resp = await ac.post(
            "/api/v1/analyze/telemetry",
            json={"session_id": "", "events": SAMPLE_EVENTS},
        )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_analyze_report_success(client):
    async with client as ac:
        resp = await ac.post(
            "/api/v1/analyze/report",
            json={
                "investigation_id": "inv-001",
                "events": SAMPLE_EVENTS,
                "iocIndicators": [{"type": "ip", "value": "185.130.5.203"}],
                "summary": "Suspicious encryption activity detected",
            },
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True


@pytest.mark.asyncio
async def test_analyze_report_llm_path(client, monkeypatch):
    async def fake_llm(features, events, anomalies):
        return LlmRouterOutput(
            threat_classification={"ransomware_like": 0.85, "suspicious_behavior": 0.9},
            severity_score=72.0,
            severity_level="high",
            behavioral_summary="Ransomware-like encryption behavior detected",
            recommendations=["Isolate the host"],
            confidence=0.88,
            executive_summary="Executive summary from LLM",
            key_findings=["finding-1"],
            mitre_mapping=[
                {"technique_id": "T1486", "technique_name": "Data Encrypted for Impact"}
            ],
            attack_chain=[{"phase": "impact", "techniques": ["T1486"], "event_count": 3}],
            anti_forensics_detected=True,
            anti_forensics_indicators=["timestamp manipulation"],
            reconstruction_summary="Reconstruction narrative",
            predicted_next_step="lateral movement",
            stealth_rating="medium",
        )

    monkeypatch.setattr("app.routes.analysis.analyze_with_llm", fake_llm)

    async with client as ac:
        resp = await ac.post(
            "/api/v1/analyze/report",
            json={
                "investigation_id": "inv-llm-001",
                "events": SAMPLE_EVENTS,
                "iocIndicators": [{"type": "ip", "value": "185.130.5.203"}],
            },
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    llm_data = data["data"]
    assert llm_data["mitre_mapping"][0]["technique_id"] == "T1486"
    assert llm_data["attack_chain"][0]["phase"] == "impact"
    assert llm_data["threat_classification"]["ransomware_like"] == 0.85
    assert llm_data["primary_threat"] == "suspicious_behavior"
    assert llm_data["executive_summary"] == "Executive summary from LLM"
    assert llm_data["findings_summary"] == "Executive summary from LLM"
    assert llm_data["severity_level"] == "high"
    assert llm_data["anti_forensics_detected"] is True
    assert "behavioral_summary" in llm_data
    assert "reconstruction_summary" in llm_data
    assert "predicted_next_step" in llm_data
    assert llm_data["threat_indicators"] == [{"type": "ip", "value": "185.130.5.203"}]


@pytest.mark.asyncio
async def test_analyze_report_llm_fallback(client, monkeypatch):
    async def fake_llm(features, events, anomalies):
        return None

    monkeypatch.setattr("app.routes.analysis.analyze_with_llm", fake_llm)

    async with client as ac:
        resp = await ac.post(
            "/api/v1/analyze/report",
            json={
                "investigation_id": "inv-fallback-001",
                "events": SAMPLE_EVENTS,
            },
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "findings_summary" in data["data"]
    assert "severity_level" in data["data"]
    assert "mitre_mapping" not in data["data"]


@pytest.mark.asyncio
async def test_analyze_report_llm_with_anomalies_no_crash(client, monkeypatch):
    async def fake_llm(features, events, anomalies):
        return LlmRouterOutput(
            threat_classification={"suspicious_behavior": 0.9},
            severity_score=65.0,
            severity_level="medium",
            behavioral_summary="Anomalous behavior detected",
            recommendations=["Investigate"],
            confidence=0.8,
        )

    monkeypatch.setattr("app.routes.analysis.analyze_with_llm", fake_llm)
    monkeypatch.setattr(
        "app.routes.analysis.anomaly_detector.detect_anomalies",
        lambda events, features: [
            AnomalyResult(
                type="burst",
                description="Event burst detected",
                severity=SeverityLevel.HIGH,
                events_involved=["ev-1"],
                deviation_score=4.5,
            )
        ],
    )

    async with client as ac:
        resp = await ac.post(
            "/api/v1/analyze/report",
            json={
                "investigation_id": "inv-anom-001",
                "events": SAMPLE_EVENTS,
            },
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["anomalies"][0]["type"] == "burst"


def test_anomalies_to_text_handles_anomaly_result():
    text = _anomalies_to_text(
        [
            AnomalyResult(
                type="burst",
                description="Event burst detected",
                severity=SeverityLevel.HIGH,
                events_involved=["ev-1"],
                deviation_score=4.5,
            )
        ]
    )
    assert "burst" in text
    assert "high" in text


def test_anomalies_to_text_handles_dicts():
    text = _anomalies_to_text([{"type": "burst", "description": "d", "severity": "medium"}])
    assert "burst" in text


@pytest.mark.asyncio
async def test_enrich_alert_success(client):
    async with client as ac:
        resp = await ac.post(
            "/api/v1/enrich/alert",
            json={
                "alert_id": "alert-001",
                "events": SAMPLE_EVENTS,
                "severity": "high",
                "description": "Suspicious encryption activity detected",
                "iocIndicators": [{"type": "ip", "value": "185.130.5.203"}],
            },
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["alert_id"] == "alert-001"
    assert "severity_score" in data["data"]
    assert "recommendations" in data["data"]


@pytest.mark.asyncio
async def test_enrich_alert_no_events(client):
    async with client as ac:
        resp = await ac.post(
            "/api/v1/enrich/alert",
            json={
                "alert_id": "alert-002",
                "indicators": [{"type": "ip", "value": "10.0.0.1"}],
            },
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["indicators_found"] == 1


@pytest.mark.asyncio
async def test_summarize_investigation_success(client):
    async with client as ac:
        resp = await ac.post(
            "/api/v1/summarize/investigation",
            json={
                "id": "inv-001",
                "title": "Test Investigation",
                "events": SAMPLE_EVENTS,
                "evidence": [{"id": "ev-1"}],
                "alerts": [{"id": "al-1"}],
            },
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "executive_summary" in data["data"]
    assert data["data"]["total_events_analyzed"] > 0


@pytest.mark.asyncio
async def test_summarize_investigation_no_events(client):
    async with client as ac:
        resp = await ac.post(
            "/api/v1/summarize/investigation",
            json={
                "id": "inv-002",
                "title": "Empty Investigation",
            },
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["total_events_analyzed"] == 0


@pytest.mark.asyncio
async def test_executive_report_success(client):
    async with client as ac:
        resp = await ac.post(
            "/api/v1/report/executive",
            json={
                "investigation_id": "inv-001",
                "title": "Test Report",
                "events": SAMPLE_EVENTS,
            },
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "narrative" in data["data"]
    assert len(data["data"]["sections"]) > 0


@pytest.mark.asyncio
async def test_executive_report_no_events(client):
    async with client as ac:
        resp = await ac.post(
            "/api/v1/report/executive",
            json={"investigation_id": "inv-002"},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["sections"] == []


@pytest.mark.asyncio
async def test_analyze_report_no_data(client):
    async with client as ac:
        resp = await ac.post(
            "/api/v1/analyze/report",
            json={},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "no analysable data" in data["message"].lower()
