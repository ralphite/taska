"""A reply by paragraph goes into one of its threads: ¶N.K names thread K (as /D shows it), and without K the first
thread whose last word is the user's, so /next stops asking once every thread is answered."""

from __future__ import annotations

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.agent_text.language import parse  # noqa: E402
from taska.domain import rules  # noqa: E402
from taska.services.project import Project  # noqa: E402


class DocReplyThread(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = Project(self.tmp.name, "demo")
        self.p.run(parse("new task P1 now Ship the export\nT1 doc Plan\n  # Plan\n  \n  Ship the export as CSV.\n"), "claude-code")

    def tearDown(self):
        self.p.close()
        self.tmp.cleanup()

    def test_each_thread_on_a_paragraph_gets_its_answer(self):
        d = next(iter(self.p.state.docs.values()))
        key = rules.doc_view(d)[0][1].key
        for quote, text in (("Ship", "Which export?"), ("CSV", "And when?")):
            self.p.run([(1, {"op": "dc", "d": str(d.d), "key": key, "quote": quote, "text": text})], "you")
        self.assertEqual(rules.doc_unanswered(self.p.state.docs[d.d]), 2)
        self.p.run(parse(f"D{d.d} reply ¶2.2 Next week.\n"), "claude-code")
        self.assertEqual(rules.doc_unanswered(self.p.state.docs[d.d]), 1)
        self.p.run(parse(f"D{d.d} reply ¶2 The CSV one.\n"), "claude-code")
        self.assertEqual(rules.doc_unanswered(self.p.state.docs[d.d]), 0)


if __name__ == "__main__":
    unittest.main()
