"""T880: the wait command /next gives when there is nothing to do works as it is for a session whose name has spaces
or Chinese (a session named "Taska project T875" was given an address with a bare space: curl refused it, so the
session never waited and no work woke it)."""

from __future__ import annotations

import os
import re
import sys
import unittest
from urllib.parse import parse_qs, quote, urlsplit

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from support import ProjectCase
from taska.http import agent_routes  # noqa: E402
from taska.http.messages import Request  # noqa: E402


class ListenCommand(ProjectCase):
    def wait_url(self, session: str) -> str:
        path = f"/next?by=claude-code&session={quote(session)}"
        req = Request("GET", path, {}, "127.0.0.1", read_body=lambda limit: b"")
        res = agent_routes.get(req, self.p, "/next", "http://x/p/demo")
        assert res is not None
        body = res.body.decode() if isinstance(res.body, bytes) else str(res.body)
        m = re.search(r'curl -s "([^"]+)" \| sh', body)
        assert m, body
        return m.group(1)

    def test_a_name_with_spaces_and_chinese_is_quoted(self) -> None:
        for name in ("Taska project T875", "整理 任务"):
            url = self.wait_url(name)
            self.assertNotIn(" ", url)
            self.assertEqual(parse_qs(urlsplit(url).query), {"by": ["claude-code"], "session": [name]})

    def test_a_plain_name_is_as_before(self) -> None:
        self.assertEqual(self.wait_url("worker"), "BASE/listen?by=claude-code&session=worker")


if __name__ == "__main__":
    unittest.main()
