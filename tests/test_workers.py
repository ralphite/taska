"""I810: a manager's worker that never calls Taska is found by its title (the item's code first), in a folder this
project's own sessions work in; waiting on the user, its item needs you after a minute, and a push goes after three."""

from __future__ import annotations

import os
import sys
import tempfile
import time
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.infra.agent_sessions import Session  # noqa: E402
from taska.services.workspace import Workspace  # noqa: E402

MANAGER = "11111111-1111-1111-1111-111111111111"
WORKER = "22222222-2222-2222-2222-222222222222"


def ses(sid: str, name: str, status: str = "busy", waits: str = "", since: float = 0, cwd: str = "/work") -> Session:
    return Session("claude-code", sid, name, cwd, status, waits, int(since))


class Workers(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.ws = Workspace(os.path.join(self.tmp.name, "data"), "", gemini=False)
        self.a, self.b = self.ws.add("sysd"), self.ws.add("other")
        for p in (self.a, self.b):
            p.run([(0, {"op": "new", "title": "Write the tutor skill", "type": "task"})], "you")
            # the project's own manager, heard of by its id, working in /work
            p.agents.saw("claude-code", 0, "manager", MANAGER)
        self.a.run([(0, {"op": "set", "ref": "T1", "f": {"status": "doing"}})], "you")

    def tearDown(self) -> None:
        self.ws.close()
        self.tmp.cleanup()

    def look(self, *running: Session) -> None:
        for p in (self.a, self.b):
            p.agents.see_sessions({MANAGER: ses(MANAGER, "manager")})
        self.ws.find_workers(list(running))
        for p in (self.a, self.b):
            p.agents.see_sessions({s.id: s for s in (ses(MANAGER, "manager"), *running) if s.id in p.agents.sids()})

    def test_found_by_its_title_and_on_the_item_in_progress(self) -> None:
        self.look(ses(WORKER, "T1：系统设计专用 tutor 技能"))
        # T1 fits both projects: it goes to the one whose T1 is in progress
        self.assertEqual(self.a.agents.workers, {WORKER: ("T1：系统设计专用 tutor 技能", 1)})
        self.assertEqual(self.b.agents.workers, {})
        row = next(s for a in self.a.agents.presence(self.a.state) for s in a.get("sessions", []) if s.get("worker"))
        self.assertEqual((row["name"], row["on"]["n"], row["status"]), ("T1：系统设计专用 tutor 技能", 1, "busy"))

    def test_its_own_session_on_no_item_is_on_the_one_its_title_names(self) -> None:
        # the worker called Taska itself (by its id, as "t28"), but took no item: its app's title names it
        self.a.agents.saw("claude-code", 0, "t28", WORKER)
        self.look(ses(WORKER, "T1：系统设计专用 tutor 技能"))
        self.assertEqual(self.a.agents.workers, {})
        row = next(s for a in self.a.agents.presence(self.a.state) for s in a.get("sessions", []) if s["name"] == "t28")
        self.assertEqual(row["on"]["n"], 1)

    def test_not_found_without_the_code_first_or_in_another_folder(self) -> None:
        self.look(ses(WORKER, "Techknow (T1)"))
        self.assertEqual(self.a.agents.workers, {})
        self.look(ses(WORKER, "T1: tutor", cwd="/elsewhere"))
        self.assertEqual(self.a.agents.workers, {})

    def test_waiting_on_you_needs_you_after_a_minute_and_pushes_after_three(self) -> None:
        now = time.time() * 1000
        self.look(ses(WORKER, "T1 tutor", "waiting", "permission", now - 30_000))
        self.assertEqual([x for x in self.ws.needs() if x["kind"] == "blocked"], [])
        self.look(ses(WORKER, "T1 tutor", "waiting", "permission", now - 90_000))
        shown = [x for x in self.ws.needs() if x["kind"] == "blocked"]
        self.assertEqual([(x["project"], x["code"], x["title"]) for x in shown], [("sysd", "T1", "T1 tutor waits on you: permission")])
        self.assertEqual([x for x in self.ws.needs(push=True) if x["kind"] == "blocked"], [])
        self.look(ses(WORKER, "T1 tutor", "waiting", "permission", now - 200_000))
        self.assertEqual(len([x for x in self.ws.needs(push=True) if x["kind"] == "blocked"]), 1)


if __name__ == "__main__":
    unittest.main()
