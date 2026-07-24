"""Defense evasion and discovery primitives for simulator realism.

Provides reusable telemetry emitters for:
  - AMSI bypass (T1562.001)
  - ETW patching (T1562.006)
  - UAC bypass (T1548.002)
  - System info discovery (T1082)
  - Process discovery (T1057)
  - Software enumeration (T1518)
  - Firewall modification (T1562.004)

All functions emit JSON to stdout via telemetry_helper.emit().
"""

from __future__ import annotations

from telemetry_helper import emit, set_phase


AMSI_BYPASS_METHODS = {
    "registry": (
        r"HKLM\SOFTWARE\Microsoft\AMSI\Providers",
        r"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\AMSI\Providers",
        "T1562.001",
        "Disabling AMSI via registry provider key deletion",
    ),
    "patch": (
        r"HKCU\SOFTWARE\Microsoft\Windows Script\Settings",
        r"HKEY_CURRENT_USER\SOFTWARE\Microsoft\Windows Script\Settings",
        "T1562.001",
        "AMSI patching via AmsiScanBuffer manipulation",
    ),
}

UAC_BYPASS_TECHNIQUES = {
    "fodhelper": (
        r"HKCU\Software\Classes\ms-settings\shell\open\command",
        "fodhelper.exe",
        "T1548.002",
        "UAC bypass via fodhelper.exe — CurVer delegation",
    ),
    "eventvwr": (
        r"HKCU\Software\Classes\mscfile\shell\open\command",
        "eventvwr.exe",
        "T1548.002",
        "UAC bypass via eventvwr.exe — registry hijack",
    ),
    "sdclt": (
        r"HKCU\Software\Classes\exefile\shell\runas\command",
        "sdclt.exe",
        "T1548.002",
        "UAC bypass via sdclt.exe — key theft pattern",
    ),
}


def emit_amsi_bypass(process_name: str, method: str = "registry") -> str:
    key, reg_key, technique, desc = AMSI_BYPASS_METHODS[method]
    set_phase("amsi_bypass")
    emit("REGISTRY", "DELETE_KEY", key, "CRITICAL",
         source_process=process_name,
         detail=desc, technique_id=technique)
    return key


def emit_etw_patch(process_name: str) -> None:
    set_phase("etw_patch")
    key = r"HKLM\SYSTEM\CurrentControlSet\Control\WMI\Etw"
    emit("REGISTRY", "SET_VALUE", key, "CRITICAL",
         source_process=process_name,
         value_name="EtwEventId", value_data="0",
         detail="Disabling ETW event tracing via registry",
         technique_id="T1562.006")
    emit("PROCESS", "CREATE_THREAD", process_name, "WARNING",
         source_process=process_name,
         detail="ETW patching via EtwEventWrite manipulation",
         technique_id="T1562.006")


def emit_uac_bypass(process_name: str, technique: str = "fodhelper") -> str:
    key, binary, technique_id, desc = UAC_BYPASS_TECHNIQUES[technique]
    set_phase("uac_bypass")
    emit("REGISTRY", "CREATE_KEY", key, "CRITICAL",
         source_process=process_name,
         detail=desc, technique_id=technique_id)
    emit("REGISTRY", "SET_VALUE", key, "CRITICAL",
         source_process=process_name,
         value_name="", value_data=r"C:\Windows\System32\cmd.exe",
         detail=f"UAC bypass via {binary} — deferred execution",
         technique_id=technique_id)
    emit("PROCESS", "CREATE_PROCESS", binary, "CRITICAL",
         source_process=process_name,
         command=f"{binary} {{bypass}}",
         detail=f"Elevated process via {binary} UAC bypass",
         technique_id=technique_id)
    return key


def emit_system_discovery(process_name: str) -> None:
    set_phase("system_discovery")
    emit("PROCESS", "CREATE_THREAD", process_name, "INFO",
         source_process=process_name,
         detail="Enumerating system configuration (T1082)")
    emit("PROCESS", "ENVIRONMENT_CHECK",
         "system_info", "INFO",
         source_process=process_name,
         detail="Gathering OS version, architecture, hostname",
         technique_id="T1082")
    emit("NETWORK", "DNS_QUERY", "whoami", "INFO",
         source_process=process_name,
         command="whoami /all",
         detail="Enumerating current user and group membership",
         technique_id="T1082")


def emit_software_discovery(process_name: str) -> None:
    set_phase("software_discovery")
    emit("REGISTRY", "READ_KEY",
         r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
         "WARNING",
         source_process=process_name,
         detail="Enumerating installed software via uninstall keys",
         technique_id="T1518")
    emit("REGISTRY", "READ_KEY",
         r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths",
         "INFO",
         source_process=process_name,
         detail="Enumerating application paths",
         technique_id="T1518")


def emit_process_discovery(process_name: str) -> None:
    set_phase("process_discovery")
    emit("PROCESS", "ENUMERATE_PROCESSES", process_name, "WARNING",
         source_process=process_name,
         detail="Enumerating running processes via CreateToolhelp32Snapshot",
         technique_id="T1057")
    emit("PROCESS", "ENUMERATE_PROCESSES", "tasklist.exe", "INFO",
         source_process=process_name,
         command="tasklist /v",
         detail="Enumerating processes with verbose detail",
         technique_id="T1057")


def emit_firewall_rule(process_name: str,
                       rule_name: str,
                       direction: str = "in",
                       port: int = 3389) -> None:
    set_phase("firewall_modification")
    emit("REGISTRY", "SET_VALUE",
         r"HKLM\SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters\FirewallPolicy",
         "CRITICAL",
         source_process=process_name,
         detail=f"Adding firewall rule '{rule_name}' — {direction} port {port}",
         technique_id="T1562.004")
    emit("PROCESS", "CREATE_PROCESS", "netsh.exe", "CRITICAL",
         source_process=process_name,
         command=f"netsh advfirewall firewall add rule name={rule_name} dir={direction} protocol=TCP localport={port} action=allow",
         detail=f"Firewall rule created: {rule_name} ({direction}:{port})",
         technique_id="T1562.004")
