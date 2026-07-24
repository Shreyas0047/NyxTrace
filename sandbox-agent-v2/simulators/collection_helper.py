"""Collection primitives for simulator realism (Phase 11).

Provides reusable telemetry emitters for data collection techniques
beyond basic keylogging and screenshots:

  - Clipboard monitoring (T1115)
  - Audio capture via microphone (T1123)
  - Input capture — form grabbing, credential harvesting (T1056)
  - Automated file collection (T1119)
  - Screen capture detail (T1113 depth)
  - Browser bookmark / history collection (T1217)
  - Email collection — local client (T1114)

MITRE ATT&CK: T1115, T1123, T1056, T1119, T1113, T1217, T1114
"""

from __future__ import annotations

from telemetry_helper import emit, set_phase


def emit_clipboard_monitoring(process_name: str) -> None:
    """Monitor clipboard content changes (T1115)."""
    set_phase("collection")
    emit("PROCESS", "CREATE_THREAD", process_name, "WARNING",
         source_process=process_name,
         detail="Installing clipboard change listener via SetClipboardViewer",
         technique_id="T1115")
    emit("REGISTRY", "SET_VALUE",
         r"HKCU\Software\Microsoft\Clipboard\Monitoring",
         "WARNING",
         source_process=process_name,
         value_name="ClipCaptureEnabled", value_data="1",
         detail="Enabling clipboard monitoring persistence",
         technique_id="T1115")
    for i, content in enumerate(("copied_secret_data", "admin:Passw0rd!")):
        emit("PROCESS", "ENVIRONMENT_CHECK", process_name, "WARNING",
             source_process=process_name,
             detail=f"Clipboard content captured [{i}]: {content}",
             technique_id="T1115")


def emit_audio_capture(process_name: str, duration_s: int = 30) -> None:
    """Capture audio from microphone (T1123)."""
    set_phase("collection")
    emit("PROCESS", "CREATE_THREAD", process_name, "CRITICAL",
         source_process=process_name,
         detail=f"Opening microphone device for {duration_s}s audio capture",
         technique_id="T1123")
    emit("FILE", "CREATE_FILE", r"C:\Windows\Temp\~rec.wav", "WARNING",
         source_process=process_name,
         detail=f"Writing captured audio stream ({duration_s}s at 44.1kHz)",
         technique_id="T1123")
    emit("REGISTRY", "SET_VALUE",
         r"HKCU\Software\Microsoft\Windows\CurrentVersion\Capabilities",
         "WARNING",
         source_process=process_name,
         value_name="MicAccessEnabled", value_data="1",
         detail="Granting microphone access for capture",
         technique_id="T1123")


def emit_input_capture(process_name: str, technique: str = "keylog") -> None:
    """Capture user input via keylogging or form grabbing (T1056)."""
    set_phase("collection")
    if technique == "keylog":
        emit("PROCESS", "KEYLOGGER", process_name, "CRITICAL",
             source_process=process_name,
             detail="Installing kernel-mode keyboard hook via NtUserSetWindowsHookEx",
             technique_id="T1056.001")
        emit("PROCESS", "ENVIRONMENT_CHECK", process_name, "CRITICAL",
             source_process=process_name,
             detail="Captured keystroke buffer dump (48 bytes)",
             technique_id="T1056.001")
    else:
        emit("PROCESS", "CREATE_THREAD", process_name, "CRITICAL",
             source_process=process_name,
             detail="Injecting form-grabbing hook into browser process",
             technique_id="T1056.003")
        emit("REGISTRY", "READ_KEY",
             r"HKCU\Software\Microsoft\Internet Explorer\Main\FormData",
             "CRITICAL",
             source_process=process_name,
             detail="Reading stored form autocomplete data",
             technique_id="T1056.003")


def emit_automated_collection(process_name: str, search_patterns: list[str] | None = None) -> None:
    """Automatically collect files matching patterns (T1119)."""
    set_phase("collection")
    patterns = search_patterns or [
        "*.doc", "*.xls", "*.pdf", "*.txt", "*.kdbx",
    ]
    for pattern in patterns:
        emit("FILE", "SCAN_FILES", pattern, "WARNING",
             source_process=process_name,
             detail=f"Scanning for files matching: {pattern}",
             technique_id="T1119")
    emit("FILE", "READ_FILE", r"%USERPROFILE%\Documents", "WARNING",
         source_process=process_name,
         detail="Copying matched files to staging directory for exfiltration",
         technique_id="T1119")
    emit("REGISTRY", "READ_KEY",
         r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
         "INFO",
         source_process=process_name,
         detail="Enumerating installed software for collection targeting",
         technique_id="T1119")


def emit_screen_capture_detail(process_name: str, count: int = 3) -> None:
    """Capture screen content with detail (T1113 depth)."""
    set_phase("collection")
    for i in range(count):
        emit("FILE", "SCREEN_CAPTURE", f"~cap_{i:03d}.png", "WARNING",
             source_process=process_name,
             monitor=i,
             detail=f"Capture of monitor {i} ({1920 + i * 320}x1080) via BitBlt",
             technique_id="T1113")
    emit("PROCESS", "CREATE_THREAD", process_name, "WARNING",
         source_process=process_name,
         detail="Spawning screenshot worker thread for periodic captures (every 30s)",
         technique_id="T1113")


def emit_browser_collection(process_name: str) -> None:
    """Collect browser bookmarks and browsing history (T1217)."""
    set_phase("collection")
    emit("FILE", "READ_FILE", r"%LOCALAPPDATA%\Google\Chrome\User Data\Default\Bookmarks",
         "WARNING",
         source_process=process_name,
         detail="Reading Chrome bookmarks for target profiling",
         technique_id="T1217")
    emit("FILE", "READ_FILE", r"%LOCALAPPDATA%\Google\Chrome\User Data\Default\History",
         "WARNING",
         source_process=process_name,
         detail="Reading Chrome browsing history",
         technique_id="T1217")
    emit("REGISTRY", "READ_KEY",
         r"HKCU\Software\Microsoft\Internet Explorer\TypedURLs",
         "WARNING",
         source_process=process_name,
         detail="Reading IE typed URL history",
         technique_id="T1217")


def emit_email_collection(process_name: str) -> None:
    """Collect email from local client (T1114)."""
    set_phase("collection")
    emit("FILE", "READ_FILE", r"%LOCALAPPDATA%\Microsoft\Outlook\*.pst",
         "WARNING",
         source_process=process_name,
         detail="Collecting Outlook PST file for exfiltration",
         technique_id="T1114.001")
    emit("REGISTRY", "READ_KEY",
         r"HKCU\Software\Microsoft\Office\*\Outlook\Profiles",
         "WARNING",
         source_process=process_name,
         detail="Reading Outlook profile configuration",
         technique_id="T1114.001")
    emit("FILE", "READ_FILE", r"%APPDATA%\Thunderbird\Profiles\*.default\Mail",
         "WARNING",
         source_process=process_name,
         detail="Collecting Thunderbird mail store",
         technique_id="T1114.001")
