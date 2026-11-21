"""B816 (Yadong r1383, r1397): an item's states in one place (domain/item_states). Who may change a status; an agent's
done is review and takes back its own open questions (I779 waited for an answer and an acceptance at once); the agent
on an item you close or drop is told at once to stop, once; an approval needs no telling (it joins the queue)."""

from __future__ import annotations

import os
import re
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "server"))

from support import ServerCase
from taska.domain import item_states as S  # noqa: E402


class Table(unittest.TestCase):
    def test_the_documents_diagram_is_the_codes(self) -> None:
        # r1398: the state machine is part of the documents, kept by the code
        with open(os.path.join(ROOT, "docs", "item-states.md"), encoding="utf-8") as f:
            doc = f.read()
        drawn = re.search(r"```mermaid\n(stateDiagram-v2\n.*?)\n```", doc, re.S)
        self.assertIsNotNone(drawn)
        self.assertEqual(drawn.group(1), S.mermaid(), "docs/item-states.md: paste item_states.mermaid() in")

    def test_every_step_drawn_is_allowed_and_told_as_drawn(self) -> None:
        for f, t, who, what in S.STEPS:
            if f is None:
                continue
            self.assertIsNone(S.refusal("X", f, t, who, None), (f, t, who))
            self.assertEqual(S.told(f, t, who) == S.STOP, "told to stop" in what, (f, t, who))

    def test_who_may_not(self) -> None:
        self.assertIsNotNone(S.refusal("B1", S.PROPOSED, S.OPEN, "codex", None))  # an agent never approves
        self.assertIsNotNone(S.refusal("B1", S.DOING, S.REVIEW, "org", None))  # the organizer finishes no work
        self.assertIsNotNone(S.refusal("B1", S.REVIEW, S.DONE, "codex", None))  # done is yours: you accept
        self.assertEqual(S.asked(S.DOING, S.DONE, "claude-code"), S.REVIEW)
        self.assertEqual(S.asked(S.DOING, S.DONE, "you"), S.DONE)
        self.assertIsNotNone(S.refusal("B1", S.DROPPED, S.OPEN, "codex", closed_by="you"))
        self.assertIsNone(S.refusal("B1", S.DROPPED, S.OPEN, "codex", closed_by="codex"))

    def test_only_closing_work_in_progress_is_told(self) -> None:
        self.assertEqual(S.told(S.DOING, S.DONE, "org"), S.STOP)  # the organizer, from your words
        self.assertIsNone(S.told(S.OPEN, S.DROPPED, "you"))  # no one is on it
        self.assertIsNone(S.told(S.PROPOSED, S.OPEN, "you"))  # an approval joins the queue
        self.assertIsNone(S.told(S.DOING, S.DROPPED, "claude-code"))  # the agent itself


class Commands(ServerCase):
    def nxt(self, by: str = "claude-code", session: str = "") -> str:
        return self.get(f"/next?by={by}" + (f"&session={session}" if session else ""))

    def new(self, title: str) -> str:
        return self.page({"op": "new", "title": title})["results"][0].split()[1]

    def test_a_done_takes_back_the_agents_open_question(self) -> None:
        code = self.new("ask then finish")
        self.do(f"{code} doing\n{code} ask which way?\n    - ( ) a\n    - ( ) b")
        out = self.do(f"{code} done finished it the likely way")
        self.assertIn("open question is taken back", out)
        waits = [x for x in self.nxt().split("\n") if x.startswith("waiting on the user")]
        self.assertFalse(any(code in x for x in waits), waits)
        card = self.get(f"/{code}")
        self.assertIn("review", card.split("\n")[0])
        self.assertIn("withdraw: Result handed in", card)

    def test_asked_again_in_review_then_handed_in(self) -> None:
        code = self.new("review then ask")
        self.do(f"{code} doing\n{code} done first result")
        self.do(f"{code} ask one more thing?\n    - ( ) yes\n    - ( ) no")
        self.assertIn("open question is taken back", self.do(f"{code} done went with yes"))
        waits = [x for x in self.nxt().split("\n") if x.startswith("waiting on the user")]
        self.assertFalse(any(code in x for x in waits), waits)

    def test_closing_what_an_agent_is_on_tells_it_to_stop_once(self) -> None:
        code = self.new("being worked on")
        self.do(f"{code} doing\n{code} progress started", session="worker-one")
        self.page({"op": "set", "ref": code, "f": {"status": "dropped"}})
        self.assertNotIn(f"stop {code}", self.nxt(session="someone-else"))  # not the one on it
        told = self.nxt(session="worker-one")
        self.assertIn(f"stop {code}: the user marked it won't do", told)
        self.assertNotIn(f"stop {code}", self.nxt(session="worker-one"))  # once

    def test_an_approval_joins_the_queue_without_a_notice(self) -> None:
        out = self.do("new proposed thing")
        code = out.split()[1]
        self.assertNotIn(f"next {code}", self.nxt())
        self.page({"op": "set", "ref": code, "f": {"status": "open"}})
        self.assertIn(f"next {code}", self.nxt())

    def test_your_reply_on_a_proposal_approves_it(self) -> None:
        # B818 r1401: replying on an agent's proposal approves it; the agent's own words do not
        code = self.do("new proposed by an agent").split()[1]
        self.do(f"{code} say should I start with the export?")
        self.assertIn("proposed", self.get(f"/{code}").split("\n")[0])
        n = int(code[1:])
        self.page({"op": "input", "text": "yes, export first", "scope": n})
        self.assertIn("open", self.get(f"/{code}").split("\n")[0])
        self.assertIn(f"resume {code}: the user replied", self.nxt())

    def test_a_subitem_you_asked_for_starts_open(self) -> None:
        # B818 r1404: the parts the user asked an item to be split into start open, their words on them
        parent = self.new("a big feature")
        rid = self.page({"op": "input", "text": "split it into subtasks so we can track them", "scope": int(parent[1:])}
                        )["results"][0].split()[1]
        out = self.do(f"new P1 now parent={parent} src={rid} the export part")
        self.assertNotIn("proposed", out)
        code = out.split()[1]
        self.assertIn("open", self.get(f"/{code}").split("\n")[0])
        # without the user's words, or not under an item, it is a proposal
        self.assertIn("proposed", self.do(f"new P1 now parent={parent} another part"))
        self.assertIn("proposed", self.do(f"new P1 now src={rid} not a subitem"))
        self.page({"op": "set", "ref": code, "f": {"status": "dropped"}})  # out of the other tests' queue

    def test_words_on_your_items(self) -> None:
        self.assertEqual(S.on_your_words(S.PROPOSED), S.OPEN)
        self.assertEqual(S.on_your_words(S.REVIEW), S.OPEN)
        self.assertIsNone(S.on_your_words(S.DOING))  # the agent on it reads them
        self.assertIsNone(S.on_your_words(S.DROPPED))  # reopening is a choice of its own


if __name__ == "__main__":
    unittest.main()
