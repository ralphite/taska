"""A project's data in one SQLite file (taska.db), with the standard library's sqlite3.

- `events`: the append-only change log, one row per change, in order. It is the truth: undo, history, Activity
  and tracing every change back to what you said all read it. A row is never changed or removed.
- `items`, `inputs`, `docs`: the current state, kept up to date with each change, so the project can be read
  (by a person, a backup, a tool) without replaying the log. Taska itself replays the log when it opens a project
  (it takes milliseconds) and checks that the state it keeps matches.
- `kv`: small things that change often and are not history: when each agent was last seen, what it read.

Attachments and voice notes stay plain files next to the database, in taska-files/.
"""

from __future__ import annotations

import json
import os
import sqlite3
import threading
from typing import Any, Dict, Iterable, Iterator, List, Optional, Set, Tuple

SCHEMA = """
CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY, k TEXT NOT NULL, t TEXT, by TEXT, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS items (n INTEGER PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS inputs (id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS docs (d INTEGER PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
"""
VERSION = "1"


def dumps(x: Any) -> str:
    return json.dumps(x, ensure_ascii=False, separators=(",", ":"))


class Db:
    """One project's database. Every call takes the lock: the server answers from many threads."""

    def __init__(self, path: str):
        self.path = path
        self.lock = threading.RLock()
        self.con = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
        self.con.execute("PRAGMA journal_mode=WAL")
        self.con.execute("PRAGMA synchronous=NORMAL")
        self.con.execute("PRAGMA busy_timeout=5000")
        self.con.executescript(SCHEMA)
        if self.meta("version") is None:
            self.set_meta("version", VERSION)
        self.closed = False

    # -- the change log --------------------------------------------------------

    def events(self) -> Iterator[Tuple[int, str]]:
        """Every change, in order: (seq, its JSON text)."""
        with self.lock:
            rows = self.con.execute("SELECT seq, data FROM events ORDER BY seq").fetchall()
        for seq, data in rows:
            yield int(seq), str(data)

    def count(self) -> int:
        with self.lock:
            return int(self.con.execute("SELECT COUNT(*) FROM events").fetchone()[0])

    def append(self, seq: int, e: Dict[str, Any], state: Optional["StateRows"] = None) -> None:
        """One change, with the rows of the current state it changed, in one transaction."""
        row = {k: v for k, v in e.items() if k != "seq"}
        with self.lock:
            self.con.execute("BEGIN IMMEDIATE")
            try:
                self.con.execute("INSERT INTO events (seq, k, t, by, data) VALUES (?, ?, ?, ?, ?)",
                                 (seq, str(e.get("k", "")), e.get("t"), e.get("by"), dumps(row)))
                if state:
                    self._write_state(state)
                    self.con.execute("INSERT OR REPLACE INTO meta (k, v) VALUES ('state_seq', ?)", (str(seq),))
                self.con.execute("COMMIT")
            except BaseException:
                self.con.execute("ROLLBACK")
                raise

    def append_many(self, lines: Iterable[Tuple[int, Dict[str, Any]]]) -> int:
        """Many changes at once (the import of an old log): (seq, event)."""
        n = 0
        with self.lock:
            self.con.execute("BEGIN IMMEDIATE")
            try:
                for seq, e in lines:
                    row = {k: v for k, v in e.items() if k != "seq"}
                    self.con.execute("INSERT INTO events (seq, k, t, by, data) VALUES (?, ?, ?, ?, ?)",
                                     (seq, str(e.get("k", "")), e.get("t"), e.get("by"), dumps(row)))
                    n += 1
                self.con.execute("COMMIT")
            except BaseException:
                self.con.execute("ROLLBACK")
                raise
        return n

    # -- the current state -----------------------------------------------------

    def _write_state(self, state: "StateRows") -> None:
        for table, key, rows, gone in (("items", "n", state.items, state.items_gone), ("inputs", "id", state.inputs, state.inputs_gone),
                                       ("docs", "d", state.docs, state.docs_gone)):
            if rows:
                self.con.executemany(f"INSERT OR REPLACE INTO {table} ({key}, data) VALUES (?, ?)", list(rows.items()))
            if gone:
                self.con.executemany(f"DELETE FROM {table} WHERE {key} = ?", [(k,) for k in gone])

    def write_state(self, state: "StateRows", seq: int, full: bool = False) -> None:
        with self.lock:
            self.con.execute("BEGIN IMMEDIATE")
            try:
                if full:
                    for table in ("items", "inputs", "docs"):
                        self.con.execute(f"DELETE FROM {table}")
                self._write_state(state)
                self.con.execute("INSERT OR REPLACE INTO meta (k, v) VALUES ('state_seq', ?)", (str(seq),))
                self.con.execute("COMMIT")
            except BaseException:
                self.con.execute("ROLLBACK")
                raise

    def read_state(self) -> Dict[str, Dict[Any, Any]]:
        with self.lock:
            return {
                "items": {int(n): json.loads(d) for n, d in self.con.execute("SELECT n, data FROM items")},
                "inputs": {str(i): json.loads(d) for i, d in self.con.execute("SELECT id, data FROM inputs")},
                "docs": {int(n): json.loads(d) for n, d in self.con.execute("SELECT d, data FROM docs")},
            }

    # -- small things ----------------------------------------------------------

    def get(self, k: str) -> Any:
        with self.lock:
            row = self.con.execute("SELECT v FROM kv WHERE k = ?", (k,)).fetchone()
        return json.loads(row[0]) if row else None

    def put(self, k: str, v: Any) -> None:
        with self.lock:
            if not self.closed:
                self.con.execute("INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)", (k, dumps(v)))

    def meta(self, k: str) -> Optional[str]:
        with self.lock:
            row = self.con.execute("SELECT v FROM meta WHERE k = ?", (k,)).fetchone()
        return str(row[0]) if row else None

    def set_meta(self, k: str, v: str) -> None:
        with self.lock:
            self.con.execute("INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)", (k, v))

    def close(self) -> None:
        with self.lock:
            if not self.closed:
                self.closed = True
                self.con.close()


class StateRows:
    """The rows of the current state one change wrote: by key, and the keys that went."""

    def __init__(self) -> None:
        self.items: Dict[int, str] = {}  # key -> the row's JSON text
        self.inputs: Dict[str, str] = {}
        self.docs: Dict[int, str] = {}
        self.items_gone: Set[int] = set()
        self.inputs_gone: Set[str] = set()
        self.docs_gone: Set[int] = set()

    def __bool__(self) -> bool:
        return bool(self.items or self.inputs or self.docs or self.items_gone or self.inputs_gone or self.docs_gone)


def db_path(folder: str) -> str:
    return os.path.join(folder, "taska.db")


def is_project(folder: str) -> bool:
    return os.path.isfile(db_path(folder))


def list_events(path: str) -> List[Dict[str, Any]]:
    """The change log of a database, as events (for tools and tests)."""
    db = Db(path)
    try:
        return [dict(json.loads(d), seq=s) for s, d in db.events()]
    finally:
        db.close()
