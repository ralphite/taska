"""B703 (r1141): an input said in an item is already in that item's talk, as the user's own message; the organizer
must not repeat it there as its own message. Change only on Yadong's explicit word."""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

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

    def say(self, ref, text):
        return {"op": "say", "ref": ref, "kind": "say", "text": text, "src": None, "files": []}

    def test_repeating_the_input_on_its_own_item_is_dropped(self):
        self.assertTrue(echo(self.p, self.inp, self.say("T001", "Update this task from the latest code.")))

    def test_other_words_or_another_item_stay(self):
        self.assertFalse(echo(self.p, self.inp, self.say("T001", "Noted: the plan follows the code.")))
        self.assertFalse(echo(self.p, self.inp, self.say("T002", "Update this task from the latest code.")))


if __name__ == "__main__":
    unittest.main()
