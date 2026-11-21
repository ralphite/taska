"""B802 C462 (B792 r1340): a change from the page that Taska refuses is logged with what it was and why, never the
words in it, so a refused change can be told apart later."""

from __future__ import annotations

import io
import json
import logging
import os
import sys
import unittest
from types import SimpleNamespace

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from support import ProjectCase  # noqa: E402
from taska.http import page_routes  # noqa: E402
from taska.http.app import ProjectPages  # noqa: E402
from taska.http.messages import Request  # noqa: E402


class RefusedLogged(ProjectCase):
    def test_a_refused_change_is_logged_with_what_and_why(self) -> None:
        got = []
        log = logging.getLogger("test-refused")
        log.addHandler(type("H", (logging.Handler,), {"emit": lambda self, r: got.append(r)})())
        pages = ProjectPages()
        ctx = SimpleNamespace(log=log, pages=lambda p: pages, status=SimpleNamespace(note_lock_wait=lambda req, ms: None))
        body = json.dumps({"id": "c1", "commands": [{"op": "set", "ref": "T9", "f": {"status": "open", "body": "my private words"}}]}).encode()
        req = Request("POST", "/p/demo/api/commands", {"Content-Type": "application/json"}, "127.0.0.1", read_body=lambda limit: body)
        answer = page_routes._commands(ctx, req, self.p)
        self.assertEqual(answer.status, 400)
        self.assertEqual(len(got), 1)
        f = got[0].f  # type: ignore[attr-defined]
        self.assertEqual(f["kind"], "refused")
        self.assertEqual(f["commands"], [{"op": "set", "ref": "T9", "fields": {"status": "open"}}])
        self.assertTrue(f["results"][0].startswith("err"))
        self.assertNotIn("my private words", json.dumps(f) + got[0].getMessage())

    def test_every_change_you_make_is_logged_without_its_words(self) -> None:
        """F846 r1451: every action you take is in the log, for product analysis."""
        got = []
        log = logging.getLogger("test-changes")
        log.addHandler(type("H", (logging.Handler,), {"emit": lambda self, r: got.append(r)})())
        log.setLevel(logging.INFO)
        pages = ProjectPages()
        ctx = SimpleNamespace(log=log, pages=lambda p: pages, status=SimpleNamespace(note_lock_wait=lambda req, ms: None))
        self.p.run([(0, {"op": "new", "title": "A thing"})], "you")
        body = json.dumps({"id": "c2", "commands": [{"op": "set", "ref": "T1", "f": {"pri": "P2", "body": "my private words"}}]}).encode()
        req = Request("POST", "/p/demo/api/commands", {"Content-Type": "application/json"}, "127.0.0.1", read_body=lambda limit: body)
        self.assertEqual(page_routes._commands(ctx, req, self.p).status, 200)
        f = got[0].f  # type: ignore[attr-defined]
        self.assertEqual((f["kind"], f["commands"]), ("change", [{"op": "set", "ref": "T1", "fields": {"pri": "P2"}}]))
        self.assertNotIn("my private words", json.dumps(f) + got[0].getMessage())


if __name__ == "__main__":
    unittest.main()
