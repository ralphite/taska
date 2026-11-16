"""B816 (Yadong r1383, r1397): an item's states in one place (domain/item_states). Who may change a status; an agent's
done is review and takes back its own open questions (I779 waited for an answer and an acceptance at once); the agent
on an item you close or drop is told at once to stop, once; an approval needs no telling (it joins the queue)."""

from __future__ import annotations

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from support import ServerCase
from taska.domain import item_states as S  # noqa: E402


class Table(unittest.TestCase):
    def test_who_may_change_what(self) -> None:
        steps = set(S.steps())
        self.assertIn((S.PROPOSED, S.OPEN, S.YOU), steps)  # you approve
        self.assertNotIn((S.PROPOSED, S.OPEN, S.AGENT), steps)  # an agent never approves
        self.assertIn((S.PROPOSED, S.DROPPED, S.AGENT), steps)  # it takes its own back
        self.assertNotIn((S.DOING, S.REVIEW, S.ORG), steps)  # the organizer finishes no work
        self.assertIn((S.DOING, S.REVIEW, S.AGENT), steps)
        self.assertNotIn((S.REVIEW, S.DONE, S.AGENT), steps)  # done is yours: you accept
        self.assertEqual(S.asked(S.DOING, S.DONE, "claude-code"), S.REVIEW)
        self.assertEqual(S.asked(S.DOING, S.DONE, "you"), S.DONE)
        self.assertIsNotNone(S.refusal("B1", S.DROPPED, S.OPEN, "codex", closed_by="you"))
        self.assertIsNone(S.refusal("B1", S.DROPPED, S.OPEN, "codex", closed_by="codex"))

    def test_only_closing_work_in_progress_is_told(self) -> None:
        self.assertEqual(S.told(S.DOING, S.DROPPED, "you"), S.STOP)
        self.assertEqual(S.told(S.DOING, S.DONE, "org"), S.STOP)
        self.assertIsNone(S.told(S.OPEN, S.DROPPED, "you"))  # no one is on it
        self.assertIsNone(S.told(S.PROPOSED, S.OPEN, "you"))  # an approval joins the queue
        self.assertIsNone(S.told(S.DOING, S.DROPPED, "claude-code"))  # the agent itself


class Commands(ServerCase):
    def nxt(self, by: str = "claude-code", session: str = "") -> str:
        return self.get(f"/next?by={by}" + (f"&session={session}" if session else ""))

    def new(self, title: str) -> str:
        return self.page({"op": "new", "title": title, "type": "task"})["results"][0].split()[1]

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
        out = self.do("new task proposed thing")
        code = out.split()[1]
        self.assertNotIn(f"next {code}", self.nxt())
        self.page({"op": "set", "ref": code, "f": {"status": "open"}})
        self.assertIn(f"next {code}", self.nxt())


if __name__ == "__main__":
    unittest.main()
