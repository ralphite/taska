"""B749 (Yadong r1248, D132): an agent's questions in a row are answered in one card; an answer may answer some of them
(r1253: the ones not answered keep waiting), and the agent picks up what was answered."""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.agent_text import render  # noqa: E402
from taska.domain import rules  # noqa: E402
from taska.services.project import Project  # noqa: E402


class QuestionsInARow(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = Project(self.tmp.name, "demo")
        self.run_one({"op": "new", "title": "Export", "type": "feature"}, "claude")
        self.asks = [self.ask(q) for q in ("Turn the page by itself?\n- ( ) Yes\n- ( ) No", "Send a part?\n- ( ) Yes\n- ( ) No", "What else?")]

    def tearDown(self):
        self.p.close()
        self.tmp.cleanup()

    def run_one(self, cmd, by="you"):
        lines, _ = self.p.run([(0, cmd)], by)
        self.assertTrue(lines[0].startswith("ok"), lines)
        return lines[0]

    def ask(self, text):
        self.run_one({"op": "say", "ref": "F1", "kind": "ask", "text": text}, "claude")
        return self.p.state.items[1].thread[-1].id

    def open_ids(self):
        return [x.id for x in rules.open_asks(self.p.state, self.p.state.items[1])]

    def answer(self, text, of=None):
        self.run_one({"op": "input", "text": text, "scope": "F1", "kind": "answer", **({"of": of} if of else {})})

    def test_all_the_questions_in_a_row_wait(self):
        self.assertEqual(self.open_ids(), self.asks)
        self.assertEqual(rules.waiting(self.p.state, self.p.state.items[1]).id, self.asks[-1])

    def test_an_answer_to_some_leaves_the_others_waiting_and_the_agent_picks_it_up(self):
        a, b, c = self.asks
        self.answer("- Turn the page by itself? → ✓ Yes\n- Send a part? → ✓ Yes", [a, b])
        self.assertEqual(self.open_ids(), [c])
        it = self.p.state.items[1]
        self.assertEqual(it.thread[-1].of, [a, b])
        card = render.card(self.p.reading(), it)
        self.assertIn("still waiting on: What else?", card)
        self.assertTrue(rules.replied(it))  # the agent is given it: not skipped as waiting on the user
        self.answer("- What else? → A long one", [c])
        self.assertEqual(self.open_ids(), [])

    def test_an_answer_naming_no_questions_answers_them_all(self):
        self.answer("✓ Yes")
        self.assertEqual(self.open_ids(), [])

    def test_an_agent_word_between_ends_the_row(self):
        self.run_one({"op": "say", "ref": "F1", "kind": "progress", "text": "On it."}, "claude")
        d = self.ask("One more?")
        self.assertEqual(self.open_ids(), [d])

    def test_only_its_questions_can_be_named(self):
        lines, _ = self.p.run([(0, {"op": "input", "text": "x", "scope": "F1", "kind": "answer", "of": [999]})], "you")
        self.assertTrue(lines[0].startswith("refused") or "not a question" in lines[0], lines)


if __name__ == "__main__":
    unittest.main()
