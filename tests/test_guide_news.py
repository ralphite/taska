"""F743 (approved by Yadong): when the guide for agents changes, agents already connected learn what changed the next
time they talk to Taska: once, in their next /next or /do reply, with the lines that changed. A session Taska has
never seen gets no notice (it reads /agent); reading /agent marks the guide as read. The marks survive a restart."""

from __future__ import annotations

import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from support import ProjectCase
from taska.agent_text import guide_text  # noqa: E402
from taska.http import agent_routes  # noqa: E402
from taska.http.messages import Request  # noqa: E402
from taska.services.project import Project  # noqa: E402

HEAD = "The guide for agents changed: read GET /agent again. What changed:"
OLD = "  curl -s BASE/log?n=30     recent changes\n"
NEW = "  curl -s BASE/log?n=30     recent changes, newest last\n"


def changed_guide() -> "mock._patch[str]":
    assert OLD in guide_text.AGENT
    return mock.patch.object(guide_text, "AGENT", guide_text.AGENT.replace(OLD, NEW))


class GuideNews(ProjectCase):
    def call(self, path: str, body: str = "") -> str:
        data = body.encode()
        req = Request("POST" if body else "GET", path, {}, "127.0.0.1", read_body=lambda limit: data)
        sub = path.split("?")[0]
        res = agent_routes.do(req, self.p) if sub == "/do" else agent_routes.get(req, self.p, sub, "http://x/p/demo")
        assert res is not None
        return res.body.decode() if isinstance(res.body, bytes) else str(res.body)

    def test_a_session_that_saw_the_guide_is_told_once_what_changed(self) -> None:
        self.call("/next?by=codex&session=one")  # first contact: marked, no notice
        with changed_guide():
            out = self.call("/next?by=codex&session=one")
            self.assertIn(HEAD, out)
            self.assertIn("  -   curl -s BASE/log?n=30     recent changes", out)
            self.assertIn("  +   curl -s BASE/log?n=30     recent changes, newest last", out)
            self.assertNotIn(HEAD, self.call("/next?by=codex&session=one"))  # once
            self.assertNotIn(HEAD, self.call("/do?by=codex&session=one", "new task Tidy up\n"))

    def test_the_do_reply_tells_it_too(self) -> None:
        self.call("/do?by=codex&session=two", "new task Tidy up\n")
        with changed_guide():
            out = self.call("/do?by=codex&session=two", "new task Tidy up more\n")
        self.assertIn("\n" + HEAD + "\n", out)

    def test_a_new_session_gets_none(self) -> None:
        self.call("/next?by=codex&session=old")
        with changed_guide():
            self.assertNotIn(HEAD, self.call("/next?by=codex&session=new"))
            self.assertNotIn(HEAD, self.call("/do?by=claude-code", "new task Tidy up\n"))

    def test_reading_the_guide_marks_it_read(self) -> None:
        self.call("/next?by=codex&session=one")
        with changed_guide():
            self.assertIn("recent changes, newest last", self.call("/agent?by=codex&session=one"))
            self.assertNotIn(HEAD, self.call("/next?by=codex&session=one"))
        self.assertIn(HEAD, self.call("/next?by=codex&session=one"))  # changed back: told again

    def test_a_long_change_is_cut_short(self) -> None:
        self.call("/next?by=codex")
        with mock.patch.object(guide_text, "AGENT", guide_text.AGENT.replace("\n", " x\n")):
            out = self.call("/next?by=codex").split("\n")
        at = out.index(HEAD)
        self.assertEqual(sum(1 for x in out[at + 1:] if x.startswith(("  - ", "  + "))), 40)
        self.assertTrue(any(x.startswith("  …") and x.endswith(" more lines") for x in out), out)

    def test_the_marks_survive_a_restart(self) -> None:
        self.call("/next?by=codex&session=one")
        self.p.close()
        self.p = Project(self.tmp.name, "demo")
        with changed_guide():
            self.assertIn(HEAD, self.call("/next?by=codex&session=one"))


if __name__ == "__main__":
    unittest.main()
