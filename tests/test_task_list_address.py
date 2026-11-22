"""T864 (Yadong r1465): there are no items, only tasks. An agent asking for the list at its old address (/items) is
told the new one, with what it asked for."""

import os
import sys
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from support import ServerCase  # noqa: E402


class TheTaskList(ServerCase):
    def test_tasks_lists_them_and_the_old_address_says_where_they_are(self) -> None:
        self.do("new P1 Export loses the filter\n", "you")
        self.assertIn("Export loses the filter", self.get("/tasks?by=claude-code"))
        with self.assertRaises(urllib.error.HTTPError) as got:
            urllib.request.urlopen(self.p + "/items?by=claude-code&q=export", timeout=10)
        said = got.exception.read().decode()
        self.assertIn("there are no items any more, only tasks: GET", said)
        self.assertIn("/tasks?by=claude-code&q=export", said)
