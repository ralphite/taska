"""Taska's log: the standard Python logger "taska", shown in the terminal and kept, when a file is given (by default
logs.db in the data folder), in a plain SQLite table anyone can read:

  sqlite3 ~/.taska/logs.db "select t, level, source, kind, message from logs order by id desc limit 50"

A record's extra fields go in `extra={"f": {...}}`: the common ones get their own columns, the rest stays whole in
`data`. A word a voice note got wrong and someone corrected is a record of kind "voicefix". The table is written
from a thread of its own, so logging never holds a request up, and never takes Taska down.
"""

from __future__ import annotations

import json
import logging
import os
import queue
import sqlite3
import sys
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

log = logging.getLogger("taska")

# the table, as it is in every logs.db there is (its columns are what people's queries name)
FIELDS = ("source", "kind", "project", "tab", "who", "ses", "item", "ms", "status")
TABLE = """
CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY, t TEXT NOT NULL, level TEXT NOT NULL, source TEXT, kind TEXT,
  project TEXT, tab TEXT, who TEXT, ses TEXT, item TEXT, ms INTEGER, status TEXT, message TEXT, data TEXT);
CREATE INDEX IF NOT EXISTS logs_t ON logs (t);
"""
INSERT = "INSERT INTO logs (t, level, message, data, {0}) VALUES (:t, :level, :message, :data, {1})".format(
    ", ".join(FIELDS), ", ".join(":" + c for c in FIELDS))


def row_of(record: logging.LogRecord) -> Dict[str, Any]:
    """A record as a row of the table: its own fields in their columns (cut to 200 characters), the rest as JSON."""
    extra: Dict[str, Any] = dict(getattr(record, "f", None) or {})
    when = extra.pop("t", None) or datetime.fromtimestamp(record.created, timezone.utc).isoformat(timespec="milliseconds")
    row: Dict[str, Any] = {"t": when, "level": record.levelname.lower(), "message": record.getMessage()}
    for name in FIELDS:
        value = extra.pop(name, None)
        row[name] = value if name == "ms" or value in (None, "") else str(value)[:200]
    row["data"] = json.dumps(extra, ensure_ascii=False, default=str) if extra else None
    return row


def open_table(path: str) -> None:
    """The file with its table; a table of the first version gets its columns' later names."""
    with sqlite3.connect(path) as db:
        have = {r[1] for r in db.execute("PRAGMA table_info(logs)")}
        if have and "message" not in have:
            db.execute("ALTER TABLE logs RENAME COLUMN side TO source")
            db.execute("ALTER TABLE logs ADD COLUMN message TEXT")
        db.executescript(TABLE)
    db.close()


class TableWriter:
    """Rows waiting to go into the table, written in batches by one thread. Rows beyond what it can hold are let go."""

    def __init__(self, path: str, room: int = 100_000, batch: int = 500):
        self.path, self.batch = path, batch
        self.waiting: "queue.Queue[Dict[str, Any]]" = queue.Queue(maxsize=room)
        threading.Thread(target=self._run, daemon=True, name="log-db").start()

    def add(self, row: Dict[str, Any]) -> None:
        try:
            self.waiting.put_nowait(row)
        except queue.Full:
            pass

    def _run(self) -> None:
        db = sqlite3.connect(self.path, timeout=30)
        db.execute("PRAGMA journal_mode=WAL")
        while True:
            rows = [self.waiting.get()]
            while len(rows) < self.batch:
                try:
                    rows.append(self.waiting.get_nowait())
                except queue.Empty:
                    break
            try:
                with db:
                    db.executemany(INSERT, rows)
            except sqlite3.Error:
                pass
            for _ in rows:
                self.waiting.task_done()

    def wait(self) -> None:
        """Until every row given so far is in the table."""
        self.waiting.join()


class TableHandler(logging.Handler):
    """The logger's way into the table."""

    def __init__(self, writer: TableWriter):
        super().__init__(logging.DEBUG)
        self.writer = writer

    def emit(self, record: logging.LogRecord) -> None:
        self.writer.add(row_of(record))

    def flush(self) -> None:
        self.writer.wait()


_DB: List[Optional[str]] = [None]


def db_path() -> Optional[str]:
    """The SQLite file the log goes into, if any."""
    return _DB[0]


def setup(db_path: Optional[str], level: str = "INFO") -> None:
    """The terminal at `level`, and every record into db_path when there is one."""
    _DB[0] = db_path or None
    terminal = logging.StreamHandler(sys.stderr)
    terminal.setLevel(getattr(logging, level.upper(), logging.INFO))
    terminal.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s", "%Y-%m-%d %H:%M:%S"))
    handlers: List[logging.Handler] = [terminal]
    if db_path:
        os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
        open_table(db_path)
        handlers.append(TableHandler(TableWriter(db_path)))
    log.setLevel(logging.DEBUG)
    log.propagate = False
    log.handlers = handlers


def voice_fix(wrong: str, right: str, **f: Any) -> None:
    """A voice note heard `wrong` where the speaker said `right` (project, item, input, file, who, via)."""
    log.info(f"voice fix: {wrong} -> {right}", extra={"f": dict(source="server", kind="voicefix", wrong=wrong, right=right, **f)})
