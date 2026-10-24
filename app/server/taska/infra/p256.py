"""ES256 (ECDSA on P-256 with SHA-256) in plain Python: enough to sign the token a push service asks for."""

from __future__ import annotations

import base64
import hashlib
import secrets
from typing import Optional, Tuple

Point = Optional[Tuple[int, int]]
P = 2 ** 256 - 2 ** 224 + 2 ** 192 + 2 ** 96 - 1
N = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551
G = (0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296,
     0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5)


def add(a: Point, b: Point) -> Point:
    if a is None:
        return b
    if b is None:
        return a
    if a[0] == b[0] and (a[1] + b[1]) % P == 0:
        return None
    if a == b:
        m = (3 * a[0] * a[0] - 3) * pow(2 * a[1], -1, P) % P  # the curve's a is -3
    else:
        m = (b[1] - a[1]) * pow(b[0] - a[0], -1, P) % P
    x = (m * m - a[0] - b[0]) % P
    return x, (m * (a[0] - x) - a[1]) % P


def multiply(k: int, pt: Point = G) -> Point:
    out: Point = None
    while k:
        if k & 1:
            out = add(out, pt)
        pt, k = add(pt, pt), k >> 1
    return out


def new_private_key() -> int:
    return secrets.randbelow(N - 1) + 1


def public_key(d: int) -> bytes:
    """The uncompressed public point (65 bytes)."""
    pt = multiply(d)
    assert pt is not None
    return b"\x04" + pt[0].to_bytes(32, "big") + pt[1].to_bytes(32, "big")


def sign(d: int, msg: bytes) -> bytes:
    """r and s, 32 bytes each (the JWS form)."""
    z = int.from_bytes(hashlib.sha256(msg).digest(), "big")
    while True:
        k = new_private_key()
        pt = multiply(k)
        assert pt is not None
        r = pt[0] % N
        s = pow(k, -1, N) * (z + r * d) % N
        if r and s:
            return r.to_bytes(32, "big") + s.to_bytes(32, "big")


def b64u(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()
