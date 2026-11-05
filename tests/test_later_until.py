"""D115 #21: Later with a day. An item put Later until a day (Tomorrow, Next week, a day picked; an agent writes
`B03 later until 2026-11-10`) is back to Now by itself on that day, with the subitems that went Later with it; back to
Now or Later with no day, the day goes. The log keeps it (a `due` event), replaying gives the same state, the agent
text and the page say it."""

from __future__ import annotations

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.agent_text import language  # noqa: E402
from taska.agent_text.render import line  # noqa: E402
from taska.domain.projection import replay  # noqa: E402
from taska.page_api.views import item_view  # noqa: E402
from taska.services.workspace import Workspace  # noqa: E402


class LaterUntil(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.ws = Workspace(os.path.join(self.tmp.name, "data"), "", gemini=False)
        self.p = self.ws.add("demo")
        self.run_as("you", {"op": "new", "title": "Paint the fence", "type": "task"},
                    {"op": "new", "title": "Buy the paint", "type": "task", "parent": "T1"})

    def tearDown(self) -> None:
        self.ws.close()
        self.tmp.cleanup()

    def run_as(self, by: str, *commands: dict) -> list:
        return self.p.run([(0, c) for c in commands], by)[0]

    def it(self, n: int):
        return self.p.state.items[n]

    def test_later_until_a_day_comes_back_on_that_day(self) -> None:
        self.run_as("you", {"op": "set", "ref": "T1", "f": {"when": "later", "later_until": "2026-11-10"}})
        self.assertEqual((self.it(1).when, self.it(1).later_until), ("later", "2026-11-10"))
        self.assertEqual(self.it(2).when, "later")  # its subitem went Later with it
        self.assertEqual(self.p.bring_back_laters("2026-11-09"), 0)
        self.assertEqual(self.it(1).when, "later")
        self.assertEqual(self.p.bring_back_laters("2026-11-10"), 1)
        self.assertEqual((self.it(1).when, self.it(1).later_until), ("now", None))
        self.assertEqual(self.it(2).when, "now")  # and back with it
        self.assertEqual(self.p.bring_back_laters("2026-11-11"), 0)  # once
        rows = [row for _, row, _ in self.p.store.db.rows() if row]
        self.assertEqual([r["k"] for r in rows].count("due"), 1)  # the log keeps it
        again = replay(rows, lambda *_: None)  # and the log replayed gives the same
        self.assertEqual((again.items[1].when, again.items[1].later_until, again.items[2].when), ("now", None, "now"))

    def test_a_day_alone_puts_it_later_and_now_takes_the_day_away(self) -> None:
        self.run_as("you", {"op": "set", "ref": "T1", "f": {"later_until": "2026-11-10"}})
        self.assertEqual(self.it(1).when, "later")
        self.run_as("you", {"op": "set", "ref": "T1", "f": {"when": "now"}})
        self.assertEqual((self.it(1).when, self.it(1).later_until), ("now", None))
        self.run_as("you", {"op": "set", "ref": "T1", "f": {"when": "later", "later_until": "2026-11-10"}})
        self.run_as("you", {"op": "set", "ref": "T1", "f": {"later_until": None}})  # Later, no day
        self.assertEqual((self.it(1).when, self.it(1).later_until), ("later", None))

    def test_a_day_is_checked(self) -> None:
        out = self.run_as("you", {"op": "set", "ref": "T1", "f": {"later_until": "next tuesday"}})
        self.assertTrue(out[0].startswith("err"), out)
        out = self.run_as("you", {"op": "set", "ref": "T1", "f": {"later_until": "2026-02-30"}})
        self.assertTrue(out[0].startswith("err"), out)
        out = self.run_as("claude-code", {"op": "due", "ref": "T1", "today": "2030-01-01"})
        self.assertTrue(out[0].startswith("err"), out)  # only Taska brings it back

    def test_the_agent_text_reads_and_says_it(self) -> None:
        cmds = language.parse("T1 later until 2026-11-10")
        self.assertEqual(cmds, [(1, {"op": "set", "ref": "T1", "f": {"when": "later", "later_until": "2026-11-10"}})])
        self.run_as("claude-code", cmds[0][1])
        self.assertIn("later until 2026-11-10", line(self.p.state, self.it(1)))
        self.assertEqual(item_view(self.p.state, self.p.agents, self.it(1)).get("later_until"), "2026-11-10")


if __name__ == "__main__":
    unittest.main()
