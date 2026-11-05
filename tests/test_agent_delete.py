"""r1069: an agent deletes an item it proposed that the user has not answered (a monitor's alarm that went away);
anything else stays the user's to delete."""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.agent_text.language import parse  # noqa: E402
from taska.services.project import Project  # noqa: E402


class AgentDelete(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = Project(self.tmp.name, "demo")
        self.p.run(parse("new bug P0 now The phone link is down\n"), "claude-code")  # B1, proposed by the agent

    def tearDown(self):
        self.p.close()
        self.tmp.cleanup()

    def test_the_agent_deletes_its_own_untouched_proposal(self):
        lines, _ = self.p.run(parse("B1 delete\n"), "claude-code")
        self.assertEqual(lines, ["ok B1 deleted"])
        self.assertTrue(self.p.state.items[1].deleted)

    def test_not_once_the_user_answered(self):
        self.p.run(parse("B1 say keep it\n"), "you")
        lines, _ = self.p.run(parse("B1 delete\n"), "claude-code")
        self.assertTrue(lines[0].startswith("err"), lines)
        self.assertFalse(self.p.state.items[1].deleted)

    def test_not_another_agents_and_not_an_approved_one(self):
        lines, _ = self.p.run(parse("B1 delete\n"), "codex")
        self.assertTrue(lines[0].startswith("err"), lines)
        self.p.run(parse("new task P1 now Mine\n"), "you")  # T2, the user's
        lines, _ = self.p.run(parse("T2 delete\n"), "claude-code")
        self.assertTrue(lines[0].startswith("err"), lines)

    def test_the_user_still_deletes_anything(self):
        lines, _ = self.p.run(parse("B1 delete\n"), "you")
        self.assertEqual(lines, ["ok B1 deleted"])


if __name__ == "__main__":
    unittest.main()
