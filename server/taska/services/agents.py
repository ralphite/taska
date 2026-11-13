"""The agents of one project as Taska sees them: who called when (and from which session), who waits for work,
what each read, which items each session holds, and what other sessions wrote for it.

Kept in the project's `kv` (agents, reads, heard, guide). Callers hold the project lock.
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
from ..infra.agent_sessions import SID, Session
from ..infra.project_db import ProjectDb


GUIDE_DIFF_LINES = 40  # of a guide change, at most this many lines are told


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
    sids: Dict[str, str] = field(default_factory=dict)  # per session name: the id its app gave it (sid=, the latest 5)
    parents: Dict[str, str] = field(default_factory=dict)  # per session name: the session that started it (parent=, F768)


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
        guide = db.get("guide")  # F743: the guide's versions sessions last saw, and those versions' words
        guide = guide if isinstance(guide, dict) else {}
        self.guide_texts: Dict[str, str] = {str(k): str(v) for k, v in (guide.get("texts") or {}).items()}
        self.guide_marks: Dict[str, str] = {str(k): str(v) for k, v in (guide.get("marks") or {}).items()}
        self.blocked: Dict[str, List[Dict[str, object]]] = {}  # per agent: its sessions waiting on the user (T711)
        self.found: Dict[str, Session] = {}  # per session id: what its app says of it now (F768)
        lead = db.get("antigravity-lead")  # F755: the one Antigravity session that runs this project, and since when
        self.lead: Optional[Tuple[str, str]] = (str(lead["sid"]), str(lead["t"])) if isinstance(lead, dict) and lead.get("sid") else None

    # -- the Antigravity session that runs the project (F755) ----------------------

    def take_lead(self, sid: str, t: str) -> None:
        """An Antigravity session starts running this project: a newer one takes over from the one before it, whose
        /next then tells it to stop (Yadong r1260)."""
        if not SID.fullmatch(sid) or (self.lead and self.lead[0] == sid):
            return
        self.lead = (sid, t)
        self._db.put("antigravity-lead", {"sid": sid, "t": t})
        self._changed()

    def replaced(self, sid: str) -> Optional[str]:
        """For an Antigravity session that is not the one running this project: since when another is (else None)."""
        return self.lead[1] if self.lead and sid != self.lead[0] else None

    # -- calls ------------------------------------------------------------------

    def saw(self, name: object, waiting: int = 0, session: str = "", sid: str = "", parent: str = "") -> None:
        """An agent called (waiting: +1 when it starts holding /next?wait, -1 when that returns), from the session
        its app knows by `sid` (T711 #10568: its status is read by that id), started by the session named `parent`
        (a manager's worker, F768)."""
        a = self.agents.setdefault(agent_name(name), AgentRecord())
        now = time.time()
        if session:
            a.session = " ".join(session.split())[:160]
            a.sessions[a.session] = now
            for old in sorted(a.sessions, key=lambda s: a.sessions[s])[:-5]:
                del a.sessions[old]
            if parent and session_name(parent) != session_name(a.session):
                a.parents[a.session] = session_name(parent)
            for old in [k for k in a.parents if k not in a.sessions]:
                del a.parents[old]
        if SID.fullmatch(sid):
            named = next((k for k, v in a.sids.items() if v == sid and k), "")
            if session:  # one id is one session: a new title for it takes the old one's place (F768)
                for old in [k for k, v in a.sids.items() if v == sid and k != a.session]:
                    del a.sids[old]
                    a.sessions.pop(old, None)
                    a.parents.pop(old, None)
                a.sids.pop(a.session, None)
                a.sids[a.session] = sid
            elif named:  # a call by its id alone (Antigravity's waker): the session it named before was heard of
                a.sessions[named] = now
            else:
                a.sids.pop("", None)
                a.sids[""] = sid
            for old in list(a.sids)[:-5]:
                del a.sids[old]
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
                who = " and ".join(dict.fromkeys(render.who_wrote(e.by) for e in new))
                out.append(f"the rules changed to v{vs[-1].v} by {who}"
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

    def read_guide(self, name: object, ses: str, version: Tuple[str, str]) -> None:
        """A session read the guide (GET /agent): it knows this version."""
        self._mark_guide(f"{agent_name(name)}\x00{session_name(ses)}", version)

    def guide_news(self, name: object, ses: str, version: Tuple[str, str]) -> List[str]:
        """The guide changed since this session last read it, told once (F743): what changed, as lines that went and
        came. A session Taska has not seen yet is only marked (it reads /agent)."""
        key = f"{agent_name(name)}\x00{session_name(ses)}"
        mark = self.guide_marks.get(key)
        if mark == version[0]:
            return []
        before = self.guide_texts.get(mark or "")
        self._mark_guide(key, version)
        if mark is None:
            return []
        changed = sections.lines_changed(before, version[1]) if before is not None \
            else ["  (the earlier version is no longer kept)"]
        more = len(changed) - GUIDE_DIFF_LINES
        return (["The guide for agents changed: read GET /agent again. What changed:"] + changed[:GUIDE_DIFF_LINES]
                + ([f"  …{more} more lines"] if more > 0 else []))

    def _mark_guide(self, key: str, version: Tuple[str, str]) -> None:
        if self.guide_marks.get(key) == version[0] and version[0] in self.guide_texts:
            return
        self.guide_marks.pop(key, None)
        self.guide_marks[key] = version[0]
        self.guide_texts.pop(version[0], None)
        self.guide_texts[version[0]] = version[1]
        for old in list(self.guide_marks)[:-500]:
            del self.guide_marks[old]
        seen = set(self.guide_marks.values())
        kept = [v for v in self.guide_texts if v in seen][-8:]
        self.guide_texts = {v: self.guide_texts[v] for v in kept}
        if not self._gone():
            self._db.put("guide", {"texts": self.guide_texts, "marks": self.guide_marks})

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

    # -- sessions waiting on the user ----------------------------------------------

    def sids(self) -> List[str]:
        """The session ids agents gave here."""
        return sorted({sid for a in self.agents.values() for sid in a.sids.values()})

    def see_sessions(self, found: Dict[str, Session]) -> None:
        """The sessions by id (T711 #10568), as their apps say they are now (F768: working, idle, waiting on the user,
        exited); those waiting on the user are shown under the agent that gave the id, by the session name it gave
        (else the app's title). A change wakes the pages."""
        mine: Dict[str, List[Dict[str, object]]] = {}
        for k, a in self.agents.items():
            for ses, sid in a.sids.items():
                s = found.get(sid)
                if s and s.status == "waiting":
                    mine.setdefault(k, []).append({"session": ses or s.name or sid[:8], "waitingFor": s.waiting_for,
                                                   "since": s.since})
        if mine != self.blocked or found != self.found:
            self.blocked, self.found = mine, dict(found)
            self.version += 1
            self._changed()

    # -- what the page shows -------------------------------------------------------

    def _holds(self, state: ProjectState) -> Dict[str, Tuple[int, float]]:
        """Per agent session ("claude-code · worker"): the item it is on now and since when (the latest it took)."""
        out: Dict[str, Tuple[int, float]] = {}
        t_now = time.time()
        for n in set(state.claims) | {n for n, i in state.items.items() if i.agent and i.status == "doing"}:
            it = state.items.get(n)
            if not it or it.deleted or it.merged_into:
                continue
            h = self.holder(state, it, t_now)
            if h and (h[0] not in out or out[h[0]][1] < h[1]):
                out[h[0]] = (n, h[1])
        return out

    def _session(self, k: str, name: str, t: float, sid: str, holds: Dict[str, Tuple[int, float]],
                 waking: Set[str]) -> Dict[str, object]:
        """One session as the page shows it (F768): its name and last call; the id its app knows it by, and what the
        app says of it (status, since when, what it waits on, its folder); the item it is on; who started it."""
        row: Dict[str, object] = {"name": name, "t": int(t * 1000)}
        s = self.found.get(sid) if sid else None
        if sid:
            row["sid"] = sid
        if s:
            row.update({"status": s.status, "since": s.since, "cwd": s.cwd})
            if s.waiting_for:
                row["waitingFor"] = s.waiting_for
            if not name:
                row["name"] = s.name or sid[:8]
        elif not name:
            row["name"] = sid[:8]
        if sid in waking:
            row["waiting"] = True  # its waker waits for work for it (B762): it is connected
        h = holds.get(ident(k, name))
        if h:
            row["on"] = {"n": h[0], "since": int(h[1] * 1000)}
        parent = self.agents[k].parents.get(name)
        if parent:
            row["parent"] = parent
        return row

    def presence(self, state: Optional[ProjectState] = None, waking: Optional[Set[str]] = None) -> List[Dict[str, object]]:
        """Each agent: its last call, whether it waits for work, its sessions (those heard of in the last day, and any
        its app says waits on the user), each as _session says; `waking`: the session ids a waker waits for (B762)."""
        day = time.time() - 86400
        holds = self._holds(state) if state else {}
        waking = waking or set()
        out: List[Dict[str, object]] = []
        for k, v in self.agents.items():
            row: Dict[str, object] = {"name": k, "t": int(v.t * 1000), "waiting": v.waiting > 0}
            if v.session:
                row["session"] = v.session
            rows = [self._session(k, n, t, v.sids.get(n, ""), holds, waking)
                    for n, t in sorted(v.sessions.items(), key=lambda x: -x[1])
                    if t > day or self.found.get(v.sids.get(n, "")) and self.found[v.sids[n]].status == "waiting"]
            if v.sids.get("") and v.sids[""] not in {sid for n, sid in v.sids.items() if n}:
                rows.append(self._session(k, "", v.t, v.sids[""], holds, waking))
            if rows:
                row["sessions"] = rows
            if self.blocked.get(k):
                row["blocked"] = self.blocked[k]
            out.append(row)
        return out
