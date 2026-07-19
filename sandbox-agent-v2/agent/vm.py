"""VM Manager — production-grade VBoxManage orchestration.

Handles:
  - Aggressive process cleanup (kills orphaned VBox processes)
  - Snapshot restoration with lock detection and retry
  - VM boot with abort detection and automatic firmware fix
  - Guest Additions heartbeat polling
  - File transfer and guest command execution
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path

log = logging.getLogger("agent.vm")

# Config — overridable via environment for non-default deployments
VM_NAME = os.environ.get("SANDBOX_VM_NAME", "ForensicsSandbox")
SNAPSHOT = os.environ.get("SANDBOX_VM_SNAPSHOT", "CleanBaselinePython")
GUEST_USER = os.environ.get("SANDBOX_GUEST_USER", "guestuser")
GUEST_PASS = os.environ.get("SANDBOX_GUEST_PASS", "guest")
GUEST_BASE = r"C:\sandbox"
GUEST_SIMULATORS = r"C:\sandbox\simulators"
GUEST_MARKER = r"C:\sandbox\guest.marker"

_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)


class VMError(Exception):
    pass


@dataclass(frozen=True)
class ExecResult:
    code: int
    stdout: str
    stderr: str

    @property
    def ok(self) -> bool:
        return self.code == 0


class VMManager:
    """Production VBoxManage wrapper with aggressive error recovery."""

    def __init__(self) -> None:
        self._vbox = self._find_vboxmanage()
        self._vm = VM_NAME
        log.info("VMManager initialized: vbox=%s, vm=%s", self._vbox, self._vm)

    # =========================================================================
    # DISCOVERY
    # =========================================================================

    @staticmethod
    def _find_vboxmanage() -> str:
        path = shutil.which("VBoxManage")
        if path:
            return path
        for root in (os.environ.get("ProgramFiles", ""), os.environ.get("ProgramFiles(x86)", "")):
            p = Path(root) / "Oracle" / "VirtualBox" / "VBoxManage.exe"
            if p.exists():
                return str(p)
        raise VMError("VBoxManage not found — install VirtualBox")

    # =========================================================================
    # LOW-LEVEL EXECUTION WITH RETRY
    # =========================================================================

    def _run(self, args: list[str], timeout: float = 30, retries: int = 3) -> ExecResult:
        """Execute VBoxManage with retry on transient errors."""
        cmd = [self._vbox] + args

        for attempt in range(1, retries + 1):
            try:
                proc = subprocess.run(
                    cmd, capture_output=True, text=True,
                    timeout=timeout, creationflags=_NO_WINDOW,
                )
                r = ExecResult(proc.returncode, proc.stdout, proc.stderr)

                if r.ok:
                    return r

                if self._is_transient(r.stderr) and attempt < retries:
                    log.warning("Transient error (attempt %d/%d): %s", attempt, retries, r.stderr[:150])
                    time.sleep(2)
                    continue

                raise VMError(f"VBoxManage [{' '.join(args[:3])}] exit={r.code}: {r.stderr[:300]}")

            except subprocess.TimeoutExpired:
                if attempt < retries:
                    log.warning("Timeout (attempt %d/%d): %s", attempt, retries, " ".join(args[:3]))
                    time.sleep(2)
                    continue
                raise VMError(f"VBoxManage timed out after {timeout}s: {' '.join(args[:3])}")

        raise VMError("Retry exhausted")

    @staticmethod
    def _is_transient(stderr: str) -> bool:
        markers = ("E_ACCESSDENIED", "not ready", "locked by a session",
                   "lock request pending", "is not running")
        s = stderr.lower()
        return any(m.lower() in s for m in markers)

    # =========================================================================
    # PROCESS CLEANUP
    # =========================================================================

    def kill_all_vbox_processes(self) -> None:
        """Aggressively kill all VirtualBox VM processes."""
        import sys as _sys
        if _sys.platform == "win32":
            for img in ("VBoxHeadless.exe", "VirtualBoxVM.exe"):
                try:
                    subprocess.run(
                        ["taskkill", "/f", "/im", img],
                        capture_output=True, timeout=10, creationflags=_NO_WINDOW,
                    )
                except Exception:
                    pass
        else:
            for img in ("VBoxHeadless", "VirtualBoxVM"):
                try:
                    subprocess.run(
                        ["pkill", "-9", img],
                        capture_output=True, timeout=10,
                    )
                except Exception:
                    pass
        time.sleep(1)

    # =========================================================================
    # VM STATE
    # =========================================================================

    def get_state(self) -> str:
        """Get VM state: 'running', 'poweroff', 'aborted', etc."""
        try:
            r = self._run(["showvminfo", self._vm, "--machinereadable"], timeout=15)
            for line in r.stdout.splitlines():
                if line.startswith("VMState="):
                    return line.split("=", 1)[1].strip('"')
        except VMError:
            pass
        return "unknown"

    def get_info(self) -> dict[str, str]:
        """Get machine-readable VM info as dict."""
        try:
            r = self._run(["showvminfo", self._vm, "--machinereadable"], timeout=15)
            info: dict[str, str] = {}
            for line in r.stdout.splitlines():
                if "=" in line:
                    k, v = line.split("=", 1)
                    info[k.strip()] = v.strip().strip('"')
            return info
        except VMError:
            return {}

    # =========================================================================
    # REVERT PHASE — force-kill + snapshot restore
    # =========================================================================

    def revert_to_snapshot(self) -> None:
        """Force-kill VM, wait for lock release, restore snapshot."""
        log.info("REVERT: Force-killing VM and restoring snapshot")

        # Force poweroff
        state = self.get_state()
        if state not in ("poweroff", "aborted"):
            try:
                self._run(["controlvm", self._vm, "poweroff"], timeout=15, retries=1)
            except VMError:
                pass
            self.kill_all_vbox_processes()

        # Wait for session lock release (max 5s)
        for _ in range(5):
            info = self.get_info()
            if info.get("SessionState", "").lower() == "none":
                break
            time.sleep(1)

        # Restore snapshot
        self._run(["snapshot", self._vm, "restore", SNAPSHOT], timeout=120)
        log.info("REVERT: Snapshot '%s' restored", SNAPSHOT)
        time.sleep(2)

    # =========================================================================
    # BOOT PHASE — start VM with abort protection
    # =========================================================================

    def boot_vm(self, headless: bool = False) -> None:
        """Start VM. Switch paravirt-provider away from hyperv if needed (it
        conflicts with VirtualBox on hosts that have Windows Hyper-V features
        enabled and can cause the VM to abort during boot). Leave firmware
        alone — Windows 11 requires UEFI, so flipping to BIOS makes the
        snapshot's GPT-partitioned disk unbootable."""
        log.info("BOOT: Starting VM (headless=%s)", headless)

        try:
            info = self.get_info()
            paravirt = info.get("effparavirtprovider", "").lower()
            if "hyperv" in paravirt:
                log.warning("BOOT: Switching paravirt-provider hyperv → default")
                self._run(["modifyvm", self._vm, "--paravirt-provider", "default"])
        except VMError as e:
            log.debug("Paravirt fix failed (non-fatal): %s", e)

        mode = "headless" if headless else "separate"
        self._run(["startvm", self._vm, "--type", mode], timeout=60)
        log.info("BOOT: VM start command issued (mode=%s)", mode)

    # =========================================================================
    # GUEST ADDITIONS HEARTBEAT
    # =========================================================================

    def wait_for_guest(self, timeout: int = 120) -> bool:
        """Poll until Guest Additions respond. Returns True if ready."""
        log.info("HEARTBEAT: Waiting for Guest Additions (timeout=%ds)", timeout)
        start = time.time()
        # `startvm --type separate` returns immediately while the VM is still
        # transitioning poweroff → starting → running. Require N consecutive
        # poweroff/aborted reads before treating it as a real abort, so the
        # initial transition window doesn't kill the session.
        consecutive_dead = 0
        DEAD_THRESHOLD = 5  # ~10s of consecutive dead reads (2s sleep below)

        while time.time() - start < timeout:
            # Check VM hasn't aborted
            state = self.get_state()
            if state in ("aborted", "poweroff"):
                consecutive_dead += 1
                if consecutive_dead >= DEAD_THRESHOLD:
                    log.error("HEARTBEAT: VM aborted during boot (state=%s, %d consecutive)",
                              state, consecutive_dead)
                    return False
                log.debug("HEARTBEAT: state=%s (transient %d/%d)",
                          state, consecutive_dead, DEAD_THRESHOLD)
                time.sleep(2)
                continue
            consecutive_dead = 0

            # Try a guest command
            try:
                r = self._run(
                    ["guestcontrol", self._vm, "run",
                     "--username", GUEST_USER, "--password", GUEST_PASS,
                     "--exe", r"C:\Windows\System32\cmd.exe",
                     "--timeout=10000", "--", "/c", "echo", "READY"],
                    timeout=15, retries=1,
                )
                if r.ok and "READY" in r.stdout:
                    elapsed = time.time() - start
                    log.info("HEARTBEAT: Guest ready in %.1fs", elapsed)
                    return True
            except VMError:
                pass

            time.sleep(2)

        log.error("HEARTBEAT: Guest not ready after %ds", timeout)
        return False

    # =========================================================================
    # GUEST MARKER VERIFICATION (safety check)
    # =========================================================================

    def verify_guest_marker(self) -> bool:
        """Verify C:\\sandbox\\guest.marker exists — prevents host infection."""
        try:
            r = self._run(
                ["guestcontrol", self._vm, "run",
                 "--username", GUEST_USER, "--password", GUEST_PASS,
                 "--exe", r"C:\Windows\System32\cmd.exe",
                 "--timeout=10000", "--", "/c", "if", "exist", GUEST_MARKER, "echo", "MARKER_OK"],
                timeout=15, retries=2,
            )
            return "MARKER_OK" in r.stdout
        except VMError:
            return False

    # =========================================================================
    # FILE TRANSFER (STAGE phase)
    # =========================================================================

    def ensure_guest_dir(self, path: str) -> None:
        """Create directory in guest if it doesn't exist."""
        self._run(
            ["guestcontrol", self._vm, "mkdir",
             "--username", GUEST_USER, "--password", GUEST_PASS,
             "--parents", path],
            timeout=15,
        )

    def copy_to_guest(self, host_path: str, guest_path: str) -> None:
        """Copy file from host to guest."""
        self._run(
            ["guestcontrol", self._vm, "copyto",
             "--username", GUEST_USER, "--password", GUEST_PASS,
             host_path, guest_path],
            timeout=60,
        )
        log.info("STAGE: Copied %s → %s", Path(host_path).name, guest_path)

    # =========================================================================
    # GUEST EXECUTION (EXECUTE phase)
    # =========================================================================

    def guest_exec(self, exe: str, args: list[str] | None = None, timeout: int = 300, cwd: str | None = None) -> ExecResult:
        """Run a command inside the guest VM. Returns the ExecResult regardless
        of exit code so the caller can parse stdout (e.g. simulator telemetry)
        even when the guest process exits non-zero. Only raises if VBoxManage
        itself fails to launch the guest process or times out at the host level.
        Must include --wait-stdout so VBoxManage returns the captured output."""
        cmd = [
            "guestcontrol", self._vm, "run",
            "--username", GUEST_USER, "--password", GUEST_PASS,
            "--exe", exe,
            f"--timeout={timeout * 1000}",
            "--wait-stdout",
            "--wait-stderr",
        ]
        if cwd:
            cmd.append(f"--cwd={cwd}")
        if args:
            cmd.append("--")
            cmd.extend(args)

        full_cmd = [self._vbox] + cmd
        try:
            proc = subprocess.run(
                full_cmd, capture_output=True, text=True,
                timeout=timeout + 30, creationflags=_NO_WINDOW,
            )
            return ExecResult(proc.returncode, proc.stdout, proc.stderr)
        except subprocess.TimeoutExpired:
            raise VMError(f"guest_exec host-side timeout after {timeout + 30}s")
