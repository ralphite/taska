"""T453: everything that happens, from the page and from the server, in one table to query later (logs.db in the data
folder, shared by every project).

The columns are what is asked most (when, which side, what kind, how bad, which project, tab, who, session, item,
how long, status); everything else of a row stays whole in `data` (JSON). Rows are written by a background thread,
so logging never slows a request. Kept 90 days, and at most about 1 GB: the oldest go first.

  python3 -m taska logs --since 2h --kind error          (see `python3 -m taska logs -h`)
"""

from __future__ import annotations

import json
import os
import sqlite3
import threading
import time
from collections import deque
from datetime import datetime, timedelta, timezone
from typing import Any, Deque, Dict, List, Optional

SCHEMA = """
CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY, t TEXT NOT NULL, side TEXT NOT NULL, kind TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info', project TEXT, tab TEXT, who TEXT, ses TEXT, item TEXT, ms INTEGER, status TEXT,
  data TEXT);
CREATE INDEX IF NOT EXISTS logs_t ON logs (t);
CREATE INDEX IF NOT EXISTS logs_kind ON logs (kind, t);
CREATE INDEX IF NOT EXISTS logs_tab ON logs (tab, t);
CREATE INDEX IF NOT EXISTS logs_project ON logs (project, t);
"""
COLS = ("t", "side", "kind", "level", "project", "tab", "who", "ses", "item", "ms", "status")
KEEP_DAYS = 90
MAX_BYTES = 1_000_000_000


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class LogDB:
    def __init__(self, path: str):
        self.path = path
        self.queue: Deque[Dict[str, Any]] = deque(maxlen=100_000)  # never grows without end if the disk is stuck
        self.wake = threading.Event()
        self.pruned = 0.0
        db = self.connect()
        if not db.execute("SELECT name FROM sqlite_master WHERE name='logs'").fetchone():
            db.execute("PRAGMA auto_vacuum=INCREMENTAL")  # space of pruned rows goes back to the disk
        db.executescript(SCHEMA)
        db.close()
        threading.Thread(target=self.writer, daemon=True, name="logs").start()

    def connect(self) -> sqlite3.Connection:
        db = sqlite3.connect(self.path, timeout=30, check_same_thread=False)
        db.execute("PRAGMA journal_mode=WAL")
        return db

    def add(self, side: str, kind: str, **f: Any) -> None:
        """One row: the known columns by name, anything else into data."""
        row = {"t": f.pop("t", None) or now(), "side": side, "kind": kind}
        for c in COLS[3:]:
            v = f.pop(c, None)
            if v not in (None, ""):
                row[c] = v if c == "ms" else str(v)[:200]
        f = {k: v for k, v in f.items() if v not in (None, "")}
        if f:
            row["data"] = json.dumps(f, ensure_ascii=False, default=str)
        self.queue.append(row)
        self.wake.set()

    def writer(self) -> None:
        db = self.connect()
        while True:
            self.wake.wait(5)
            self.wake.clear()
            time.sleep(0.5)  # a burst goes in one transaction
            rows = []
            while self.queue:
                rows.append(self.queue.popleft())
            if rows:
                sql = ("INSERT INTO logs (t, side, kind, level, project, tab, who, ses, item, ms, status, data)"
                       " VALUES (:t, :side, :kind, :level, :project, :tab, :who, :ses, :item, :ms, :status, :data)")
                full = [{**{c: None for c in COLS + ("data",)}, "level": "info", **r} for r in rows]
                try:
                    with db:
                        db.executemany(sql, full)
                except Exception:  # the log must never take Taska down: one at a time, a bad row is dropped
                    for r in full:
                        try:
                            with db:
                                db.execute(sql, r)
                        except Exception:
                            pass
            if time.time() - self.pruned > 600:
                self.pruned = time.time()
                self.prune(db)

    def prune(self, db: sqlite3.Connection) -> None:
        try:
            with db:
                cut = (datetime.now(timezone.utc) - timedelta(days=KEEP_DAYS)).isoformat()
                db.execute("DELETE FROM logs WHERE t < ?", (cut,))
                pages, size = db.execute("PRAGMA page_count").fetchone()[0], db.execute("PRAGMA page_size").fetchone()[0]
                if pages * size > MAX_BYTES:
                    n = db.execute("SELECT count(*) FROM logs").fetchone()[0]
                    db.execute("DELETE FROM logs WHERE id IN (SELECT id FROM logs ORDER BY id LIMIT ?)", (max(1, n // 10),))
            db.execute("PRAGMA incremental_vacuum")
        except sqlite3.Error:
            pass


_log: Optional[LogDB] = None


def start(root: str) -> LogDB:
    global _log
    _log = LogDB(os.path.join(root, "logs.db"))
    return _log


def migrate_actions(root: str) -> int:
    """T453, once: the page's actions.jsonl files (F407) go into the table, then away (one log, not two). Written
    straight in and committed before a file is removed, so nothing is lost if Taska stops halfway."""
    import glob
    if _log is None:
        return 0
    n = 0
    db = _log.connect()
    for path in sorted(glob.glob(os.path.join(root, "*", "actions*.jsonl"))):
        project = os.path.basename(os.path.dirname(path))
        rows = []
        with open(path, encoding="utf-8", errors="replace") as f:
            for line in f:
                try:
                    e = json.loads(line)
                except ValueError:
                    continue
                what = str(e.pop("what", "") or "action")
                net = what.startswith("net ")
                ms = e.pop("ms", None)
                rest = {k: v for k, v in e.items() if k not in ("t", "status", "via") or (k == "via" and net)}
                if not net and e.get("via"):
                    rest["how"] = e["via"]
                rows.append((str(e.get("t") or now()), "net" if net else what[:40], "warn" if net else "info", project,
                             int(ms) if str(ms or "").isdigit() else None, str(e["status"]) if e.get("status") else None,
                             json.dumps(rest, ensure_ascii=False) if rest else None))
        try:
            with db:
                db.executemany("INSERT INTO logs (t, side, kind, level, project, who, ms, status, data)"
                               " VALUES (?, 'page', ?, ?, ?, 'you', ?, ?, ?)", rows)
        except sqlite3.Error:
            continue  # kept as it is: tried again next start
        os.remove(path)
        n += len(rows)
    db.close()
    return n


def log(side: str, kind: str, **f: Any) -> None:
    """Keep one row (nothing when no log is open, as in tests)."""
    if _log is not None:
        _log.add(side, kind, **f)


def since(spec: str) -> str:
    """'2h', '30m', '3d' or an ISO time -> an ISO time."""
    units = {"m": 60, "h": 3600, "d": 86400}
    if spec and spec[-1] in units and spec[:-1].isdigit():
        return (datetime.now(timezone.utc) - timedelta(seconds=int(spec[:-1]) * units[spec[-1]])).isoformat()
    return spec


def query(path: str, args: Any) -> List[sqlite3.Row]:
    db = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    if args.sql:
        return list(db.execute(args.sql))
    where, vals = [], []
    for col, v in (("side", args.side), ("kind", args.kind), ("level", args.level), ("project", args.project),
                   ("tab", args.tab), ("who", args.who), ("item", args.item)):
        if v:
            where.append(f"{col} = ?")
            vals.append(v)
    if args.since:
        where.append("t >= ?")
        vals.append(since(args.since))
    if args.until:
        where.append("t < ?")
        vals.append(since(args.until))
    if args.grep:
        where.append("data LIKE ?")
        vals.append(f"%{args.grep}%")
    sql = "SELECT * FROM logs" + (" WHERE " + " AND ".join(where) if where else "") + " ORDER BY id DESC LIMIT ?"
    return list(reversed(list(db.execute(sql, vals + [args.limit]))))


def main(argv: List[str]) -> None:
    import argparse
    ap = argparse.ArgumentParser(prog="taska logs", description="Read Taska's log table (logs.db), oldest first.")
    ap.add_argument("--root", default="~/.taska")
    ap.add_argument("--since", help="2h, 30m, 3d or an ISO time")
    ap.add_argument("--until")
    for c in ("side", "kind", "level", "project", "tab", "who", "item"):
        ap.add_argument("--" + c)
    ap.add_argument("--grep", help="words in the row's data")
    ap.add_argument("--limit", type=int, default=200)
    ap.add_argument("--sql", help="any read-only SQL on the logs table")
    ap.add_argument("--json", action="store_true", help="one JSON object a line")
    args = ap.parse_args(argv)
    for r in query(os.path.join(os.path.expanduser(args.root), "logs.db"), args):
        d = dict(r)
        if args.json:
            print(json.dumps(d, ensure_ascii=False))
        elif "kind" in d and "t" in d:
            head = " ".join(str(d[c]) for c in ("t", "side", "kind", "level", "project", "tab", "who", "ses", "item", "ms", "status") if d.get(c) not in (None, ""))
            print(head + (" " + d["data"][:300] if d.get("data") else ""))
        else:
            print(d)
