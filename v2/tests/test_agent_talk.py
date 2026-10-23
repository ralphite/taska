"""F450: agents and sessions in one project talk on items. A message with @name reaches that session on its next
/next or /do reply; any other session's message on an item reaches the session working on it; a message from another
session does not take the item away from it."""

from __future__ import annotations

import os
import sys
import unittest
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from harness import Server  # noqa: E402

P = "/p/default"


class AgentTalk(unittest.TestCase):
    srv: Server

    @classmethod
    def setUpClass(cls) -> None:
        cls.srv = Server("v2")

    @classmethod
    def tearDownClass(cls) -> None:
        cls.srv.stop()

    def do(self, text: str, by: str = "claude-code", ses: Optional[str] = None) -> str:
        q = f"?by={by}" + (f"&session={ses}" if ses else "")
        code, _, body = self.srv.call("POST", f"{P}/do{q}", text)
        self.assertEqual(code, 200, body)
        return body

    def get(self, path: str, by: str = "claude-code", ses: Optional[str] = None) -> str:
        q = f"?by={by}" + (f"&session={ses}" if ses else "")
        code, _, body = self.srv.call("GET", f"{P}{path}{q}")
        self.assertEqual(code, 200, body)
        return body

    def test_sessions_talk(self) -> None:
        self.do("new feature P1 now Export the list\nnew feature P2 now Import a list", by="you")
        # each session gets its own item; the same agent's other session is "another one" (D66 #1)
        got = self.get("/next", ses="worker")
        self.assertIn("next F1", got)
        self.do("F1 doing", ses="worker")
        got = self.get("/next", ses="manager")
        self.assertIn("others are on (skip): F1 (claude-code · worker)", got)
        self.assertIn("next F2", got)

        # @worker reaches the worker: named once in its /do reply, then /next brings the item back (D66 #2, #3)
        said = self.do("F1 say @worker also check the CSV", ses="manager")
        self.assertIn("ok F1 say → worker", said)
        reply = self.do("F2 say a note", ses="worker")
        self.assertIn("claude-code · manager wrote to you on F1: @worker also check the CSV (GET /F1)", reply)
        self.assertNotIn("wrote to you", self.do("F2 say another note", ses="worker"))
        got = self.get("/next", ses="worker")
        self.assertIn("resume F1: claude-code · manager wrote to you", got)
        self.assertIn("claude-code · manager → worker: @worker also check the CSV", got)
        self.assertNotIn("resume F1", self.get("/next", ses="worker"))  # read: not again

        # the manager is on F2 (/next gave it): the worker's notes there reach it
        self.assertIn("resume F2: claude-code · worker wrote on it (you are on it) (#5)", self.get("/next", ses="manager"))
        # a message from another session leaves the item with the one working on it
        self.assertIn("others are on (skip): F1 (claude-code · worker)", self.get("/next", ses="manager"))

        # words on the item it is on reach it without a name; another agent kind too
        self.do("F1 say I looked at the export", by="codex")
        got = self.get("/next", ses="worker")
        self.assertIn("resume F1: codex wrote on it (you are on it)", got)

        # the worker answers the manager by name; reading the card counts as reading it
        self.do("F1 say @manager done, the CSV is fine", ses="worker")
        self.assertIn("resume F1: claude-code · worker wrote to you", self.get("/next", ses="manager"))
        self.do("F1 say @manager one more", ses="worker")
        self.get("/F1", ses="manager")
        self.assertNotIn("resume F1", self.get("/next", ses="manager"))

        # an unknown name is kept and said; @ in code or in an e-mail address names nobody
        self.assertIn("nobody: no session by that name", self.do("F2 say @nobody hello", ses="worker"))
        self.assertEqual(self.do("F2 say see `@worker` and a@worker.com", ses="manager").splitlines()[0], "ok F2 say")

        # a session with no name yet hears the words addressed to it once it calls
        got = self.get("/next", by="codex", ses="nobody")
        self.assertIn("resume F2: claude-code · worker wrote to you", got)

        # writing on that very item before reading it, the /do reply still names the words it had not read
        self.do("F1 say @worker one more thing", ses="manager")
        self.assertIn("claude-code · manager wrote to you on F1: @worker one more thing", self.do("F1 progress on it", ses="worker"))

        # naming itself names nobody; taking an item up, what was said there before is not news
        self.assertEqual(self.do("F2 say @manager a note to self", ses="manager").splitlines()[0], "ok F2 say")
        self.assertNotIn("wrote on F2", self.do("F2 doing", ses="late"))
        self.assertNotIn("resume F2", self.get("/next", ses="late"))
        self.do("F2 say over to you", ses="manager")
        self.assertIn("claude-code · manager wrote on F2, which you are on: over to you", self.do("F1 say ok", ses="late"))


if __name__ == "__main__":
    unittest.main()
