"""T646: an agent waits on the user only by asking. Its old word block lands as an ask, and the blocks written
before become asks once."""

from __future__ import annotations

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.agent_text.language import parse  # noqa: E402
from taska.agent_text.render import log_entries  # noqa: E402
from taska.domain import events as ev, rules  # noqa: E402
from taska.services.project import Project  # noqa: E402


class AskNotBlock(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = Project(self.tmp.name, "demo")
        self.p.run(parse("new task P1 now Ship the export\n"), "you")

    def tearDown(self):
        self.p.close()
        self.tmp.cleanup()

    def test_block_from_an_agent_lands_as_an_ask(self):
        lines, _ = self.p.run(parse("T1 block I need the export key\n"), "claude-code")
        self.assertEqual(lines, ["ok T1 ask"])
        it = self.p.state.items[1]
        self.assertEqual(it.thread[-1].kind, "ask")
        self.assertEqual(rules.waiting(self.p.state, it).text, "I need the export key")
        self.assertTrue(rules.needs_you(self.p.state, it))

    def test_earlier_blocks_become_asks_once(self):
        self.p.emit(ev.MessagePosted(n=1, by="codex", kind="block", text="I need the export key"))  # as written before
        self.p.blocks_to_asks()
        it = self.p.state.items[1]
        self.assertEqual([x.kind for x in it.thread], ["ask"])
        self.assertEqual(rules.waiting(self.p.state, it).text, "I need the export key")
        count = self.p.store.count
        self.p.blocks_to_asks()  # nothing left: no change
        self.assertEqual(self.p.store.count, count)
        said = [r["what"] for r in log_entries(self.p.state, 10)]
        self.assertIn("T1 ask 'I need the export key'", said)  # the log says what it is now
        self.assertIn("made 1 earlier block an ask", said)
        # read again from the file, it stays an ask
        self.p.close()
        again = Project(self.tmp.name, "demo")
        try:
            self.assertEqual([x.kind for x in again.state.items[1].thread], ["ask"])
        finally:
            again.close()
        self.p = Project(self.tmp.name, "demo")


if __name__ == "__main__":
    unittest.main()
