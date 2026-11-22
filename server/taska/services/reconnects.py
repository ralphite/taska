"""Agent sessions to bring back to Taska after they lost their connection (T833, Yadong r1433 r1435).

A Claude Code session waits for work with a long /next of its own; when the machine restarts that wait is gone and
nothing outside its app can make it speak (its links only fill the box; Taska cannot send into a session). Another
Claude session can: Taska hands one session that is connected now a narrow job, before any other work: send the lost
one a message telling it to reconnect, then go back to what it was doing. With none connected, Yadong starts one new
session with an instruction to bring back every lost one, after which it is done. Antigravity is the same with its own
message command; Codex needs none of this (Taska wakes it through its own queue).

The asks are kept for the workspace (a session in one project may bring back one in another), in memory only: a
session asked for that comes back, by any call to Taska, is no longer asked for. Thread-safe on its own lock; callers
hold no project lock when they wake the projects.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import TYPE_CHECKING, Callable, Dict, List, Optional, Set, Tuple

from ..infra.agent_sessions import SID
from ..infra.project_db import ProjectDb

if TYPE_CHECKING:
    from .agents import AgentActivity

APPS = ("claude-code", "antigravity")  # the apps whose sessions are brought back by another session
HANDED_FOR = 120  # seconds a relay has to send it before another connected session is asked


@dataclass
class Ask:
    sid: str
    app: str
    slug: str  # the project it worked for
    name: str  # its title
    t: float
    relay: str = ""  # the session asked to send it, and when
    relayed_at: float = 0.0


class Reconnects:
    def __init__(self, clock=time.time):
        self._lock = threading.Lock()
        self._clock = clock
        self.asks: Dict[str, Ask] = {}

    def add(self, sid: str, app: str, slug: str, name: str) -> None:
        """Bring back session `sid` (asked again: it is handed out again at once)."""
        if app not in APPS:
            return
        with self._lock:
            self.asks[sid] = Ask(sid=sid, app=app, slug=slug, name=name, t=self._clock())

    def heard(self, sid: str) -> bool:
        """Session `sid` called Taska: it is back. Whether it had been asked for."""
        with self._lock:
            return self.asks.pop(sid, None) is not None

    def pending(self, app: Optional[str] = None) -> List[Ask]:
        with self._lock:
            return sorted((a for a in self.asks.values() if app is None or a.app == app), key=lambda a: a.t)

    def asked(self, sid: str) -> bool:
        with self._lock:
            return sid in self.asks

    def waiting_for(self, app: str, relay: str) -> bool:
        """Whether an ask session `relay` could be handed now waits (nothing is handed)."""
        now = self._clock()
        with self._lock:
            return any(a.app == app and a.sid != relay and not (a.relay and now - a.relayed_at < HANDED_FOR) for a in self.asks.values())

    def for_relay(self, app: str, relay: str) -> Optional[Ask]:
        """The oldest ask a connected session `relay` of `app` is to send now (not itself; not one another session
        was handed in the last two minutes), handed to it."""
        now = self._clock()
        with self._lock:
            for a in sorted(self.asks.values(), key=lambda a: a.t):
                if a.app != app or a.sid == relay:
                    continue
                if a.relay and a.relay != relay and now - a.relayed_at < HANDED_FOR:
                    continue
                if a.relay == relay and now - a.relayed_at < HANDED_FOR:
                    continue  # it has it already: not again while it sends it
                a.relay, a.relayed_at = relay, now
                return a
        return None


class LostSessions:
    """A project's sessions that waited for work when its process last saved, kept over a restart: one not heard of
    since this process started, three minutes on, lost its connection (the machine restarted). Callers hold the
    project lock."""

    def __init__(self, db: ProjectDb, gone: Callable[[], bool]):
        self._db = db
        self._gone = gone
        self.started = time.time()
        self.heard: Set[str] = set()  # the sessions that called since this process started
        self.called: Dict[str, float] = {}  # per session id: its last call to the project
        self.was: Dict[str, float] = {}
        saved = db.get("listening")
        if isinstance(saved, dict) and isinstance(saved.get("sids"), dict):
            at = float(saved.get("at") or 0)
            for k, v in saved["sids"].items():
                if isinstance(v, dict) and SID.fullmatch(str(k)) and (int(v.get("n") or 0) > 0 or at - float(v.get("t") or 0) <= 120):
                    self.was[str(k)] = float(v.get("t") or 0)

    def heard_from(self, sid: str, now: float) -> None:
        self.heard.add(sid)
        self.called[sid] = now

    def save(self, listening: Dict[str, int], listened: Dict[str, float]) -> None:
        """Who waits for work now (and who did a moment ago), and the lost sessions not back yet (for three days)."""
        if self._gone():
            return
        now = time.time()
        rows = {sid: {"n": n, "t": listened.get(sid, now)} for sid, n in listening.items() if n > 0 or now - listened.get(sid, 0) <= 120}
        for sid, t in self.was.items():
            if sid not in self.heard and sid not in rows and now - t <= 3 * 86400:
                rows[sid] = {"n": 1, "t": t}
        self._db.put("listening", {"at": now, "sids": rows})

    def lost(self, now: Optional[float] = None) -> Set[str]:
        """The sessions that waited for work before this process started and have not called since (three minutes
        after the start: a session only cut off by Taska's own restart is back by then)."""
        now = time.time() if now is None else now
        if now - self.started < 180:
            return set()
        return {sid for sid, t in self.was.items() if sid not in self.heard and now - t <= 3 * 86400}


def session_of(ag: "AgentActivity", sid: str) -> Optional[Tuple[str, str]]:
    """The app and the title of the project's session its app knows by `sid` (None: not one of the project's)."""
    for k, a in ag.agents.items():
        for name, x in a.sids.items():
            if x == sid:
                return k, name or (ag.found[sid].name if sid in ag.found else "")
    return None


def connected(ag: "AgentActivity", app: str, now: Optional[float] = None) -> List[str]:
    """The project's sessions of `app` connected now, waiting for work or at work (a call in the last two minutes):
    one may bring back a lost one (told on its /next, or on its next /do)."""
    now = time.time() if now is None else now
    return [sid for k, a in ag.agents.items() if k == app for sid in set(a.sids.values())
            if ag.listening.get(sid, 0) > 0 or now - ag.lostness.called.get(sid, 0) <= 120]
