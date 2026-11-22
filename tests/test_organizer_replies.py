"""T760 (Yadong r1278, r1281, 11-12): a reply on a task is for the agent on it. It always stays in that agent's
inbox (the organizer never acks it), and the organizer never changes that task's status from it (r1268 on T745 was
turned into "T745 done", unseen by its agent); a priority or Now/Later it asks for, and tasks for other things it
mentions, are still made. Change only on Yadong's explicit word."""

import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from support import ProjectCase
from taska.domain import rules  # noqa: E402
from taska.services import organizer as org  # noqa: E402


class Replies(ProjectCase):
    def setUp(self):
        super().setUp()
        self.p.run([(0, {"op": "new", "tags": ["bug"], "pri": "P1", "when": "now", "title": "Book is missing"})], "you")
        self.p.run([(0, {"op": "input", "text": "I mean this problem is gone now. Urgent.", "q": "q1", "scope": 1})],
                   "you")
        self.o = org.Organizer(self.p)

    def organize(self, plan):
        with mock.patch.object(org.gemini, "ask", side_effect=lambda *a, **k: plan):
            self.o.organize("r1")

    def test_a_reply_stays_for_the_agent_and_its_task_keeps_its_status(self):
        self.organize("B001 done\nB001 P0\nack r1")
        inp, task = self.p.state.inputs["r1"], self.p.state.tasks[1]
        self.assertFalse(inp.acked)
        self.assertIn(inp, rules.for_agent(self.p.state, True, self.p.held_fn))
        self.assertEqual(task.status, "open")
        self.assertEqual(task.pri, "P0")
        self.assertIn("Left for agent", inp.org.msg)

    def test_a_reply_may_still_make_tasks_for_other_things(self):
        self.organize("new P1 now Check the other shelf\nack r1")
        self.assertFalse(self.p.state.inputs["r1"].acked)
        self.assertIn("Check the other shelf", [i.title for i in self.p.state.tasks.values()])

    def test_an_input_without_an_task_is_handled_as_before(self):
        self.p.run([(0, {"op": "input", "text": "Thanks", "q": "q2"})], "you")
        with mock.patch.object(org.gemini, "ask", side_effect=lambda *a, **k: "ack r2"):
            self.o.organize("r2")
        self.assertTrue(self.p.state.inputs["r2"].acked)


if __name__ == "__main__":
    unittest.main()
