"""T453: Taska's log, the standard Python logger ("taska"). It prints to the terminal; with a file configured
(--log-db, by default logs.db in the data folder) it also writes every record to a plain SQLite table anyone can read:

  sqlite3 ~/.taska/logs.db "select t, level, source, kind, message from logs order by id desc limit 50"

The page logs too: it sends its records to POST /api/pagelog, and the server writes them through the same logger.
Extra fields go in `extra={"f": {...}}`: the common ones get their own columns, the rest stays whole in `data`.
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
from typing import Any, Dict, Optional

log = logging.getLogger("taska")

COLS = ("source", "kind", "project", "tab", "who", "ses", "item", "ms", "status")
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
        self.q: "queue.Queue[Dict[str, Any]]" = queue.Queue(maxsize=100_000)
        db = sqlite3.connect(path)
        cols = [r[1] for r in db.execute("PRAGMA table_info(logs)")]
        if cols and "message" not in cols:  # the first version's table: kept, with the new column names
            db.execute("ALTER TABLE logs RENAME COLUMN side TO source")
            db.execute("ALTER TABLE logs ADD COLUMN message TEXT")
        db.executescript(SCHEMA)
        db.commit()
        db.close()
        threading.Thread(target=self.write, daemon=True, name="log-db").start()

    def emit(self, record: logging.LogRecord) -> None:
        f: Dict[str, Any] = dict(getattr(record, "f", None) or {})
        row: Dict[str, Any] = {
            "t": f.pop("t", None) or datetime.fromtimestamp(record.created, timezone.utc).isoformat(timespec="milliseconds"),
            "level": record.levelname.lower(), "message": record.getMessage()}
        for c in COLS:
            v = f.pop(c, None)
            row[c] = v if v in (None, "") or c == "ms" else str(v)[:200]
        row["data"] = json.dumps(f, ensure_ascii=False, default=str) if f else None
        try:
            self.q.put_nowait(row)
        except queue.Full:
            pass

    def write(self) -> None:
        db = sqlite3.connect(self.path, timeout=30)
        db.execute("PRAGMA journal_mode=WAL")
        sql = (f"INSERT INTO logs (t, level, message, data, {', '.join(COLS)}) "
               f"VALUES (:t, :level, :message, :data, {', '.join(':' + c for c in COLS)})")
        while True:
            rows = [self.q.get()]
            while not self.q.empty() and len(rows) < 500:
                rows.append(self.q.get_nowait())
            try:
                with db:
                    db.executemany(sql, rows)
            except sqlite3.Error:
                pass  # the log never takes Taska down


def setup(db_path: Optional[str], level: str = "INFO") -> None:
    """The terminal at `level` (INFO: what is worth seeing scroll by), and every record into db_path if given."""
    log.setLevel(logging.DEBUG)
    log.propagate = False
    term = logging.StreamHandler(sys.stderr)
    term.setLevel(getattr(logging, level.upper(), logging.INFO))
    term.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s", "%Y-%m-%d %H:%M:%S"))
    log.handlers = [term]
    if db_path:
        os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
        log.addHandler(SQLiteHandler(db_path))
