"""All projects under one data root: opening them, making, renaming, deleting and restoring them, and what the
pages read across them (each project's counts, what needs you everywhere, search).

    <root>/<project>/taska.db        one project, with taska-files/ next to it
    <root>/.deleted/<project>/       a deleted project, as it was (restore brings it back)
"""

from __future__ import annotations

import contextlib
import json
import os
import re
import time
import secrets
import shutil
import threading
from typing import Any, Callable, Dict, List, Optional, Tuple

from ..domain import finding, rules, versions
from ..domain.text import project_title, slug_of
from ..domain.state import ProjectState
from ..domain.vocab import CLOSED, PROJECT_NAME, SLUG_CHARS, Refused
from ..agent_text import reconnect as reconnect_text
from ..infra.agent_sessions import Session, claude_desktop
from ..infra.project_db import ProjectDb
from .meaning import Meaning
from .moves import Moves
from .project import Project, now_iso
from .reconnects import APPS as RECONNECT_APPS, Reconnects, connected, session_of
from .shared_rules import SharedRules, is_shared_slug
from .settings import AccessKey, ListViews, ProjectOrder, SearchByMeaning, Spellings, VoicePrefs

Opened = Callable[[Project], None]


def short_slug() -> str:
    return "p-" + "".join(secrets.choice(SLUG_CHARS) for _ in range(4))  # p-7k2m


def tally(st: ProjectState) -> Dict[str, int]:
    """A project's counts, as its page counts them: what needs you (archived is not on the page's list, so not here;
    a proposed change to the rules waiting counts, I693); what Tasks holds, open and finished (done or dropped); its
    inputs and documents (the rules are not one of them; F667: the sidebar's card)."""
    needs = {i.n for i in st.live_tasks() if rules.needs_you(st, i)}
    listed = [i for i in st.live_tasks() if not i.archived]
    closed = sum(1 for i in listed if i.status in CLOSED)
    docs = sum(1 for d in st.docs.values() if not d.deleted and not d.is_rules
               and not (d.n in st.tasks and st.tasks[d.n].deleted))
    return {"open": len(listed) - closed, "needs": len(needs) + len(versions.waiting(st.rules)), "closed": closed,
            "inputs": sum(1 for r in st.inputs.values() if not r.deleted), "docs": docs}


# I810: a worker's title starting with the code of the task it works on ("T28: the tutor skill", "T28 · …")
WORKER_TITLE = re.compile(r"\s*([A-Z])0*(\d+)(?=$|[\s:\uff1a\u00b7,\uff0c.\-\u2014])")


class Workspace:
    def __init__(self, root: str, public: str = "", on_open: Optional[Opened] = None,
                 voice_fix: Optional[Callable[..., None]] = None, gemini: bool = False):
        self.root = os.path.abspath(os.path.expanduser(root))
        self.public = public.rstrip("/")  # the tunnel's address, for the phone link
        self.lan = ""  # this machine on its own network ("http://192.168.1.20:7340"), when Taska listens there
        self.trash = os.path.join(self.root, ".deleted")
        self._lock = threading.Lock()
        self._on_open = on_open
        self._voice_fix = voice_fix
        os.makedirs(self.root, exist_ok=True)
        self.key = AccessKey(self.root)
        self.spellings = Spellings(self.root)
        self.views = ListViews(self.root)
        self.voice_prefs = VoicePrefs(self.root)
        self.order = ProjectOrder(self.root)
        self.meaning = Meaning(SearchByMeaning(self.root), allowed=gemini,  # gemini: the server may ask it (cli)
                               path=os.path.join(self.root, "meaning.db"), lists=self.short_lists)
        self.moves = Moves()
        self.reconnects = Reconnects()  # I833: sessions to bring back after they lost their connection
        self.local = ""  # Taska on this machine ("http://127.0.0.1:7340"), for what the agents here run
        self.projects: Dict[str, Project] = {}
        for name in sorted(os.listdir(self.root)):
            if PROJECT_NAME.fullmatch(name) and ProjectDb.exists_in(os.path.join(self.root, name)):
                self._open(name)
        if not self.projects:
            self.add("default")
        self.shared_rules = SharedRules(self.root, self)  # I779: kept once for every project
        self.meaning.soon()  # the lines' embeddings, before the first search asks for them

    # -- what projects share (services.project.Shared) -------------------------------------

    def remember_spelling(self, wrong: str, right: str) -> None:
        self.spellings.correct(wrong, right)

    def note_voice_fix(self, wrong: str, right: str, **where: Any) -> None:
        if self._voice_fix:
            self._voice_fix(wrong, right, **{k: v for k, v in where.items()})

    def input_moving(self, slug: str, rid: str) -> bool:
        return self.moves.moving(slug, rid)

    def changed(self, slug: str) -> None:
        if not is_shared_slug(slug):
            self.meaning.soon()
        else:  # called under that shared document's lock
            self.shared_rules.refresh(slug)

    def skills(self) -> Dict[str, str]:
        return self.shared_rules.skills()

    def shared_texts(self) -> Dict[str, str]:
        return self.shared_rules.texts()

    def shared_listing(self) -> List[Dict[str, Any]]:
        """Settings › Shared rules: each with the projects that put it in (I779)."""
        return self.shared_rules.listing(dict(self.projects))

    # -- opening and changing projects ---------------------------------------------------------

    def _open(self, name: str) -> Project:
        p = Project(os.path.join(self.root, name), name, shared=self)
        self.projects[name] = p
        if self._on_open:
            self._on_open(p)
        return p

    def live(self, slug: Any) -> Project:
        p = self.projects.get(str(slug or ""))
        if not p:
            raise Refused(f"no project {slug}")
        return p

    def _taken(self, slug: str) -> bool:
        return slug in self.projects or os.path.exists(os.path.join(self.root, slug)) or \
            os.path.exists(os.path.join(self.trash, slug))

    def _clash(self, title: str, but: Optional[Project] = None) -> None:
        if any(p is not but and p.title.lower() == title.lower() for p in self.projects.values()):
            raise Refused(f"a project called {title} exists already")

    def add(self, name: Any) -> Project:
        """A new project: any name; its address is made from the name once and never changes (a deleted project's
        address is never given again)."""
        title = project_title(name)
        with self._lock:
            self._clash(title)
            base = slug_of(title)
            slug, k = base or short_slug(), 2
            while self._taken(slug):
                slug, k = (f"{base[:36].rstrip('-')}-{k}" if base else short_slug()), k + 1
            os.makedirs(os.path.join(self.root, slug), exist_ok=True)
            p = self._open(slug)
        if title != slug:
            p.run([(0, {"op": "cfg", "name": title})], "you")
        return p

    def rename(self, slug: Any, name: Any) -> Tuple[Project, str]:
        title = project_title(name)
        with self._lock:
            p = self.live(slug)
            self._clash(title, but=p)
            was = p.title
        if title != was:
            p.run([(0, {"op": "cfg", "name": title})], "you")
        return p, was

    def delete(self, slug: Any) -> Project:
        """Out of the way, nothing lost: the folder moves to .deleted/; agents asking for work hear it was deleted."""
        with self._lock:
            p = self.live(slug)
            with p.lock:
                p.gone = True
                info = {"t": now_iso(), "title": p.title, "tasks": len(p.state.live_tasks())}
                p.news.bump()  # pages and agents waiting on it hear at once
                p.close()
            del self.projects[p.slug]
            os.makedirs(self.trash, exist_ok=True)
            os.rename(os.path.join(self.root, p.slug), os.path.join(self.trash, p.slug))
            with open(os.path.join(self.trash, p.slug, "deleted.json"), "w", encoding="utf-8") as f:
                json.dump(info, f, ensure_ascii=False)
            return p

    def restore(self, slug: Any) -> Project:
        slug = str(slug or "")
        with self._lock:
            src = os.path.join(self.trash, slug)
            if not PROJECT_NAME.fullmatch(slug) or not ProjectDb.exists_in(src):
                raise Refused(f"no deleted project {slug}")
            if slug in self.projects or os.path.exists(os.path.join(self.root, slug)):
                raise Refused(f"the address {slug} is in use")
            with contextlib.suppress(FileNotFoundError):
                os.remove(os.path.join(src, "deleted.json"))
            os.rename(src, os.path.join(self.root, slug))
            return self._open(slug)

    def purge(self, slug: Any) -> None:
        """The one step that can't be undone: a deleted project's folder goes for good."""
        slug = str(slug or "")
        with self._lock:
            src = os.path.join(self.trash, slug)
            if not PROJECT_NAME.fullmatch(slug) or not os.path.isdir(src):
                raise Refused(f"no deleted project {slug}")
            shutil.rmtree(src)

    def was_deleted(self, slug: str) -> bool:
        return os.path.isdir(os.path.join(self.trash, slug))

    def deleted(self) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        for slug in sorted(os.listdir(self.trash)) if os.path.isdir(self.trash) else []:
            if not PROJECT_NAME.fullmatch(slug) or not ProjectDb.exists_in(os.path.join(self.trash, slug)):
                continue
            try:
                with open(os.path.join(self.trash, slug, "deleted.json"), encoding="utf-8") as f:
                    info = json.load(f)
            except (OSError, ValueError):
                info = {}
            out.append({"name": slug, "title": info.get("title") or slug, "t": info.get("t") or "", "tasks": info.get("tasks", 0)})
        return sorted(out, key=lambda d: d["t"], reverse=True)

    def set_order(self, names: Any) -> None:
        """The projects in the order you put them; ones left out keep their places after these, by name."""
        if not isinstance(names, list) or not all(isinstance(n, str) for n in names):
            raise Refused("give the projects' names in their new order")
        with self._lock:
            self.order.set([n for n in names if n in self.projects])

    # -- reading across projects ------------------------------------------------------------------

    def summary(self, presence: Callable[[Project], Dict[str, Any]]) -> List[Dict[str, Any]]:
        """One row per project: how many things need you, how many are open, who is around, when it last changed."""
        out: List[Dict[str, Any]] = []
        for name, p in sorted(self.projects.items()):
            with p.lock:
                row: Dict[str, Any] = {"name": name, "title": p.title, "icon": p.state.icon, **tally(p.state), **presence(p),
                                       "t": int(p.store.changed_at() * 1000)}
                pos = self.order.position(name)
                if pos is not None:
                    row["pos"] = pos
                out.append(row)
        return out

    # -- a phone, once (D115 #20: the first-run checklist's Use on your phone) ------------------

    @property
    def phone_seen(self) -> bool:
        """Whether Taska was ever opened on a phone."""
        return os.path.exists(os.path.join(self.root, ".phone-seen"))

    def saw_phone(self) -> None:
        if not self.phone_seen:
            with open(os.path.join(self.root, ".phone-seen"), "w", encoding="utf-8") as f:
                f.write(time.strftime("%Y-%m-%d %H:%M:%S\n"))

    def bring_back_laters(self, today: str) -> int:
        """In every project, what was Later until `today` or before is back to Now (D115 #21). -> how many."""
        return sum(p.bring_back_laters(today) for p in list(self.projects.values()))

    def find_workers(self, running: List[Session]) -> None:
        """I810: which running sessions are a manager's workers on which tasks, by their titles: a title starting with
        a task's code ("T28: the tutor skill"), in a folder this project's own sessions work in. A code that fits
        tasks in several projects goes to the one whose task is in progress, and to none when that does not settle it."""
        found: Dict[str, Dict[str, Tuple[str, int]]] = {name: {} for name in self.projects}
        titled: Dict[str, Dict[str, int]] = {name: {} for name in self.projects}
        for s in running:
            m = WORKER_TITLE.match(s.name)
            if not m:
                continue
            fits: List[Tuple[str, int, bool]] = []
            for name, p in self.projects.items():
                with p.lock:
                    own = s.id in p.agents.sids(own=True)
                    if own:  # one of its own sessions: its app's title says the task it is on (when nothing else does)
                        it = p.state.tasks.get(int(m.group(2)))
                        if it and it.status not in CLOSED:
                            titled[name][s.id] = it.n
                        continue
                    if s.cwd not in p.agents.folders():
                        continue
                    it = p.state.tasks.get(int(m.group(2)))
                    if it and not it.deleted and not it.merged_into and it.status not in CLOSED:
                        fits.append((name, it.n, it.status == "doing"))
            doing = [f for f in fits if f[2]]
            pick = fits if len(fits) == 1 else doing if len(doing) == 1 else []
            for name, n, _ in pick:
                found[name][s.id] = (s.name, n)
        for name, p in list(self.projects.items()):
            with p.lock:
                p.agents.adopt(found.get(name, {}), titled.get(name, {}))

    def listening(self, sid: str) -> Dict[str, bool]:
        """B811: whether session `sid` is an agent session here (it gave Taska its id), and whether it waits for work
        now in any project: the check at the end of each of its turns (a session that stopped listening takes no work)."""
        now = time.time()
        known = listens = False
        for p in list(self.projects.values()):
            with p.lock:
                if sid in p.agents.sids(own=True):
                    known = True
                    # a task in progress there: it is at work (waiting on what it started), not to listen now
                    busy = any(i.status == "doing" and not i.deleted and not i.merged_into for i in p.state.tasks.values())
                    listens = listens or busy or p.agents.listens(sid, now)
        return {"known": known, "listening": listens}

    # -- bringing back lost sessions (I833) ---------------------------------------------------

    def _connected(self, app: str, but: str = "") -> List[str]:
        """The sessions of `app` that wait for work now, in any project (one may bring back another)."""
        out: List[str] = []
        for p in list(self.projects.values()):
            with p.lock:
                out += [sid for sid in connected(p.agents, app) if sid != but]
        return out

    def _wake_all(self) -> None:
        """Every project's waiting agents look again (no project lock held)."""
        for p in list(self.projects.values()):
            p.news.wake()

    def reconnect(self, slug: str, sid: str, root: str) -> Dict[str, Any]:
        """The user asked to bring back session `sid` of project `slug`. With a session of its app connected, that one
        is handed it (relay); with none, every lost session of that app is asked for too and the answer is what to give
        a new session (and, for Claude, the link that opens one with it)."""
        p = self.live(slug)
        with p.lock:
            got = session_of(p.agents, sid)
        if not got or got[0] not in RECONNECT_APPS:
            raise Refused("Taska cannot bring back that session")
        app, name = got
        if app == "claude-code":
            d = claude_desktop(sid)
            if d and d["archived"]:
                raise Refused("that session is archived in the Claude app")
            name = name or (str(d["title"]) if d else "")
        relays = self._connected(app, but=sid)
        self.reconnects.add(sid, app, slug, name)
        out: Dict[str, Any] = {"ok": True, "relay": bool(relays)}
        if not relays:
            for q in list(self.projects.values()):
                with q.lock:
                    lost = [(x, session_of(q.agents, x)) for x in q.agents.lostness.lost()]
                for x, of in lost:
                    if of and of[0] == app and not self.reconnects.asked(x):
                        self.reconnects.add(x, app, q.slug, of[1])
            out["text"] = reconnect_text.new_session(root, app)
        self._wake_all()
        return out

    def relay_for(self, app: str, sid: str, root: str) -> str:
        """The narrow job for connected session `sid` of `app` when a lost one waits to be brought back ('' none)."""
        a = self.reconnects.for_relay(app, sid)
        if not a:
            return ""
        return reconnect_text.relay(root, a.app, a.slug, a.sid, a.name, claude_desktop(a.sid) if a.app == "claude-code" else None)

    def lost_list(self, app: str, root: str) -> str:
        """GET /api/reconnects?app=: for the new session the user started to bring back every lost session of `app`."""
        if app not in RECONNECT_APPS:
            raise Refused("app: claude-code or antigravity")
        rows: List[Dict[str, object]] = []
        for a in self.reconnects.pending(app):
            self.reconnects.for_relay(app, "new session")  # handed to it: a connected session does not send it too
            rows.append({"sid": a.sid, "slug": a.slug, "name": a.name, "desktop": claude_desktop(a.sid) if app == "claude-code" else None})
        return reconnect_text.all_lost(root, app, rows)

    def needs(self, push: bool = False) -> List[Dict[str, Any]]:
        """What needs you in every project, newest first. A session working on a task and waiting on you counts
        once it has waited a minute (I810), and for a push once it has waited three."""
        out: List[Dict[str, Any]] = []
        now_ms = time.time() * 1000
        for name, p in sorted(self.projects.items()):
            with p.lock:
                st = p.state
                for k, rows in p.agents.blocked.items():
                    for b in rows:
                        n, since = b.get("on"), b.get("since") or 0
                        if not isinstance(n, int) or n not in st.tasks or not isinstance(since, (int, float)):
                            continue
                        if since and now_ms - since < (180_000 if push else 60_000):
                            continue
                        why = f": {b['waitingFor']}" if b.get("waitingFor") else ""
                        out.append({"project": name, "ptitle": p.title, "n": n, "code": st.code(n),
                                    "title": f"{b.get('session')} waits on you{why}", "kind": "blocked", "pri": "P1",
                                    "t": time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime((since or now_ms) / 1000))})
                for i in st.live_tasks():
                    if i.status in CLOSED or i.merged_into or i.archived:
                        continue
                    w = rules.waiting(st, i)
                    kind = w.kind if w else i.status if i.status in ("proposed", "review") and not rules.talked(st, i) else None
                    if kind:
                        out.append({"project": name, "ptitle": p.title, "n": i.n, "code": st.code(i.n), "title": i.title,
                                    "kind": kind, "pri": i.pri, "t": i.t1 or ""})
                for x in versions.waiting(st.rules):  # a proposed change to the rules (I693)
                    out.append({"project": name, "ptitle": p.title, "n": 0, "code": "Rules", "title": x.why,
                                "kind": "rules", "pri": "P1", "t": x.t, "p": x.id})
        return sorted(out, key=lambda x: x["t"], reverse=True)

    def find(self, q: str, here: str = "") -> Tuple[str, List[Tuple[str, finding.Found]]]:
        """F479: what `q` finds in every project, closest first, each with its project: by what it means when that is
        on (Meaning), then by its words (what the meaning did not find after it); -> (how: "meaning" or "words", it)."""
        words: List[Tuple[float, str, finding.Found]] = []
        for name in self._here_first(here):
            p = self.projects[name]
            with p.lock:
                words += [(f.score, name, f) for f in finding.by_words(p.state, q)]
        asks = self.meaning.on()
        lists = self.short_lists(here) if asks else []
        words.sort(key=lambda x: x[0], reverse=True)  # stable: the project you are in first when as close
        out = [(name, f) for _, name, f in words]
        ranked = self.meaning.rank(q, lists) if asks else None
        if ranked is None:
            return "words", out[:80]
        known = {(name, f.key): f for name, _, short in lists for f, _ in short}
        by_meaning = [(name, known[(name, key)]) for name, key in ranked if (name, key) in known]
        seen = {(name, f.key) for name, f in by_meaning}
        return "meaning", (by_meaning + [(name, f) for name, f in out if (name, f.key) not in seen])[:80]

    def short_lists(self, here: str = "") -> List[Tuple[str, str, List[Tuple[finding.Found, str]]]]:
        """Every project's short list (finding.short_list) as it is now, with its name and title, `here` first."""
        out: List[Tuple[str, str, List[Tuple[finding.Found, str]]]] = []
        for name in self._here_first(here):
            p = self.projects.get(name)
            if p is not None:
                with p.lock:
                    out.append((name, p.title, finding.short_list(p.state)))
        return out

    def _here_first(self, here: str) -> List[str]:
        return sorted(self.projects, key=lambda x: (x != here, x))

    def close(self) -> None:
        self.meaning.close()
        self.shared_rules.close()
        for p in list(self.projects.values()):
            p.close()
