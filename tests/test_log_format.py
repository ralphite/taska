"""Refactor 8B: a log is read only in today's format (2). Its earlier format was rewritten once (8A) and nothing reads
it any more, so a project whose log is of another format is refused when it opens, not read as changes of unknown
kinds; a new project starts in format 2."""

from __future__ import annotations

import tempfile
import unittest

from support import ProjectCase
from taska.infra.project_db import ProjectDb
from taska.services.project import Project


class LogFormat(ProjectCase):
    def test_a_new_project_is_in_format_2(self) -> None:
        self.assertEqual(self.p.store.db.version, "2")

    def test_a_log_of_format_1_is_refused(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            db = ProjectDb(tmp)
            db._con.execute("UPDATE meta SET v = '1' WHERE k = 'version'")
            db.close()
            with self.assertRaisesRegex(RuntimeError, "format 1, this Taska reads only 2"):
                Project(tmp, "old")


if __name__ == "__main__":
    unittest.main()
