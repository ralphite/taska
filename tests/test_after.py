"""T857 (D152 part 3, Yadong r1455): "do T13 after T12". A task that waits for others is not given by /next while any
of them is unfinished, and /next says so; once they are done it comes back, saying what it waited for. Never itself,
never a group, never two tasks waiting for each other."""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from support import ProjectCase  # noqa: E402
from taska.agent_text.language import parse  # noqa: E402
from taska.agent_text.render import card, listing  # noqa: E402
from taska.agent_text.work import Asker, next_work  # noqa: E402


class After(ProjectCase):
    def do(self, text: str, by: str = "claude-code") -> list:
        return self.p.run(parse(text), by)[0]

    def next_text(self) -> str:
        return next_work(self.p.reading(), "test", False, Asker(who="codex")).text

    def setUp(self) -> None:
        super().setUp()
        self.do("new P2 Fix the cart total\nnew P0 Show the order number\n", "you")

    def test_blocked_is_skipped_and_comes_back_once_the_other_is_done(self) -> None:
        self.assertEqual(self.do("T2 after T1\n"), ["ok T2 after T1 (blocked: /next gives it once T1 is done)"])
        got = self.next_text()
        self.assertIn("blocked (skip): T2 ← T1", got)
        self.assertIn("next T1 ", got)  # the P0 waits, the P2 goes first
        self.assertIn("T2 P0 now open Show the order number after T1", listing(self.p.state, {}))
        self.assertIn("waits for T1 (open): /next gives T2 once it is done", card(self.p.reading(), self.p.state.tasks[2]))
        self.assertIn("blocks T2", card(self.p.reading(), self.p.state.tasks[1]))
        self.do("T1 done\n", "you")
        got = self.next_text()
        self.assertNotIn("blocked", got)
        self.assertIn("next T2: T1 it waited for is done", got)
        self.assertIn("waited for T1 (done)", got)

    def test_taken_off_and_written_on_new_with_dollar(self) -> None:
        self.do("T2 after T1\n")
        self.assertEqual(self.do("T2 after -T1\n"), ["ok T2 after -T1 (not blocked any more)"])
        self.do("new parent=T1 First the data\nnew parent=T1 after=$ Then the page\n", "you")
        self.assertEqual(self.p.state.tasks[4].after, [3])

    def test_never_itself_a_group_or_each_other(self) -> None:
        self.do("new group Checkout\nT2 after T1\n", "you")
        self.assertIn("cannot wait for itself", self.do("T1 after T1\n")[0])
        self.assertIn("is a group", self.do("T1 after T3\n")[0])
        self.assertIn("would wait for each other", self.do("T1 after T2\n")[0])


if __name__ == "__main__":
    unittest.main()
