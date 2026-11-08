"""B703 (r1141, r1144, #10330): an input said in an item is already in that item's talk, as the user's own words; the
organizer never writes a message there (no repeat, no rewrite): it only does what needs doing. Change only on
Yadong's explicit word.

B714 (#10594, 11-07): the one message the organizer may write there, or on an item it just made, is a question to the
user (ask, with its choices), so that when it is unsure the user sees the question instead of nothing."""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.agent_text.language import parse  # noqa: E402
from taska.agent_text.organizer_text import INSTRUCTIONS  # noqa: E402
from taska.services.organizer import echo  # noqa: E402
from taska.services.project import Project  # noqa: E402


class Echo(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = Project(self.tmp.name, "demo")
        self.p.run([(0, {"op": "new", "type": "task", "pri": "P1", "when": "now", "title": "Demo plan"})], "you")
        self.p.run([(0, {"op": "input", "text": "Update this task from the latest code.", "q": "q1", "scope": 1})], "you")
        self.inp = self.p.state.inputs["r1"]

    def tearDown(self):
        self.p.close()
        self.tmp.cleanup()

    def say(self, ref, text, kind="say"):
        return {"op": "say", "ref": ref, "kind": kind, "text": text, "src": None, "files": []}

    def test_repeating_the_input_on_its_own_item_is_dropped(self):
        self.assertTrue(echo(self.p, self.inp, self.say("T001", "Update this task from the latest code.")))

    def test_a_message_on_the_item_the_plan_just_made_is_dropped(self):
        # B714 (r1167): the organizer made B713 and added "截图" with the input's picture as a message on it
        self.p.run([(0, {"op": "input", "text": "Swipe down does nothing", "q": "q2"})], "you")
        inp = self.p.state.inputs["r2"]
        self.assertTrue(echo(self.p, inp, self.say("$", "截图")))
        self.assertTrue(echo(self.p, inp, self.say("B099", "截图")))  # by its code, made by the same plan

    def test_any_message_on_that_item_is_dropped_one_elsewhere_stays(self):
        self.assertTrue(echo(self.p, self.inp, self.say("T001", "Noted: the plan follows the code.")))
        self.p.run([(0, {"op": "new", "type": "task", "pri": "P1", "when": "now", "title": "Other"})], "you")
        self.assertFalse(echo(self.p, self.inp, self.say("T002", "The part about the other task.")))

    def test_a_question_to_the_user_stays_on_those_items(self):
        # B714 #10594: unsure, the organizer asks with a question card; its notes and proposals there are still dropped
        ask = parse("T001 ask Which export should change?\n  - ( ) CSV\n  - ( ) PDF")[0][1]
        self.assertFalse(echo(self.p, self.inp, ask))
        self.assertTrue(echo(self.p, self.inp, self.say("T001", "Maybe CSV.", "propose")))
        self.p.run([(0, {"op": "input", "text": "Swipe down does nothing", "q": "q2"})], "you")
        inp = self.p.state.inputs["r2"]
        self.assertFalse(echo(self.p, inp, self.say("$", "On the phone or the desktop?", "ask")))
        self.assertTrue(echo(self.p, inp, self.say("$", "Maybe the list.", "propose")))

    def test_the_organizer_is_told_to_ask_there(self):
        self.assertIn("ask is the only message", INSTRUCTIONS)


if __name__ == "__main__":
    unittest.main()
