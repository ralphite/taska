"""Once, at start: every project's log (the deleted ones' and the shared rules' too) in the format of today, each file
copied beside itself first. Format 3 (T863): the older codes of items in what was written are T codes
(domain.code_migration). A log is written only when it leaves the same items, inputs and documents as before; else it
stays as it is and the line says why (and the project is not opened: its format is not today's)."""

from __future__ import annotations

import os
import time
from typing import Any, Iterator, List, Optional, Tuple

from ..domain import code_migration
from ..domain.projection import replay
from ..infra.project_db import FORMAT_VERSION, ProjectDb

PLACES = ("", ".deleted", ".shared-rules")  # the projects, the deleted ones, the shared rules (I779)


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
    """What a log leaves, but for its words: each item's place and state, the inputs, the documents."""
    st = replay(rows, lambda seq, why: None)
    items = tuple(sorted((i.n, i.status, i.parent, tuple(i.tags), i.group, i.archived, i.deleted, i.merged_into)
                         for i in st.items.values()))
    return items, tuple(sorted(st.inputs)), tuple(sorted(st.docs)), len(st.events)


def migrate(folder: str, name: str = "", stamp: Optional[str] = None) -> Optional[str]:
    """One project's log -> a line saying what became of it, by its name (None: it was in today's format)."""
    name = name or os.path.basename(folder)
    db = ProjectDb(folder)
    try:
        if db.version == FORMAT_VERSION:
            return None
        if db.version != "2":
            return f"{name}: left as it is: its log is in format {db.version}, not 2"
        stored = list(db.rows())
        if any(row is None for _, row, _ in stored):
            return f"{name}: left as it is: a change in it is not JSON"
        rows = [row for _, row, _ in stored if row is not None]
        new, kv, count = code_migration.rewrite(rows, db.kv())
        if records(rows) != records(new):
            return f"{name}: left as it is: rewritten, its log would not leave the same records"
        changed = {seq: b for (seq, a, _), b in zip(stored, new) if a != b}
        copy = ""
        if changed or kv:
            copy = os.path.join(folder, f"taska-format{db.version}-{stamp or time.strftime('%Y%m%d-%H%M%S')}.db")
            db.backup(copy)
        db.rewrite(changed, kv, FORMAT_VERSION)
        return (f"{name}: log in format {FORMAT_VERSION}: {count} older codes made T codes in {len(changed)} of "
                f"{len(rows)} changes" + (f"; the file as it was: {os.path.basename(copy)}" if copy else ""))
    finally:
        db.close()


def migrate_all(root: str) -> List[str]:
    """Every project under the data root -> a line for each that was not in today's format."""
    stamp = time.strftime("%Y%m%d-%H%M%S")
    return [line for line in (migrate(f, os.path.relpath(f, root), stamp) for f in folders(root)) if line]
