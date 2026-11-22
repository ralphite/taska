"""Once, at start: every project's log (the deleted ones' and the shared rules' too) in the format of today, each file
copied beside itself first. Format 3 (T863): the older codes of tasks in what was written are T codes
(domain.code_migration); format 4 (T864): the current tasks are kept in the table `tasks`, not `items`. A log is
written only when it leaves the same tasks, inputs and documents as before; else it
stays as it is and the line says why (and the project is not opened: its format is not today's)."""

from __future__ import annotations

import os
import time
from typing import Any, Iterator, List, Optional, Tuple

from ..domain import code_migration
from ..domain.projection import replay
from ..infra.project_db import FORMAT_VERSION, ProjectDb

PLACES = ("", ".deleted", ".shared-rules")  # the projects, the deleted ones, the shared rules (T779)


def folders(root: str) -> Iterator[str]:
    """Every project's folder under the data root."""
    for place in PLACES:
        parent = os.path.join(root, place) if place else root
        if not os.path.isdir(parent) or os.path.islink(parent):
            continue
        for name in sorted(os.listdir(parent)):
            folder = os.path.join(parent, name)
            if not name.startswith(".") and not os.path.islink(folder) and ProjectDb.exists_in(folder):
                yield folder


def records(rows: List[dict]) -> Tuple[Any, ...]:
    """What a log leaves, but for its words: each task's place and state, the inputs, the documents."""
    st = replay(rows, lambda seq, why: None)
    tasks = tuple(sorted((i.n, i.status, i.parent, tuple(i.tags), i.group, i.archived, i.deleted, i.merged_into)
                         for i in st.tasks.values()))
    return tasks, tuple(sorted(st.inputs)), tuple(sorted(st.docs)), len(st.events)


def migrate(folder: str, name: str = "", stamp: Optional[str] = None) -> Optional[str]:
    """One project's log -> a line saying what became of it, by its name (None: it was in today's format). Each format
    after its own goes in turn, from one copy of the file made first."""
    name = name or os.path.basename(folder)
    db = ProjectDb(folder)
    try:
        if db.version == FORMAT_VERSION:
            return None
        if db.version not in ("2", "3"):
            return f"{name}: left as it is: its log is in format {db.version}, not 2 or 3"
        copy = os.path.join(folder, f"taska-format{db.version}-{stamp or time.strftime('%Y%m%d-%H%M%S')}.db")
        db.backup(copy)
        said = []
        if db.version == "2":
            stored = list(db.rows())
            if any(row is None for _, row, _ in stored):
                return f"{name}: left as it is: a change in it is not JSON"
            rows = [row for _, row, _ in stored if row is not None]
            new, kv, count = code_migration.rewrite(rows, db.kv())
            if records(rows) != records(new):
                return f"{name}: left as it is: rewritten, its log would not leave the same records"
            changed = {seq: b for (seq, a, _), b in zip(stored, new) if a != b}
            db.rewrite(changed, kv, "3")
            said.append(f"{count} older codes made T codes in {len(changed)} of {len(rows)} changes")
        if db.version == "3":
            db.drop_items("4")
            said.append("its current tasks in the table tasks")
        return f"{name}: log in format {FORMAT_VERSION}: " + "; ".join(said) + f"; the file as it was: {os.path.basename(copy)}"
    finally:
        db.close()


def migrate_all(root: str) -> List[str]:
    """Every project under the data root -> a line for each that was not in today's format."""
    stamp = time.strftime("%Y%m%d-%H%M%S")
    return [line for line in (migrate(f, os.path.relpath(f, root), stamp) for f in folders(root)) if line]
