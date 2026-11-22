"""T863 (Yadong r1464): what was written names every task by T and its number. A log of format 2 is rewritten once
at start, from a copy of its file made first: each older code of a task of the project (its type's letter then)
becomes T and the same digits; letters and digits that never named a task there stay as written."""

import json
import os
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import support  # noqa: E402,F401  (puts the server on the path)
from taska.domain.code_migration import rewrite  # noqa: E402
from taska.infra.project_db import FORMAT_VERSION, ProjectDb  # noqa: E402
from taska.services.migrate import migrate, migrate_all  # noqa: E402
from taska.services.project import Project  # noqa: E402

T = "2026-11-01T10:%02d:00-07:00"
ADD = {"k": "add", "by": "you", "src": None, "pri": "P1", "when": "now", "status": "open", "body": ""}


def old_rows() -> list:
    return [dict(ADD, n=1, title="Export loses the filter", type="bug", t=T % 1),
            dict(ADD, n=2, title="Sort by date", type="feature", body="After B01. Alice has phones B7 and B8; F1 the "
                 "database; f2864-voice_0-39.webm; /assets/index-B01.js", t=T % 2),
            {"k": "set", "n": 2, "by": "you", "f": {"type": "idea"}, "was": {"type": "feature"}, "src": None, "t": T % 3},
            {"k": "say", "n": 1, "by": "claude-code", "ses": "", "id": 3, "kind": "progress",
             "text": "Fixed with F02 and I2 (same task, then an idea); B1 again; B9 is no task", "src": None, "t": T % 4}]


class Rewrite(unittest.TestCase):
    def test_codes_of_tasks_become_t_codes_and_the_rest_stays(self) -> None:
        rows, kv, n = rewrite(old_rows(), {"voicealarm": {"ref": "B01"}, "guide": {"texts": {"x": "B03 doing"}}})
        self.assertEqual(rows[1]["body"], "After T01. Alice has phones B7 and B8; F1 the database; "
                         "f2864-voice_0-39.webm; /assets/index-B01.js")
        self.assertEqual(rows[3]["text"], "Fixed with T02 and T2 (same task, then an idea); T1 again; B9 is no task")
        self.assertEqual(kv, {"voicealarm": {"ref": "T01"}})  # a code alone, not the texts kept there
        self.assertEqual(n, 5)


class AtStart(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.folder = os.path.join(self.tmp.name, "demo")
        os.makedirs(self.folder)
        ProjectDb(self.folder).close()
        con = sqlite3.connect(os.path.join(self.folder, "taska.db"))
        con.execute("CREATE TABLE items (n INTEGER PRIMARY KEY, data TEXT NOT NULL)")  # as format 3 had it
        con.executemany("INSERT INTO events (seq, k, t, by, data) VALUES (?, ?, ?, ?, ?)",
                        [(i + 1, r["k"], r["t"], r["by"], json.dumps(r)) for i, r in enumerate(old_rows())])
        con.execute("UPDATE meta SET v = '2' WHERE k = 'version'")
        con.commit()
        con.close()

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_a_log_of_format_2_is_rewritten_once_from_a_copy_and_opens(self) -> None:
        lines = migrate_all(self.tmp.name)
        self.assertEqual(len(lines), 1)
        self.assertIn("demo: log in format 4: 4 older codes made T codes in 2 of 4 changes; its current tasks in the table tasks", lines[0])
        self.assertTrue(any(f.startswith("taska-format2-") for f in os.listdir(self.folder)))
        self.assertIsNone(migrate(self.folder))  # the next start does nothing
        con = sqlite3.connect(os.path.join(self.folder, "taska.db"))
        tables = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
        con.close()
        self.assertIn("tasks", tables)
        self.assertNotIn("items", tables)  # format 3's table of the current tasks went (T864)
        p = Project(self.folder, "demo")
        try:
            self.assertEqual(p.state.tasks[2].body[:10], "After T01.")
            self.assertEqual(FORMAT_VERSION, "4")
        finally:
            p.close()


if __name__ == "__main__":
    unittest.main()
