"""T806 #3 (r1376): a change that cannot be read when a project opens is skipped, logged as an error and counted in
the project's view (the page says so), not only printed."""

from __future__ import annotations

import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from support import ProjectCase
from taska.services import project as project_mod  # noqa: E402


class Damaged(ProjectCase):
    def test_a_skipped_change_is_logged_and_counted(self) -> None:
        self.assertEqual(self.p.damaged, 0)
        errors = []
        with mock.patch.object(project_mod.log, "error", lambda msg, extra=None: errors.append((msg, extra["f"]["kind"]))):
            self.p._warn(7, "could not read: bad row")
        self.assertEqual(self.p.damaged, 1)
        self.assertEqual(errors, [("change 7 skipped: could not read: bad row", "replay")])
        from taska.page_api.views import project_view
        view = project_view(self.p.state, self.p.agents, slug="demo", title="Demo", organizer_on=False, organizer_busy=[],
                            organizer_model="", presence=[], work=False, db_path=self.p.store.path, damaged=self.p.damaged)
        self.assertEqual(view["damaged"], 1)
        self.assertNotIn("damaged", project_view(self.p.state, self.p.agents, slug="demo", title="Demo", organizer_on=False,
                                                 organizer_busy=[], organizer_model="", presence=[], work=False,
                                                 db_path=self.p.store.path))


if __name__ == "__main__":
    unittest.main()
