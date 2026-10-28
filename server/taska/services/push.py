"""Pushes to phones: a Home Screen Taska subscribes with its browser's push service; when something new needs you,
Taska sends that service an empty push signed with its own key (VAPID), and the phone asks Taska what it is, so the
push service never sees it. Kept in <root>/.push/ (vapid.json, subs.json)."""

from __future__ import annotations

import json
import os
import threading
import time
import urllib.error
import urllib.request
from typing import Any, Callable, Dict, List, Optional, Set, Tuple
from urllib.parse import urlsplit

from ..domain.vocab import Refused
from ..infra import p256

Need = Tuple[str, str, str]  # project, code, kind


class Push:
    QUIET = (22, 8)  # local hours with no push, for a subscription that keeps quiet hours

    def __init__(self, root: str):
        self._dir = os.path.join(root, ".push")
        self._lock = threading.Lock()
        os.makedirs(self._dir, exist_ok=True)
        key = os.path.join(self._dir, "vapid.json")
        try:
            with open(key, encoding="utf-8") as f:
                self._d = int(json.load(f)["d"], 16)
        except (FileNotFoundError, ValueError, KeyError):
            self._d = p256.new_private_key()
            with open(key, "w", encoding="utf-8") as f:
                json.dump({"d": format(self._d, "x")}, f)
            os.chmod(key, 0o600)
        self.public = p256.b64u(p256.public_key(self._d))
        try:
            with open(os.path.join(self._dir, "subs.json"), encoding="utf-8") as f:
                self.subs: List[Dict[str, Any]] = [x for x in json.load(f) if isinstance(x, dict)
                                                   and x.get("endpoint", "").startswith("https://")]
        except (FileNotFoundError, ValueError):
            self.subs = []
        self._seen: Optional[Set[Need]] = None  # what needed you at the last look: only what is new is pushed

    def _save(self) -> None:
        with open(os.path.join(self._dir, "subs.json"), "w", encoding="utf-8") as f:
            json.dump(self.subs, f)

    def subscribe(self, sub: Any, quiet: bool = True) -> None:
        ep = str((sub or {}).get("endpoint", ""))
        if not ep.startswith("https://"):
            raise Refused("a push subscription needs an https endpoint")
        with self._lock:
            self.subs = [x for x in self.subs if x["endpoint"] != ep] + [{"endpoint": ep, "quiet": bool(quiet), "t": int(time.time())}]
            self._save()

    def unsubscribe(self, ep: str) -> None:
        with self._lock:
            self.subs = [x for x in self.subs if x["endpoint"] != ep]
            self._save()

    def has(self, ep: str) -> bool:
        with self._lock:
            return any(x["endpoint"] == ep for x in self.subs)

    def _token(self, endpoint: str) -> str:
        """The VAPID header for a push service: who sends (this Taska), for 12 hours."""
        u = urlsplit(endpoint)
        claims = {"aud": f"{u.scheme}://{u.netloc}", "exp": int(time.time()) + 12 * 3600, "sub": "mailto:taska@example.invalid"}
        head = p256.b64u(json.dumps({"typ": "JWT", "alg": "ES256"}).encode()) + "." + p256.b64u(json.dumps(claims).encode())
        return f"vapid t={head}.{p256.b64u(p256.sign(self._d, head.encode()))}, k={self.public}"

    def _send(self, sub: Dict[str, Any]) -> bool:
        """An empty push to one phone. False when the push service says the subscription is gone."""
        req = urllib.request.Request(sub["endpoint"], data=b"", method="POST", headers={
            "Authorization": self._token(sub["endpoint"]), "TTL": "3600", "Urgency": "high", "Content-Length": "0"})
        try:
            with urllib.request.urlopen(req, timeout=15):
                return True
        except urllib.error.HTTPError as ex:
            return ex.code not in (404, 410)
        except OSError:
            return True  # the network: try again with the next news

    def forget(self) -> None:
        """No phone asks: the next look starts afresh."""
        self._seen = None

    def check(self, needs: Callable[[], List[Dict[str, Any]]]) -> int:
        """What needs you now: what is new since the last look goes as one push to every phone not in quiet hours."""
        now = {(x["project"], x["code"], x["kind"]) for x in needs()}
        new, self._seen = (now - self._seen if self._seen is not None else set()), now
        if not new:
            return 0
        hour = time.localtime().tm_hour
        quiet = hour >= self.QUIET[0] or hour < self.QUIET[1]
        with self._lock:
            subs = [x for x in self.subs if not (x.get("quiet", True) and quiet)]
        gone = [x["endpoint"] for x in subs if not self._send(x)]
        for ep in gone:
            self.unsubscribe(ep)
        return len(subs) - len(gone)
