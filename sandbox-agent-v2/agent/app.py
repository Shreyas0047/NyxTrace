"""FastAPI Application — the HTTP/WebSocket interface.

Implements every endpoint the Node.js backend calls:
  GET  /health
  GET  /simulators
  POST /sessions/start
  GET  /sessions/{id}
  GET  /sessions/{id}/events
  GET  /sessions
  POST /sessions/{id}/stop
  POST /sessions/{id}/terminate
  POST /vm/reset
  GET  /vm/status
  GET  /monitoring/status
  GET  /execution/status
  GET  /logs
  WS   /telemetry/live
  WS   /logs/live
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import deque
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from agent.config import settings
from agent.models import (
    HealthResponse, SimulatorInfo, StartSessionRequest,
    SessionState, ExecutionStatus,
)
from agent.security import SandboxResourceLimits, validate_resource_limits
from agent.vm import VMManager, VMError
from agent.pipeline import SessionPipeline

log = logging.getLogger("agent.app")

# =============================================================================
# GLOBALS
# =============================================================================

_vm: Optional[VMManager] = None
_pipeline: Optional[SessionPipeline] = None
_start_time: float = 0
_telemetry_clients: set[WebSocket] = set()
_log_clients: set[WebSocket] = set()
_event_queue: asyncio.Queue = asyncio.Queue(maxsize=10000)
_log_buffer: deque = deque(maxlen=1000)

# Simulator registry
SIMULATORS = [
    SimulatorInfo(id="system-service-alpha", display_name="LockByte", description="Simulates ransomware: encrypts target file types, removes shadow copies, and drops a ransom note", category="system"),
    SimulatorInfo(id="system-service-beta", display_name="HiveMind", description="Simulates a botnet agent: C2 beaconing, spawning child processes, and registry persistence", category="system"),
    SimulatorInfo(id="system-service-gamma", display_name="VaultDrain", description="Simulates credential theft: reads SAM and LSASS credential stores, dumps browser credentials, and stages exfiltration", category="system"),
    SimulatorInfo(id="system-service-delta", display_name="SilentEye", description="Simulates spyware: keylogging, screen capture, and sensitive document harvesting", category="system"),
    SimulatorInfo(id="system-service-epsilon", display_name="GhostKernel", description="Simulates evasion: deep persistence, boot configuration modification, and process injection", category="system"),
    SimulatorInfo(id="system-service-lateral", display_name="NetWarp", description="Simulates lateral movement: network discovery, SMB enumeration, pass-the-hash, and remote execution", category="system"),
]


def _broadcast(event: dict) -> None:
    """Thread-safe broadcast — enqueues for async delivery."""
    try:
        _event_queue.put_nowait(event)
    except asyncio.QueueFull:
        pass


def _add_log(level: str, message: str, session_id: Optional[str] = None) -> None:
    """Add to log buffer and broadcast."""
    from datetime import datetime, timezone
    entry = {"timestamp": datetime.now(timezone.utc).isoformat(), "level": level, "message": message, "session_id": session_id}
    _log_buffer.append(entry)
    _broadcast({"type": "log", **entry})


# =============================================================================
# LIFESPAN
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _vm, _pipeline, _start_time

    from agent.logging_config import configure_json_logging
    configure_json_logging(service="sandbox-agent")
    _start_time = time.time()

    log.info("=== Sandbox Agent v2.0.0 starting ===")
    _add_log("INFO", "Sandbox Agent v2.0.0 starting")

    _vm = VMManager()
    _pipeline = SessionPipeline(vm=_vm, simulators_dir=Path(__file__).parent.parent / "simulators")
    _pipeline.set_broadcast(_broadcast)

    _add_log("INFO", "VM Manager initialized")
    _add_log("INFO", "Pipeline ready")

    # Background broadcaster
    task = asyncio.create_task(_ws_broadcaster())

    yield

    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


async def _ws_broadcaster() -> None:
    """Drain event queue and broadcast to all WebSocket clients."""
    while True:
        event = await _event_queue.get()
        is_log = event.get("type") == "log"

        # Send to appropriate clients
        targets = _log_clients if is_log else _telemetry_clients
        dead: set[WebSocket] = set()
        for ws in list(targets):
            try:
                await asyncio.wait_for(ws.send_json(event), timeout=5)
            except Exception:
                dead.add(ws)
        targets.difference_update(dead)

        # Telemetry events also go to telemetry clients
        if not is_log:
            dead2: set[WebSocket] = set()
            for ws in list(_telemetry_clients):
                try:
                    await asyncio.wait_for(ws.send_json(event), timeout=5)
                except Exception:
                    dead2.add(ws)
            _telemetry_clients.difference_update(dead2)


# =============================================================================
# APP FACTORY
# =============================================================================

def create_app() -> FastAPI:
    app = FastAPI(title="NyxTrace Sandbox Agent", version="2.0.0", lifespan=lifespan)

    is_wildcard = settings.CORS_ORIGINS == ["*"]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=not is_wildcard,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # API key authentication middleware — checks every HTTP request except
    # /health (which is used by load balancers / k8s probes).
    @app.middleware("http")
    async def _api_key_middleware(request, call_next):
        if settings.API_KEY and request.url.path != "/health":
            api_key = request.headers.get("X-API-Key")
            if not api_key:
                from starlette.responses import JSONResponse
                return JSONResponse(status_code=401, content={"detail": "Missing X-API-Key header"})
            if api_key != settings.API_KEY:
                from starlette.responses import JSONResponse
                return JSONResponse(status_code=401, content={"detail": "Invalid API key"})
        return await call_next(request)

    # Surface the inbound correlation ID on every response and stash it on the
    # request scope so handlers/log statements can include it.
    @app.middleware("http")
    async def _correlation_id_middleware(request, call_next):
        from agent.tracing import correlation_id

        cid = request.headers.get("x-correlation-id") or request.headers.get("X-Correlation-ID")
        token = correlation_id.set(cid) if cid else None
        try:
            if cid:
                request.state.correlation_id = cid
            response = await call_next(request)
            if cid:
                response.headers["X-Correlation-ID"] = cid
            return response
        finally:
            if token:
                correlation_id.reset(token)

    # -------------------------------------------------------------------------
    # HEALTH
    # -------------------------------------------------------------------------

    @app.get("/health")
    async def health() -> HealthResponse:
        vm_status = {}
        try:
            state = _vm.get_state()
            vm_status = {"vm_name": "ForensicsSandbox", "vm_status": state}
        except Exception as e:
            vm_status = {"error": str(e)}

        active = _pipeline.active_session
        return HealthResponse(
            uptime_seconds=time.time() - _start_time,
            vm_status=vm_status,
            active_sessions=1 if active and active.state not in (SessionState.COMPLETED, SessionState.FAILED) else 0,
            telemetry_connections=len(_telemetry_clients),
        )

    # -------------------------------------------------------------------------
    # SIMULATORS
    # -------------------------------------------------------------------------

    @app.get("/simulators")
    async def simulators() -> list[SimulatorInfo]:
        return SIMULATORS

    # -------------------------------------------------------------------------
    # SESSIONS
    # -------------------------------------------------------------------------

    @app.post("/sessions/start")
    async def start_session(
        req: StartSessionRequest,
        _limits: SandboxResourceLimits = Depends(validate_resource_limits),
    ) -> dict:
        capped_timeout = min(req.timeout_seconds, settings.MAX_DURATION_SECONDS)
        try:
            session = await _pipeline.start(req.simulator_id, capped_timeout)
            _add_log("INFO", f"Session started: {session.session_id} ({req.simulator_id})", session.session_id)
            return session.model_dump()
        except RuntimeError as e:
            raise HTTPException(409, str(e))
        except Exception as e:
            raise HTTPException(500, str(e))

    @app.get("/sessions/{session_id}")
    async def get_session(session_id: str) -> dict:
        s = _pipeline.get_session(session_id)
        if not s:
            raise HTTPException(404, "Session not found")
        return s.model_dump()

    @app.get("/sessions/{session_id}/events")
    async def get_events(session_id: str) -> dict:
        return {"events": _pipeline.get_events(session_id)}

    @app.get("/sessions")
    async def list_sessions() -> list[dict]:
        return [s.model_dump() for s in _pipeline.get_all_sessions()]

    @app.post("/sessions/{session_id}/stop")
    async def stop_session(session_id: str) -> dict:
        try:
            s = await _pipeline.stop(session_id)
            return s.model_dump()
        except KeyError:
            raise HTTPException(404, "Session not found")

    @app.post("/sessions/{session_id}/terminate")
    async def terminate_session(session_id: str) -> dict:
        try:
            s = await _pipeline.stop(session_id)
            return s.model_dump()
        except KeyError:
            raise HTTPException(404, "Session not found")

    # -------------------------------------------------------------------------
    # VM
    # -------------------------------------------------------------------------

    @app.post("/vm/reset")
    async def reset_vm() -> dict:
        try:
            await asyncio.to_thread(_vm.revert_to_snapshot)
            return {"status": "success", "message": "VM reset to clean snapshot"}
        except VMError as e:
            raise HTTPException(500, str(e))

    @app.get("/vm/status")
    async def vm_status() -> dict:
        info = _vm.get_info()
        return {"vm_name": "ForensicsSandbox", "vm_status": _vm.get_state(), **info}

    # -------------------------------------------------------------------------
    # MONITORING / EXECUTION STATUS
    # -------------------------------------------------------------------------

    @app.get("/monitoring/status")
    async def monitoring_status() -> dict:
        return _pipeline.get_monitoring().model_dump()

    @app.get("/execution/status")
    async def execution_status() -> dict:
        active = _pipeline.active_session
        current = None
        if active:
            current = {
                "session_id": active.session_id,
                "state": active.state.value,
                "simulator_id": active.simulator_id,
                "created_at": active.created_at,
                "updated_at": active.updated_at,
                "error": active.error,
            }
        sessions = _pipeline.get_all_sessions()
        return ExecutionStatus(
            history_count=len(sessions),
            current_session=current,
            recent_sessions=[
                {"session_id": s.session_id, "status": s.state.value, "simulator_id": s.simulator_id}
                for s in sessions[-10:]
            ],
        ).model_dump()

    # -------------------------------------------------------------------------
    # LOGS
    # -------------------------------------------------------------------------

    @app.get("/logs")
    async def get_logs(limit: int = Query(100), level: Optional[str] = Query(None)) -> dict:
        logs = list(_log_buffer)
        if level:
            logs = [entry for entry in logs if entry.get("level", "").upper() == level.upper()]
        return {"logs": logs[-limit:]}

    # -------------------------------------------------------------------------
    # WEBSOCKETS
    # -------------------------------------------------------------------------

    @app.websocket("/telemetry/live")
    async def telemetry_ws(ws: WebSocket):
        await ws.accept()
        _telemetry_clients.add(ws)
        log.info("Telemetry WS connected (%d)", len(_telemetry_clients))
        try:
            async for _ in ws.iter_text():
                pass
        except WebSocketDisconnect:
            pass
        finally:
            _telemetry_clients.discard(ws)

    @app.websocket("/logs/live")
    async def logs_ws(ws: WebSocket):
        await ws.accept()
        _log_clients.add(ws)
        # Send recent logs on connect
        for entry in list(_log_buffer)[-50:]:
            try:
                await ws.send_json(entry)
            except Exception:
                break
        try:
            async for _ in ws.iter_text():
                pass
        except WebSocketDisconnect:
            pass
        finally:
            _log_clients.discard(ws)

    return app
