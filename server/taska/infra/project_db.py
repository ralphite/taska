"""One project's SQLite file (taska.db): the change log, the current state rows, and small values.

- `events`: the append-only change log, one row per change, in order; never changed or removed.
- `items`, `inputs`, `docs`: the current state, kept within a second of the log, so the project can be read
  without Taska.
- `kv`: what changes often and is not history (when each agent was last seen, what it read).
- `meta`: the format version, and how far the state rows follow the log.

The tables and their rows are the durable storage format.
"""

from __future__ import annotations

import json
import os
import sqlite3
import threading
from dataclasses import dataclass, field
from typing import Any, Dict, Iterator, List, Optional, Set, Tuple

SCHEMA = """
CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY, k TEXT NOT NULL, t TEXT, by TEXT, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS items (n INTEGER PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS inputs (id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS docs (d INTEGER PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
"""
FORMAT_VERSION = "1"
FILE_NAME = "taska.db"


def dumps(x: Any) -> str:
    return json.dumps(x, ensure_ascii=False, separators=(",", ":"))


@dataclass
class StateRows:
    """Rows of the current state to write (key -> JSON text), and the keys that went."""

    items: Dict[int, str] = field(default_factory=dict)
    inputs: Dict[str, str] = field(default_factory=dict)
    docs: Dict[int, str] = field(default_factory=dict)
    items_gone: Set[int] = field(default_factory=set)
    inputs_gone: Set[str] = field(default_factory=set)
    docs_gone: Set[int] = field(default_factory=set)

    def __bool__(self) -> bool:
        return bool(self.items or self.inputs or self.docs or self.items_gone or self.inputs_gone or self.docs_gone)

    def tables(self) -> List[Tuple[str, str, Dict[Any, str], Set[Any]]]:
        return [("items", "n", self.items, self.items_gone), ("inputs", "id", self.inputs, self.inputs_gone),
                ("docs", "d", self.docs, self.docs_gone)]


class ProjectDb:
    """The file of one project. Every call takes the lock: requests come from many threads."""

    def __init__(self, folder: str):
        self.path = os.path.join(folder, FILE_NAME)
        self._lock = threading.RLock()
        self._con = sqlite3.connect(self.path, check_same_thread=False, isolation_level=None)
        self._con.execute("PRAGMA journal_mode=WAL")
        self._con.execute("PRAGMA synchronous=NORMAL")
        self._con.execute("PRAGMA busy_timeout=5000")
        self._con.executescript(SCHEMA)
        if self._meta("version") is None:
            self._set_meta("version", FORMAT_VERSION)
        self.closed = False

    @staticmethod
    def exists_in(folder: str) -> bool:
        return os.path.isfile(os.path.join(folder, FILE_NAME))

    # -- the log ----------------------------------------------------------------

    def rows(self) -> Iterator[Tuple[int, Optional[Dict[str, Any]], str]]:
        """Every change in order: (seq, its row, or None when it is not JSON, the stored text)."""
        with self._lock:
            stored = self._con.execute("SELECT seq, data FROM events ORDER BY seq").fetchall()
        for seq, data in stored:
            try:
                row = json.loads(data)
            except ValueError:
                row = None
            yield int(seq), row if isinstance(row, dict) else None, str(data)

    def append(self, seq: int, row: Dict[str, Any]) -> None:
        """One change, at the end of the log."""
        with self._lock:
            self._con.execute("INSERT INTO events (seq, k, t, by, data) VALUES (?, ?, ?, ?, ?)",
                              (seq, str(row.get("k", "")), row.get("t"), row.get("by"), dumps(row)))

    def next_seq(self) -> int:
        with self._lock:
            got = self._con.execute("SELECT MAX(seq) FROM events").fetchone()[0]
        return int(got or 0) + 1

    # -- the current state -------------------------------------------------------

    def write_state(self, rows: StateRows, seq: int, full: bool = False) -> None:
        with self._lock:
            if self.closed:
                return
            self._con.execute("BEGIN IMMEDIATE")
            try:
                for table, key, fresh, gone in rows.tables():
                    if full:
                        self._con.execute(f"DELETE FROM {table}")
                    if fresh:
                        self._con.executemany(f"INSERT OR REPLACE INTO {table} ({key}, data) VALUES (?, ?)",
                                              list(fresh.items()))
                    if gone:
                        self._con.executemany(f"DELETE FROM {table} WHERE {key} = ?", [(k,) for k in gone])
                self._con.execute("INSERT OR REPLACE INTO meta (k, v) VALUES ('state_seq', ?)", (str(seq),))
                self._con.execute("COMMIT")
            except BaseException:
                self._con.execute("ROLLBACK")
                raise

    # -- small values --------------------------------------------------------------

    def get(self, k: str) -> Any:
        with self._lock:
            row = self._con.execute("SELECT v FROM kv WHERE k = ?", (k,)).fetchone()
        return json.loads(row[0]) if row else None

    def put(self, k: str, v: Any) -> None:
        with self._lock:
            if not self.closed:
                self._con.execute("INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)", (k, dumps(v)))

    def _meta(self, k: str) -> Optional[str]:
        row = self._con.execute("SELECT v FROM meta WHERE k = ?", (k,)).fetchone()
        return str(row[0]) if row else None

    def _set_meta(self, k: str, v: str) -> None:
        self._con.execute("INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)", (k, v))

    def changed_at(self) -> float:
        """When the file last changed on disk."""
        t = 0.0
        for p in (self.path, self.path + "-wal"):
            try:
                t = max(t, os.path.getmtime(p))
            except OSError:
                pass
        return t

    def close(self) -> None:
        with self._lock:
            if not self.closed:
                self.closed = True
                self._con.close()
