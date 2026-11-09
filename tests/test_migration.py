"""Refactor 8: a log of the earlier formats is rewritten once, at start, into today's kinds (domain.migration), each
change in its place, from a copy of the file made first; it leaves the same records but for what the migration means
to change, and a second start finds nothing to do."""

from __future__ import annotations

import json
import os
import sqlite3
import tempfile
import unittest
from unittest import mock

from support import ROOT  # noqa: F401  (puts the server on the path)
from taska.domain import migration
from taska.domain.projection import replay
from taska.infra.project_db import ProjectDb
from taska.services import migrate
from taska.services.project import Project

T = "2026-10-01T10:00:%02d-07:00"
F = "f1-voice_0-05.webm"
VOICE = {"f": F, "name": "voice 0-05.webm", "mime": "audio/webm"}

# a log of format 1: what the B682, T646 and I693 changes once left, and what came before them
OLD = [
    {"k": "add", "n": 1, "title": "Ship the export", "type": "task", "pri": "P1", "when": "now", "status": "open",
     "by": "you", "t": T % 1},
    {"k": "in", "id": "r1", "by": "you", "text": "Keep the filter", "scope": None,
     "files": [dict(VOICE, tr="keep filter", wait=True)], "t": T % 2},
    {"k": "tr", "src": "r1", "f": F, "tr": "Keep the filter.", "was": "keep filter", "by": "taska",
     "heard": "keep the filter", "t": T % 3},
    {"k": "org", "src": "r1", "ok": False, "msg": "Gemini HTTP 503: overloaded", "by": "org", "t": T % 4},
    {"k": "ack", "ids": ["r1"], "by": "claude-code", "t": T % 5},
    {"k": "say", "n": 1, "by": "claude-code", "kind": "block", "text": "I need the export key", "src": None, "t": T % 6},
    {"k": "heard", "notes": {"r1": {F: "keep the filter, word for word"}}, "by": "taska", "t": T % 7},
    {"k": "asked", "ids": [6], "by": "taska", "t": T % 8},
    {"k": "voices", "voices": {F: {"state": "done", "said": "keep the filter, word for word",
                                   "tidied": "Keep the filter.", "t": T % 9}},
     "inputs": {}, "comments": {}, "by": "taska", "t": T % 9},
]


def write(folder: str, rows: list, version: str = "1") -> None:
    db = ProjectDb(folder)
    for seq, row in enumerate(rows, 1):
        db.append(seq, row)
    db._con.execute("UPDATE meta SET v = ? WHERE k = 'version'", (version,))
    db.close()


def version(folder: str) -> str:
    db = ProjectDb(folder)
    try:
        return db.version
    finally:
        db.close()


def stored(folder: str) -> list:
    with sqlite3.connect(os.path.join(folder, "taska.db")) as con:
        return [json.loads(d) for (d,) in con.execute("SELECT data FROM events ORDER BY seq")]


class Migration(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = self.tmp.name
        self.folder = os.path.join(self.root, "demo")
        os.makedirs(self.folder)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_each_old_change_becomes_todays_in_its_place(self) -> None:
        write(self.folder, OLD)
        [line] = migrate.migrate_all(self.root)
        self.assertIn("demo: log in format 2: 6 of 9 changes rewritten", line)
        rows = stored(self.folder)
        self.assertEqual([r["k"] for r in rows], ["add", "in", "voice", "org", "ack", "say", "voices", "folded", "voices"])
        self.assertEqual(rows[1]["files"], [VOICE])  # a file is only what a file is: the note's words are its record's
        self.assertEqual({k: rows[2][k] for k in ("f", "state", "said", "tidied", "src")},
                         {"f": F, "state": "done", "said": "keep the filter", "tidied": "Keep the filter.", "src": "r1"})
        self.assertEqual(rows[3], {"k": "org", "src": "r1", "retry": True, "by": "org", "t": T % 4})  # only busy (T424)
        self.assertEqual(rows[5]["kind"], "ask")
        self.assertEqual(rows[6]["voices"][F]["said"], "keep the filter, word for word")
        self.assertEqual(rows[7], {"k": "folded", "was": "asked", "by": "taska", "t": T % 8})
        with sqlite3.connect(os.path.join(self.folder, "taska.db")) as con:
            self.assertEqual(con.execute("SELECT v FROM meta WHERE k = 'version'").fetchone(), ("2",))
        # the file as it was, beside it, whole
        [copy] = [n for n in os.listdir(self.folder) if n.startswith("taska-format1-")]
        with sqlite3.connect(os.path.join(self.folder, copy)) as con:
            self.assertEqual([json.loads(d) for (d,) in con.execute("SELECT data FROM events ORDER BY seq")], OLD)
        # and the project reads as before
        p = Project(self.folder, "demo")
        try:
            self.assertEqual(p.state.items[1].thread[0].kind, "ask")
            self.assertEqual(p.state.voices[F].tidied, "Keep the filter.")
            self.assertIsNone(p.state.inputs["r1"].org)  # the busy failure's note goes: it was asked again
        finally:
            p.close()

    def test_a_kind_nothing_reads_is_folded(self) -> None:
        write(self.folder, OLD + [{"k": "plain", "id": "r1", "by": "you", "t": T % 10}])
        [line] = migrate.migrate_all(self.root)
        self.assertIn("1 plain -> folded", line)
        self.assertEqual(stored(self.folder)[-1], {"k": "folded", "was": "plain", "by": "you", "t": T % 10})

    def test_a_second_start_finds_nothing_to_do(self) -> None:
        write(self.folder, OLD)
        migrate.migrate_all(self.root)
        once = stored(self.folder)
        self.assertEqual(migrate.migrate_all(self.root), [])
        self.assertEqual(stored(self.folder), once)
        self.assertEqual(len([n for n in os.listdir(self.folder) if n.startswith("taska-format1-")]), 1)

    def test_the_same_records_as_before(self) -> None:
        new, _, retried = migration.rewrite(OLD)
        warned: list = []
        before, after = replay(OLD, lambda *w: warned.append(w)), replay(new, lambda *w: warned.append(w))
        self.assertEqual(warned, [])
        self.assertEqual(migration.snapshot(before, retried), migration.snapshot(after, retried))

    def test_a_deleted_project_too(self) -> None:
        gone = os.path.join(self.root, ".deleted", "old")
        os.makedirs(gone)
        write(gone, OLD)
        [line] = migrate.migrate_all(self.root)
        self.assertTrue(line.startswith(".deleted/old: log in format 2"), line)

    def test_a_log_whose_one_time_changes_are_still_to_come_is_left_for_the_next_start(self) -> None:
        write(self.folder, OLD[:3])  # its words not yet in their records (B682)
        [line] = migrate.migrate_all(self.root)
        self.assertIn("demo: left for the next start", line)
        self.assertEqual(stored(self.folder), OLD[:3])
        self.assertEqual(version(self.folder), "1")

    def test_a_rewrite_that_would_change_the_records_is_not_written(self) -> None:
        write(self.folder, OLD)
        wrong = lambda rows: ([dict(r, text="else") if r["k"] == "in" else r for r in rows], {}, set())  # noqa: E731
        with mock.patch.object(migration, "rewrite", wrong):
            [line] = migrate.migrate_all(self.root)
        self.assertIn("would not leave the same records", line)
        self.assertEqual(stored(self.folder), OLD)
        self.assertEqual([n for n in os.listdir(self.folder) if n.startswith("taska-format1-")], [])

    def test_a_new_project_starts_in_format_2(self) -> None:
        p = Project(self.folder, "demo")
        p.close()
        self.assertEqual(version(self.folder), "2")
        self.assertEqual(migrate.migrate_all(self.root), [])


if __name__ == "__main__":
    unittest.main()
