"""Shared telemetry helper for all simulators.

Provides:
  - MITRE ATT&CK technique ID mapping
  - Correlation IDs and phase markers
  - Timing randomization (jitter)
  - Threat scoring for severity assessment
"""

from __future__ import annotations

import ctypes
import json
import os
import random
import shutil
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone
from enum import IntEnum
from typing import Optional

try:
    import winreg
    _HAS_WINREG = True
except ImportError:
    _HAS_WINREG = False

# Session-wide correlation ID (set once per simulator run)
SESSION_CORRELATION_ID: str = str(uuid.uuid4())
_phase_counter: int = 0
_current_phase: str = ""


def set_phase(name: str) -> str:
    """Set the current phase and return a phase_id for correlation."""
    global _phase_counter, _current_phase
    _phase_counter += 1
    _current_phase = name
    return f"{SESSION_CORRELATION_ID[:8]}-P{_phase_counter:02d}"


def jitter(base: float = 0.1, variance: float = 0.15) -> None:
    """Sleep with randomized jitter for realistic timing."""
    time.sleep(base + random.uniform(0, variance))


# =============================================================================
# ENVIRONMENT DETECTION — anti-analysis gating for simulators
# =============================================================================


class EnvSafety(IntEnum):
    CLEAN = 0
    SUSPICIOUS = 1
    COMPROMISED = 2


_DETECTION_WEIGHTS: dict[str, int] = {
    "debugger_present":        100,
    "vbox_guest_service":       90,
    "vbox_guest_additions":     85,
    "vm_bios_manufacturer":     80,
    "analysis_tool_running":    50,
    "sandbox_username":         40,
    "small_screen":             25,
    "small_disk":               20,
    "low_cpu_count":            10,
}

_SANDBOX_USERNAMES: frozenset[str] = frozenset({
    "sandbox", "guest", "user", "admin", "test", "vmware", "vbox",
    "analyst", "malware", "debug", "lab", "sample", "evil",
})

_ANALYSIS_TOOLS: frozenset[str] = frozenset({
    "procexp.exe", "procexp64.exe", "procmon.exe", "procmon64.exe",
    "wireshark.exe", "tshark.exe", "tcpview.exe", "tcpview64.exe",
    "processhacker.exe", "processhacker64.exe", "ollydbg.exe",
    "x64dbg.exe", "x32dbg.exe", "windbg.exe", "ida.exe", "ida64.exe",
    "ghidra.exe", "immunitydbg.exe", "regmon.exe", "filemon.exe",
    "apimonitor.exe", "apilogger.exe", "petools.exe", "lordpe.exe",
    "importrec.exe", "dnspy.exe", "ilspy.exe", "de4dot.exe",
    "vboxservice.exe", "vboxtray.exe",
    "vmtoolsd.exe", "vmwaretray.exe", "vmwareuser.exe",
    "qemu-ga.exe",
})

_VM_BIOS_MARKERS: tuple[str, ...] = (
    "innotek", "virtualbox", "vbox", "vmware", "qemu",
    "bochs", "microsoft corporation virtual", "xen",
)

_COMPROMISED_THRESHOLD: int = 80
_SUSPICIOUS_THRESHOLD: int = 30


def check_environment() -> tuple[EnvSafety, list[str]]:
    reasons: list[str] = []
    cumulative: int = 0

    # 1. Debugger check (highest confidence)
    try:
        is_debugged = ctypes.windll.kernel32.IsDebuggerPresent()
        if is_debugged:
            reasons.append("debugger_present")
            cumulative += _DETECTION_WEIGHTS["debugger_present"]
    except Exception:
        pass

    # 2. VM registry artifacts
    if _HAS_WINREG:
        try:
            key = winreg.OpenKey(
                winreg.HKEY_LOCAL_MACHINE,
                r"SYSTEM\CurrentControlSet\Services\VBoxGuest",
                0, winreg.KEY_READ,
            )
            winreg.CloseKey(key)
            reasons.append("vbox_guest_service")
            cumulative += _DETECTION_WEIGHTS["vbox_guest_service"]
        except OSError:
            pass

        try:
            key = winreg.OpenKey(
                winreg.HKEY_LOCAL_MACHINE,
                r"HARDWARE\DESCRIPTION\System\BIOS",
                0, winreg.KEY_READ,
            )
            manufacturer, _ = winreg.QueryValueEx(key, "SystemManufacturer")
            winreg.CloseKey(key)
            if any(m in manufacturer.lower() for m in _VM_BIOS_MARKERS):
                reasons.append("vm_bios_manufacturer")
                cumulative += _DETECTION_WEIGHTS["vm_bios_manufacturer"]
        except OSError:
            pass

        try:
            key = winreg.OpenKey(
                winreg.HKEY_LOCAL_MACHINE,
                r"SOFTWARE\Oracle\VirtualBox Guest Additions",
                0, winreg.KEY_READ,
            )
            winreg.CloseKey(key)
            reasons.append("vbox_guest_additions")
            cumulative += _DETECTION_WEIGHTS["vbox_guest_additions"]
        except OSError:
            pass

    # 3. Analysis tools running
    try:
        result = subprocess.run(
            ["tasklist", "/fo", "csv", "/nh"],
            capture_output=True, text=True, timeout=5,
            creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0,
        )
        running_tools = [t for t in _ANALYSIS_TOOLS if t in result.stdout.lower()]
        if running_tools:
            reasons.append(f"analysis_tool_running:{','.join(running_tools)}")
            cumulative += _DETECTION_WEIGHTS["analysis_tool_running"]
    except Exception:
        pass

    # 4. Sandbox username
    try:
        username = os.environ.get("USERNAME", "").lower()
        if username in _SANDBOX_USERNAMES:
            reasons.append("sandbox_username")
            cumulative += _DETECTION_WEIGHTS["sandbox_username"]
    except Exception:
        pass

    # 5. Small screen resolution
    try:
        width = ctypes.windll.user32.GetSystemMetrics(0)
        height = ctypes.windll.user32.GetSystemMetrics(1)
        if width <= 1024 and height <= 768:
            reasons.append("small_screen")
            cumulative += _DETECTION_WEIGHTS["small_screen"]
    except Exception:
        pass

    # 6. Small disk
    try:
        total, _used, _free = shutil.disk_usage("/")
        if total < 100 * (1024 ** 3):
            reasons.append("small_disk")
            cumulative += _DETECTION_WEIGHTS["small_disk"]
    except Exception:
        pass

    # 7. Low CPU count
    try:
        cpus = os.cpu_count() or 0
        if cpus <= 2:
            reasons.append("low_cpu_count")
            cumulative += _DETECTION_WEIGHTS["low_cpu_count"]
    except Exception:
        pass

    if cumulative >= _COMPROMISED_THRESHOLD:
        return EnvSafety.COMPROMISED, reasons
    if cumulative >= _SUSPICIOUS_THRESHOLD:
        return EnvSafety.SUSPICIOUS, reasons
    return EnvSafety.CLEAN, reasons


# =============================================================================
# MITRE ATT&CK TECHNIQUE MAPPING
# =============================================================================

TECHNIQUE_MAP: dict[str, str] = {
    # Execution
    "CREATE_PROCESS": "T1059",
    "CREATE_THREAD": "T1106",
    # Persistence
    "SET_VALUE:Run": "T1547.001",
    "SET_VALUE:RunOnce": "T1547.001",
    "SET_VALUE:Service": "T1543.003",
    "CREATE_KEY:Service": "T1543.003",
    "SCHEDULED_TASK": "T1053.005",
    # Privilege Escalation
    "OPEN_PROCESS": "T1055",
    "WRITE_MEMORY": "T1055.001",
    # Defense Evasion
    "DLL_HIJACK": "T1574.001",
    "HIDDEN_FILE": "T1564.001",
    "DELETE_SHADOWS": "T1490",
    "BOOT_MODIFY": "T1542.003",
    # Credential Access
    "READ_KEY:SAM": "T1003.002",
    "READ_KEY:LSA": "T1003.004",
    "READ_FILE:LoginData": "T1555.003",
    "READ_FILE:Cookies": "T1539",
    # Discovery
    "DNS_QUERY": "T1018",
    "SCAN_FILES": "T1083",
    "BROWSER_DISCOVERY": "T1217",
    # Lateral Movement
    "SMB_CONNECT": "T1021.002",
    "REMOTE_SERVICE": "T1021.002",
    "PASS_THE_HASH": "T1550.002",
    # Collection
    "SCREEN_CAPTURE": "T1113",
    "CLIPBOARD": "T1115",
    "KEYLOGGER": "T1056.001",
    # Command and Control
    "CONNECT:C2": "T1071.001",
    "DNS_BEACON": "T1071.004",
    # Exfiltration
    "EXFILTRATE": "T1041",
    # Impact
    "ENCRYPT_FILE": "T1486",
    "RANSOM_NOTE": "T1491.001",
    "WALLPAPER": "T1491.001",
}

# =============================================================================
# THREAT SCORING
# =============================================================================

THREAT_SCORES: dict[str, int] = {
    "ENCRYPT_FILE": 95,
    "DELETE_SHADOWS": 90,
    "WRITE_MEMORY": 85,
    "OPEN_PROCESS": 80,
    "BOOT_MODIFY": 90,
    "PASS_THE_HASH": 88,
    "EXFILTRATE": 85,
    "READ_KEY:SAM": 82,
    "READ_KEY:LSA": 82,
    "READ_FILE:LoginData": 78,
    "DLL_HIJACK": 75,
    "SCHEDULED_TASK": 60,
    "SET_VALUE:Run": 55,
    "SET_VALUE:Service": 70,
    "CREATE_KEY:Service": 70,
    "CONNECT:C2": 72,
    "DNS_BEACON": 50,
    "KEYLOGGER": 80,
    "SCREEN_CAPTURE": 65,
    "RANSOM_NOTE": 90,
}


def _resolve_technique(operation: str, target: str = "") -> Optional[str]:
    """Resolve the best MITRE technique ID for an operation+target combo."""
    # Try specific key first
    for key_hint in ("SAM", "LSA", "Run", "RunOnce", "Service", "LoginData", "Cookies"):
        if key_hint.lower() in target.lower():
            combo = f"{operation}:{key_hint}"
            if combo in TECHNIQUE_MAP:
                return TECHNIQUE_MAP[combo]
    return TECHNIQUE_MAP.get(operation)


def _resolve_threat_score(operation: str, target: str = "", severity: str = "INFO") -> Optional[int]:
    """Resolve threat score for an operation."""
    for key_hint in ("SAM", "LSA", "Run", "RunOnce", "Service", "LoginData"):
        if key_hint.lower() in target.lower():
            combo = f"{operation}:{key_hint}"
            if combo in THREAT_SCORES:
                return THREAT_SCORES[combo]
    score = THREAT_SCORES.get(operation)
    if score is None and severity == "CRITICAL":
        return 70  # default for unscored critical events
    return score


# =============================================================================
# EMIT FUNCTION — drop-in replacement for simulator emit()
# =============================================================================

def emit(category: str, operation: str, target: str, severity: str = "INFO",
         source_process: str = "unknown", technique_id: Optional[str] = None,
         **metadata) -> None:
    """Emit a forensic event with ATT&CK mapping, correlation, and threat scoring."""
    resolved_technique = technique_id or _resolve_technique(operation, target)
    threat_score = _resolve_threat_score(operation, target, severity)

    event: dict = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "category": category,
        "operation": operation,
        "source_process": source_process,
        "target": target,
        "severity": severity,
        "metadata": metadata,
        "correlation_id": SESSION_CORRELATION_ID,
        "phase": _current_phase,
    }
    if resolved_technique:
        event["technique_id"] = resolved_technique
    if threat_score is not None:
        event["threat_score"] = threat_score

    print(json.dumps(event), flush=True)
