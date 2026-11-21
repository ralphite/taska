"""T855 (D152, Yadong r1455 r1459): items have no types; tags say what an item is (#bug, #手机). Items stored with a
type before read bug as the tag bug and the other types as no tag; every code is T and a number, and the older
codes name the same item. An agent still writing a type is refused with its command written with a tag instead."""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from support import ProjectCase  # noqa: E402
from taska.agent_text.language import parse  # noqa: E402
from taska.agent_text.render import card, listing  # noqa: E402
from taska.domain.projection.core import replay  # noqa: E402

T = "2026-11-01T10:%02d:00-07:00"


def old_rows():
    """Items as they were stored before T855: each with a type, one changed from idea to bug."""
    add = {"k": "add", "by": "you", "src": None, "pri": "P1", "when": "now", "status": "open", "body": ""}
    return [dict(add, n=1, title="Export loses the filter", type="bug", t=T % 1),
            dict(add, n=2, title="Sort by date", type="feature", t=T % 2),
            dict(add, n=3, title="Maybe a dark page", type="idea", t=T % 3),
            {"k": "set", "n": 3, "by": "you", "f": {"type": "bug"}, "was": {"type": "idea"}, "src": None, "t": T % 4},
            {"k": "set", "n": 1, "by": "you", "f": {"type": "task"}, "was": {"type": "bug"}, "src": None, "t": T % 5}]


class OldItems(unittest.TestCase):
    def test_bug_reads_as_the_tag_bug_and_the_other_types_as_no_tag(self) -> None:
        st = replay(old_rows(), lambda seq, why: self.fail(why))
        self.assertEqual(st.items[2].tags, [])
        self.assertEqual(st.items[3].tags, ["bug"])  # set to bug later
        self.assertEqual(st.items[1].tags, [])  # a bug made a task later
        self.assertEqual([st.code(n) for n in (1, 2, 3)], ["T1", "T2", "T3"])


class Tags(ProjectCase):
    def do(self, text: str, by: str = "claude-code") -> list:
        return self.p.run(parse(text), by)[0]

    def test_new_with_tags_and_put_on_and_take_off(self) -> None:
        self.assertEqual(self.do("new P1 #bug #手机 Export loses the filter\n", "you"), ["ok T1 new"])
        self.assertEqual(self.p.state.items[1].tags, ["bug", "手机"])
        self.assertEqual(self.do("T1 #UX -#手机\n"), ["ok T1 +#ux -#手机 (tags now: #bug #ux)"])
        self.assertEqual(self.do("T1 #bug\n"), ["ok T1 no change (tags now: #bug #ux)"])
        bad = self.p.run([(0, {"op": "tag", "ref": "T1", "add": ["a.b"]})], "you")[0][0]
        self.assertIn("bad tag 'a.b'", bad)

    def test_the_card_and_the_list_show_tags_and_the_list_filters_by_one(self) -> None:
        self.do("new P1 #bug Export loses the filter\nnew P2 Sort by date\n", "you")
        st = self.p.state
        self.assertTrue(card(self.p.reading(), st.items[1]).startswith("T1 P1 now open #bug  Export loses the filter"))
        self.assertIn("T1 P1 now open #bug Export loses the filter", listing(st, {}))
        only = listing(st, {"tag": ["#bug"]})
        self.assertTrue(only.startswith("1 items"), only)
        self.assertNotIn("Sort by date", only)

    def test_an_old_code_names_the_same_item(self) -> None:
        self.do("new P1 Export loses the filter\n", "you")
        self.assertEqual(self.do("B1 P0\nF1 later\n", "you"), ["ok T1 pri=P0", "ok T1 when=later"])

    def test_a_type_is_refused_with_the_command_written_with_a_tag(self) -> None:
        self.do("new P1 Export loses the filter\n", "you")
        got = self.do("new bug P1 parent=T1 Export button too small\nT1 bug\nnew task P2 Tidy up\n")
        self.assertEqual(got, [
            "err L1: there are no types any more: write a tag instead: new #bug P1 parent=T1 Export button too small",
            "err L2: there are no types any more: write a tag instead: T1 #bug",
            "err L3: there are no types any more: write a tag instead: new P2 Tidy up"])
        self.assertEqual(len(self.p.state.items), 1)
        page = self.p.run([(0, {"op": "new", "title": "X", "type": "bug"})], "you")[0]
        self.assertEqual(page, ["err: there are no types any more: write a tag instead (#bug)"])


if __name__ == "__main__":
    unittest.main()
