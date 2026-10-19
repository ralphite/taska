"""Push to a phone (F195): an empty push, signed with Taska's own key; the phone then asks Taska what needs you."""

from __future__ import annotations

import base64
import hashlib
import json
import os
import secrets
import threading
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlsplit

from .core import Err

Point = Optional[Tuple[int, int]]



# Push to a phone (F195). A Home Screen Taska subscribes with the browser's push service; Taska tells that service
# "something needs you" with an empty push, signed with its own key (VAPID, RFC 8292: an ES256 token). The phone then
# asks Taska itself what needs you, so the push service never sees what it is. Only the standard library: P-256 ECDSA
# is a few lines of arithmetic.
P256_P = 2 ** 256 - 2 ** 224 + 2 ** 192 + 2 ** 96 - 1
P256_N = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551
P256_G = (0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296,
          0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5)


def p256_add(a: Point, b: Point) -> Point:
    if a is None:
        return b
    if b is None:
        return a
    if a[0] == b[0] and (a[1] + b[1]) % P256_P == 0:
        return None
    if a == b:
        m = (3 * a[0] * a[0] - 3) * pow(2 * a[1], -1, P256_P) % P256_P  # the curve's a is -3
    else:
        m = (b[1] - a[1]) * pow(b[0] - a[0], -1, P256_P) % P256_P
    x = (m * m - a[0] - b[0]) % P256_P
    return x, (m * (a[0] - x) - a[1]) % P256_P


def p256_mul(k: int, pt: Point = P256_G) -> Point:
    out = None
    while k:
        if k & 1:
            out = p256_add(out, pt)
        pt, k = p256_add(pt, pt), k >> 1
    return out


def b64u(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def es256(d: int, msg: bytes) -> bytes:
    """An ES256 signature of msg with private key d: r and s, 32 bytes each (JWS form)."""
    z = int.from_bytes(hashlib.sha256(msg).digest(), "big")
    while True:
        k = secrets.randbelow(P256_N - 1) + 1
        pt = p256_mul(k)
        assert pt is not None
        r = pt[0] % P256_N
        sig = pow(k, -1, P256_N) * (z + r * d) % P256_N
        if r and sig:
            return r.to_bytes(32, "big") + sig.to_bytes(32, "big")


class Push:
    """The phones that asked for pushes, Taska's push key, and the pushes themselves, for every project (F195)."""
    QUIET = (22, 8)  # local hours with no push, for a subscription that keeps quiet hours

    def __init__(self, root: str):
        self.dir = os.path.join(root, ".push")
        self.lock = threading.Lock()
        os.makedirs(self.dir, exist_ok=True)
        try:
            with open(os.path.join(self.dir, "vapid.json"), encoding="utf-8") as f:
                self.d = int(json.load(f)["d"], 16)
        except (FileNotFoundError, ValueError, KeyError):
            self.d = secrets.randbelow(P256_N - 1) + 1
            with open(os.path.join(self.dir, "vapid.json"), "w", encoding="utf-8") as f:
                json.dump({"d": format(self.d, "x")}, f)
            os.chmod(os.path.join(self.dir, "vapid.json"), 0o600)
        pub = p256_mul(self.d)
        assert pub is not None
        x, y = pub
        self.public = b64u(b"\x04" + x.to_bytes(32, "big") + y.to_bytes(32, "big"))
        try:
            with open(os.path.join(self.dir, "subs.json"), encoding="utf-8") as f:
                self.subs = [x for x in json.load(f) if isinstance(x, dict) and x.get("endpoint", "").startswith("https://")]
        except (FileNotFoundError, ValueError):
            self.subs = []
        self.seen = None  # what needed you at the last look: only what is new is pushed

    def save(self) -> None:
        with open(os.path.join(self.dir, "subs.json"), "w", encoding="utf-8") as f:
            json.dump(self.subs, f)

    def subscribe(self, sub: Any, quiet: bool = True) -> None:
        ep = str((sub or {}).get("endpoint", ""))
        if not ep.startswith("https://"):
            raise Err("a push subscription needs an https endpoint")
        with self.lock:
            self.subs = [x for x in self.subs if x["endpoint"] != ep] + [{"endpoint": ep, "quiet": bool(quiet), "t": int(time.time())}]
            self.save()

    def unsubscribe(self, ep: str) -> None:
        with self.lock:
            self.subs = [x for x in self.subs if x["endpoint"] != ep]
            self.save()

    def has(self, ep: str) -> bool:
        with self.lock:
            return any(x["endpoint"] == ep for x in self.subs)

    def token(self, endpoint: str) -> str:
        """The VAPID header for a push service: who sends (this Taska), for 12 hours."""
        u = urlsplit(endpoint)
        claims = {"aud": f"{u.scheme}://{u.netloc}", "exp": int(time.time()) + 12 * 3600, "sub": "mailto:taska@example.invalid"}
        head = b64u(json.dumps({"typ": "JWT", "alg": "ES256"}).encode()) + "." + b64u(json.dumps(claims).encode())
        return f"vapid t={head}.{b64u(es256(self.d, head.encode()))}, k={self.public}"

    def send(self, sub: Dict[str, Any]) -> bool:
        """An empty push to one phone. False when the push service says the subscription is gone."""
        req = urllib.request.Request(sub["endpoint"], data=b"", method="POST",
                                     headers={"Authorization": self.token(sub["endpoint"]), "TTL": "3600", "Urgency": "high", "Content-Length": "0"})
        try:
            with urllib.request.urlopen(req, timeout=15):
                return True
        except urllib.error.HTTPError as ex:
            return ex.code not in (404, 410)
        except OSError:
            return True  # the network: try again with the next news

    def check(self, needs: List[Dict[str, Any]]) -> int:
        """needs: what needs you now (Hub.needs). New since the last look: one push to every phone not in quiet hours."""
        now = {(x["project"], x["code"], x["kind"]) for x in needs}
        new, self.seen = (now - self.seen if self.seen is not None else set()), now
        if not new:
            return 0
        hour = time.localtime().tm_hour
        quiet = hour >= self.QUIET[0] or hour < self.QUIET[1]
        with self.lock:
            subs = [x for x in self.subs if not (x.get("quiet", True) and quiet)]
        gone = [x["endpoint"] for x in subs if not self.send(x)]
        for ep in gone:
            self.unsubscribe(ep)
        return len(subs) - len(gone)
