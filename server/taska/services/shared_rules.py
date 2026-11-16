"""Shared rules (I779, D134): documents kept once for the whole Taska, each with a name, that a project's rules put in
by a line `{{name}}`. Each is kept as a small project of its own that only holds its rules document, so it has
versions, comments, History and the editor as a project's rules have, and the page opens it as it opens the Rules
tab. They are not projects: no list, count, search, agent or organizer sees them.

    <root>/.shared-rules/<id>/taska.db     one shared rule; its address is ~<id> (never a project's)
"""

from __future__ import annotations

import os
import secrets
import threading
from typing import Any, Dict, List, Mapping, Optional, Tuple

from ..domain import includes, skills, versions
from ..domain.vocab import SLUG_CHARS
from ..infra.project_db import ProjectDb
from .project import Project, Shared

FOLDER = ".shared-rules"
MARK = "~"  # a shared rule's address starts with it; a project's never does


def is_shared_slug(slug: str) -> bool:
    return slug.startswith(MARK)


class SharedRules:
    def __init__(self, root: str, shared: Optional[Shared] = None):
        self.folder = os.path.join(root, FOLDER)
        self._shared = shared
        self._lock = threading.Lock()
        self.rules: Dict[str, Project] = {}
        self._now: Dict[str, Tuple[str, str]] = {}  # slug -> (name, text) as last changed: the skills, read lock-free
        for name in sorted(os.listdir(self.folder)) if os.path.isdir(self.folder) else []:
            if all(c in SLUG_CHARS for c in name) and ProjectDb.exists_in(os.path.join(self.folder, name)):
                self.refresh(self._open(name).slug)

    def _open(self, name: str) -> Project:
        p = Project(os.path.join(self.folder, name), MARK + name, shared=self._shared)
        p.holds_shared = True
        self.rules[p.slug] = p
        return p

    def refresh(self, slug: str) -> None:
        """One has changed (its lock held, or no one else has it yet): what skills() gives (I821)."""
        p = self.rules.get(slug)
        if p is not None:
            now = dict(self._now)
            now[slug] = (p.title, p.state.rules.md if p.state.rules else "")
            self._now = now  # replaced whole: a reader never sees it half made

    def skills(self) -> Dict[str, str]:
        """The skills (shared documents named /name), by name, as they were last changed."""
        return skills.skills_of({name: md for name, md in self._now.values()})

    def get(self, slug: str) -> Optional[Project]:
        return self.rules.get(slug)

    def names(self) -> List[str]:
        return [p.title for p in self._ordered()]

    def _ordered(self) -> List[Project]:
        return sorted(self.rules.values(), key=lambda p: includes.norm(p.title))

    def add(self, name: Any) -> Project:
        """New shared rules, empty, by a name no other has."""
        with self._lock:
            title = includes.check_name(name, self.names())
            os.makedirs(self.folder, exist_ok=True)
            while True:
                rid = "".join(secrets.choice(SLUG_CHARS) for _ in range(5))
                if not os.path.exists(os.path.join(self.folder, rid)):
                    break
            os.makedirs(os.path.join(self.folder, rid))
            p = self._open(rid)
        p.run([(0, {"op": "cfg", "name": title})], "you")
        return p

    def texts(self) -> Dict[str, str]:
        """Each shared rule's text now, by its name: what a project's lines put in."""
        out: Dict[str, str] = {}
        for p in self._ordered():
            with p.lock:
                out[p.title] = p.state.rules.md if p.state.rules else ""
        return out

    def listing(self, projects: Mapping[str, Project]) -> List[Dict[str, Any]]:
        """What the page shows of each: its name and address, its text and the sections a line can name, its version
        (who, when), and which projects put it in, with the line."""
        rows: List[Tuple[Project, str, Dict[str, Any]]] = []
        for p in self._ordered():
            with p.lock:
                d = p.state.rules
                vs = versions.versions(p.state, d) if d else []
                md = d.md if d else ""
                row: Dict[str, Any] = {"slug": p.slug, "name": p.title, "md": md,
                                       "parts": [{"name": x.name, "title": x.title, "md": x.md} for x in includes.parts(md)]}
                if vs:
                    row.update(v=vs[-1].v, by=vs[-1].by, t=vs[-1].t)
                rows.append((p, p.title, row))
        texts: Dict[str, Tuple[str, str]] = {}
        for slug, q in sorted(projects.items()):
            with q.lock:
                texts[slug] = (q.title, q.state.rules.md if q.state.rules else "")
        used = includes.used_by(texts, [n for _, n, _ in rows])
        for _, n, row in rows:
            row["used"] = [{"project": s, "title": t, "line": line} for s, t, line in used[n]]
        return [row for _, _, row in rows]

    def close(self) -> None:
        for p in list(self.rules.values()):
            p.close()

