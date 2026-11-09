"""Data validation reports an unreadable event, a change of a kind no reader knows and a log of an earlier format,
without changing or dropping any stored history."""

from contextlib import closing
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

from check_data import databases, inspect


EVENT = {"k": "add", "n": 1, "type": "task", "title": "Keep history", "pri": "P1", "when": "now", "status": "open",
         "by": "you", "t": "2026-01-01T00:00:00+00:00"}


def make(path: Path, version: str, *data: str) -> None:
    with closing(sqlite3.connect(path)) as db:
        db.execute("CREATE TABLE events (seq INTEGER PRIMARY KEY, data TEXT)")
        db.execute("CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)")
        db.execute("INSERT INTO meta VALUES ('version', ?)", (version,))
        db.executemany("INSERT INTO events VALUES (?, ?)", list(enumerate(data, 1)))
        db.commit()


class DataCheckTest(unittest.TestCase):
    def test_a_log_of_an_earlier_format_or_kind_is_reported(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "taska.db"
            make(path, "1", json.dumps(EVENT), json.dumps({"k": "tr", "src": "r1", "f": "f1", "tr": "words"}))
            _, warnings = inspect(path)
            self.assertEqual(warnings, ["its log is in format 1, not 2", "changes of kinds this version does not know: tr"])

    def test_check_is_read_only_and_reports_bad_events(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            folder = root / "example"
            folder.mkdir()
            path = folder / "taska.db"
            make(path, "2", json.dumps(EVENT), "bad JSON")
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
