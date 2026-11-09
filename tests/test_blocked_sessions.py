"""T711 #10568: an agent session is known by its own id, not its title. The agent passes
"&sid=$CLAUDE_CODE_SESSION_ID$CODEX_THREAD_ID" on its calls (each app sets one in its commands' environment); Taska
reads that session's status by the id (Claude Code's ~/.claude/sessions/<pid>.json, Codex's rollout log) and shows it
blocked while it waits on the user."""

from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import urllib.request
from typing import Any, Dict, List
from unittest import mock

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "server"))

from taska.infra import agent_sessions  # noqa: E402
from taska.infra.agent_sessions import Session, claude_code, codex, lookup  # noqa: E402
from taska.services.agents import AgentActivity  # noqa: E402

DEAD = 999_999  # no process has this pid
CC, CX = "aaaaaaaa-1111-2222-3333-444444444444", "019a0000-5c55-75d3-ade5-bc4c0361163a"


def claude_file(folder: str, pid: int, sid: str, **fields: Any) -> None:
    d = {"pid": pid, "sessionId": sid, "cwd": "/Users/x/dev/app", "kind": "interactive", **fields}
    with open(os.path.join(folder, f"{pid}.json"), "w", encoding="utf-8") as f:
        json.dump(d, f)


def codex_log(home: str, sid: str, *types: str, name: str = "Docs pass") -> None:
    day = os.path.join(home, "sessions", "2026", "11", "07")
    os.makedirs(day, exist_ok=True)
    rows = [{"timestamp": "2026-11-07T10:00:00.000Z", "type": "session_meta", "payload": {"id": sid, "cwd": "/w"}}]
    for i, t in enumerate(types):
        kind = "response_item" if t == "message" else "event_msg"
        rows.append({"timestamp": f"2026-11-07T10:00:0{i + 1}.000Z", "type": kind, "payload": {"type": t}})
    with open(os.path.join(day, f"rollout-2026-11-07T10-00-00-{sid}.jsonl"), "w", encoding="utf-8") as f:
        f.write("".join(json.dumps(r) + "\n" for r in rows))
    with open(os.path.join(home, "session_index.jsonl"), "w", encoding="utf-8") as f:
        f.write(json.dumps({"id": sid, "thread_name": name}) + "\n")


class Lookup(unittest.TestCase):
    def setUp(self) -> None:
        self.dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)
        self.claude, self.codex = os.path.join(self.dir.name, "claude"), os.path.join(self.dir.name, "codex")
        os.makedirs(self.claude)
        env = mock.patch.dict(os.environ, {"TASKA_CLAUDE_SESSIONS": self.claude, "TASKA_CODEX_HOME": self.codex})
        env.start()
        self.addCleanup(env.stop)

    def test_claude_code_by_id(self) -> None:
        claude_file(self.claude, os.getpid(), CC, name="Fix export", status="waiting",
                    waitingFor="approve Bash: rm -rf build", statusUpdatedAt=1792852923711)
        claude_file(self.claude, DEAD, "bbbbbbbb-1111", name="Old one", status="waiting", waitingFor="approve plan")
        with open(os.path.join(self.claude, "1.key.json"), "w") as f:
            f.write("not json")
        self.assertEqual(lookup(CC), Session("claude-code", CC, "Fix export", "/Users/x/dev/app", "waiting",
                                             "approve Bash: rm -rf build", 1792852923711))
        self.assertEqual(claude_code("bbbbbbbb-1111").status, "exited")  # type: ignore[union-attr]
        claude_file(self.claude, os.getpid(), CC, name="Fix export", status="idle", waitingFor="a question")
        self.assertEqual(claude_code(CC).status, "waiting")  # type: ignore[union-attr]  # waitingFor alone says so
        claude_file(self.claude, os.getpid(), CC, name="Fix export", status="busy")
        self.assertEqual(claude_code(CC).status, "busy")  # type: ignore[union-attr]

    def test_codex_by_id(self) -> None:
        codex_log(self.codex, CX, "task_started", "message", "token_count")
        self.assertEqual(lookup(CX), Session("codex", CX, "Docs pass", "/w", "busy", "", _ms("10:00:01")))
        codex_log(self.codex, CX, "task_started", "message", "task_complete", "token_count")
        self.assertEqual(codex(CX).status, "idle")  # type: ignore[union-attr]
        codex_log(self.codex, CX, "task_started", "message", "exec_approval_request", "token_count")
        s = codex(CX)
        self.assertEqual((s.status, s.waiting_for, s.since), ("waiting", "exec approval request", _ms("10:00:03")))  # type: ignore[union-attr]
        codex_log(self.codex, CX, "task_started", "exec_approval_request", "message")  # answered: it went on
        self.assertEqual(codex(CX).status, "busy")  # type: ignore[union-attr]

    def test_unknown_or_malformed_ids(self) -> None:
        self.assertIsNone(lookup(CC))
        for bad in ("", "*", "../../etc", "a" * 80):
            self.assertIsNone(lookup(bad))


def _ms(clock: str) -> int:
    return agent_sessions._ms(f"2026-11-07T{clock}.000Z")


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
        self.a.saw("claude-code", session="Fix  export", sid=CC)
        self.a.saw("codex", session="Docs pass", sid=CX)
        self.a.saw("antigravity", session="x", sid="*")  # not an id: not kept

    def test_blocked_by_the_id_it_reported(self) -> None:
        self.assertEqual(self.a.sids(), sorted([CC, CX]))
        waits = Session("claude-code", CC, "Another title", "/x", "waiting", "approve plan", 5)
        v = self.a.version
        self.a.see_blocked({CC: waits, CX: Session("codex", CX, "Docs pass", "/w", "busy")})
        self.assertEqual(self.a.version, v + 1)
        self.assertTrue(self.woken)
        rows = {r["name"]: r for r in self.a.presence()}
        self.assertEqual(rows["claude-code"]["blocked"], [{"session": "Fix export", "waitingFor": "approve plan", "since": 5}])
        self.assertNotIn("blocked", rows["codex"])
        self.a.see_blocked({CX: Session("codex", CX, "Docs pass", "/w", "waiting", "exec approval request", 7)})
        rows = {r["name"]: r for r in self.a.presence()}
        self.assertEqual(rows["codex"]["blocked"], [{"session": "Docs pass", "waitingFor": "exec approval request", "since": 7}])
        self.assertNotIn("blocked", rows["claude-code"])

    def test_same_again_is_no_news_and_going_away_is(self) -> None:
        found = {CC: Session("claude-code", CC, "Fix export", "/x", "waiting", "approve plan", 5)}
        self.a.see_blocked(found)
        v = self.a.version
        self.a.see_blocked(found)
        self.assertEqual(self.a.version, v)
        self.a.see_blocked({})
        self.assertEqual(self.a.version, v + 1)
        self.assertNotIn("blocked", self.a.presence()[0])


class OverHttp(unittest.TestCase):
    """The whole way: the guide asks for sid=, a call with it reports the id, the page's view shows it blocked."""

    def serve(self, tmp: str) -> Any:
        """A server on its own data whose session readers look in tmp; a call to it by path (and body)."""
        claude, home = os.path.join(tmp, "claude"), os.path.join(tmp, "codex")
        os.makedirs(claude)
        with socket.socket() as s:
            s.bind(("127.0.0.1", 0))
            port = s.getsockname()[1]
        env = {k: v for k, v in os.environ.items() if "KEY" not in k and k != "PYTHONPATH"}
        env.update(TASKA_CLAUDE_SESSIONS=claude, TASKA_CODEX_HOME=home)
        proc = subprocess.Popen([sys.executable, "-m", "taska", "serve", "--host", "127.0.0.1", "--port", str(port),
                                 "--root", os.path.join(tmp, "data"), "--organizer", "off", "--log-db", ""],
                                cwd=os.path.join(ROOT, "server"), env=env, stdout=subprocess.DEVNULL,
                                stderr=subprocess.DEVNULL)
        self.addCleanup(proc.wait)
        self.addCleanup(proc.terminate)
        base = f"http://127.0.0.1:{port}"

        def call(path: str, data: Any = None, timeout: float = 10) -> bytes:
            body = json.dumps(data).encode() if isinstance(data, dict) else data
            with urllib.request.urlopen(urllib.request.Request(base + path, data=body), timeout=timeout) as r:
                return r.read()

        for _ in range(200):
            try:
                call("/health")
                break
            except OSError:
                time.sleep(0.03)
        return call

    def test_report_then_blocked_in_the_view(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            call = self.serve(tmp)
            claude_file(os.path.join(tmp, "claude"), os.getpid(), CC, name="Title in the app", status="waiting",
                        waitingFor="approve plan")
            codex_log(os.path.join(tmp, "codex"), CX, "task_started", "message")
            p = "/p/" + json.loads(call("/api/projects", {"title": "Sessions"}))["name"]
            self.assertIn(b'"&sid=$CLAUDE_CODE_SESSION_ID$CODEX_THREAD_ID"', call(p + "/agent"))
            call(p + f"/next?by=claude-code&session=Fix%20export&sid={CC}")
            call(p + f"/do?by=codex&session=Docs&sid={CX}", b"ack r999\n")
            rows = {r["name"]: r for r in json.loads(call(p + "/api/view"))["project"]["agents"]}
            self.assertEqual(rows["claude-code"]["blocked"], [{"session": "Fix export", "waitingFor": "approve plan", "since": 0}])
            self.assertNotIn("blocked", rows["codex"])

    def test_a_waiting_page_hears_within_seconds(self) -> None:
        """A page's long wait for news (up to 25 s) has the sessions looked at every 2 s: a session that comes to
        wait on the user, or goes on, reaches the page within about that, not when its wait ends."""
        with tempfile.TemporaryDirectory() as tmp:
            call = self.serve(tmp)
            claude = os.path.join(tmp, "claude")
            claude_file(claude, os.getpid(), CC, name="Fix export", status="busy")
            p = "/p/" + json.loads(call("/api/projects", {"title": "Sessions"}))["name"]
            call(p + f"/next?by=claude-code&session=Fix%20export&sid={CC}")
            cursor = json.loads(call(p + "/api/view"))["cursor"]
            for status, blocked in (("waiting", True), ("busy", False)):
                got: Dict[str, Any] = {}
                ask = threading.Thread(target=lambda: got.update(
                    out=json.loads(call(p + f"/api/changes?cursor={cursor}&wait=20", timeout=30)), t=time.monotonic()))
                ask.start()
                time.sleep(0.5)  # the page waits: then the session changes
                claude_file(claude, os.getpid(), CC, name="Fix export", status=status, waitingFor="approve plan" if blocked else "")
                t0 = time.monotonic()
                ask.join(30)
                out = got["out"]
                self.assertNotIn("same", out)
                self.assertLess(got["t"] - t0, 2.8)
                row = next(r for r in out["project"]["agents"] if r["name"] == "claude-code")
                self.assertEqual("blocked" in row, blocked)
                cursor = out["cursor"]
            t0 = time.monotonic()  # nothing changes: the wait runs to its end
            self.assertTrue(json.loads(call(p + f"/api/changes?cursor={cursor}&wait=3"))["same"])
            self.assertGreater(time.monotonic() - t0, 2.9)


if __name__ == "__main__":
    unittest.main()
