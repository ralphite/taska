"""B830 (T789): the logs say what happened. A model that gave no answer is not written as 200, and a request turned
away says where it came from and how it was asked, without the asking page's address (it may hold the key)."""

from __future__ import annotations

import logging
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.http.app import turned_away  # noqa: E402
from taska.http.messages import Request  # noqa: E402
from taska.infra import gemini  # noqa: E402


class LogWords(unittest.TestCase):
    def test_no_answer_is_not_written_as_200(self) -> None:
        got = []
        handler = type("H", (logging.Handler,), {"emit": lambda self, r: got.append(r)})()
        gemini.log.addHandler(handler)
        was = gemini.log.level
        gemini.log.setLevel(logging.INFO)
        try:
            gemini._logged("voice", "m", {}, 30853, error="TimeoutError('The read operation timed out')")
            gemini._logged("voice", "m", {}, 900, reply={})
        finally:
            gemini.log.removeHandler(handler)
            gemini.log.setLevel(was)
        self.assertEqual([r.getMessage() for r in got], ["gemini m for voice: no answer in 30853 ms", "gemini m for voice: 200 in 900 ms"])

    def test_a_request_turned_away_says_where_from_but_not_the_address(self) -> None:
        req = Request("GET", "/p/sd/D36", {"Referer": "https://x.example/k/secret/p/a", "Sec-Fetch-Site": "cross-site",
                                            "Sec-Fetch-Mode": "no-cors", "Sec-Fetch-Dest": "iframe"}, "127.0.0.1")
        self.assertEqual(turned_away(req, 403), {"from": "https://x.example", "fetch": "cross-site/no-cors/iframe"})
        self.assertEqual(turned_away(req, 200), {})
        self.assertEqual(turned_away(Request("GET", "/", {}, "127.0.0.1"), 401), {"from": "", "fetch": "-/-/-"})


if __name__ == "__main__":
    unittest.main()
