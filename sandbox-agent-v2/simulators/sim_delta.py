"""Simulator Delta — data harvesting and surveillance behavior.

Behaviors: keylogger stub, screenshot capture simulation, clipboard monitoring,
file scanning for sensitive documents, data staging and exfiltration attempt.

MITRE ATT&CK: T1056.001, T1113, T1115, T1083, T1041
"""

from __future__ import annotations

import json
import os
import random
import shutil
import socket
import sys
from pathlib import Path

from telemetry_helper import check_environment, emit, EnvSafety, set_phase, jitter
from c2_helper import fronted_beacon, emit_heartbeats, jittered_sleep, FRONT_DOMAINS


def main() -> int:
    set_phase("initialization")
    emit("PROCESS", "CREATE_PROCESS", sys.executable, "WARNING",
         source_process="svchost_d.exe", pid=os.getpid())

    env, env_reasons = check_environment()
    if env_reasons:
        emit("PROCESS", "ENVIRONMENT_CHECK",
             os.environ.get("COMPUTERNAME", "unknown"),
             "WARNING" if env != EnvSafety.CLEAN else "INFO",
             source_process="svchost_d.exe",
             verdict=env.name, reasons=env_reasons)
    if env == EnvSafety.COMPROMISED:
        emit("PROCESS", "EXIT_PROCESS", "svchost_d.exe", "INFO",
             source_process="svchost_d.exe", early_exit="COMPROMISED environment")
        return 0

    user = os.environ.get("USERPROFILE", r"C:\Users\guestuser")

    # Phase 1: Keylogger hook
    if env != EnvSafety.SUSPICIOUS:
        set_phase("keylogger")
        emit("PROCESS", "KEYLOGGER", "svchost_d.exe", "CRITICAL",
             source_process="svchost_d.exe",
             detail="Installing keyboard hook (SetWindowsHookEx simulation)", technique_id="T1056.001")
        emit("REGISTRY", "SET_VALUE", r"HKCU\Software\Microsoft\Input\Settings", "WARNING",
             source_process="svchost_d.exe", value_name="KeyCapture",
             detail="Keyboard capture configuration written")
        jitter(0.3, 0.4)

    # Phase 2: Screenshot capture
    set_phase("screen_capture")
    screenshots_dir = Path(os.environ.get("TEMP", r"C:\Windows\Temp")) / "~scr"
    screenshots_dir.mkdir(parents=True, exist_ok=True)
    for i in range(3):
        shot = screenshots_dir / f"cap_{i:03d}.bmp"
        shot.write_bytes(os.urandom(1024))
        emit("FILE", "SCREEN_CAPTURE", str(shot), "WARNING",
             source_process="svchost_d.exe", size=1024,
             detail=f"Screenshot captured #{i+1}", technique_id="T1113")
        jitter(0.2, 0.2)

    # Phase 3: Clipboard monitoring
    if env != EnvSafety.SUSPICIOUS:
        set_phase("clipboard")
        emit("PROCESS", "CLIPBOARD", "svchost_d.exe", "WARNING",
             source_process="svchost_d.exe",
             detail="Clipboard monitor active (OpenClipboard hook)", technique_id="T1115")
        (screenshots_dir / "clipboard.log").write_text("clipboard_data_placeholder")
        jitter(0.2, 0.2)

    # Phase 4: Sensitive file scanning
    set_phase("file_discovery")
    scan_dirs = [Path(user) / "Documents", Path(user) / "Desktop", Path(user) / "Downloads"]
    found = 0
    for d in scan_dirs:
        if not d.exists():
            continue
        emit("FILE", "SCAN_FILES", str(d), "INFO",
             source_process="svchost_d.exe", detail=f"Scanning {d.name}", technique_id="T1083")
        for f in d.iterdir():
            if f.is_file() and f.suffix.lower() in (".txt", ".pdf", ".docx", ".csv", ".xlsx"):
                found += 1
                emit("FILE", "READ_FILE", str(f), "WARNING",
                     source_process="svchost_d.exe", size=f.stat().st_size,
                     detail=f"Sensitive file indexed: {f.name}")
        jitter(0.15, 0.15)

    # Phase 5: Data staging
    set_phase("staging")
    staging = screenshots_dir / "staged.dat"
    staging.write_text(f"harvested_files={found}\nscreenshots=3\nclipboard=captured\n")
    emit("FILE", "CREATE_FILE", str(staging), "CRITICAL",
         source_process="svchost_d.exe", detail="Harvested data staged for exfil")

    # Phase 6: Exfiltration (domain-fronted)
    if env != EnvSafety.SUSPICIOUS:
        set_phase("exfiltration")
        for server in ["10.13.37.60", "10.13.37.61"]:
            front = random.choice(FRONT_DOMAINS)
            emit("NETWORK", "EXFILTRATE", f"{server}:443", "CRITICAL",
                 source_process="svchost_d.exe", protocol="HTTPS", method="POST",
                 detail=f"Exfiltrating surveillance data (fronted: {front})", technique_id="T1041")
            emit("NETWORK", "DOMAIN_FRONT", front, "WARNING",
                 source_process="svchost_d.exe", target_host=front, target_ip=server,
                 detail=f"Domain fronting exfiltration via {front}", technique_id="T1090")
            fronted_beacon(server, 443, front, {"type": "exfil", "source": "delta"})
            jittered_sleep(0.3, 0.4)
        emit_heartbeats("10.13.37.60", 8443, count=2,
                        process_name="svchost_d.exe",
                        min_interval=8.0, max_interval=20.0)

    shutil.rmtree(screenshots_dir, ignore_errors=True)
    emit("FILE", "DELETE_FILE", str(screenshots_dir), "INFO",
         source_process="svchost_d.exe", detail="Staging cleaned", technique_id="T1070.004")
    emit("PROCESS", "EXIT_PROCESS", "svchost_d.exe", "INFO",
         source_process="svchost_d.exe", files_found=found)
    return 0


if __name__ == "__main__":
    sys.exit(main())
