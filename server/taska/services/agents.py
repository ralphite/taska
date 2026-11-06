"""The agents of one project as Taska sees them: who called when (and from which session), who waits for work,
what each read, which items each session holds, and what other sessions wrote for it.

Kept in the project's `kv` (agents, reads, heard). Callers hold the project lock.
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Set, Tuple

from ..agent_text import render
from ..domain import events as ev, rules, sections, versions
from ..domain.model import Input, Item, Message
from ..domain.state import ProjectState, ident
from ..domain.text import first_line, seconds
from ..domain.vocab import CLAIM_TTL, PEOPLE
from ..infra.project_db import ProjectDb


def agent_name(name: object) -> str:
    return re.sub(r"[^\w .-]", "", str(name or "agent"))[:40] or "agent"


def name_key(name: object) -> str:
    return "-".join(str(name).lower().split())


def session_name(ses: object) -> str:
    return " ".join(str(ses or "").split())[:60]


@dataclass
class AgentRecord:
    t: float = 0.0  # its last call
    waiting: int = 0  # how many /next?wait calls it holds now
    session: str = ""  # what it said about itself last (its session's name, the machine, the folder)
    sessions: Dict[str, float] = field(default_factory=dict)  # each session's last call (the latest 5)
    next_at: Optional[float] = None  # when it last read /next


class AgentActivity:
    def __init__(self, db: ProjectDb, state: ProjectState, changed: Callable[[], None], gone: Callable[[], bool]):
        self._db = db
        self._changed = changed  # wakes those waiting for news
        self._gone = gone
        self.version = 0  # bumps when an agent turns up, starts or stops waiting, or reads an item
        self._saved_at = 0.0
        saved = db.get("agents")
        if isinstance(saved, dict):
            self.agents: Dict[str, AgentRecord] = {str(k): AgentRecord(t=float(v)) for k, v in saved.items()}
        else:  # first run: when did each agent last write here?
            self.agents = {}
            for e in state.events:
                if e.by and e.by not in PEOPLE and e.t:
                    try:
                        self.agents[e.by] = AgentRecord(t=seconds(e.t))
                    except ValueError:
                        pass
        reads = db.get("reads")
        self.reads: Dict[int, Dict[str, float]] = {int(n): dict(v) for n, v in reads.items()} if isinstance(reads, dict) else {}
        heard = db.get("heard")
        self.heard: Dict[str, Dict[int, int]] = (
            {str(k): {int(n): int(m) for n, m in v.items()} for k, v in heard.items()} if isinstance(heard, dict) else {})
        self.told: Dict[str, Set[int]] = {}  # per session: messages for it that a /do reply named already
        self.rule_marks: Dict[str, int] = {}  # per session: how much of the log it has been told rules from

    # -- calls ------------------------------------------------------------------

    def saw(self, name: object, waiting: int = 0, session: str = "") -> None:
        """An agent called (waiting: +1 when it starts holding /next?wait, -1 when that returns)."""
        a = self.agents.setdefault(agent_name(name), AgentRecord())
        now = time.time()
        if session:
            a.session = " ".join(session.split())[:160]
            a.sessions[a.session] = now
            for old in sorted(a.sessions, key=lambda s: a.sessions[s])[:-5]:
                del a.sessions[old]
        before = (a.waiting > 0, now - a.t < 600)
        a.t, a.waiting = now, max(0, a.waiting + waiting)
        if (a.waiting > 0, True) != before:
            self.version += 1
            self._changed()
        if (waiting or now - self._saved_at > 60) and not self._gone():
            self._saved_at = now
            self._db.put("agents", {k: v.t for k, v in self.agents.items()})

    def read_item(self, n: int, name: object, state: ProjectState) -> None:
        """An agent read an item (its card, or /next gave it): the page says "Read by" under your last words."""
        name = agent_name(name)
        if name in PEOPLE or n not in state.items:
            return
        self.reads.setdefault(n, {})[name] = time.time()
        self.version += 1
        self._changed()
        if not self._gone():
            self._db.put("reads", {str(k): v for k, v in self.reads.items()})

    def read_next(self, name: object) -> None:
        self.agents.setdefault(agent_name(name), AgentRecord()).next_at = time.time()

    def news_for(self, name: object, for_agent: List[Input]) -> List[str]:
        """Inputs that came in after the agent last read /next: it hears of them when it writes back."""
        since = self.agents.get(agent_name(name), AgentRecord()).next_at
        if not since:
            return []
        return [i.id for i in rules.by_number(for_agent) if seconds(i.t) >= int(since)]

    def rule_news(self, state: ProjectState, name: object, ses: str = "") -> List[str]:
        """The rules changed by someone else since this session last heard from Taska, told once (I693): the version,
        who, why, and the changed sections as a diff; and what became of its own proposals. Its first call only sets
        the mark (it reads /rules)."""
        name, ses = agent_name(name), session_name(ses)
        key = f"{name}\x00{ses}"
        mark = self.rule_marks.get(key)
        self.rule_marks[key] = len(state.events)
        d = state.rules
        if mark is None or not d:
            return []
        out: List[str] = []
        ws = versions.writes(state, d)
        new = [e for e in ws if e.seq > mark]
        if new and not all(e.by == name and (e.ses or "") == ses for e in new):
            before = next((e.md for e in reversed(ws) if e.seq <= mark), "")
            changed = sections.diff(before, d.md)
            if changed:
                vs = versions.versions(state, d)
                whys = [e.why for e in reversed(new) if e.why]
                out.append(f"the rules changed to v{vs[-1].v} by {render.who_wrote(new[-1].by)}"
                           + (f": {'; '.join(whys)}" if whys else "") + ". Apply them from now on; what changed:")
                out += ["  " + x for x in changed]
        for e in state.events[mark:]:
            p = next((x for x in d.proposals if x.id == getattr(e, "p", None)), None)
            if isinstance(e, ev.DocDecided) and p and p.by == name:
                word = {"approved": "approved: it is in the rules now", "declined": "declined by the user",
                        "stale": f"sent back ({e.note}): write it again on the rules as they are now and propose it again"}
                out.append(f"your rules proposal P{p.id} ({p.why}) was {word.get(e.to, e.to)}")
            if isinstance(e, ev.CommentAdded) and e.d == d.d and e.by == "you" and e.key[:1] == "p":
                q = next((x for x in d.proposals if f"p{x.id}" == e.key), None)
                if q and q.by == name:
                    out.append(f"the user wrote on your rules proposal P{q.id}: {first_line(e.text, 200)} "
                               f"(answer: rules reply P{q.id} <text>)")
        return out

    # -- holds ------------------------------------------------------------------

    def holder(self, state: ProjectState, it: Item, now: Optional[float] = None) -> Optional[Tuple[str, float]]:
        """The agent session working on an item: the last one /next gave it to or that wrote to it, while fresh."""
        t_now = now or time.time()
        c = state.claims.get(it.n)
        best = (c.who, c.since) if c and t_now - c.since < CLAIM_TTL else None
        a = it.agent
        if a and it.status == "doing":
            t = seconds(a.t)
            if t_now - t < CLAIM_TTL and (not best or t >= best[1]):
                best = (ident(a.by, a.ses), t)
        return best

    # -- sessions talking to each other ------------------------------------------

    def known_names(self, state: ProjectState) -> List[str]:
        """The agents and sessions that called or wrote here, longest first."""
        out: Set[str] = set()
        for k, v in self.agents.items():
            out.add(k)
            out.update(" ".join(str(x).split())[:60] for x in v.sessions)
        for e in state.events[-3000:]:
            if e.by and e.by not in PEOPLE:
                out.add(e.by)
                if e.ses:
                    out.add(e.ses)
        return sorted((x for x in out if x), key=len, reverse=True)

    def mentions(self, state: ProjectState, text: str) -> Tuple[List[str], List[str]]:
        """The sessions a message names with @name, outside code -> (names, those nobody goes by yet)."""
        plain = re.sub(r"```.*?```|`[^`\n]*`", " ", text, flags=re.S)
        known = self.known_names(state)
        keys = {name_key(k) for k in known}
        names: List[str] = []
        unknown: List[str] = []
        for m in re.finditer(r"(?<![A-Za-z0-9_@.])@", plain):
            rest = plain[m.end():]
            hit = next((k for k in known if rest[:len(k)].lower() == k.lower()
                        and not re.match(r"[A-Za-z0-9_-]", rest[len(k):len(k) + 1])), "")
            if not hit:
                t = re.match(r"[A-Za-z0-9_][A-Za-z0-9_.-]*", rest)
                hit = t.group(0).rstrip(".-") if t else ""
                if not hit:
                    continue
                if name_key(hit) not in keys and hit not in unknown:
                    unknown.append(hit)
            if all(name_key(hit) != name_key(x) for x in names):
                names.append(hit)
        return names, unknown

    @staticmethod
    def addressed(x: Message, by: object, ses: str = "") -> bool:
        to = {name_key(t) for t in x.to or []}
        return bool(to) and ((bool(ses) and name_key(ses) in to) or name_key(by) in to)

    def calls_for(self, state: ProjectState, by: object, ses: str = "") -> List[Tuple[Item, Message, bool]]:
        """What other agents or sessions wrote for this session that it has not read yet, oldest first, as (item,
        message, named it): words addressed to it on any item, and any of theirs on the items it is on."""
        if not by or by in PEOPLE:
            return []
        me = ident(by, ses)
        heard, acted = self.heard.get(me, {}), state.first_act(me)
        t_now = time.time()
        maybe = state.addressed_items | set(state.claims) | {
            n for n, i in state.items.items() if i.agent and i.status == "doing"}
        out: List[Tuple[Item, Message, bool]] = []
        for n in maybe:
            it = state.items.get(n)
            if not it or it.deleted or it.merged_into:
                continue
            c = self.holder(state, it, t_now)
            mine = bool(c and c[0] == me)
            if not mine and n not in state.addressed_items:
                continue
            mark, took = heard.get(n, 0), acted.get(n, 0)
            for x in reversed(it.thread):
                if x.id <= mark:
                    break
                if x.by in PEOPLE or x.hidden:
                    continue
                if ident(x.by, x.ses) == me:
                    break  # its own word: it had read what came before
                to_me = self.addressed(x, by, ses)
                if to_me or (mine and x.id > took):
                    out.append((it, x, to_me))
        return sorted(out, key=lambda r: int(r[1].id))

    def heard_item(self, state: ProjectState, n: int, by: object, ses: str = "") -> None:
        """A session read item n: the messages on it so far have reached it."""
        it = state.items.get(n)
        if not by or by in PEOPLE or not it:
            return
        last = int(it.thread[-1].id) if it.thread else 0
        mine = self.heard.setdefault(ident(by, ses), {})
        if mine.get(n, 0) < last:
            mine[n] = last
            if not self._gone():
                self._db.put("heard", {k: {str(i): m for i, m in v.items()} for k, v in self.heard.items()})

    def call_news(self, state: ProjectState, by: object, ses: str = "") -> List[str]:
        """For a /do reply: one line for each message for this session that no reply has named to it yet."""
        told = self.told.setdefault(ident(by, ses), set())
        out: List[str] = []
        for it, x, to_me in self.calls_for(state, by, ses):
            if x.id in told:
                continue
            told.add(x.id)
            c = state.code(it.n)
            where = f"to you on {c}" if to_me else f"on {c}, which you are on"
            out.append(f"{ident(x.by, x.ses)} wrote {where}: {first_line(x.text, 120)} (GET /{c})")
        return out

    # -- what the page shows -------------------------------------------------------

    def presence(self) -> List[Dict[str, object]]:
        day = time.time() - 86400
        out: List[Dict[str, object]] = []
        for k, v in self.agents.items():
            row: Dict[str, object] = {"name": k, "t": int(v.t * 1000), "waiting": v.waiting > 0}
            if v.session:
                row["session"] = v.session
            if v.sessions:
                row["sessions"] = [{"name": n, "t": int(t * 1000)}
                                   for n, t in sorted(v.sessions.items(), key=lambda x: -x[1]) if t > day]
            out.append(row)
        return out
