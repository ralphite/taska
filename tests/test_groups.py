"""T856 (D152 part 2, Yadong r1455 r1457): a group holds tasks and gives them its words. It has no status of its own,
/next never gives it, it is never done by itself (the user archives it); any task can be made a group or a task again.
An agent's group needs no approval (D153)."""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from support import ProjectCase  # noqa: E402
from taska.agent_text.language import parse  # noqa: E402
from taska.agent_text.render import card, listing  # noqa: E402
from taska.agent_text.work import Asker, next_work  # noqa: E402


class Groups(ProjectCase):
    def do(self, text: str, by: str = "claude-code") -> list:
        return self.p.run(parse(text), by)[0]

    def setUp(self) -> None:
        super().setUp()
        self.do("new group P1 Checkout\n  Every UI change starts as a Storybook prototype.\n"
                "new P1 parent=T1 Total does not follow the amount\nnew P2 parent=T1 Say what is wrong with the code\n",
                "you")

    def test_an_agents_group_is_open_and_says_how_to_fill_it(self) -> None:
        self.assertEqual(self.do("new group Export\n"),
                         ["ok T4 new group (a group holds tasks: put them in with parent=T4; /next never gives it)"])
        self.assertEqual(self.p.state.tasks[4].status, "open")
        self.assertTrue(self.p.state.tasks[4].group)

    def test_next_never_gives_a_group_even_with_its_tasks_finished(self) -> None:
        self.do("T2 done\nT3 done\n", "you")
        got = next_work(self.p.reading(), "test", False, Asker(who="codex"))
        self.assertNotIn("next T1", got.text)
        self.assertIn("nothing to do now", got.text)

    def test_the_list_card_and_tasks_under_it_say_it_is_a_group(self) -> None:
        self.do("T2 done\n", "you")
        st = self.p.state
        self.assertIn("T1 P1 now group 1/2 Checkout", listing(st, {}))
        head = card(self.p.reading(), st.tasks[1]).split("\n")
        self.assertEqual(head[0], "T1 group P1 now  Checkout  (1/2 finished; a group is never given by /next and never "
                                  "done by itself)")
        self.assertEqual(head[1], "tasks: T2 done · T3 open")
        sub = card(self.p.reading(), st.tasks[3])
        self.assertIn("part of T1 (group, 1/2 finished): Checkout", sub)
        self.assertIn("Every UI change starts as a Storybook prototype.", sub)

    def test_no_status_on_a_group_and_back_to_a_task(self) -> None:
        self.assertIn("is a group: it has no status", self.do("T1 done\n")[0])
        self.assertIn("is a group: it has no status", self.do("T1 open\n")[0])  # the same answer, whatever status
        self.assertEqual(self.do("T1 task\n"), ["ok T1 task (/next gives it again once its subtasks are finished)"])
        self.assertEqual(self.do("T2 group\n", "you"), ["ok T2 group (/next no longer gives it; its subtasks stay under it)"])

    def test_a_finished_task_made_a_group_is_open(self) -> None:
        self.do("T2 done\n", "you")
        self.do("T2 group\n", "you")
        self.assertEqual(self.p.state.tasks[2].status, "open")


if __name__ == "__main__":
    unittest.main()
