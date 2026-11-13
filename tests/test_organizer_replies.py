"""B760 (Yadong r1278, r1281, 11-12): a reply on an item is for the agent on it. It always stays in that agent's
inbox (the organizer never acks it), and the organizer never changes that item's status from it (r1268 on B745 was
turned into "B745 done", unseen by its agent); a priority or Now/Later it asks for, and items for other things it
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
        self.p.run([(0, {"op": "new", "type": "bug", "pri": "P1", "when": "now", "title": "Book is missing"})], "you")
        self.p.run([(0, {"op": "input", "text": "I mean this problem is gone now. Urgent.", "q": "q1", "scope": 1})],
                   "you")
        self.o = org.Organizer(self.p)

    def organize(self, plan):
        with mock.patch.object(org.gemini, "ask", side_effect=lambda *a, **k: plan):
            self.o.organize("r1")

    def test_a_reply_stays_for_the_agent_and_its_item_keeps_its_status(self):
        self.organize("B001 done\nB001 P0\nack r1")
        inp, item = self.p.state.inputs["r1"], self.p.state.items[1]
        self.assertFalse(inp.acked)
        self.assertIn(inp, rules.for_agent(self.p.state, True, self.p.held_fn))
        self.assertEqual(item.status, "open")
        self.assertEqual(item.pri, "P0")
        self.assertIn("Left for agent", inp.org.msg)

    def test_a_reply_may_still_make_items_for_other_things(self):
        self.organize("new task P1 now Check the other shelf\nack r1")
        self.assertFalse(self.p.state.inputs["r1"].acked)
        self.assertIn("Check the other shelf", [i.title for i in self.p.state.items.values()])

    def test_an_input_without_an_item_is_handled_as_before(self):
        self.p.run([(0, {"op": "input", "text": "Thanks", "q": "q2"})], "you")
        with mock.patch.object(org.gemini, "ask", side_effect=lambda *a, **k: "ack r2"):
            self.o.organize("r2")
        self.assertTrue(self.p.state.inputs["r2"].acked)


if __name__ == "__main__":
    unittest.main()
