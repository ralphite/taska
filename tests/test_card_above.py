"""T853 (Yadong r1458): an agent working on a subtask reads everything it is part of, from its parent up to the top:
each level's whole body (a long one cut, saying where the rest is), every decision there and its documents; then the
tasks beside it, one line each. Instructions written on a group for everything under it reach every task below."""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from support import ProjectCase  # noqa: E402
from taska.agent_text.render import ABOVE_BODY, card  # noqa: E402


class Above(ProjectCase):
    def run_as(self, by: str, *commands: dict) -> list:
        return self.p.run([(0, c) for c in commands], by)[0]

    def setUp(self) -> None:
        super().setUp()
        top_body = "All UI work.\nline two\nline three\nline four\nEvery UI task starts as a Storybook prototype."
        self.run_as("you", {"op": "new", "title": "UI", "body": top_body},
                    {"op": "new", "title": "List rows", "parent": "T1", "body": "Rows only."},
                    {"op": "new", "title": "Row height", "parent": "T2"},
                    {"op": "new", "title": "Row icons", "parent": "T2"})
        self.run_as("you", {"op": "say", "ref": "T1", "kind": "decide", "text": "Phone and desktop the same."},
                    {"op": "say", "ref": "T1", "kind": "decide", "text": "Tailwind only."},
                    {"op": "say", "ref": "T1", "kind": "decide", "text": "No new components."})

    def test_every_level_up_with_its_whole_body_and_every_decision(self) -> None:
        text = card(self.p.reading(), self.p.state.tasks[3])
        self.assertIn("part of T2 (open): List rows", text)
        self.assertIn("part of T1 (open): UI", text)
        self.assertLess(text.index("part of T2"), text.index("part of T1"))  # nearest first
        self.assertIn("Every UI task starts as a Storybook prototype.", text)  # line 5 of the top level's body
        for d in ("Phone and desktop the same.", "Tailwind only.", "No new components."):
            self.assertIn("decided: " + d, text)

    def test_the_tasks_beside_it(self) -> None:
        text = card(self.p.reading(), self.p.state.tasks[3])
        self.assertIn("beside it under T2:\n  T4 open Row icons", text)
        self.assertNotIn("  T3 open Row height", text)

    def test_a_long_body_is_cut_and_says_where_the_rest_is(self) -> None:
        self.run_as("you", {"op": "set", "ref": "T1", "f": {"body": "x " * ABOVE_BODY + "THE END"}})
        text = card(self.p.reading(), self.p.state.tasks[3])
        self.assertIn("… (cut: read T1 for the rest)", text)
        self.assertNotIn("THE END", text)


if __name__ == "__main__":
    unittest.main()
