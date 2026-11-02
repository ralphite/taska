"""The daily copy of Taska's data (T582): consistent databases, unchanged files linked to yesterday's copy, once a day,
the last 14 kept."""

from __future__ import annotations

import os
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tools"))
from backup_data import backup  # noqa: E402


class DailyBackup(unittest.TestCase):
    def test_copies_links_and_keeps_fourteen(self) -> None:
        root = tempfile.mkdtemp(prefix="taska-backup-")
        data, backups = os.path.join(root, "data"), os.path.join(root, "backups")
        os.makedirs(os.path.join(data, "p", "taska-files"))
        db = sqlite3.connect(os.path.join(data, "p", "taska.db"))
        db.execute("create table t (x)")
        db.execute("insert into t values (1)")
        db.commit()
        with open(os.path.join(data, "p", "taska-files", "f1.png"), "wb") as f:
            f.write(b"picture")
        first = backup(data, backups, "2026-11-01")
        second = backup(data, backups, "2026-11-02")
        self.assertEqual(sqlite3.connect(os.path.join(second, "p", "taska.db")).execute("select x from t").fetchall(), [(1,)])
        a, b = (os.stat(os.path.join(d, "p", "taska-files", "f1.png")) for d in (first, second))
        self.assertEqual(a.st_ino, b.st_ino)  # unchanged: linked, not copied
        self.assertEqual(backup(data, backups, "2026-11-02"), second)  # once a day
        for day in range(3, 20):
            backup(data, backups, f"2026-11-{day:02d}")
        kept = sorted(os.listdir(backups))
        self.assertEqual(len(kept), 14)
        self.assertEqual(kept[-1], "2026-11-19")
        db.close()


if __name__ == "__main__":
    unittest.main()
