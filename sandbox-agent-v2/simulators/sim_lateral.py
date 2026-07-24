"""Simulator Lateral — lateral movement and network propagation behavior.

Behaviors: network host discovery, SMB share enumeration, pass-the-hash attempt,
remote service creation, WMI execution simulation, internal pivoting.

MITRE ATT&CK: T1018, T1021.002, T1550.002, T1569.002, T1047
"""

from __future__ import annotations

import json
import os
import random
import socket
import subprocess
import sys
from pathlib import Path

from telemetry_helper import check_environment, emit, EnvSafety, set_phase, jitter

# Simulated internal network (non-routable)
INTERNAL_HOSTS = [
    ("10.0.0.10", "DC01"),
    ("10.0.0.20", "FILESERVER"),
    ("10.0.0.30", "WORKSTATION-1"),
    ("10.0.0.40", "WORKSTATION-2"),
    ("10.0.0.50", "SQLSERVER"),
]

SMB_PORT = 445
WMI_PORT = 135


def main() -> int:
    set_phase("initialization")
    emit("PROCESS", "CREATE_PROCESS", sys.executable, "WARNING",
         source_process="lateral.exe", pid=os.getpid(),
         detail="Lateral movement simulator started")

    env, env_reasons = check_environment()
    if env_reasons:
        emit("PROCESS", "ENVIRONMENT_CHECK",
             os.environ.get("COMPUTERNAME", "unknown"),
             "WARNING" if env != EnvSafety.CLEAN else "INFO",
             source_process="lateral.exe",
             verdict=env.name, reasons=env_reasons)
    if env == EnvSafety.COMPROMISED:
        emit("PROCESS", "EXIT_PROCESS", "lateral.exe", "INFO",
             source_process="lateral.exe", early_exit="COMPROMISED environment")
        return 0

    # --- Phase 1: Network Discovery (host scanning) ---
    set_phase("network_discovery")
    emit("PROCESS", "CREATE_THREAD", "lateral.exe", "INFO",
         source_process="lateral.exe",
         detail="Starting internal network scan", technique_id="T1018")

    alive_hosts = []
    for ip, hostname in INTERNAL_HOSTS:
        emit("NETWORK", "CONNECT", f"{ip}:{SMB_PORT}", "WARNING",
             source_process="lateral.exe", protocol="TCP",
             detail=f"Port scan: {ip} (SMB/445)", technique_id="T1018")
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(1)
            s.connect((ip, SMB_PORT))
            s.close()
            alive_hosts.append((ip, hostname))
        except (ConnectionRefusedError, OSError, socket.timeout):
            # Simulated — mark some as "alive" anyway for telemetry
            if random.random() < 0.6:
                alive_hosts.append((ip, hostname))
        jitter(0.2, 0.3)

    emit("NETWORK", "DNS_QUERY", "10.0.0.0/24", "INFO",
         source_process="lateral.exe",
         detail=f"Discovery complete: {len(alive_hosts)} hosts found", technique_id="T1018")

    # --- Phase 2: SMB Share Enumeration ---
    set_phase("smb_enumeration")
    emit("PROCESS", "CREATE_THREAD", "lateral.exe", "INFO",
         source_process="lateral.exe",
         detail="Enumerating SMB shares on discovered hosts", technique_id="T1135")

    for ip, hostname in alive_hosts[:3]:
        shares = random.sample(["C$", "ADMIN$", "IPC$", "Users", "Shared", "Backups"], k=3)
        emit("NETWORK", "SMB_CONNECT", f"\\\\{ip}\\IPC$", "CRITICAL",
             source_process="lateral.exe", protocol="SMB",
             hostname=hostname, detail=f"SMB null session to {hostname}",
             technique_id="T1021.002")
        for share in shares:
            emit("NETWORK", "SMB_CONNECT", f"\\\\{ip}\\{share}", "WARNING",
                 source_process="lateral.exe", protocol="SMB",
                 hostname=hostname, share=share,
                 detail=f"Enumerating share: \\\\{hostname}\\{share}", technique_id="T1135")
        jitter(0.4, 0.5)

    # --- Phase 3: Credential Harvesting for PTH ---
    set_phase("credential_harvest")
    emit("PROCESS", "CREATE_PROCESS", "mimikatz.exe", "CRITICAL",
         source_process="lateral.exe",
         detail="Dumping NTLM hashes from memory (sekurlsa::logonpasswords)",
         technique_id="T1003.001")
    jitter(0.5, 0.5)

    ntlm_hash = "aad3b435b51404eeaad3b435b51404ee:8846f7eaee8fb117ad06bdd830b7586c"
    emit("PROCESS", "CREATE_THREAD", "lateral.exe", "CRITICAL",
         source_process="lateral.exe",
         detail=f"NTLM hash captured: Administrator:{ntlm_hash[:20]}...",
         technique_id="T1003.001")

    # --- Phase 4: Pass-the-Hash ---
    if env != EnvSafety.SUSPICIOUS:
        set_phase("pass_the_hash")
        target_ip, target_host = alive_hosts[0] if alive_hosts else ("10.0.0.10", "DC01")
        emit("NETWORK", "PASS_THE_HASH", f"{target_ip}:{SMB_PORT}", "CRITICAL",
             source_process="lateral.exe", protocol="NTLM",
             target_host=target_host, username="Administrator",
             detail=f"Pass-the-Hash authentication to {target_host}",
             technique_id="T1550.002")
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(2)
            s.connect((target_ip, SMB_PORT))
            s.close()
        except (ConnectionRefusedError, OSError, socket.timeout):
            pass
        jitter(0.3, 0.4)
        emit("NETWORK", "SMB_CONNECT", f"\\\\{target_ip}\\ADMIN$", "CRITICAL",
             source_process="lateral.exe", protocol="SMB",
             detail=f"Authenticated access to ADMIN$ on {target_host}",
             technique_id="T1021.002")

    if env != EnvSafety.SUSPICIOUS:
        set_phase("remote_execution")
        emit("PROCESS", "REMOTE_SERVICE", f"\\\\{target_ip}", "CRITICAL",
             source_process="lateral.exe",
             detail=f"Creating remote service on {target_host} (sc.exe \\\\{target_host} create)",
             technique_id="T1569.002")
        try:
            subprocess.run(
                ["sc.exe", f"\\\\{target_ip}", "create", "WinUpdateSvc",
                 "binPath=", r"C:\Windows\Temp\payload.exe", "start=", "auto"],
                capture_output=True, timeout=5)
        except Exception:
            pass
        emit("PROCESS", "REMOTE_SERVICE", f"\\\\{target_ip}", "CRITICAL",
             source_process="lateral.exe",
             detail=f"Starting remote service on {target_host}",
             technique_id="T1569.002")
        jitter(0.3, 0.3)

    if env != EnvSafety.SUSPICIOUS:
        set_phase("wmi_execution")
        second_target = alive_hosts[1] if len(alive_hosts) > 1 else ("10.0.0.20", "FILESERVER")
        emit("NETWORK", "CONNECT", f"{second_target[0]}:{WMI_PORT}", "CRITICAL",
             source_process="lateral.exe", protocol="DCOM/WMI",
             detail=f"WMI connection to {second_target[1]}", technique_id="T1047")
        emit("PROCESS", "CREATE_PROCESS", "wmic.exe", "CRITICAL",
             source_process="lateral.exe",
             command=f"wmic /node:{second_target[0]} process call create 'cmd.exe /c whoami > C:\\temp\\out.txt'",
             detail=f"Remote command execution via WMI on {second_target[1]}",
             technique_id="T1047")
        jitter(0.4, 0.4)

    # --- Phase 7: Payload Copy to Remote Host ---
    if env != EnvSafety.SUSPICIOUS:
        set_phase("payload_deployment")
        payload_path = f"\\\\{target_ip}\\ADMIN$\\Temp\\payload.exe"
        emit("FILE", "CREATE_FILE", payload_path, "CRITICAL",
             source_process="lateral.exe", size=4096,
             detail=f"Payload deployed to {target_host} via SMB",
             technique_id="T1570")

    emit("PROCESS", "EXIT_PROCESS", "lateral.exe", "INFO",
         source_process="lateral.exe",
         hosts_discovered=len(alive_hosts),
         hosts_compromised=0 if env == EnvSafety.SUSPICIOUS else 2,
         techniques_used=["T1550.002", "T1569.002", "T1047"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
