"""T867 (Yadong r1467 r1468): a group says where it stands in one line. An agent writes it (`T1 update ...`; a new one
replaces the last); the list, the group's card and every task under it show it; an agent finishing a task in a group is
reminded of it. It is the group's next field, so you change it where you edit the group."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from support import ProjectCase  # noqa: E402
from taska.agent_text.language import parse  # noqa: E402
from taska.agent_text.render import card, listing  # noqa: E402


class GroupUpdate(ProjectCase):
    def do(self, text: str, by: str = "claude-code") -> list:
        return self.p.run(parse(text), by)[0]

    def setUp(self) -> None:
        super().setUp()
        self.do("new group P1 Checkout\nnew P1 parent=T1 Total does not follow the amount\nnew P2 parent=T1 Coupon error\n",
                "you")

    def test_an_agent_writes_where_the_group_stands_and_everything_shows_it(self) -> None:
        self.assertEqual(self.do("T1 update The total is fixed; the coupon error is next\n"), ["ok T1 next"])
        st = self.p.state
        self.assertEqual(st.tasks[1].next, "The total is fixed; the coupon error is next")
        self.assertIn("— now: The total is fixed", listing(st, {}))
        self.assertIn("now: The total is fixed; the coupon error is next", card(self.p.reading(), st.tasks[1]))
        under = card(self.p.reading(), st.tasks[3])
        self.assertIn("part of T1 (group, 0/2 finished): Checkout\n  now: The total is fixed", under)
        self.do("T1 update Both fixed, waiting for review\n")
        self.assertEqual(self.p.state.tasks[1].next, "Both fixed, waiting for review")  # a new one replaces the last

    def test_finishing_a_task_in_a_group_reminds_of_it(self) -> None:
        got = self.do("T2 done\n")[0]
        self.assertIn("(it is in group T1: if where that stands changed, say it in one line: `T1 update ...`)", got)
        self.assertNotIn("in group", self.do("new P1 Alone\nT4 done\n")[-1])
