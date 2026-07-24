"""C2 / network beaconing utilities for realistic traffic patterns.

Provides jittered heartbeats, domain fronting simulation, DNS-over-HTTPS
mimicry, and exponential-backoff sleep.

MITRE ATT&CK: T1071.001, T1071.004, T1090, T1573, T1008
"""

from __future__ import annotations

import json
import random
import socket
import time
from typing import Any, Optional

from telemetry_helper import emit, set_phase

# Sinkhole C2 infrastructure (all non-routable / safe)
C2_IPS = [
    "10.13.37.1", "10.13.37.2", "10.13.37.3", "10.13.37.4",
    "10.13.37.50", "10.13.37.51",
    "10.13.37.60", "10.13.37.61",
    "10.13.37.70",
]

C2_PORTS = [443, 8443, 4444, 8080]

# Front domains for Host-header manipulation
FRONT_DOMAINS = [
    "www.google-analytics.com",
    "cdn.example-cdn.com",
    "static.akamaized.net",
    "api.cloudflare.com",
]

# Simulated DoH resolver address
DOH_RESOLVER = ("10.13.37.254", 443)


def jittered_sleep(base_sec: float, jitter_sec: float = 0.3) -> None:
    """Sleep base_sec ± jitter_sec — malformed triangular distribution."""
    actual = base_sec + random.uniform(-jitter_sec, jitter_sec)
    time.sleep(max(0.001, actual))


def backoff_sleep(attempt: int, base: float = 1.0, cap: float = 60.0) -> None:
    """Exponential backoff with full jitter: U(0, min(cap, base * 2^attempt))."""
    max_delay = min(cap, base * (2 ** attempt))
    time.sleep(random.uniform(0, max_delay))


def tcp_beacon(ip: str, port: int, payload: Optional[dict] = None,
               timeout: float = 2.0) -> bool:
    """Open TCP connection, send optional JSON payload, close."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        s.connect((ip, port))
        if payload is not None:
            s.send(json.dumps(payload).encode() + b"\n")
        s.close()
        return True
    except (ConnectionRefusedError, OSError, socket.timeout):
        return False


def fronted_beacon(ip: str, port: int, front_domain: str,
                   payload: Optional[dict] = None,
                   timeout: float = 2.0) -> bool:
    """Beacon with domain-fronting Host header (simulated CDN fronting).

    Connects to ip:port but sets the HTTP Host header to front_domain,
    mimicking traffic that hides behind a legitimate CDN.
    """
    body = json.dumps(payload) if payload else "{}"
    request = (
        f"POST /collect HTTP/1.1\r\n"
        f"Host: {front_domain}\r\n"
        f"Content-Type: application/json\r\n"
        f"Content-Length: {len(body)}\r\n"
        f"X-Request-ID: {random.randint(100000, 999999)}\r\n"
        f"Connection: keep-alive\r\n"
        f"\r\n"
        f"{body}"
    ).encode()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        s.connect((ip, port))
        s.send(request)
        s.close()
        return True
    except (ConnectionRefusedError, OSError, socket.timeout):
        return False


def emit_doh_query(domain: str, process_name: str = "svchost.exe") -> None:
    """Emit simulated DNS-over-HTTPS telemetry for domain.

    Sends a TCP connection to the DoH resolver sinkhole port with an
    HTTP POST mimicking RFC 8484 DNS wireformat upload, then emits
    DoH-specific telemetry.
    """
    set_phase("dns_over_https")
    emit("NETWORK", "DNS_OVER_HTTPS", domain, "WARNING",
         source_process=process_name,
         protocol="HTTPS", method="POST",
         resolver_ip=DOH_RESOLVER[0], resolver_port=DOH_RESOLVER[1],
         content_type="application/dns-message",
         detail=f"DoH resolution: {domain} via {DOH_RESOLVER[0]}",
         technique_id="T1071.004")
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(2)
        s.connect(DOH_RESOLVER)
        dns_payload = bytes([0x00, 0x01]) + domain.encode()[:240]
        http_body = (
            f"POST /dns-query HTTP/1.1\r\n"
            f"Host: dns.google\r\n"
            f"Content-Type: application/dns-message\r\n"
            f"Content-Length: {len(dns_payload)}\r\n"
            f"\r\n"
        ).encode() + dns_payload
        s.send(http_body)
        s.close()
    except (ConnectionRefusedError, OSError, socket.timeout):
        pass


def emit_heartbeats(ip: str, port: int, count: int = 3,
                    process_name: str = "svchost.exe",
                    bot_id: Optional[str] = None,
                    min_interval: float = 3.0,
                    max_interval: float = 30.0) -> None:
    """Send count staggered heartbeats with random intervals.

    Each heartbeat carries a unique session ID. Intervals vary
    randomly between min_interval and max_interval to avoid
    fixed-period detection.
    """
    set_phase("c2_heartbeat")
    session_id = f"SES-{random.randint(100000, 999999)}"
    for i in range(count):
        interval = random.uniform(min_interval, max_interval)
        emit("NETWORK", "C2_HEARTBEAT", f"{ip}:{port}", "CRITICAL",
             source_process=process_name,
             protocol="TCP", direction="outbound",
             heartbeat_seq=i + 1, heartbeat_count=count,
             session_id=session_id,
             next_interval_sec=round(interval, 1),
             detail=f"C2 heartbeat {i + 1}/{count} (next in {interval:.1f}s)",
             technique_id="T1071.001")
        ok = tcp_beacon(ip, port,
                        {"type": "heartbeat", "seq": i + 1,
                         "session": session_id, "bot_id": bot_id})
        if not ok:
            backoff_sleep(i, base=1.0, cap=10.0)
        else:
            jittered_sleep(interval, interval * 0.2)
