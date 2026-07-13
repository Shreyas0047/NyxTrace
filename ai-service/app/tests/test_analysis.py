"""
Tests for telemetry analysis endpoint.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


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
                "iocIndicators": ["185.130.5.203"],
                "summary": "Suspicious encryption activity detected",
            },
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True


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
                "iocIndicators": ["185.130.5.203"],
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
                "indicators": ["10.0.0.1"],
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
