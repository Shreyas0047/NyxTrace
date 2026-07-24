"""Defense evasion depth primitives for simulator realism (Phase 9).

Provides reusable telemetry emitters for evasion techniques beyond
the basics in defense_helper.py (AMSI, ETW, UAC, firewall rules):

  - Disable Windows Defender (T1562.001)
  - Clear event logs (T1070.001)
  - Indicator removal — delete artifacts (T1070.004)
  - Timestomp (T1070.006)
  - Registry cleanup (T1070)
  - Delete Volume Shadow Copies (T1490)
  - Disable system recovery (T1490)
  - Masquerade as legitimate process (T1036.005)
  - Disable PowerShell / script logging (T1562.008)

MITRE ATT&CK: T1562.001, T1070, T1490, T1036.005, T1562.008
"""

from __future__ import annotations

from telemetry_helper import emit, set_phase


def emit_defender_disable(process_name: str) -> None:
    """Disable Windows Defender real-time monitoring (T1562.001)."""
    set_phase("defense_evasion_depth")
    emit("REGISTRY", "SET_VALUE",
         r"HKLM\SOFTWARE\Policies\Microsoft\Windows Defender",
         "CRITICAL",
         source_process=process_name,
         value_name="DisableAntiSpyware", value_data="1",
         detail="Disabling Windows Defender via registry policy",
         technique_id="T1562.001")
    emit("REGISTRY", "SET_VALUE",
         r"HKLM\SOFTWARE\Policies\Microsoft\Windows Defender\Real-Time Protection",
         "CRITICAL",
         source_process=process_name,
         value_name="DisableRealtimeMonitoring", value_data="1",
         detail="Disabling Defender real-time monitoring",
         technique_id="T1562.001")
    emit("PROCESS", "CREATE_PROCESS", "powershell.exe", "CRITICAL",
         source_process=process_name,
         command="powershell Set-MpPreference -DisableRealtimeMonitoring $true",
         detail="Disabling Defender via PowerShell MPPreference",
         technique_id="T1562.001")


def emit_event_log_clear(process_name: str) -> None:
    """Clear Windows event logs to remove forensic traces (T1070.001)."""
    set_phase("defense_evasion_depth")
    for log in ("Security", "System", "Application"):
        emit("PROCESS", "CREATE_PROCESS", "wevtutil.exe", "CRITICAL",
             source_process=process_name,
             command=f"wevtutil cl {log}",
             detail=f"Clearing {log} event log",
             technique_id="T1070.001")
    emit("FILE", "DELETE_FILE", r"%SystemRoot%\System32\winevt\Logs\Security.evtx",
         "CRITICAL",
         source_process=process_name,
         detail="Deleting Security event log file directly",
         technique_id="T1070.001")


def emit_indicator_removal(process_name: str, artifact_paths: list[str] | None = None) -> None:
    """Delete forensic artifacts (T1070.004)."""
    set_phase("defense_evasion_depth")
    paths = artifact_paths or [
        r"C:\Windows\Temp\*.tmp",
        r"%TEMP%\*",
        r"C:\Users\*\AppData\Local\Temp\*",
    ]
    for path in paths:
        emit("FILE", "DELETE_FILE", path, "WARNING",
             source_process=process_name,
             detail=f"Deleting forensic artifact: {path}",
             technique_id="T1070.004")
    emit("PROCESS", "CREATE_PROCESS", "cmd.exe", "WARNING",
         source_process=process_name,
         command="cmd /c del /f /s /q C:\\Windows\\Temp\\* 2>nul",
         detail="Mass deletion of Windows temp files",
         technique_id="T1070.004")


def emit_timestomp(process_name: str, target_path: str = r"C:\Windows\System32\calc.exe") -> None:
    """Modify file timestamps to masquerade as a legitimate file (T1070.006)."""
    set_phase("defense_evasion_depth")
    emit("FILE", "SET_ATTRIBUTES", target_path, "WARNING",
         source_process=process_name,
         detail="Modifying file creation timestamp via SetFileTime",
         technique_id="T1070.006")
    emit("FILE", "SET_ATTRIBUTES", target_path, "WARNING",
         source_process=process_name,
         detail="Copying legitimate file timestamps via timestamp-copy tool",
         technique_id="T1070.006")


def emit_registry_cleanup(process_name: str, run_key: str | None = None) -> None:
    """Delete malicious registry artifacts (T1070)."""
    set_phase("defense_evasion_depth")
    target = run_key or r"HKCU\Software\Microsoft\Windows\CurrentVersion\RunOnce\EvilKey"
    emit("REGISTRY", "DELETE_KEY", target, "CRITICAL",
         source_process=process_name,
         detail="Deleting malicious registry artifact to hide traces",
         technique_id="T1070")
    emit("REGISTRY", "DELETE_KEY",
         r"HKLM\SYSTEM\CurrentControlSet\Services\EvilService",
         "CRITICAL",
         source_process=process_name,
         detail="Deleting service registry key after execution",
         technique_id="T1070")


def emit_vss_delete(process_name: str) -> None:
    """Delete Volume Shadow Copies to prevent recovery (T1490)."""
    set_phase("defense_evasion_depth")
    emit("PROCESS", "CREATE_PROCESS", "vssadmin.exe", "CRITICAL",
         source_process=process_name,
         command="vssadmin delete shadows /all /quiet",
         detail="Deleting all Volume Shadow Copies",
         technique_id="T1490")
    emit("PROCESS", "CREATE_PROCESS", "wmic.exe", "CRITICAL",
         source_process=process_name,
         command="wmic shadowcopy delete",
         detail="Deleting shadow copies via WMI",
         technique_id="T1490")
    emit("PROCESS", "CREATE_PROCESS", "wbadmin.exe", "CRITICAL",
         source_process=process_name,
         command="wbadmin delete catalog -quiet",
         detail="Deleting backup catalog",
         technique_id="T1490")


def emit_inhibit_system_recovery(process_name: str) -> None:
    """Disable system recovery options (T1490)."""
    set_phase("defense_evasion_depth")
    emit("REGISTRY", "SET_VALUE",
         r"HKLM\SYSTEM\CurrentControlSet\Control\SystemRestore",
         "CRITICAL",
         source_process=process_name,
         value_name="DisableSR", value_data="1",
         detail="Disabling system restore points",
         technique_id="T1490")
    emit("PROCESS", "CREATE_PROCESS", "bcdedit.exe", "CRITICAL",
         source_process=process_name,
         command="bcdedit /set {default} recoveryenabled No",
         detail="Disabling Windows recovery on boot failure",
         technique_id="T1490")
    emit("PROCESS", "CREATE_PROCESS", "reagentc.exe", "CRITICAL",
         source_process=process_name,
         command="reagentc /disable",
         detail="Disabling Windows Recovery Environment (WinRE)",
         technique_id="T1490")


def emit_masquerade_process(process_name: str, masquerade_as: str = "svchost.exe") -> None:
    """Spawn a masqueraded child process (T1036.005)."""
    set_phase("defense_evasion_depth")
    emit("PROCESS", "CREATE_PROCESS", masquerade_as, "WARNING",
         source_process=process_name,
         command=f"{masquerade_as} -k {process_name[:-4]}",
         detail=f"Masquerading as {masquerade_as} with service argument",
         technique_id="T1036.005")
    emit("PROCESS", "CREATE_THREAD", process_name, "WARNING",
         source_process=process_name,
         detail="Spoofing parent PID (PPID spoofing) to masquerade lineage",
         technique_id="T1036.005")


def emit_disable_logging(process_name: str) -> None:
    """Disable script/command logging (T1562.008)."""
    set_phase("defense_evasion_depth")
    emit("REGISTRY", "SET_VALUE",
         r"HKLM\SOFTWARE\Policies\Microsoft\Windows\PowerShell\ScriptBlockLogging",
         "CRITICAL",
         source_process=process_name,
         value_name="EnableScriptBlockLogging", value_data="0",
         detail="Disabling PowerShell script block logging",
         technique_id="T1562.008")
    emit("REGISTRY", "SET_VALUE",
         r"HKLM\SOFTWARE\Policies\Microsoft\Windows\PowerShell\Transcription",
         "CRITICAL",
         source_process=process_name,
         value_name="EnableTranscripting", value_data="0",
         detail="Disabling PowerShell transcription logging",
         technique_id="T1562.008")
    emit("REGISTRY", "SET_VALUE",
         r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System\Audit",
         "CRITICAL",
         source_process=process_name,
         value_name="ProcessCreationIncludeCmdLine_Enabled", value_data="0",
         detail="Disabling command-line process creation auditing (4688)",
         technique_id="T1562.008")
