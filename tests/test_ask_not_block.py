"""T646: an agent waits on the user only by asking. Its old word, block, is no word now: the blocks written before
are asks in the log since its format 2 (Refactor 8A)."""

from __future__ import annotations

import unittest

from support import ProjectCase
from taska.agent_text.language import parse
from taska.domain import rules


class AskNotBlock(ProjectCase):
    def setUp(self):
        super().setUp()
        self.p.run(parse("new task P1 now Ship the export\n"), "you")

    def test_an_agent_that_is_stuck_asks(self):
        lines, _ = self.p.run(parse("T1 ask I need the export key\n"), "claude-code")
        self.assertEqual(lines, ["ok T1 ask"])
        it = self.p.state.items[1]
        self.assertEqual(rules.waiting(self.p.state, it).text, "I need the export key")
        self.assertTrue(rules.needs_you(self.p.state, it))

    def test_block_is_no_word(self):
        lines, _ = self.p.run(parse("T1 block I need the export key\n"), "claude-code")
        self.assertTrue(lines[0].startswith("err"), lines)
        self.assertEqual(self.p.state.items[1].thread, [])


if __name__ == "__main__":
    unittest.main()
