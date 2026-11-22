"""T862 (approved 11-21): a Claude Code session's wait gives only its id (sid=), no name. Two such sessions were one
"claude-code" to Taska: what one was on was the other's too, so words a third session wrote on it woke both, the
other with "resume T1: ... wrote on it (you are on it)" while it had nothing to do there. A session is told by its id
when it gives no name: by the name that id gave before, else the id's start."""

import os
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from support import ServerCase  # noqa: E402

A = "aaaaaaaa-1111-4111-8111-000000000001"
B = "bbbbbbbb-2222-4222-8222-000000000002"


class SessionsByTheirIds(ServerCase):
    def call(self, path: str, sid: str = "", session: str = "", body: str = "") -> str:
        q = f"by=claude-code" + (f"&sid={sid}" if sid else "") + (f"&session={session}" if session else "")
        req = urllib.request.Request(f"{self.p}{path}{'&' if '?' in path else '?'}{q}", data=body.encode() if body else None)
        return urllib.request.urlopen(req, timeout=10).read().decode()

    def test_words_on_an_task_wake_the_session_on_it_not_another_with_no_name(self) -> None:
        self.do("new P1 Export loses the filter\n", "you")
        self.assertIn("next T1", self.call("/next", sid=A))  # A takes T1
        self.assertIn("ok T1 say", self.call("/do", sid=A, body="T1 say looking at it\n"))
        self.assertNotIn("resume T1", self.call("/next", sid=A))  # its own words do not wake it
        self.call("/do", session="sysd", body="T1 say the export test fails on Safari too\n")
        self.assertIn("resume T1: claude-code · sysd wrote on it (you are on it)", self.call("/next", sid=A))
        self.assertNotIn("T1", self.call("/next", sid=B).split("\n", 5)[-1])  # B is not on T1: nothing about it

        # a session that gave its name once is that session by its id alone
        self.do("new P1 Sort by date\n", "you")
        self.call("/do", sid=B, session="tutor", body="T2 doing\n")
        card = self.call("/T2")
        self.assertIn("tutor", card)
        self.call("/do", session="sysd", body="T2 say a note for whoever is on it\n")
        self.assertIn("resume T2: claude-code · sysd wrote on it (you are on it)", self.call("/next", sid=B))


if __name__ == "__main__":
    import unittest
    unittest.main()
