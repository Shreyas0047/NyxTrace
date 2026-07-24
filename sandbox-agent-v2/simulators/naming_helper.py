"""Realistic artifact naming and operation-appropriate timing for simulators.

Provides:
  - Realistic mutex/named pipe/service/CLSID names (T1036 Masquerading)
  - Operation-appropriate timing delays — distinct ranges per operation type
  - Helper to emit mutex creation telemetry

MITRE ATT&CK: T1036 (Masquerading), T1059 (Execution timing mimicry)
"""

from __future__ import annotations

import random
from typing import Optional

from telemetry_helper import emit, set_phase

# =============================================================================
# REALISTIC MUTEX NAMES — mimic Windows component mutexes
# =============================================================================

MUTEX_NAMES: list[str] = [
    r"Local\MSCTF.CtfMonitorInstalled",
    r"Local\_!SAFE!_!CLEAN!_!SECURE!_",
    r"Global\Cryptography_NTDS_Mutex",
    r"Local\ZonesCacheCounterMutex",
    r"Global\ShellObjectsMutex",
    r"Local\WindowsUpdate_Service_Mutex",
    r"Global\MSCTF_Compatibility_Session_Mutex",
    r"Local\IpcServer_Mutex",
    r"Global\RDP_WINSTATION_ACTIVE",
    r"Local\WinlogonNotifyMutex",
    r"Global\__ComCatalogCache__",
    r"Local\Microsoft_Windows_DHCP_Client_Mutex",
    r"Global\NetworkLocationWizard_UserMutex",
    r"Local\PerformanceCountersMutex",
    r"Global\SessionMgr_Mutex",
]

# =============================================================================
# REALISTIC NAMED PIPE NAMES — Windows default pipe names
# =============================================================================

PIPE_NAMES: list[str] = [
    r"\\.\pipe\Winsock2\CatalogChangeListener-{GUID}",
    r"\\.\pipe\srvsvc",
    r"\\.\pipe\wkssvc",
    r"\\.\pipe\browser",
    r"\\.\pipe\epmapper",
    r"\\.\pipe\lsarpc",
    r"\\.\pipe\ntsvcs",
    r"\\.\pipe\samr",
    r"\\.\pipe\spoolss",
    r"\\.\pipe\winreg",
    r"\\.\pipe\MSF_WU_MGT",
    r"\\.\pipe\Ctx_WinStation_API_Service",
    r"\\.\pipe\SessEnvPrivateAPI",
    r"\\.\pipe\TermSrv_API_Service",
]

# =============================================================================
# REALISTIC SERVICE NAMES — masquerade as Windows services
# =============================================================================

SERVICE_NAMES: list[str] = [
    "WdiServiceHost",
    "wcncsvc",
    "WiaRpc",
    "WMPNetworkSvc",
    "WpnService",
    "WSearch",
    "wscsvc",
    "WwanSvc",
    "StateRepository",
    "StorSvc",
    "SysMain",
    "Themes",
    "UserDataSvc",
    "WaaSMedicSvc",
    "DoSvc",
]

# =============================================================================
# REALISTIC COM DESCRIPTIONS — for COM hijacking telemetry
# =============================================================================

COM_NAMES: list[str] = [
    "Microsoft Windows Update Service",
    "Windows Cryptographic Provider",
    "Microsoft Software Protection Service",
    "Windows Licensing Service",
    "Windows Defender Advanced Threat Protection",
    "Microsoft Compatibility Telemetry",
    "Windows Push Notifications Service",
    "Microsoft Account Sign-In Assistant",
    "Windows Automatic Updates Service",
]

# =============================================================================
# OPERATION-SPECIFIC TIMING (base, variance) — seconds
# =============================================================================

_OPERATION_TIMING: dict[str, tuple[float, float]] = {
    "file_create":       (0.01, 0.04),
    "file_read":         (0.005, 0.02),
    "file_write":        (0.01, 0.04),
    "file_delete":       (0.01, 0.03),
    "file_encrypt":      (0.08, 0.15),
    "file_scan":         (0.1, 0.2),
    "registry_read":     (0.02, 0.08),
    "registry_write":    (0.05, 0.15),
    "registry_create":   (0.05, 0.15),
    "process_create":    (0.1, 0.3),
    "process_inject":    (0.3, 0.5),
    "thread_create":     (0.05, 0.15),
    "memory_write":      (0.05, 0.1),
    "dns_query":         (0.3, 1.0),
    "doh_query":         (0.3, 1.0),
    "tcp_connect":       (0.2, 0.8),
    "http_beacon":       (0.5, 1.5),
    "exfiltrate":        (0.5, 2.0),
    "heartbeat":         (0.3, 1.0),
    "domain_front":      (0.4, 1.0),
    "browser_scan":      (0.15, 0.25),
    "port_scan":         (0.2, 0.3),
    "keylogger":         (0.2, 0.4),
    "screenshot":        (0.15, 0.25),
    "smb_connect":       (0.3, 0.5),
    "wmi_call":          (0.3, 0.5),
    "pth_auth":          (0.3, 0.4),
    "shadow_delete":     (0.2, 0.4),
    "scheduled_task":    (0.2, 0.4),
    "mutex_create":      (0.01, 0.03),
    "pipe_create":       (0.02, 0.05),
    "wmi_subscribe":     (0.2, 0.4),
    "com_hijack":        (0.15, 0.3),
    "init":              (0.05, 0.1),
    "anti_analysis":     (0.1, 0.2),
}

# =============================================================================
# PUBLIC API
# =============================================================================


def pick_mutex() -> str:
    """Return a realistic mutex name, replacing {GUID} placeholders."""
    name = random.choice(MUTEX_NAMES)
    if "{GUID}" in name:
        name = name.replace("{GUID}", _gen_guid())
    return name


def pick_pipe() -> str:
    """Return a realistic named pipe name, replacing {GUID} placeholders."""
    pipe = random.choice(PIPE_NAMES)
    if "{GUID}" in pipe:
        pipe = pipe.replace("{GUID}", _gen_guid())
    return pipe


def pick_service_name() -> str:
    """Return a realistic service name for persistence."""
    return random.choice(SERVICE_NAMES)


def pick_com_description() -> str:
    """Return a realistic COM component description."""
    return random.choice(COM_NAMES)


def phase_delay(operation: str) -> float:
    """Return an operation-appropriate delay in seconds.

    Different operations have characteristic timing profiles; using
    the same jitter range for everything is a heuristic marker.
    Returns base + U(0, variance).
    """
    base, variance = _OPERATION_TIMING.get(operation, (0.05, 0.1))
    return base + random.uniform(0, variance)


def emit_mutex(mutex_name: str, source_process: str,
               operation: str = "MUTEX_CREATE") -> None:
    """Emit telemetry for a mutex creation event."""
    set_phase("mutex")
    emit("SYNCHRONIZATION", operation, mutex_name, "INFO",
         source_process=source_process,
         detail=f"Mutex created: {mutex_name}")


def emit_pipe(pipe_name: str, source_process: str) -> None:
    """Emit telemetry for a named pipe creation event."""
    set_phase("pipe")
    emit("IPC", "CREATE_PIPE", pipe_name, "INFO",
         source_process=source_process,
         detail=f"Named pipe created: {pipe_name}")


def _gen_guid() -> str:
    return (
        f"{random.randint(0, 0xFFFFFFFF):08x}-"
        f"{random.randint(0, 0xFFFF):04x}-"
        f"{random.randint(0, 0xFFFF):04x}-"
        f"{random.randint(0, 0xFFFF):04x}-"
        f"{random.randint(0, 0xFFFFFFFFFFFF):012x}"
    )
