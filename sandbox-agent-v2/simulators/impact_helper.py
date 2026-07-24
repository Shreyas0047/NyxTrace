"""Impact primitives for simulator realism (Phase 10).

Provides reusable telemetry emitters for destructive and disruptive
impact techniques:

  - Data destruction (T1485)
  - Service stop (T1489)
  - System shutdown / reboot (T1529)
  - Disk wipe (T1561.001)
  - Resource hijacking / cryptomining (T1496)
  - Account lockout / removal (T1531)

MITRE ATT&CK: T1485, T1489, T1529, T1561.001, T1496, T1531
"""

from __future__ import annotations

from telemetry_helper import emit, set_phase


def emit_data_destruction(process_name: str, target_path: str = "%TEMP%\\*.tmp") -> None:
    """Overwrite target files with random data to prevent recovery (T1485)."""
    set_phase("impact")
    emit("FILE", "WRITE_FILE", target_path, "CRITICAL",
         source_process=process_name,
         detail=f"Overwriting {target_path} with random data to prevent recovery",
         technique_id="T1485")
    emit("FILE", "DELETE_FILE", target_path, "CRITICAL",
         source_process=process_name,
         detail=f"Deleting overwritten file: {target_path}",
         technique_id="T1485")
    emit("PROCESS", "CREATE_PROCESS", "cmd.exe", "CRITICAL",
         source_process=process_name,
         command="cmd /c cipher /w:%TEMP%",
         detail="Overwriting free space to prevent file recovery",
         technique_id="T1485")


def emit_service_stop(process_name: str, services: list[str] | None = None) -> None:
    """Stop security / monitoring services (T1489)."""
    set_phase("impact")
    targets = services or [
        "WinDefend",
        "wscsvc",
        "Sense",
        "MsMpSvc",
        "SecurityHealthService",
    ]
    for svc in targets:
        emit("PROCESS", "CREATE_PROCESS", "net.exe", "CRITICAL",
             source_process=process_name,
             command=f"net stop {svc} /y",
             detail=f"Stopping service: {svc}",
             technique_id="T1489")
        emit("REGISTRY", "SET_VALUE",
             rf"HKLM\SYSTEM\CurrentControlSet\Services\{svc}",
             "CRITICAL",
             source_process=process_name,
             value_name="Start", value_data="4",
             detail=f"Disabling service startup: {svc}",
             technique_id="T1489")
    emit("PROCESS", "CREATE_PROCESS", "sc.exe", "CRITICAL",
         source_process=process_name,
         command="sc query type=service state=all | findstr /i DISABLED",
         detail="Verifying services are disabled",
         technique_id="T1489")


def emit_system_shutdown(process_name: str, reason: str = "system instability") -> None:
    """Shut down or reboot the system (T1529)."""
    set_phase("impact")
    emit("PROCESS", "CREATE_PROCESS", "shutdown.exe", "CRITICAL",
         source_process=process_name,
         command=f'shutdown /r /t 60 /c "{reason}"',
         detail=f"Scheduled system reboot: {reason}",
         technique_id="T1529")
    emit("PROCESS", "CREATE_PROCESS", "wmic.exe", "CRITICAL",
         source_process=process_name,
         command="wmic os where Primary='TRUE' call Win32Shutdown 6",
         detail="Forced system shutdown via WMI",
         technique_id="T1529")


def emit_disk_wipe(process_name: str) -> None:
    """Overwrite disk master boot record (T1561.001)."""
    set_phase("impact")
    emit("PROCESS", "CREATE_THREAD", process_name, "CRITICAL",
         source_process=process_name,
         detail="Opening physical drive \\\\.\\PHYSICALDRIVE0 with write access",
         technique_id="T1561.001")
    emit("FILE", "WRITE_FILE", r"\\.\PHYSICALDRIVE0", "CRITICAL",
         source_process=process_name,
         detail="Writing zeroes to MBR partition table entry",
         technique_id="T1561.001")
    emit("PROCESS", "CREATE_PROCESS", "diskpart.exe", "CRITICAL",
         source_process=process_name,
         command="diskpart /s clean.txt",
         detail="DiskPart clean — removing all partition structures",
         technique_id="T1561.001")


def emit_resource_hijacking(process_name: str) -> None:
    """Deploy cryptominer and consume system resources (T1496)."""
    set_phase("impact")
    emit("FILE", "CREATE_FILE", r"C:\Windows\Temp\svchost_mine.exe", "WARNING",
         source_process=process_name,
         detail="Dropping cryptocurrency miner binary",
         technique_id="T1496")
    emit("PROCESS", "CREATE_PROCESS", "svchost_mine.exe", "WARNING",
         source_process=process_name,
         command="svchost_mine.exe --pool stratum+tcp://mine.local:3333 --wallet 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
         detail="Launching cryptominer with wallet address",
         technique_id="T1496")
    emit("PROCESS", "CREATE_THREAD", "svchost_mine.exe", "WARNING",
         source_process=process_name,
         detail="Spawning worker threads for CPU mining (100% utilization)",
         technique_id="T1496")
    emit("PROCESS", "CREATE_THREAD", "svchost_mine.exe", "WARNING",
         source_process=process_name,
         detail="Initializing GPU mining via CUDA",
         technique_id="T1496")


def emit_account_lockout(process_name: str, target_user: str = "Administrator") -> None:
    """Lock out or delete user accounts (T1531)."""
    set_phase("impact")
    emit("PROCESS", "CREATE_PROCESS", "net.exe", "CRITICAL",
         source_process=process_name,
         command=f"net user {target_user} /active:no",
         detail=f"Disabling user account: {target_user}",
         technique_id="T1531")
    emit("REGISTRY", "SET_VALUE",
         rf"HKLM\SAM\SAM\Domains\Account\Users",
         "CRITICAL",
         source_process=process_name,
         detail=f"Setting account lockout flag for {target_user} via SAM registry",
         technique_id="T1531")
    emit("PROCESS", "CREATE_PROCESS", "net.exe", "CRITICAL",
         source_process=process_name,
         command="net user guest /active:yes",
         detail="Enabling guest account as backdoor",
         technique_id="T1531")
