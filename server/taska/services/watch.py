"""Work nobody takes, found and handed to someone (T869, Yadong r1470 r1473). Waking agents was left to the waits they
wrote themselves: a session changed its wait to end only on its own task and passed over a new one three times, another
was cut off by a restart, and Taska thought the work was in hand. Now:

- a Claude Code session waits for work with Taska's own script (GET /listen, run as it is): only such a wait counts
  as one that takes any work; a wait it wrote itself is noted, and its next call is told to use the script;
- every minute each project an agent worked in lately (AGENTS) is looked at: a task /next would give (now, open or
  doing, not a group, not waiting on the user or another task, no subtasks open), made or changed lately (FRESH),
  that no session is on (no hold, or held by one that neither waits with the script nor wrote on it lately) for GRACE
  seconds is stuck;
- a stuck task's project has an idle Claude session (its app says idle, not archived): Taska asks for it to be woken
  (services.reconnects): a session connected now, or the dispatcher waiting at /api/dispatch, sends it a message to
  come and take the work, through its app (the only way into a Claude session);
- nobody to wake, nobody to send it, or the woken one does not come: the user is told once, by a task in that project
  (proposed), which goes by itself once the work is taken.
Callers hold no project lock: each project's own is taken while it is looked at."""

from __future__ import annotations

import logging
import os
import threading
import time
from typing import TYPE_CHECKING, Callable, Dict, List, Optional, Set, Tuple

from ..agent_text.reconnect import dispatcher
from ..domain import rules
from ..domain.model import Task
from ..domain.state import ProjectState
from ..domain.text import seconds
from ..domain.vocab import CLAIM_TTL

if TYPE_CHECKING:
    from .project import Project
    from .workspace import Workspace

# the times, in seconds (shorter only for a drill on a test server: TASKA_WATCH_GRACE and the like)
GRACE = int(os.environ.get("TASKA_WATCH_GRACE") or 300)  # a task waits for a session before Taska looks for one
HANDED = int(os.environ.get("TASKA_WATCH_HANDED") or 180)  # an ask may wait for a session to send it, then the user is told
COME = int(os.environ.get("TASKA_WATCH_COME") or 600)  # a woken session has to call Taska, then the user is told
EVERY = float(os.environ.get("TASKA_WATCH_EVERY") or 60)  # how often the projects are looked at
FRESH = 2 * 86400  # only tasks made or changed this lately: an old open one is not one an agent just left
AGENTS = 3 * 86400  # only projects an agent worked in this lately: elsewhere the open tasks are the user's own
KEY = "nobody-on-alarm"  # in a project's db: {code of the stuck task: code of the task telling the user}


class Listeners:
    """Who waits for work with Taska's script now, and who waits with a wait of its own (per project, by session)."""

    def __init__(self, clock: Callable[[], float] = time.time) -> None:
        self._lock = threading.Lock()
        self.clock = clock
        self.held: Dict[Tuple[str, str], int] = {}  # (project, who) -> waits held now
        self.own: Dict[Tuple[str, str], float] = {}  # (project, sid or who) -> when its own kind of wait was last seen
        self.told: Set[Tuple[str, str]] = set()

    def start(self, slug: str, who: str) -> None:
        with self._lock:
            self.held[(slug, who)] = self.held.get((slug, who), 0) + 1

    def stop(self, slug: str, who: str) -> None:
        with self._lock:
            n = self.held.get((slug, who), 0) - 1
            if n > 0:
                self.held[(slug, who)] = n
            else:
                self.held.pop((slug, who), None)

    def listening(self, slug: str, who: str) -> bool:
        with self._lock:
            return self.held.get((slug, who), 0) > 0

    def any(self, slug: str) -> bool:
        with self._lock:
            return any(n > 0 for (s, _), n in self.held.items() if s == slug)

    def own_wait(self, slug: str, key: str) -> None:
        """A wait for work that is not Taska's script (it may end only on what its session chose)."""
        with self._lock:
            self.own[(slug, key)] = self.clock()
            self.told.discard((slug, key))

    def tell(self, slug: str, key: str) -> bool:
        """Whether a call of this session is to be told to wait with the script (once per wait of its own seen)."""
        with self._lock:
            if (slug, key) in self.own and (slug, key) not in self.told and self.clock() - self.own[(slug, key)] < 3600:
                self.told.add((slug, key))
                return True
            return False


def work(st: ProjectState, now: Optional[float] = None) -> List[Task]:
    """The tasks /next would give some session now (none held by anyone here), made or changed in the last FRESH."""
    out = []
    for it in st.live_tasks():
        if it.when != "now" or it.group or it.archived or it.status not in ("open", "doing"):
            continue
        if now is not None and now - seconds(it.t1) > FRESH:
            continue
        if rules.waiting(st, it) or rules.open_kids(st, it) or rules.waits_for(st, it):
            continue
        out.append(it)
    return out


def on_it(st: ProjectState, it: Task, listening: Callable[[str], bool], now: float) -> bool:
    """Whether a session is on the task: one holds it and waits with the script, or wrote on it in the hold's time."""
    c = st.claims.get(it.n)
    if c and now - c.since < CLAIM_TTL and listening(c.who):
        return True
    a = it.agent
    if a and it.status == "doing" and now - seconds(a.t) < CLAIM_TTL:
        return True
    return False


class Watch:
    def __init__(self, ws: "Workspace", listeners: Listeners, lookup: Callable[[str], Optional[object]],
                 desktop: Callable[[str], Optional[Dict[str, object]]], clock: Callable[[], float] = time.time) -> None:
        self.ws = ws
        self.listeners = listeners
        self.lookup = lookup  # a session's status in its app, by its id
        self.desktop = desktop  # the Claude app's record of a session, by its id
        self.clock = clock
        self.stuck: Dict[Tuple[str, int], float] = {}  # (project, task) -> since when nobody is on it
        self.asked: Dict[Tuple[str, int], Tuple[str, float]] = {}  # (project, task) -> the session asked for, when

    def check(self) -> List[str]:
        """One look at every project -> what was done, one line each (for the log and tests)."""
        out: List[str] = []
        for slug, p in sorted(self.ws.projects.items()):
            out.extend(self._project(slug, p))
        return out

    def _project(self, slug: str, p: "Project") -> List[str]:
        now = self.clock()
        with p.lock:
            st = p.state
            if not any(now - a.t <= AGENTS for name, a in p.agents.agents.items() if name != "agent"):
                return []  # no agent works here lately: its open tasks are the user's own
            stuck = [it for it in work(st, now) if not on_it(st, it, lambda who: self.listeners.listening(slug, who), now)]
            codes = {it.n: st.code(it.n) for it in stuck}
            sessions = self._sessions(p)
            alarm = p.store.db.get(KEY)
            alarm = dict(alarm) if isinstance(alarm, dict) else {}
        out: List[str] = []
        ns = {it.n for it in stuck}
        for (s, n) in [k for k in self.stuck if k[0] == slug and k[1] not in ns]:  # taken meanwhile
            self.stuck.pop((s, n), None)
            self.asked.pop((s, n), None)
        for code in [c for c in alarm if not any(codes.get(n) == c for n in ns)]:
            out.append(self._unsay(p, alarm, code))
        for it in stuck:
            key = (slug, it.n)
            since = self.stuck.setdefault(key, now)
            if now - since < GRACE:
                continue
            code = codes[it.n]
            asked = self.asked.get(key)
            rc = self.ws.reconnects
            if asked is None:
                idle = [sid for sid in sessions if self._idle(sid)]
                if idle:
                    sid = idle[0]
                    rc.add(sid, "claude-code", slug, sessions[sid], why="work", task=code)
                    self.asked[key] = (sid, now)
                    self.ws._wake_all()  # the sessions waiting now look again: one connected may send it
                    out.append(f"{slug} {code}: asked to wake {sessions[sid] or sid[:8]}")
                    continue
            elif rc.asked(asked[0]):
                pending = next((a for a in rc.pending() if a.sid == asked[0]), None)
                late = (pending is not None and not pending.relayed_at and now - asked[1] >= HANDED) or now - asked[1] >= COME
                if not late:
                    continue
            elif now - asked[1] < COME:
                continue  # it came (it called Taska); give it time to take the work
            if code not in alarm:
                out.append(self._say(p, alarm, code, it.title, asked))
        return out

    def _sessions(self, p: "Project") -> Dict[str, str]:
        """The project's Claude sessions by id, the one most lately heard of first (call with its lock)."""
        a = p.agents.agents.get("claude-code")
        if not a:
            return {}
        names = {sid: name for name, sid in a.sids.items() if sid}
        heard = p.agents.lostness.called
        return dict(sorted(names.items(), key=lambda kv: -heard.get(kv[0], a.sessions.get(kv[1], 0))))

    def _idle(self, sid: str) -> bool:
        s = self.lookup(sid)
        d = self.desktop(sid)
        return bool(s is not None and getattr(s, "status", "") == "idle" and d is not None and not d.get("archived"))

    def _say(self, p: "Project", alarm: Dict[str, object], code: str, title: str, asked: Optional[Tuple[str, float]]) -> str:
        root = self.ws.local or "http://127.0.0.1:7340"
        why = ("the session asked to come did not come" if asked else "no Claude session of this project is idle to "
               "wake, and none waits with Taska's script")
        body = (f"{code}（{title}）已经超过 {GRACE // 60} 分钟没有 agent 在做：{'叫过的会话没来' if asked else '这个项目没有空闲的 Claude 会话可以叫，也没有会话在用 Taska 的脚本等活'}。\n\n"
                "让 agent 接起来，任选一个：\n"
                "- 在一个已有的 Claude Code 会话里说一句“接着做 Taska 的活”；\n"
                "- 或者开一个新的 Claude Code 会话，粘贴 Agents 面板里 Connect new agent 复制的那段话；\n"
                "- 想以后都不用管：开一个新的 Claude Code 会话当调度员，粘贴下面这段话；以后有活没人接时，Taska 会通过它叫醒别的会话：\n\n"
                f"```\n{dispatcher(root)}\n```\n\n"
                f"{code} 有人接了，这件会自己消失。（{why}；T869）")
        with p.lock:
            lines, _ = p.run([(0, {"op": "new", "pri": "P1", "when": "now", "title": f"没有 agent 在做 {code}", "body": body})],
                             "taska")
            ref = lines[0].split()[1] if lines and lines[0].startswith("ok ") else None
            alarm[code] = ref
            p.store.db.put(KEY, alarm)
        return f"{p.slug} {code}: told the user ({ref})"

    def _unsay(self, p: "Project", alarm: Dict[str, object], code: str) -> str:
        ref = alarm.pop(code, None)
        with p.lock:
            p.store.db.put(KEY, alarm)
            if ref:
                it = next((t for t in p.state.tasks.values() if p.state.code(t.n) == ref), None)
                if it is not None and it.status == "proposed" and not rules.replied(it):
                    p.run([(0, {"op": "idel", "ref": ref})], "taska")
        return f"{p.slug} {code}: taken; the note to the user went ({ref})"


def run(watch: Watch, every: float = EVERY, stop: Optional[threading.Event] = None) -> threading.Thread:
    """Look every `every` seconds until `stop` (a daemon thread)."""
    stop = stop or threading.Event()

    def loop() -> None:
        while not stop.wait(every):
            try:
                for line in watch.check():
                    logging.getLogger("taska").info(f"watch: {line}", extra={"f": {"source": "server", "kind": "watch"}})
            except Exception:  # one bad look must not end the watch
                logging.getLogger("taska").exception("watch failed")

    t = threading.Thread(target=loop, name="taska-watch", daemon=True)
    t.start()
    return t
