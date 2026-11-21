"""T858 (D152 part 4, Yadong r1455): the card of an item another session is on says which session, how it is and how
to reach it, so an agent leaves it to that session or writes to it instead of colliding."""

import dataclasses
import os
import sys
import time
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from support import ProjectCase  # noqa: E402
from taska.agent_text.language import parse  # noqa: E402
from taska.agent_text.render import card  # noqa: E402


class OnIt(ProjectCase):
    def test_the_card_names_the_session_how_it_is_and_how_to_write_to_it(self) -> None:
        self.p.run(parse("new P1 Keyboard hides the pay button\nT1 ask Which phone?\n"), "you")
        rd = dataclasses.replace(self.p.reading(), holder=lambda it: ("claude-code · checkout", time.time() - 190))
        text = card(rd, self.p.state.items[1])
        self.assertIn("on it: claude-code · checkout (working, heard 3 min ago): if that is not you, leave it to that "
                      "session, or write to it with `T1 say @checkout ...`", text)

    def test_nobody_on_it_says_nothing(self) -> None:
        self.p.run(parse("new P1 Keyboard hides the pay button\n"), "you")
        self.assertNotIn("on it:", card(self.p.reading(), self.p.state.items[1]))


if __name__ == "__main__":
    unittest.main()
