"""The change log: each change as facts (what the page's Activity gets) and the same in the log's words (agents)."""

from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.agent_text import log as change_log  # noqa: E402
from taska.agent_text.language import parse  # noqa: E402
from taska.domain import events as ev  # noqa: E402
from taska.services.project import Project  # noqa: E402


class ChangeLog(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = Project(self.tmp.name, "demo")
        self.p.run(parse("new bug P1 now Export loses the filter\n"), "you")

    def tearDown(self):
        self.p.close()
        self.tmp.cleanup()

    def test_a_change_is_facts_not_words(self):
        self.p.emit(ev.FieldsSet(n=1, by="you", f={"title": "A → B, it's", "archived": True},
                                 was={"title": "Export loses the filter", "archived": False}))
        x = change_log.entries(self.p.state, 1)[0]
        self.assertEqual(x["kind"], "set")
        self.assertEqual(x["n"], 1)
        self.assertEqual(x["codes"], {"1": "B1"})
        self.assertEqual(x["set"], [{"field": "title", "was": "Export loses the filter", "now": "A → B, it's"},
                                    {"field": "archived", "was": False, "now": True}])
        json.dumps(x)
        # agents read it in the log's words, as before
        self.assertEqual(change_log.said(x), "B1 title Export loses the filter→A → B, it's, archived False→True")

    def test_the_log_words_stay(self):
        self.p.run(parse("B1 ask Which export?\n"), "codex")
        text = change_log.text(self.p.state, 2)
        self.assertIn("you new B1 bug P1 now 'Export loses the filter'", text)
        self.assertIn("codex B1 ask 'Which export?'", text)


if __name__ == "__main__":
    unittest.main()
