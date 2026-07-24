"""Discovery depth primitives for simulator realism (Phase 8).

Provides reusable telemetry emitters for host/network discovery techniques
not covered by defense_helper's basic system/process/software discovery:

  - Account discovery (T1087)
  - Domain trust discovery (T1482)
  - Permission groups discovery (T1069)
  - System network configuration discovery (T1016)
  - System network connections discovery (T1049)
  - System owner discovery (T1033)
  - System location discovery (T1614)
  - Network share discovery (T1135)
  - File/directory discovery depth (T1083)

MITRE ATT&CK: T1087, T1482, T1069, T1016, T1049, T1033, T1614, T1135, T1083
"""

from __future__ import annotations

from telemetry_helper import emit, set_phase


def emit_account_discovery(process_name: str, method: str = "net") -> None:
    """Enumerate user accounts (T1087)."""
    set_phase("discovery_depth")
    emit("PROCESS", "CREATE_PROCESS", "net.exe", "WARNING",
         source_process=process_name,
         command="net user /domain" if method == "domain" else "net user",
         detail="Enumerating local/domain user accounts",
         technique_id="T1087")
    emit("PROCESS", "CREATE_PROCESS", "net.exe", "WARNING",
         source_process=process_name,
         command="net group /domain",
         detail="Enumerating domain groups",
         technique_id="T1087.002")


def emit_domain_trust_discovery(process_name: str) -> None:
    """Enumerate domain trusts (T1482)."""
    set_phase("discovery_depth")
    emit("PROCESS", "CREATE_PROCESS", "nltest.exe", "WARNING",
         source_process=process_name,
         command="nltest /domain_trusts",
         detail="Enumerating domain trust relationships",
         technique_id="T1482")
    emit("PROCESS", "CREATE_PROCESS", "nltest.exe", "INFO",
         source_process=process_name,
         command="nltest /dclist:%USERDNSDOMAIN%",
         detail="Enumerating domain controllers",
         technique_id="T1482")
    emit("NETWORK", "DNS_QUERY", "_ldap._tcp.dc._msdcs.%USERDNSDOMAIN%", "INFO",
         source_process=process_name,
         query_type="SRV",
         detail="DC discovery via DNS SRV query",
         technique_id="T1482")


def emit_permission_groups_discovery(process_name: str) -> None:
    """Enumerate permission groups (T1069)."""
    set_phase("discovery_depth")
    emit("PROCESS", "CREATE_PROCESS", "whoami.exe", "WARNING",
         source_process=process_name,
         command="whoami /groups",
         detail="Enumerating current user group memberships",
         technique_id="T1069")
    emit("PROCESS", "CREATE_PROCESS", "net.exe", "WARNING",
         source_process=process_name,
         command="net localgroup",
         detail="Enumerating local groups",
         technique_id="T1069.001")
    emit("REGISTRY", "READ_KEY",
         r"HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList",
         "INFO",
         source_process=process_name,
         detail="Enumerating user SIDs and profile paths",
         technique_id="T1069")


def emit_network_config_discovery(process_name: str) -> None:
    """Enumerate network configuration (T1016)."""
    set_phase("discovery_depth")
    emit("PROCESS", "CREATE_PROCESS", "ipconfig.exe", "WARNING",
         source_process=process_name,
         command="ipconfig /all",
         detail="Enumerating network adapters and DNS configuration",
         technique_id="T1016")
    emit("PROCESS", "CREATE_PROCESS", "arp.exe", "WARNING",
         source_process=process_name,
         command="arp -a",
         detail="Enumerating ARP cache for lateral targets",
         technique_id="T1016")
    emit("PROCESS", "CREATE_PROCESS", "route.exe", "INFO",
         source_process=process_name,
         command="route print",
         detail="Enumerating routing table",
         technique_id="T1016")


def emit_network_connections_discovery(process_name: str) -> None:
    """Enumerate active network connections (T1049)."""
    set_phase("discovery_depth")
    emit("PROCESS", "CREATE_PROCESS", "netstat.exe", "WARNING",
         source_process=process_name,
         command="netstat -ano",
         detail="Enumerating active TCP/UDP connections and listening ports",
         technique_id="T1049")
    emit("PROCESS", "CREATE_PROCESS", "netstat.exe", "INFO",
         source_process=process_name,
         command="netstat -nabo",
         detail="Enumerating connections with owning process names",
         technique_id="T1049")


def emit_system_owner_discovery(process_name: str) -> None:
    """Enumerate current user and system owner (T1033)."""
    set_phase("discovery_depth")
    emit("PROCESS", "CREATE_PROCESS", "whoami.exe", "INFO",
         source_process=process_name,
         command="whoami",
         detail="Identifying current user context",
         technique_id="T1033")
    emit("PROCESS", "CREATE_PROCESS", "net.exe", "INFO",
         source_process=process_name,
         command="net config workstation",
         detail="Enumerating workstation domain and logon server",
         technique_id="T1033")
    emit("PROCESS", "CREATE_PROCESS", "query.exe", "INFO",
         source_process=process_name,
         command="query user",
         detail="Enumerating active user sessions on host",
         technique_id="T1033")


def emit_system_location_discovery(process_name: str) -> None:
    """Enumerate system location and time zone (T1614)."""
    set_phase("discovery_depth")
    emit("PROCESS", "CREATE_PROCESS", "tzutil.exe", "INFO",
         source_process=process_name,
         command="tzutil /g",
         detail="Enumerating system time zone for geo-location",
         technique_id="T1614")
    emit("PROCESS", "CREATE_PROCESS", "systeminfo.exe", "INFO",
         source_process=process_name,
         command="systeminfo | findstr /B /C:\"OS Name\" /C:\"System Locale\"",
         detail="Enumerating system locale and regional settings",
         technique_id="T1614")
    emit("NETWORK", "DNS_QUERY", "geo.telemetry-service.local", "INFO",
         source_process=process_name,
         query_type="A",
         detail="Attempting geo-IP lookup for physical location profiling",
         technique_id="T1614")


def emit_network_share_discovery(process_name: str) -> None:
    """Enumerate network shares (T1135)."""
    set_phase("discovery_depth")
    emit("PROCESS", "CREATE_PROCESS", "net.exe", "WARNING",
         source_process=process_name,
         command="net share",
         detail="Enumerating local SMB shares",
         technique_id="T1135")
    emit("PROCESS", "CREATE_PROCESS", "net.exe", "WARNING",
         source_process=process_name,
         command="net view /domain",
         detail="Enumerating domain resources and remote shares",
         technique_id="T1135")


def emit_file_directory_discovery(process_name: str, target_dir: str = "C:\\") -> None:
    """Enumerate files/directories in a sensitive path (T1083 depth)."""
    set_phase("discovery_depth")
    emit("FILE", "SCAN_FILES", target_dir, "WARNING",
         source_process=process_name,
         command=f'dir /s "{target_dir}"',
         detail=f"Recursively enumerating files in {target_dir}",
         technique_id="T1083")
    emit("FILE", "READ_FILE", target_dir, "INFO",
         source_process=process_name,
         detail="Reading directory listing with hidden/system file visibility",
         technique_id="T1083")
