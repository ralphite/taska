"""All projects under one data root: opening them, making, renaming, deleting and restoring them, and what the
pages read across them (each project's counts, what needs you everywhere, search).

    <root>/<project>/taska.db        one project, with taska-files/ next to it
    <root>/.deleted/<project>/       a deleted project, as it was (restore brings it back)
"""

from __future__ import annotations

import contextlib
import json
import os
import secrets
import shutil
import threading
from typing import Any, Callable, Dict, List, Optional, Tuple

from ..domain import rules
from ..domain.text import project_title, slug_of
from ..domain.vocab import CLOSED, PROJECT_NAME, SLUG_CHARS, Refused
from ..infra.project_db import ProjectDb
from .moves import Moves
from .project import Project, now_iso
from .settings import AccessKey, ListViews, ProjectOrder, Spellings, VoicePrefs

Opened = Callable[[Project], None]


def short_slug() -> str:
    return "p-" + "".join(secrets.choice(SLUG_CHARS) for _ in range(4))  # p-7k2m


class Workspace:
    def __init__(self, root: str, public: str = "", on_open: Optional[Opened] = None,
                 voice_fix: Optional[Callable[..., None]] = None):
        self.root = os.path.abspath(os.path.expanduser(root))
        self.public = public.rstrip("/")  # the tunnel's address, for the phone link
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
        self.moves = Moves()
        self.projects: Dict[str, Project] = {}
        for name in sorted(os.listdir(self.root)):
            if PROJECT_NAME.fullmatch(name) and ProjectDb.exists_in(os.path.join(self.root, name)):
                self._open(name)
        if not self.projects:
            self.add("default")

    # -- what projects share (services.project.Shared) -------------------------------------

    def remember_spelling(self, wrong: str, right: str) -> None:
        self.spellings.correct(wrong, right)

    def note_voice_fix(self, wrong: str, right: str, **where: Any) -> None:
        if self._voice_fix:
            self._voice_fix(wrong, right, **{k: v for k, v in where.items()})

    def input_moving(self, slug: str, rid: str) -> bool:
        return self.moves.moving(slug, rid)

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
                info = {"t": now_iso(), "title": p.title, "items": len(p.state.live_items())}
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
            out.append({"name": slug, "title": info.get("title") or slug, "t": info.get("t") or "", "items": info.get("items", 0)})
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
                st = p.state
                live = [i for i in st.live_items() if i.status not in CLOSED]
                # what needs you, as the page counts it: archived is not on the page's list, so not here
                needs = {i.n for i in live if not i.archived and rules.needs_you(st, i)}
                # "open" as the project's page counts it: what Items holds that isn't finished, rules an agent
                # proposed or that wait on you included
                open_ = sum(1 for i in live if not i.archived and (i.type != "rule" or i.status == "proposed" or i.n in needs))
                row: Dict[str, Any] = {"name": name, "title": p.title, "open": open_, "needs": len(needs), **presence(p),
                                       "t": int(p.store.changed_at() * 1000)}
                pos = self.order.position(name)
                if pos is not None:
                    row["pos"] = pos
                out.append(row)
        return out

    def needs(self) -> List[Dict[str, Any]]:
        """What needs you in every project, newest first."""
        out: List[Dict[str, Any]] = []
        for name, p in sorted(self.projects.items()):
            with p.lock:
                st = p.state
                for i in st.live_items():
                    if i.status in CLOSED or i.merged_into or i.archived:
                        continue
                    w = rules.waiting(st, i)
                    kind = w.kind if w else i.status if i.status in ("proposed", "review") and not rules.talked(st, i) else None
                    if kind:
                        out.append({"project": name, "ptitle": p.title, "n": i.n, "code": st.code(i.n), "title": i.title,
                                    "kind": kind, "pri": i.pri, "t": i.t1 or ""})
        return sorted(out, key=lambda x: x["t"], reverse=True)

    def search(self, q: str, skip: str = "") -> List[Dict[str, Any]]:
        """Words in every project but `skip`: items by code, title, text and talk, and what you said. Every word must
        be there. Newest first, at most 30."""
        words = [w for w in q.lower().split() if w][:8]
        out: List[Dict[str, Any]] = []
        if not words:
            return out
        for name, p in sorted(self.projects.items()):
            if name == skip:
                continue
            with p.lock:
                st = p.state
                for i in st.items.values():
                    if i.merged_into or i.deleted:
                        continue
                    hay = " ".join([st.code(i.n), i.title, i.body, i.next or "", *(x.text or "" for x in i.thread)]).lower()
                    if all(w in hay for w in words):
                        out.append({"project": name, "ptitle": p.title, "kind": "item", "code": st.code(i.n), "title": i.title,
                                    "status": i.status, "archived": i.archived, "t": i.t1 or i.t0 or ""})
                for r in st.inputs.values():
                    if not r.deleted and all(w in (r.id + " " + r.text).lower() for w in words):
                        out.append({"project": name, "ptitle": p.title, "kind": "input", "code": r.id, "title": r.text[:200],
                                    "t": r.t})
        return sorted(out, key=lambda x: x["t"], reverse=True)[:30]

    def close(self) -> None:
        for p in list(self.projects.values()):
            p.close()
