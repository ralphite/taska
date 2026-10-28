"""A project's stored changes: the log in its file, the state replayed from it, and the state rows in the file kept in
step with the state.

`commit` is the one way a change gets in: the log first (a change in the log is never lost), then the state. The
state rows follow within a second; only the rows that changed are written.
"""

from __future__ import annotations

import threading
from typing import Any, Callable, Dict, Mapping, Optional, Set

from ..domain import events as ev
from ..domain.projection import apply, replay
from ..domain.state import ProjectState
from ..infra.project_db import ProjectDb, StateRows, dumps

Warn = Callable[[int, str], None]


class WrittenRows:
    """The JSON of every state row as last written, so a write takes only what changed since."""

    def __init__(self) -> None:
        self._was: Dict[str, Dict[Any, str]] = {"items": {}, "inputs": {}, "docs": {}}

    def since(self, state: ProjectState, full: bool) -> StateRows:
        rows = StateRows()
        self._table("items", state.items, rows.items, rows.items_gone, full)
        self._table("inputs", state.inputs, rows.inputs, rows.inputs_gone, full)
        self._table("docs", state.docs, rows.docs, rows.docs_gone, full)
        return rows

    def _table(self, name: str, records: Mapping[Any, Any], fresh: Dict[Any, str], gone: Set[Any], full: bool) -> None:
        was = self._was[name]
        now = {k: dumps(v.to_row()) for k, v in records.items()}
        fresh.update((k, text) for k, text in now.items() if full or was.get(k) != text)
        gone.update(k for k in was if k not in now)
        self._was[name] = now


class ProjectStore:
    def __init__(self, folder: str, lock: threading.RLock, warn: Warn):
        self._lock = lock
        self.db = ProjectDb(folder)
        rows = []
        for seq, row, _ in self.db.rows():
            if row is None:
                warn(seq, "skipped: it is not a change")
            else:
                rows.append(row)
        self.state = replay(rows, warn)
        self._written = WrittenRows()
        self._flusher: Optional[threading.Timer] = None
        self.write_state(full=True)

    @property
    def path(self) -> str:
        return self.db.path

    @property
    def count(self) -> int:
        """How many changes the log holds."""
        return len(self.state.events)

    def commit(self, event: ev.Event) -> None:
        """Into the log, then the state. The caller holds the project's lock."""
        self.db.append(self.count + 1, event.to_row())
        apply(self.state, event)
        self._soon_write()

    def write_state(self, full: bool = False) -> None:
        """Write the rows of the current state that changed since the last write (all of them with full)."""
        with self._lock:
            if self.db.closed:
                return
            rows = self._written.since(self.state, full)
            if rows or full:
                self.db.write_state(rows, self.count, full=full)

    def _soon_write(self) -> None:
        if self._flusher and self._flusher.is_alive():
            return
        self._flusher = threading.Timer(1.0, self.write_state)
        self._flusher.daemon = True
        self._flusher.start()

    def changed_at(self) -> float:
        return self.db.changed_at()

    def close(self) -> None:
        with self._lock:
            if self._flusher:
                self._flusher.cancel()
            self.write_state()
            self.db.close()
