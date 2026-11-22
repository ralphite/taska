"""T821 (Yadong r1402, r1406): a skill is a shared document named /name, kept once for every project; words that start
with its name (typed `/qa ...`, said "斜杠 QA ...") come to every agent with its text under them; agents see the list
with the rules, and read one by name to apply it themselves when it fits."""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.agent_text import render  # noqa: E402
from taska.domain import skills  # noqa: E402
from taska.services import organizer  # noqa: E402
from taska.services.workspace import Workspace  # noqa: E402

QA = "回答问题，只答不做。\n\n- 只回答，不改代码、不改文档、不新建任务。"


class Words(unittest.TestCase):
    def test_typed_or_said_any_case(self) -> None:
        have = {"/qa": QA, "/plan": "Plan it."}
        for words in ["/qa what does D12 say?", "/QA what", "斜杠 QA 这个文档讲了什么", "slash qa what", "/ qa x"]:
            self.assertEqual(skills.invoked(words, have), "/qa", words)
        for words in ["what is /qa", "/qatar trip", "/unknown x", "", "斜杠"]:
            self.assertIsNone(skills.invoked(words, have), words)

    def test_the_list_says_what_each_is_for(self) -> None:
        have = skills.skills_of({"/qa": "# Answer only\n\nmore", "编程": "x"})  # a shared rule is not a skill
        self.assertEqual(skills.catalog(have), [("/qa", "Answer only")])


class Agents(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.ws = Workspace(self.tmp.name)
        self.p = self.ws.add("demo")
        qa = self.ws.shared_rules.add("/qa")
        qa.run([(0, {"op": "rules", "md": QA})], "you")

    def tearDown(self) -> None:
        self.ws.close()
        self.tmp.cleanup()

    def test_kept_once_for_every_project_and_changes_apply_at_once(self) -> None:
        self.assertEqual(self.p.skills(), {"/qa": QA})
        self.assertEqual(self.ws.add("other").skills(), {"/qa": QA})
        s = self.ws.shared_rules.get(next(iter(self.ws.shared_rules.rules)))
        s.run([(0, {"op": "rules", "md": "Answer, change nothing."})], "you")
        self.assertEqual(self.p.skills(), {"/qa": "Answer, change nothing."})

    def test_words_applying_it_come_with_its_text(self) -> None:
        self.p.run([(0, {"op": "new", "title": "Export plan"})], "you")
        lines, _ = self.p.run([(0, {"op": "input", "text": "/qa what does the plan say about filters?", "scope": 1})], "you")
        rid = lines[0].split()[1]
        with self.p.lock:
            rd = self.p.reading()
            card = render.card(rd, self.p.state.tasks[1])
            inbox = render.input_card(rd, self.p.state.inputs[rid])
        for text in (card, inbox):
            self.assertIn("skill /qa (the user applied it to these words; do as it says):", text)
            self.assertIn("只回答，不改代码", text)
        with self.p.lock:
            self.assertIn("只回答，不改代码", organizer.context(self.p, self.p.state.inputs[rid]))

    def test_other_words_come_as_before(self) -> None:
        lines, _ = self.p.run([(0, {"op": "input", "text": "export keeps the filter"})], "you")
        with self.p.lock:
            self.assertNotIn("skill /qa", render.input_card(self.p.reading(), self.p.state.inputs[lines[0].split()[1]]))

    def test_the_list_comes_with_the_rules(self) -> None:
        listed = skills.listing(self.p.skills(), "BASE")
        self.assertIn("/qa  回答问题，只答不做。", listed)
        self.assertIn("GET BASE/skill?name=<name>", listed)
        with self.p.lock:
            self.assertIn("/qa", organizer.context(self.p, self.p.state.inputs.get("r1") or _input(self.p)))


def _input(p):
    lines, _ = p.run([(0, {"op": "input", "text": "hello"})], "you")
    return p.state.inputs[lines[0].split()[1]]


if __name__ == "__main__":
    unittest.main()
