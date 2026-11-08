"""T711 #10443: whether an agent session waits on the user, the simplest first. Claude Code's session files say it
(status "waiting", or a waitingFor); a file whose process is gone does not count. A blocked session belongs to the
project where an agent gave its title as its session name, and the page hears of it there."""

from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from typing import Any, Dict, List

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "server"))

from taska.infra.agent_sessions import Blocked, claude_code  # noqa: E402
from taska.services.agents import AgentActivity  # noqa: E402

DEAD = 999_999  # no process has this pid


def write(folder: str, pid: int, **fields: Any) -> None:
    d = {"pid": pid, "sessionId": f"s{pid}", "cwd": "/Users/x/dev/app", "kind": "interactive", **fields}
    with open(os.path.join(folder, f"{pid}.json"), "w", encoding="utf-8") as f:
        json.dump(d, f)


class Detector(unittest.TestCase):
    def test_waiting_sessions_of_live_processes_only(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            me = os.getpid()
            write(folder, me, name="Fix export", status="waiting", waitingFor="approve Bash: rm -rf build",
                  statusUpdatedAt=1792852923711)
            write(folder, DEAD, name="Old one", status="waiting", waitingFor="approve plan")
            write(folder, os.getppid(), name="Busy one", status="busy")
            with open(os.path.join(folder, "1.key.json"), "w") as f:
                f.write("not json")
            got = claude_code(folder)
        self.assertEqual(got, [Blocked("claude-code", "Fix export", "/Users/x/dev/app", "approve Bash: rm -rf build",
                                       1792852923711)])

    def test_waiting_for_alone_counts_and_idle_does_not(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            write(folder, os.getpid(), name="Asks", status="idle", waitingFor="a question")
            self.assertEqual([b.waiting_for for b in claude_code(folder)], ["a question"])
            write(folder, os.getpid(), name="Asks", status="idle")
            self.assertEqual(claude_code(folder), [])

    def test_no_folder_no_sessions(self) -> None:
        self.assertEqual(claude_code("/nonexistent/sessions"), [])


class FakeDb:
    def __init__(self) -> None:
        self.kv: Dict[str, Any] = {"agents": {}}

    def get(self, k: str) -> Any:
        return self.kv.get(k)

    def put(self, k: str, v: Any) -> None:
        self.kv[k] = v


class ToProject(unittest.TestCase):
    def setUp(self) -> None:
        self.woken: List[int] = []
        self.a = AgentActivity(FakeDb(), None, changed=lambda: self.woken.append(1), gone=lambda: False)  # type: ignore[arg-type]
        self.a.saw("claude-code", session="Fix  export")
        self.a.saw("codex", session="Docs pass")

    def test_matched_by_the_session_name_given_here(self) -> None:
        mine = Blocked("claude-code", "Fix export", "/x", "approve plan", 5)
        other = Blocked("claude-code", "Another project's session", "/y", "a question", 6)
        v = self.a.version
        self.a.see_blocked([mine, other])
        self.assertEqual(self.a.version, v + 1)
        self.assertTrue(self.woken)
        rows = {r["name"]: r for r in self.a.presence()}
        self.assertEqual(rows["claude-code"]["blocked"], [{"session": "Fix export", "waitingFor": "approve plan", "since": 5}])
        self.assertNotIn("blocked", rows["codex"])

    def test_same_again_is_no_news_and_going_away_is(self) -> None:
        b = Blocked("claude-code", "Fix export", "/x", "approve plan", 5)
        self.a.see_blocked([b])
        v = self.a.version
        self.a.see_blocked([b])
        self.assertEqual(self.a.version, v)
        self.a.see_blocked([])
        self.assertEqual(self.a.version, v + 1)
        self.assertNotIn("blocked", self.a.presence()[0])


if __name__ == "__main__":
    unittest.main()
