"""Pushes to phones: a Home Screen Taska subscribes with its browser's push service; when something new needs you,
Taska sends that service an empty push signed with its own key (VAPID), and the phone asks Taska what it is, so the
push service never sees it. Kept in <root>/.push/ (vapid.json, subs.json, and seen.json: what needed you at the last
look, so a restart pushes what became new meanwhile, not all of it again).

Every push is logged with how it went (T806 #3). A push the service did not take is owed to that phone and sent again
at the next look; one whose subscription is gone drops it."""

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
from ..infra.logs import log

Need = Tuple[str, str, str]  # project, code, kind


def minutes(hhmm: Any, default: int) -> int:
    """A time of day "HH:MM" as minutes after midnight; anything else: the default."""
    try:
        h, m = (int(x) for x in str(hhmm).split(":"))
    except ValueError:
        return default
    return h * 60 + m if 0 <= h < 24 and 0 <= m < 60 else default


def in_quiet(sub: Dict[str, Any], now: int) -> bool:
    """Whether a subscription keeps quiet at `now` (minutes after local midnight): its own hours (D115 #43), 22:00 to
    08:00 when it has none; a span may run over midnight; from equal to to keeps none."""
    if not sub.get("quiet", True):
        return False
    start, end = sub.get("from", Push.QUIET[0] * 60), sub.get("to", Push.QUIET[1] * 60)
    return start <= now < end if start <= end else now >= start or now < end


class Push:
    QUIET = (22, 8)  # local hours with no push, for a subscription that keeps quiet hours and has none of its own

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
        self._seen: Optional[Set[Need]] = self._load_seen()  # what needed you at the last look: only what is new is pushed
        self._owed: Dict[str, Set[Need]] = {}  # per phone: what was not taken yet, sent again at the next look

    def _load_seen(self) -> Optional[Set[Need]]:
        """What needed you at the last look before a restart; none when that was over an hour ago (start afresh)."""
        path = os.path.join(self._dir, "seen.json")
        try:
            if time.time() - os.path.getmtime(path) > 3600:
                return None
            with open(path, encoding="utf-8") as f:
                return {tuple(x) for x in json.load(f) if isinstance(x, list) and len(x) == 3}  # type: ignore[misc]
        except (OSError, ValueError, TypeError):
            return None

    def _save_seen(self) -> None:
        try:
            with open(os.path.join(self._dir, "seen.json.tmp"), "w", encoding="utf-8") as f:
                json.dump(sorted(self._seen or ()), f)
            os.replace(os.path.join(self._dir, "seen.json.tmp"), os.path.join(self._dir, "seen.json"))
        except OSError:
            pass

    def _save(self) -> None:
        with open(os.path.join(self._dir, "subs.json"), "w", encoding="utf-8") as f:
            json.dump(self.subs, f)

    def subscribe(self, sub: Any, quiet: bool = True, start: Any = None, end: Any = None) -> None:
        """A phone's subscription, with its quiet hours: on or off, and from when to when ("HH:MM", local time)."""
        ep = str((sub or {}).get("endpoint", ""))
        if not ep.startswith("https://"):
            raise Refused("a push subscription needs an https endpoint")
        span = {"from": minutes(start, self.QUIET[0] * 60), "to": minutes(end, self.QUIET[1] * 60)}
        with self._lock:
            self.subs = [x for x in self.subs if x["endpoint"] != ep] + [{"endpoint": ep, "quiet": bool(quiet), **span, "t": int(time.time())}]
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

    def _send(self, sub: Dict[str, Any]) -> str:
        """An empty push to one phone: "ok", "gone" (the push service says the subscription is gone), or why it failed
        (sent again at the next look)."""
        req = urllib.request.Request(sub["endpoint"], data=b"", method="POST", headers={
            "Authorization": self._token(sub["endpoint"]), "TTL": "3600", "Urgency": "high", "Content-Length": "0"})
        try:
            with urllib.request.urlopen(req, timeout=15):
                return "ok"
        except urllib.error.HTTPError as ex:
            return "gone" if ex.code in (404, 410) else f"HTTP {ex.code}"
        except OSError as ex:
            return f"unreachable: {ex}"[:200]

    def forget(self) -> None:
        """No phone asks: the next look starts afresh."""
        if self._seen is not None:
            self._seen = None
            try:
                os.remove(os.path.join(self._dir, "seen.json"))
            except OSError:
                pass

    def check(self, needs: Callable[[], List[Dict[str, Any]]]) -> int:
        """What needs you now: what is new since the last look goes as one push to every phone not in quiet hours,
        with what an earlier push could not deliver to it. -> how many phones took one."""
        now = {(x["project"], x["code"], x["kind"]) for x in needs()}
        new = now - self._seen if self._seen is not None else set()
        if now != self._seen:
            self._seen = now
            self._save_seen()
        t = time.localtime()
        now_min = t.tm_hour * 60 + t.tm_min
        with self._lock:
            subs = [x for x in self.subs if not in_quiet(x, now_min)]
            eps = {x["endpoint"] for x in self.subs}
        self._owed = {ep: (owed & now) for ep, owed in self._owed.items() if ep in eps and owed & now}
        took = 0
        for sub in subs:
            ep = sub["endpoint"]
            due = self._owed.get(ep, set()) | new
            if not due:
                continue
            how = self._send(sub)
            log.log(20 if how == "ok" else 30, f"push {how}", extra={"f": {
                "source": "server", "kind": "push", "status": how, "host": urlsplit(ep).netloc,
                "what": [f"{p} {c} {k}" for p, c, k in sorted(due)][:10]}})
            if how == "ok":
                took += 1
                self._owed.pop(ep, None)
            elif how == "gone":
                self._owed.pop(ep, None)
                self.unsubscribe(ep)
            else:
                self._owed[ep] = due
        return took
