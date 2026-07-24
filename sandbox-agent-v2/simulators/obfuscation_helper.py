"""Data obfuscation primitives for simulator realism (Phase 7).

Provides reversible encoding/encryption primitives and telemetry emitters:
  - XOR encoding (T1027 — Obfuscated Files or Information)
  - Base64 encoding (T1027.013 — Encrypted/Encoded File)
  - RC4-like stream cipher (T1573.002 — Protocol Impersonation)
  - Crypto API telemetry

All encoding is provably reversible — no data is permanently modified.
"""

from __future__ import annotations

import base64 as _base64
import random
from typing import Optional

from telemetry_helper import emit, set_phase


def xor_bytes(data: bytes, key: bytes) -> bytes:
    """XOR a byte sequence with a repeating key. Reversible with same key."""
    return bytes(k ^ key[i % len(key)] for i, k in enumerate(data))


def base64_encode(data: bytes) -> str:
    """Standard base64 encoding. Inverse: base64.b64decode()."""
    return _base64.b64encode(data).decode("ascii")


def rc4_stream(data: bytes, key: bytes) -> bytes:
    """RC4-like stream cipher. Same function encrypts and decrypts."""
    s = list(range(256))
    j = 0
    for i in range(256):
        j = (j + s[i] + key[i % len(key)]) & 0xFF
        s[i], s[j] = s[j], s[i]
    i = j = 0
    out = bytearray()
    for byte in data:
        i = (i + 1) & 0xFF
        j = (j + s[i]) & 0xFF
        s[i], s[j] = s[j], s[i]
        out.append(byte ^ s[(s[i] + s[j]) & 0xFF])
    return bytes(out)


def emit_crypto_operation(
    process_name: str,
    operation: str,
    algorithm: str,
    data_size: int,
    technique_id: str = "T1027",
    detail: Optional[str] = None,
) -> None:
    """Emit telemetry for a cryptographic/encoding operation."""
    set_phase("data_obfuscation")
    emit("PROCESS", "CRYPTO_OPERATION", process_name, "WARNING",
         source_process=process_name,
         algorithm=algorithm,
         operation=operation,
         data_size=data_size,
         detail=detail or f"{algorithm} {operation} on {data_size} bytes",
         technique_id=technique_id)


def emit_encoded_file_write(
    process_name: str,
    file_path: str,
    original_size: int,
    encoded_size: int,
    algorithm: str = "XOR",
    technique_id: str = "T1027",
) -> None:
    """Emit telemetry for writing an encoded file to disk."""
    set_phase("data_obfuscation")
    emit("FILE", "WRITE_ENCODED", file_path, "WARNING",
         source_process=process_name,
         algorithm=algorithm,
         original_size=original_size,
         encoded_size=encoded_size,
         detail=f"Encoded {original_size} bytes -> {encoded_size} bytes via {algorithm}",
         technique_id=technique_id)
