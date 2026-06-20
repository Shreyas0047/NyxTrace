"""Session Pipeline — state-machine orchestrator for sandbox execution.

Pipeline stages:
  REVERT  → Force-kill VM, restore CleanBaseline snapshot
  STAGE   → Transfer simulator + monitor stub to guest
  EXECUTE → Run simulator via guestcontrol, capture output
  OBSERVE → Parse telemetry from stdout/log, broadcast via WebSocket
  COMPLETE/FAILED → Terminal states
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Optional

from agent.models import (
    RuntimeSession, SessionState, ForensicEvent,
    EventCategory, EventSeverity, MonitoringStatus,
)
from agent.vm import VMManager, VMError, GUEST_SIMULATORS

log = logging.getLogger("agent.pipeline")

# Callback type for broadcasting events to WebSocket clients
BroadcastFn = Callable[[dict], None]


class SessionPipeline:
    """Manages the full lifecycle of sandbox sessions."""

    def __init__(self, vm: VMManager, simulators_dir: Path) -> None:
        self._vm = vm
        self._simulators_dir = simulators_dir
        self._sessions: dict[str, RuntimeSession] = {}
        self._events: dict[str, list[dict]] = {}  # session_id -> events
        self._active_id: Optional[str] = None
        self._broadcast: Optional[BroadcastFn] = None
        self._monitoring = MonitoringStatus()

    def set_broadcast(self, fn: BroadcastFn) -> None:
        self._broadcast = fn

    @property
    def active_session(self) -> Optional[RuntimeSession]:
        if self._active_id:
            return self._sessions.get(self._active_id)
        return None

    def get_session(self, sid: str) -> Optional[RuntimeSession]:
        return self._sessions.get(sid)

    def get_all_sessions(self) -> list[RuntimeSession]:
        return list(self._sessions.values())

    def get_events(self, sid: str) -> list[dict]:
        return self._events.get(sid, [])

    def get_monitoring(self) -> MonitoringStatus:
        return self._monitoring

    # =========================================================================
    # PUBLIC: Start a new session
    # =========================================================================

    async def start(self, simulator_id: str, timeout: int = 300) -> RuntimeSession:
        """Create and launch a session. Returns immediately; pipeline runs in background."""
        if self._active_id:
            active = self._sessions[self._active_id]
            if active.state not in (SessionState.COMPLETED, SessionState.FAILED):
                raise RuntimeError("A session is already running")

        session = RuntimeSession(simulator_id=simulator_id)
        self._sessions[session.session_id] = session
        self._events[session.session_id] = []
        self._active_id = session.session_id
        self._monitoring = MonitoringStatus(is_active=True, session_id=session.session_id)

        asyncio.create_task(self._run_pipeline(session, timeout))
        return session

    async def stop(self, sid: str) -> RuntimeSession:
        """Stop a running session."""
        session = self._sessions.get(sid)
        if not session:
            raise KeyError(f"Session {sid} not found")
        session.transition(SessionState.FAILED, "Stopped by user")
        self._monitoring.is_active = False
        try:
            await asyncio.to_thread(self._vm.kill_all_vbox_processes)
        except Exception:
            pass
        return session

    # =========================================================================
    # PIPELINE EXECUTION
    # =========================================================================

    async def _run_pipeline(self, session: RuntimeSession, timeout: int) -> None:
        """The full REVERT → STAGE → EXECUTE → OBSERVE → COMPLETE pipeline."""
        try:
            await asyncio.wait_for(
                self._execute_stages(session),
                timeout=timeout + 420,
            )
        except asyncio.TimeoutError:
            session.transition(SessionState.FAILED, f"Pipeline timed out after {timeout}s")
            self._emit_log("ERROR", f"Session timed out after {timeout}s", session.session_id)
        except Exception as e:
            session.transition(SessionState.FAILED, str(e))
            self._emit_log("ERROR", f"Pipeline failed: {e}", session.session_id)
            log.exception("Pipeline error for session %s", session.session_id)
        finally:
            self._monitoring.is_active = False
            # Power off VM after session — do NOT restore snapshot here.
            # The next session's _execute_stages (REVERT phase) will
            # restore the clean snapshot, avoiding a double-revert that
            # can corrupt Guest Additions state on force-poweroff.
            try:
                self._emit_log("INFO", "Powering off VM after session", session.session_id)
                await asyncio.to_thread(self._vm.kill_all_vbox_processes)
                self._emit_log("INFO", "VM powered off", session.session_id)
            except Exception as e:
                log.exception("VM poweroff after session %s", session.session_id)
                self._emit_log("ERROR", f"VM poweroff failed: {e}", session.session_id)

    async def _execute_stages(self, session: RuntimeSession) -> None:
        """Execute each pipeline stage sequentially."""
        sid = session.session_id

        # --- REVERT ---
        session.transition(SessionState.REVERTING)
        self._emit_log("INFO", "Reverting VM to clean snapshot", sid)
        await asyncio.to_thread(self._vm.revert_to_snapshot)
        self._emit_log("INFO", "Snapshot restored successfully", sid)

        # --- BOOT ---
        session.transition(SessionState.STAGING)
        self._emit_log("INFO", "Booting VM", sid)
        await asyncio.to_thread(self._vm.boot_vm, False)  # GUI mode — visible

        # Wait for Guest Additions
        self._emit_log("INFO", "Waiting for Guest OS to become ready", sid)
        ready = await asyncio.to_thread(self._vm.wait_for_guest, 360)
        if not ready:
            raise VMError("Guest Additions did not become ready — VM may have aborted")

        # Verify guest marker (safety)
        marker_ok = await asyncio.to_thread(self._vm.verify_guest_marker)
        if not marker_ok:
            log.warning("Guest marker not found — proceeding anyway (dev mode)")

        # --- STAGE ---
        self._emit_log("INFO", f"Staging simulator: {session.simulator_id}", sid)
        guest_script = await asyncio.to_thread(self._stage_simulator, session.simulator_id)

        # --- EXECUTE ---
        session.transition(SessionState.EXECUTING)
        self._emit_log("INFO", "Executing simulator in guest VM", sid)
        # Invoke Python by full path. Plain `python` resolves to the Microsoft
        # Store alias stub on a fresh Windows 11 guest, which exits 9009 with
        # an "install from the Microsoft Store" message. Override via the
        # SANDBOX_GUEST_PYTHON env var if you install Python somewhere else.
        import os as _os
        guest_python = _os.environ.get("SANDBOX_GUEST_PYTHON", r"C:\Users\guestuser\AppData\Local\Programs\Python\Python313\python.exe")
        result = await asyncio.to_thread(
            self._vm.guest_exec,
            r"C:\Windows\System32\cmd.exe",
            ["/c", guest_python, guest_script],
            timeout=300,
            cwd=GUEST_SIMULATORS,
        )

        # --- OBSERVE ---
        session.transition(SessionState.OBSERVING)
        self._emit_log("INFO", "Collecting forensic telemetry", sid)
        self._parse_telemetry(sid, result.stdout)

        if result.code != 0:
            log.warning("Simulator exited with code %d: %s", result.code, result.stderr[:200])

        # --- COMPLETE ---
        session.transition(SessionState.COMPLETED)
        total = len(self._events.get(sid, []))
        self._emit_log("INFO", f"Session completed — {total} events collected", sid)
        self._update_monitoring(sid)
        # Generate sandbox-report.json for AI Analysis pipeline
        try:
            self._generate_report(session)
        except Exception as exc:
            log.warning("Failed to generate sandbox-report.json for %s: %s", sid, exc)

    # =========================================================================
    # STAGE: Transfer simulator to guest
    # =========================================================================

    def _stage_simulator(self, simulator_id: str) -> str:
        """Transfer the simulator script to the guest. Returns guest path."""
        script_map = {
            "system-service-alpha": "ransomware_sim.py",
            "system-service-beta": "botnet_sim.py",
            "system-service-gamma": "credential_stealer_sim.py",
            "system-service-delta": "sim_delta.py",
            "system-service-epsilon": "sim_epsilon.py",
            "system-service-lateral": "sim_lateral.py",
        }
        filename = script_map.get(simulator_id)
        if not filename:
            raise ValueError(f"Unknown simulator: {simulator_id}")

        host_path = self._simulators_dir / filename
        if not host_path.exists():
            raise FileNotFoundError(f"Simulator not found: {host_path}")

        self._vm.ensure_guest_dir(GUEST_SIMULATORS)

        # Always copy the shared telemetry helper
        helper_path = self._simulators_dir / "telemetry_helper.py"
        if helper_path.exists():
            self._vm.copy_to_guest(str(helper_path), f"{GUEST_SIMULATORS}\\telemetry_helper.py")

        guest_dest = f"{GUEST_SIMULATORS}\\{filename}"
        self._vm.copy_to_guest(str(host_path), guest_dest)
        return guest_dest

    # =========================================================================
    # OBSERVE: Parse telemetry from simulator output
    # =========================================================================

    def _parse_telemetry(self, sid: str, stdout: str) -> None:
        """Parse JSON-lines telemetry from simulator stdout."""
        events = self._events.setdefault(sid, [])
        for line in stdout.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
                events.append(event)
                # Broadcast to WebSocket clients
                if self._broadcast:
                    self._broadcast({
                        "session_id": sid,
                        "timestamp": event.get("timestamp", datetime.now(timezone.utc).isoformat()),
                        "event_type": "forensic_event",
                        "category": event.get("category", "PROCESS"),
                        "data": event,
                    })
            except json.JSONDecodeError:
                log.debug("Non-JSON output: %s", line[:80])

    def _update_monitoring(self, sid: str) -> None:
        """Update monitoring counters from collected events."""
        events = self._events.get(sid, [])
        proc = file = reg = net = alerts = 0
        for e in events:
            cat = e.get("category", "").upper()
            sev = e.get("severity", "").upper()
            if cat == "PROCESS":
                proc += 1
            elif cat == "FILE":
                file += 1
            elif cat == "REGISTRY":
                reg += 1
            elif cat == "NETWORK":
                net += 1
            if sev == "CRITICAL":
                alerts += 1

        self._monitoring = MonitoringStatus(
            total_events=len(events),
            process_count=proc,
            file_operations_count=file,
            registry_operations_count=reg,
            network_operations_count=net,
            behavior_alerts=alerts,
            is_active=False,
            session_id=sid,
        )

    # =========================================================================
    # REPORT GENERATION (sandbox-report.json)
    # =========================================================================

    def _generate_report(self, session: RuntimeSession) -> Optional[Path]:
        """Generate sandbox-report.json after session completion.

        The report is consumed by the backend AI Analysis pipeline to derive
        threat classification, MITRE mapping, attack chain, etc. It is also
        served to the Reports page via reports.service.ts.
        """
        sid = session.session_id
        events = self._events.get(sid, [])

        # Categorize events by type for AI Analysis pipeline
        process_activity = [e for e in events if e.get("category", "").upper() == "PROCESS"]
        file_activity = [e for e in events if e.get("category", "").upper() == "FILE"]
        registry_activity = [e for e in events if e.get("category", "").upper() == "REGISTRY"]
        network_activity = [e for e in events if e.get("category", "").upper() == "NETWORK"]

        # Severity counts for AI Analysis
        severity_counts: dict[str, int] = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
        for e in events:
            sev = e.get("severity", "info").lower()
            if sev in severity_counts:
                severity_counts[sev] += 1

        # Build chronological timeline (sorted by timestamp)
        timeline = sorted(
            [
                {
                    "timestamp": e.get("timestamp", ""),
                    "category": e.get("category", "SYSTEM"),
                    "event_type": e.get("event_type", e.get("type", "event")),
                    "severity": e.get("severity", "info"),
                    "details": e.get("details", e.get("data", {})),
                }
                for e in events
            ],
            key=lambda x: x.get("timestamp", ""),
        )

        # Resolve simulator name (matches backend SIMULATOR_DISPLAY_NAMES)
        sim_display = {
            "system-service-alpha": "Sample Alpha",
            "system-service-beta": "Sample Beta",
            "system-service-gamma": "Sample Gamma",
            "system-service-delta": "Sample Delta",
            "system-service-epsilon": "Sample Epsilon",
            "ransomware-simulator": "Sample Alpha",
            "spyware-simulator": "Sample Beta",
            "trojan-simulator": "Sample Gamma",
            "botnet-simulator": "Sample Delta",
            "credential-stealer": "Sample Epsilon",
        }
        simulator_name = sim_display.get(session.simulator_id, session.simulator_id)

        report = {
            "report_metadata": {
                "exportedAt": datetime.now(timezone.utc).isoformat(),
                "format_version": "1.0",
                "generator": "sandbox-agent-v2",
            },
            "session": {
                "sessionId": sid,
                "session_id": sid,
                "simulatorId": session.simulator_id,
                "simulator_id": session.simulator_id,
                "simulatorName": simulator_name,
                "simulator_name": simulator_name,
                "state": session.state.value if hasattr(session.state, "value") else str(session.state),
                "createdAt": session.created_at,
                "updatedAt": session.updated_at,
                "executionTime": 0,
            },
            "summary": {
                "total_events": len(events),
                "process_count": len(process_activity),
                "file_count": len(file_activity),
                "registry_count": len(registry_activity),
                "network_count": len(network_activity),
                "severity_counts": severity_counts,
            },
            "process_activity": process_activity,
            "file_activity": file_activity,
            "registry_activity": registry_activity,
            "network_activity": network_activity,
            "timeline": timeline,
            "events": events,
        }

        # Write to <project_root>/uploads/reports/<session_id>.json
        # The backend reports.service.ts reads from uploads/reports.
        try:
            project_root = Path(__file__).resolve().parents[2]
            reports_dir = project_root / "uploads" / "reports"
            reports_dir.mkdir(parents=True, exist_ok=True)
            report_path = reports_dir / f"sandbox-report-{sid}.json"
            with report_path.open("w", encoding="utf-8") as fh:
                json.dump(report, fh, indent=2, default=str)
            self._emit_log("INFO", f"Generated {report_path.name} ({len(events)} events)", sid)
            return report_path
        except Exception as exc:
            log.exception("Failed writing sandbox report: %s", exc)
            return None

    # =========================================================================
    # LOGGING (broadcasts to /logs/live WebSocket)
    # =========================================================================

    def _emit_log(self, level: str, message: str, session_id: Optional[str] = None) -> None:
        """Emit a system log entry for the /logs/live WebSocket."""
        if self._broadcast:
            self._broadcast({
                "type": "log",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "level": level,
                "message": message,
                "session_id": session_id,
                "source": "pipeline",
            })
