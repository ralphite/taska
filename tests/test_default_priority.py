"""The user's rule (r10 on 10-09, again r1072 on 11-04): a new item is P1 unless someone says otherwise. On 10-11 it
quietly became P2; this test is here so it cannot change again without the user saying so. Change it only on the
user's explicit word, and cite it."""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.agent_text.language import parse  # noqa: E402
from taska.agent_text.organizer_text import INSTRUCTIONS  # noqa: E402
from taska.domain.vocab import DEFAULT_PRI  # noqa: E402
from taska.services.project import Project  # noqa: E402


class DefaultPriority(unittest.TestCase):
    def test_the_default_is_p1(self):
        self.assertEqual(DEFAULT_PRI, "P1")

    def test_a_new_item_without_a_priority_is_p1(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Project(tmp, "demo")
            try:
                for by in ("you", "claude-code", "org"):
                    p.run(parse("new task now Something to do\n"), by)
                self.assertEqual({it.pri for it in p.state.items.values()}, {"P1"})
            finally:
                p.close()

    def test_the_organizer_is_told_p1(self):
        self.assertIn("P1 is the default", INSTRUCTIONS)
        self.assertIn("use P2 rarely", INSTRUCTIONS)
        self.assertNotIn("P2 = normal", INSTRUCTIONS)


if __name__ == "__main__":
    unittest.main()
