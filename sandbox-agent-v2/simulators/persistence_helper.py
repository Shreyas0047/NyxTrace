"""Persistence technique emitters shared across all simulators.

MITRE ATT&CK:
  T1547.001 — Boot or Logon Autostart Execution: Registry Run Keys / Startup Folder
  T1053.005 — Scheduled Task/Job: Scheduled Task
  T1546.003 — Event Triggered Execution: WMI Event Subscription
  T1543.003 — Create or Modify System Process: Windows Service
  T1574.002 — Hijack Execution Flow: DLL Side-Loading (COM hijack)
"""

from telemetry_helper import emit, set_phase


def emit_registry_run(source_process: str, value_name: str,
                      value_data: str, run_type: str = "HKCU") -> None:
    """T1547.001 — Registry Run Keys persistence."""
    set_phase("persistence")
    key = (r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run" if run_type == "HKCU"
           else r"HKLM\Software\Microsoft\Windows\CurrentVersion\Run")
    emit("REGISTRY", "SET_VALUE", key, "CRITICAL",
         source_process=source_process,
         value_name=value_name, value_data=value_data,
         detail="Persistence via Registry Run key", technique_id="T1547.001")


def emit_scheduled_task(source_process: str, task_name: str,
                        bin_path: str, schedule: str = "HOURLY") -> None:
    """T1053.005 — Scheduled task persistence."""
    set_phase("scheduled_task")
    emit("PROCESS", "SCHEDULED_TASK", "schtasks.exe", "CRITICAL",
         source_process=source_process,
         command=f"schtasks /create /tn {task_name} /tr {bin_path} /sc {schedule} /f",
         detail=f"Scheduled task '{task_name}' for persistence",
         technique_id="T1053.005")


def emit_wmi_subscription(source_process: str) -> None:
    """T1546.003 — WMI Event Subscription persistence."""
    set_phase("wmi_persistence")
    emit("WMI", "CREATE_FILTER", "__EventFilter", "CRITICAL",
         source_process=source_process,
         detail="WMI Event Filter + CommandLineEventConsumer for persistence",
         technique_id="T1546.003")


def emit_windows_service(source_process: str, service_name: str,
                         bin_path: str) -> None:
    """T1543.003 — Windows Service persistence."""
    set_phase("service_persistence")
    emit("PROCESS", "CREATE_SERVICE", "sc.exe", "CRITICAL",
         source_process=source_process,
         command=f"sc create {service_name} binPath= {bin_path} start= auto",
         detail=f"Windows service '{service_name}' for persistence",
         technique_id="T1543.003")


def emit_com_hijack(source_process: str, com_description: str) -> None:
    """T1574.002 — COM hijack via CLSID InprocServer32 / TreatAs."""
    set_phase("com_hijack")
    emit("REGISTRY", "SET_VALUE", "CLSID", "CRITICAL",
         source_process=source_process,
         detail=f"COM hijack via CLSID '{com_description}' for persistence",
         technique_id="T1574.002")
