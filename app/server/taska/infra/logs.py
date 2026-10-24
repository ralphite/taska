"""Taska's log: the standard Python logger "taska", printed to the terminal and, when a file is given (by default
logs.db in the data folder), written to a plain SQLite table anyone can read:

  sqlite3 ~/.taska/logs.db "select t, level, source, kind, message from logs order by id desc limit 50"

Extra fields go in `extra={"f": {...}}`: the common ones get their own columns, the rest stays whole in `data`.
A word a voice note got wrong and someone corrected is a record of kind "voicefix".
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

COLUMNS = ("source", "kind", "project", "tab", "who", "ses", "item", "ms", "status")
SCHEMA = """
CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY, t TEXT NOT NULL, level TEXT NOT NULL, source TEXT, kind TEXT,
  project TEXT, tab TEXT, who TEXT, ses TEXT, item TEXT, ms INTEGER, status TEXT, message TEXT, data TEXT);
CREATE INDEX IF NOT EXISTS logs_t ON logs (t);
"""


class SQLiteHandler(logging.Handler):
    """Writes records to a SQLite file from a thread of its own, so logging never holds a request up."""

    def __init__(self, path: str):
        super().__init__(logging.DEBUG)
        self.path = path
        self._queue: "queue.Queue[Dict[str, Any]]" = queue.Queue(maxsize=100_000)
        db = sqlite3.connect(path)
        columns = [r[1] for r in db.execute("PRAGMA table_info(logs)")]
        if columns and "message" not in columns:  # the first version's table, kept with the new column names
            db.execute("ALTER TABLE logs RENAME COLUMN side TO source")
            db.execute("ALTER TABLE logs ADD COLUMN message TEXT")
        db.executescript(SCHEMA)
        db.commit()
        db.close()
        threading.Thread(target=self._write, daemon=True, name="log-db").start()

    def emit(self, record: logging.LogRecord) -> None:
        f: Dict[str, Any] = dict(getattr(record, "f", None) or {})
        row: Dict[str, Any] = {
            "t": f.pop("t", None) or datetime.fromtimestamp(record.created, timezone.utc).isoformat(timespec="milliseconds"),
            "level": record.levelname.lower(), "message": record.getMessage()}
        for c in COLUMNS:
            v = f.pop(c, None)
            row[c] = v if v in (None, "") or c == "ms" else str(v)[:200]
        row["data"] = json.dumps(f, ensure_ascii=False, default=str) if f else None
        try:
            self._queue.put_nowait(row)
        except queue.Full:
            pass

    def _write(self) -> None:
        db = sqlite3.connect(self.path, timeout=30)
        db.execute("PRAGMA journal_mode=WAL")
        sql = (f"INSERT INTO logs (t, level, message, data, {', '.join(COLUMNS)}) "
               f"VALUES (:t, :level, :message, :data, {', '.join(':' + c for c in COLUMNS)})")
        while True:
            rows = [self._queue.get()]
            while not self._queue.empty() and len(rows) < 500:
                rows.append(self._queue.get_nowait())
            try:
                with db:
                    db.executemany(sql, rows)
            except sqlite3.Error:
                pass  # the log never takes Taska down
            for _ in rows:
                self._queue.task_done()

    def flush(self) -> None:
        self._queue.join()


class LogFile:
    """Where the records go, so the dashboard can read them back."""

    def __init__(self) -> None:
        self.path: Optional[str] = None


LOG_FILE = LogFile()


def setup(db_path: Optional[str], level: str = "INFO") -> None:
    """The terminal at `level`, and every record into db_path if given."""
    LOG_FILE.path = db_path or None
    log.setLevel(logging.DEBUG)
    log.propagate = False
    term = logging.StreamHandler(sys.stderr)
    term.setLevel(getattr(logging, level.upper(), logging.INFO))
    term.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s", "%Y-%m-%d %H:%M:%S"))
    handlers: List[logging.Handler] = [term]
    if db_path:
        os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
        handlers.append(SQLiteHandler(db_path))
    log.handlers = handlers


def voice_fix(wrong: str, right: str, **f: Any) -> None:
    """A voice note heard `wrong` where the speaker said `right` (project, item, input, file, who, via)."""
    log.info(f"voice fix: {wrong} -> {right}", extra={"f": dict(source="server", kind="voicefix", wrong=wrong, right=right, **f)})
