"""F581 transition: a page opened before the swap asks the old poll; it hears nothing new and a new version.

Delete with server/taska/http/old_page_poll.py.
"""

import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "server"))

from taska.http import old_page_poll  # noqa: E402
from taska.http.messages import Request  # noqa: E402


def ask(query: str) -> dict:
    a = old_page_poll.answer(Request("GET", "/p/taska/api/poll?" + query, {}, "127.0.0.1"))
    assert a.status == 200
    return json.loads(a.body)


class OldPagePollTest(unittest.TestCase):
    def test_gives_back_what_it_sent(self) -> None:
        # numbers stay numbers and the boot a string: the old page compares them with !==
        self.assertEqual(ask("rev=4182&boot=lq3x9a&pv=17&wait=0"), {"rev": 4182, "boot": "lq3x9a", "pv": 17, "ver": "rewrite"})

    def test_as_the_old_server_read_what_is_missing(self) -> None:
        self.assertEqual(ask("rev=0&boot=lq3x9a&wait=0"), {"rev": 0, "boot": "lq3x9a", "pv": -1, "ver": "rewrite"})


if __name__ == "__main__":
    unittest.main()
