"""T772 (T769, Yadong approved 11-13): a session that marks doing a task another session holds is not let do it
unknowingly: it is told who holds it and how to go on; only when the user asked it to, `B03 take` takes it, said on
the task so the session that had it hears it. Change only on Yadong's explicit word."""

from __future__ import annotations

import dataclasses
import os
import sys
import time
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from support import ProjectCase
from taska.http import agent_routes  # noqa: E402
from taska.domain import holds  # noqa: E402
from taska.domain.vocab import CLAIM_TTL  # noqa: E402
from taska.http.messages import Request  # noqa: E402
from taska.infra.agent_sessions import Session  # noqa: E402
from taska.services.project import Project  # noqa: E402


class HeldTasks(ProjectCase):
    def setUp(self) -> None:
        super().setUp()
        self.p.run([(0, {"op": "new", "pri": "P1", "when": "now", "title": "Export loses the filter"})], "you")

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
        self.assertEqual(self.p.state.tasks[1].status, "open")
        self.assertIn("ok T1 status=doing", self.do("alpha", "T1 doing\n"))  # the holder itself: as before

    def test_take_when_the_user_asked_is_said_on_the_task_and_the_holder_hears_it(self) -> None:
        self.get("/next?by=claude-code&session=alpha")
        out = self.do("beta", "T1 take\n")
        self.assertIn("ok T1 status=doing", out)
        said = [m.text for m in self.p.state.tasks[1].thread]
        self.assertIn("@alpha T1 is taken over from you, as the user asked: stop working on it.", said)
        self.assertIn("stop working on it", self.do("alpha", "T1 progress still here\n"))  # alpha is told on its next call

    def test_an_task_nobody_holds_is_taken_as_before(self) -> None:
        self.assertIn("ok T1 status=doing", self.do("beta", "T1 doing\n"))


if __name__ == "__main__":
    unittest.main()


class WhoIsHere(HeldTasks):
    """T774 (T769): a session's /next says who else works here, on its first call and then only when that changed."""

    def test_told_once_then_only_when_it_changed(self) -> None:
        self.get("/next?by=codex&session=main")
        first = self.get("/next?by=claude-code&session=alpha")
        self.assertIn("other agent sessions here: codex · main (on T1, heard just now)", first)
        self.assertNotIn("other agent sessions here", self.get("/next?by=claude-code&session=alpha"))
        self.p.run([(0, {"op": "new", "pri": "P1", "when": "now", "title": "Sort by date"})], "you")
        self.do("beta", "T2 doing\n")
        self.assertIn("claude-code · beta (on T2, heard just now)", self.get("/next?by=claude-code&session=alpha"))


class HoldMoves(HeldTasks):
    """Found by tools/collab_check.py with real agents (T769 r1307): `doing` on a task already doing changed nothing,
    so a take or a manager's hand-on left the hold where it was."""

    def holder(self) -> str:
        return self.p.agents.holder(self.p.state, self.p.state.tasks[1])[0]

    def test_take_of_an_task_already_doing_moves_the_hold(self) -> None:
        self.get("/next?by=claude-code&session=alpha")
        self.do("alpha", "T1 doing\n")
        self.assertIn("ok T1 status=doing (yours now)", self.do("beta", "T1 take\n"))
        self.assertEqual(self.holder(), "claude-code · beta")
        self.do("alpha", "T1 progress still here\n")  # alpha's word on it later does not take it back
        self.assertEqual(self.holder(), "claude-code · beta")

    def test_a_worker_takes_the_task_its_manager_is_doing(self) -> None:
        self.get("/next?by=claude-code&session=manager")
        self.do("manager", "T1 doing\n")
        req = Request("POST", "/do?by=claude-code&session=worker-1&parent=manager", {}, "127.0.0.1", read_body=lambda limit: b"T1 doing\n")
        self.assertIn("ok T1 status=doing", agent_routes.do(req, self.p).body.decode())
        self.assertEqual(self.holder(), "claude-code · worker-1")


class HoldKept(HeldTasks):
    """T877: a session that handed the work to its own background agent writes nothing on Taska for a long while; its
    hold stays while its app says it is at work (busy, or waiting on the user) and the task is the one it took last."""

    SID = "aaaaaaaa-1111-4111-8111-000000000001"

    def holder(self, at: float):
        return self.p.agents.holder(self.p.state, self.p.state.tasks[1], time.time() + at)

    def app(self, status: str) -> None:  # alpha took T1, then its app says this of it
        if not self.p.state.claims:
            req = Request("POST", f"/do?by=claude-code&session=alpha&sid={self.SID}", {}, "127.0.0.1",
                          read_body=lambda limit: b"T1 doing\nT1 progress My own agent is on it\n")
            agent_routes.do(req, self.p)
        self.p.agents.see_sessions({self.SID: Session("claude-code", self.SID, "alpha", "/x", status)})

    def test_kept_while_its_session_is_at_work(self) -> None:
        self.app("busy")
        self.assertEqual(self.holder(CLAIM_TTL + 3600)[0], "claude-code · alpha")
        self.app("waiting")
        self.assertEqual(self.holder(CLAIM_TTL + 3600)[0], "claude-code · alpha")

    def test_lapses_once_its_session_is_idle_or_gone(self) -> None:
        self.app("busy")
        self.assertIsNotNone(self.holder(60))
        for status in ("idle", "exited"):
            self.app(status)
            self.assertIsNone(self.holder(CLAIM_TTL + 60))

    def test_not_kept_once_it_took_another_task(self) -> None:
        self.app("busy")
        self.p.run([(0, {"op": "new", "pri": "P1", "when": "now", "title": "Sort by date"})], "you")
        time.sleep(1.1)  # the times are in seconds
        self.do("alpha", "T2 doing\n")
        self.assertIsNone(self.holder(CLAIM_TTL + 60))

    def test_a_session_that_gives_its_id_alone_is_found_by_it(self) -> None:
        """Claude Code sessions Taska opens call with sid= alone: named by their app's title (else the id's start)."""
        other = "bbbbbbbb-2222-4222-8222-000000000002"
        req = Request("POST", f"/do?by=claude-code&sid={other}", {}, "127.0.0.1", read_body=lambda limit: b"T1 doing\n")
        agent_routes.do(req, self.p)
        self.p.agents.see_sessions({other: Session("claude-code", other, "", "/x", "busy")})
        self.assertEqual(self.holder(CLAIM_TTL + 60)[0], "claude-code · bbbbbbbb")
        self.assertEqual(holds.sid_of("claude-code · Taska T9", {}, {other: Session("claude-code", other, "Taska T9", "/x", "busy")},
                                      {}), other)

    def test_a_word_from_another_session_later_leaves_it_with_the_holder_at_work(self) -> None:
        """T875: a second session opened for it wrote that it leaves it; the hold stays with the first, still at work."""
        self.app("busy")
        other = "bbbbbbbb-2222-4222-8222-000000000002"
        long_ago = time.time() - CLAIM_TTL - 60  # alpha has been quiet on Taska past the hold
        self.p.state.claims[1] = self.p.state.claims[1]._replace(since=long_ago)
        self.p.state.tasks[1].agent = dataclasses.replace(
            self.p.state.tasks[1].agent, t=time.strftime("%Y-%m-%dT%H:%M:%S+00:00", time.gmtime(long_ago)))
        req = Request("POST", f"/do?by=claude-code&session=beta&sid={other}", {}, "127.0.0.1",
                      read_body=lambda limit: b"T1 progress Alpha's own agent is still on it: I leave it\n")
        agent_routes.do(req, self.p)
        self.p.agents.see_sessions({self.SID: Session("claude-code", self.SID, "alpha", "/x", "busy"),
                                    other: Session("claude-code", other, "beta", "/x", "idle")})
        self.assertEqual(self.holder(CLAIM_TTL + 60)[0], "claude-code · alpha")

    def test_a_session_by_its_id_alone_is_known_over_a_restart(self) -> None:
        """Its id was only in memory: after Taska restarted, a quiet session at work was not found and lost its hold."""
        other = "bbbbbbbb-2222-4222-8222-000000000002"
        req = Request("POST", f"/do?by=claude-code&sid={other}", {}, "127.0.0.1", read_body=lambda limit: b"T1 doing\n")
        agent_routes.do(req, self.p)
        self.p.close()
        self.p = Project(self.tmp.name, "demo")
        self.assertIn(other, self.p.agents.sids())
        self.p.agents.see_sessions({other: Session("claude-code", other, "", "/x", "busy")})
        self.assertEqual(self.holder(CLAIM_TTL + 60)[0], "claude-code · bbbbbbbb")


class RepliedHeld(HeldTasks):
    """T885 (Yadong approved 11-24): the user's reply on a task another session is on goes to that session; /next gave
    it to a second session as "resume", which woke that one for nothing and could set two sessions on it."""

    def test_the_reply_is_for_the_session_on_it(self) -> None:
        self.get("/next?by=claude-code&session=alpha")
        self.do("alpha", "T1 doing\nT1 ask Which filter?\n")
        self.p.run([(0, {"op": "say", "ref": "T1", "text": "the date one"})], "you")
        other = self.get("/next?by=claude-code&session=beta")
        self.assertNotIn("resume T1", other)
        self.assertIn("others are on (skip): T1", other)
        self.assertEqual(other.count("others are on"), 1)
        self.assertIn("resume T1: the user replied", self.get("/next?by=claude-code&session=alpha"))
