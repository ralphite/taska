"""Data validation reports an unreadable event without changing or dropping any stored history."""

from contextlib import closing
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

from check_data import databases, inspect


class DataCheckTest(unittest.TestCase):
    def test_check_is_read_only_and_reports_bad_events(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            folder = root / "example"
            folder.mkdir()
            path = folder / "taska.db"
            event = {"k": "new", "n": 1, "type": "task", "title": "Keep history", "pri": "P1", "when": "now",
                     "status": "open", "by": "you", "t": "2026-01-01T00:00:00+00:00"}
            with closing(sqlite3.connect(path)) as db:
                db.execute("CREATE TABLE events (seq INTEGER PRIMARY KEY, data TEXT)")
                db.executemany("INSERT INTO events VALUES (?, ?)", [(1, json.dumps(event)), (2, "bad JSON")])
                db.commit()
            before = path.read_bytes()
            counts, warnings = inspect(path)
            self.assertEqual(counts["events"], 2)
            self.assertEqual(warnings, ["event 2: invalid JSON event"])
            self.assertEqual(path.read_bytes(), before)
            self.assertEqual(databases(root), [path])
            (root / "linked").symlink_to(folder, target_is_directory=True)
            self.assertEqual(databases(root), [path])


if __name__ == "__main__":
    unittest.main()
