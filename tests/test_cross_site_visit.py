"""T841: opening a Taska address from another app is a visit, whatever that app's browser says it is for (one said
"empty": four of its visits to a document were refused, 11-19); other cross-site requests and frames stay refused."""

from __future__ import annotations

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.http.access import Access  # noqa: E402
from taska.http.messages import Request, Response  # noqa: E402


class CrossSiteVisit(unittest.TestCase):
    def setUp(self) -> None:
        self.access = Access(lambda: "ab12-cd34", lambda path: False)

    def ask(self, mode: str, dest: str, method: str = "GET") -> object:
        headers = {"Host": "127.0.0.1:7340", "Sec-Fetch-Site": "cross-site", "Sec-Fetch-Mode": mode, "Sec-Fetch-Dest": dest}
        return self.access.check(Request(method, "/p/system-design/D48", headers, "127.0.0.1"))

    def test_a_visit_from_another_app_opens_the_page(self) -> None:
        for dest in ("document", "empty"):
            self.assertIsInstance(self.ask("navigate", dest), Request, dest)

    def test_other_cross_site_requests_and_frames_stay_refused(self) -> None:
        for mode, dest, method in (("navigate", "iframe", "GET"), ("cors", "empty", "GET"), ("no-cors", "script", "GET"),
                                   ("navigate", "document", "POST")):
            answer = self.ask(mode, dest, method)
            self.assertIsInstance(answer, Response, (mode, dest, method))
            self.assertEqual(answer.status, 403, (mode, dest, method))


if __name__ == "__main__":
    unittest.main()
