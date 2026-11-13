"""T772 (I769, Yadong approved 11-13): a session that marks doing an item another session holds is not let do it
unknowingly: it is told who holds it and how to go on; only when the user asked it to, `B03 take` takes it, said on
the item so the session that had it hears it. Change only on Yadong's explicit word."""

from __future__ import annotations

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from support import ProjectCase
from taska.http import agent_routes  # noqa: E402
from taska.http.messages import Request  # noqa: E402


class HeldItems(ProjectCase):
    def setUp(self) -> None:
        super().setUp()
        self.p.run([(0, {"op": "new", "type": "task", "pri": "P1", "when": "now", "title": "Export loses the filter"})], "you")

    def get(self, path: str) -> str:
        req = Request("GET", path, {}, "127.0.0.1", read_body=lambda limit: b"")
        res = agent_routes.get(req, self.p, path.split("?")[0], "http://x/p/demo")
        assert res is not None
        return res.body.decode()

    def do(self, session: str, body: str) -> str:
        req = Request("POST", f"/do?by=claude-code&session={session}", {}, "127.0.0.1", read_body=lambda limit: body.encode())
        return agent_routes.do(req, self.p).body.decode()

    def test_another_session_is_told_who_holds_it_and_does_not_take_it(self) -> None:
        self.assertIn("next T1", self.get("/next?by=claude-code&session=alpha"))
        out = self.do("beta", "T1 doing\n")
        self.assertIn("T1 is held by claude-code · alpha", out)
        self.assertIn("T1 take", out)
        self.assertEqual(self.p.state.items[1].status, "open")
        self.assertIn("ok T1 status=doing", self.do("alpha", "T1 doing\n"))  # the holder itself: as before

    def test_take_when_the_user_asked_is_said_on_the_item_and_the_holder_hears_it(self) -> None:
        self.get("/next?by=claude-code&session=alpha")
        out = self.do("beta", "T1 take\n")
        self.assertIn("ok T1 status=doing", out)
        said = [m.text for m in self.p.state.items[1].thread]
        self.assertIn("@alpha taken over from you, as the user asked.", said)
        self.assertIn("taken over from you", self.do("alpha", "T1 progress still here\n"))  # alpha is told on its next call

    def test_an_item_nobody_holds_is_taken_as_before(self) -> None:
        self.assertIn("ok T1 status=doing", self.do("beta", "T1 doing\n"))


if __name__ == "__main__":
    unittest.main()
