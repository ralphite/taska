"""I810: a manager's worker that never calls Taska is found by its title (the item's code first), in a folder this
project's own sessions work in; waiting on the user, its item needs you after a minute, and a push goes after three."""

from __future__ import annotations

import json
import os
import sys
import tempfile
import time
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.infra.agent_sessions import Session, running  # noqa: E402
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


class CodexWorkers(unittest.TestCase):
    """I810 r1369: a Codex thread its manager started is found by its first instruction (it has no title), and
    waiting on an approval it needs you, as a Claude Code worker does."""

    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.home = os.path.join(self.tmp.name, "codex")
        day = os.path.join(self.home, "sessions", "2026", "11", "15")
        os.makedirs(day)
        sid = "01a1dd93-921a-7330-8502-eed8f8aef51c"
        lines = [
            {"type": "session_meta", "payload": {"cwd": "/work"}},
            {"type": "event_msg", "payload": {"type": "task_started"}, "timestamp": "2026-11-15T09:00:00Z"},
            {"type": "event_msg", "payload": {"type": "user_message", "message": "T1: write the tutor skill\nDetails..."}},
            {"type": "response_item", "payload": {"type": "message", "role": "assistant"}},
            {"type": "event_msg", "payload": {"type": "exec_approval_request"}, "timestamp": "2026-11-15T09:01:00Z"},
        ]
        with open(os.path.join(day, f"rollout-2026-11-15T09-00-00-{sid}.jsonl"), "w") as f:
            f.write("\n".join(json.dumps(x) for x in lines) + "\n")
        self.sid = sid
        self.old = os.environ.get("TASKA_CODEX_HOME"), os.environ.get("TASKA_CLAUDE_SESSIONS")
        os.environ["TASKA_CODEX_HOME"] = self.home
        os.environ["TASKA_CLAUDE_SESSIONS"] = os.path.join(self.tmp.name, "none")
        self.ws = Workspace(os.path.join(self.tmp.name, "data"), "", gemini=False)
        self.p = self.ws.add("sysd")
        self.p.run([(0, {"op": "new", "title": "Write the tutor skill", "type": "task"})], "you")
        self.p.agents.saw("claude-code", 0, "manager", MANAGER)
        self.p.agents.see_sessions({MANAGER: ses(MANAGER, "manager")})

    def tearDown(self) -> None:
        for k, v in zip(("TASKA_CODEX_HOME", "TASKA_CLAUDE_SESSIONS"), self.old):
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
        self.ws.close()
        self.tmp.cleanup()

    def test_found_by_its_first_instruction_and_needs_you_while_it_waits(self) -> None:
        found = [s for s in running() if s.agent == "codex"]
        self.assertEqual([(s.name, s.status, s.cwd) for s in found], [("T1: write the tutor skill", "waiting", "/work")])
        self.ws.find_workers(found)
        self.assertEqual(self.p.agents.workers, {self.sid: ("T1: write the tutor skill", 1)})
        self.p.agents.see_sessions({MANAGER: ses(MANAGER, "manager"), self.sid: found[0]})
        blocked = [x for x in self.ws.needs() if x["kind"] == "blocked"]
        self.assertEqual([(x["code"], x["title"]) for x in blocked], [("T1", "T1: write the tutor skill waits on you: exec approval request")])


class Listening(unittest.TestCase):
    """B811: whether an agent session waits for work now, for the check at the end of its turns."""

    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.ws = Workspace(os.path.join(self.tmp.name, "data"), "", gemini=False)
        self.p = self.ws.add("demo")

    def tearDown(self) -> None:
        self.ws.close()
        self.tmp.cleanup()

    def test_a_session_listens_while_its_wait_is_open_and_a_minute_after(self) -> None:
        self.assertEqual(self.ws.listening(MANAGER), {"known": False, "listening": False})  # never heard of: not checked
        self.p.agents.saw("claude-code", 0, "main", MANAGER)
        self.assertEqual(self.ws.listening(MANAGER), {"known": True, "listening": False})  # it stopped listening
        self.p.agents.saw("claude-code", 1, "main", MANAGER)
        self.assertEqual(self.ws.listening(MANAGER), {"known": True, "listening": True})
        self.p.agents.saw("claude-code", -1)  # the wait ends, as /next ends it: by the agent, and by the session's id
        self.p.agents.stopped_listening(MANAGER)
        now = time.time()
        self.assertTrue(self.p.agents.listens(MANAGER, now + 30))  # its next wait comes after a short pause
        self.assertFalse(self.p.agents.listens(MANAGER, now + 120))

    def test_a_session_with_an_item_in_progress_is_not_asked_to_listen(self) -> None:
        self.p.agents.saw("claude-code", 0, "main", MANAGER)
        self.p.run([(0, {"op": "new", "title": "Redo the brainstorm", "type": "task"})], "you")
        self.p.run([(0, {"op": "set", "ref": "T1", "f": {"status": "doing"}})], "you")
        self.assertEqual(self.ws.listening(MANAGER), {"known": True, "listening": True})


if __name__ == "__main__":
    unittest.main()
