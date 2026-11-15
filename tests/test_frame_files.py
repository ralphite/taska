"""B790: a web page document's sandboxed frame has the project's files with the project's files pass, and nothing else."""

from __future__ import annotations

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.http.access import Access  # noqa: E402
from taska.http.messages import Request, Response  # noqa: E402

FRAME = {"Host": "server.example.ts.net:7340", "Sec-Fetch-Site": "cross-site", "Sec-Fetch-Mode": "no-cors",
         "Sec-Fetch-Dest": "audio", "X-Forwarded-For": "1.2.3.4"}


class FrameFiles(unittest.TestCase):
    def setUp(self) -> None:
        self.access = Access(lambda: "ab12-cd34", lambda path: False)

    def ask(self, path: str, method: str = "GET") -> object:
        return self.access.check(Request(method, path, dict(FRAME), "127.0.0.1"))

    def test_the_pass_lets_in_that_projects_files_only(self) -> None:
        cap = self.access.files_cap("system-design")
        self.assertIsInstance(self.ask(f"/p/system-design/f/f50-D5-zh-1.1.mp3?cap={cap}"), Request)
        self.assertIsInstance(self.ask(f"/p/system-design/f/f50-D5-zh-1.1.mp3?cap={cap}", "HEAD"), Request)
        for refused in (f"/p/dev2/f/f406-x.mp4?cap={cap}", f"/p/system-design/api/view?cap={cap}",
                        f"/p/system-design/f/f50.mp3?cap={cap}&x=1", "/p/system-design/f/f50.mp3?cap=00ff",
                        "/p/system-design/f/f50.mp3"):
            answer = self.ask(refused)
            self.assertIsInstance(answer, Response, refused)
            self.assertEqual(answer.status, 403, refused)
        self.assertIsInstance(self.ask(f"/p/system-design/f/f50.mp3?cap={cap}", "POST"), Response)

    def test_the_pass_changes_with_the_key(self) -> None:
        other = Access(lambda: "ef56-gh78", lambda path: False)
        self.assertNotEqual(self.access.files_cap("system-design"), other.files_cap("system-design"))
        self.assertNotEqual(self.access.files_cap("system-design"), self.access.files_cap("dev2"))


if __name__ == "__main__":
    unittest.main()
