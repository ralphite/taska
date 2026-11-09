"""Once, at start: every project's log (the deleted ones' too) in the format of today (domain.migration), each file
copied beside itself first. A log is written only when what it leaves is the same as before, but for what the
migration means to change; otherwise it stays as it is and the line says why."""

from __future__ import annotations

import os
import time
from typing import Iterator, List, Optional

from ..domain import migration
from ..domain.projection import replay
from ..domain.vocab import PROJECT_NAME
from ..infra.project_db import FORMAT_VERSION, ProjectDb


def folders(root: str) -> Iterator[str]:
    """The projects' folders, the deleted ones' too."""
    for parent in (root, os.path.join(root, ".deleted")):
        if not os.path.isdir(parent) or os.path.islink(parent):
            continue
        for name in sorted(os.listdir(parent)):
            folder = os.path.join(parent, name)
            if PROJECT_NAME.fullmatch(name) and not os.path.islink(folder) and ProjectDb.exists_in(folder):
                yield folder


def migrate(folder: str, name: str = "", stamp: Optional[str] = None) -> Optional[str]:
    """One project's log -> a line saying what became of it, by its name (None: it was in today's format)."""
    name = name or os.path.basename(folder)
    db = ProjectDb(folder)
    try:
        if db.version == FORMAT_VERSION:
            return None
        stored = list(db.rows())
        if any(row is None for _, row, _ in stored):
            return f"{name}: left as it is: a change in it is not JSON"
        rows = [row for _, row, _ in stored if row is not None]
        why = migration.unready(rows)
        if why:
            return f"{name}: left for the next start: {why}"
        new, counts, retried = migration.rewrite(rows)
        quiet = lambda seq, what: None  # noqa: E731  (the same changes are skipped either way)
        if migration.snapshot(replay(rows, quiet), retried) != migration.snapshot(replay(new, quiet), retried):
            return f"{name}: left as it is: rewritten, its log would not leave the same records"
        changed = {seq: b for (seq, a, _), b in zip(stored, new) if a != b}
        copy = ""
        if changed:
            copy = os.path.join(folder, f"taska-format{db.version}-{stamp or time.strftime('%Y%m%d-%H%M%S')}.db")
            db.backup(copy)
        db.rewrite(changed, FORMAT_VERSION)
        what = ", ".join(f"{n} {k}" for k, n in sorted(counts.items())) or "nothing to rewrite"
        return (f"{name}: log in format {FORMAT_VERSION}: {len(changed)} of {len(rows)} changes rewritten ({what})"
                + (f"; the file as it was: {os.path.basename(copy)}" if copy else ""))
    finally:
        db.close()


def migrate_all(root: str) -> List[str]:
    """Every project under the data root -> a line for each that was not in today's format."""
    stamp = time.strftime("%Y%m%d-%H%M%S")
    return [line for line in (migrate(f, os.path.relpath(f, root), stamp) for f in folders(root)) if line]
