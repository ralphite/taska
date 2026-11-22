"""T866 (Yadong r1467): Taska over MCP. An agent that speaks MCP adds a project's /mcp once and works through typed tools
that answer as an agent's curl would (/next, /T03, /tasks, /do): one session per connection, known by its id."""

import json
import os
import sys
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from support import ServerCase  # noqa: E402


class OverMcp(ServerCase):
    def rpc(self, method: str, params: dict, sid: str = "", rid: object = 1) -> tuple:
        msg = {"jsonrpc": "2.0", "method": method, "params": params}
        if rid is not None:
            msg["id"] = rid
        headers = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}
        if sid:
            headers["Mcp-Session-Id"] = sid
        with urllib.request.urlopen(urllib.request.Request(self.p + "/mcp", data=json.dumps(msg).encode(), headers=headers),
                                    timeout=10) as r:
            body = r.read().decode()
            return (json.loads(body) if body else None), r.headers.get("Mcp-Session-Id") or sid, r.status

    def call(self, sid: str, name: str, **args: object) -> tuple:
        got, _, _ = self.rpc("tools/call", {"name": name, "arguments": args}, sid)
        res = got["result"]
        return res["content"][0]["text"], res["isError"]

    def test_an_agent_works_a_task_through_the_tools(self) -> None:
        got, sid, _ = self.rpc("initialize", {"protocolVersion": "2025-06-18", "capabilities": {},
                                              "clientInfo": {"name": "claude-code", "version": "2"}})
        self.assertEqual(got["result"]["serverInfo"]["name"], "taska")
        self.assertIn("tools", got["result"]["capabilities"])
        self.assertTrue(sid.startswith("claude-code."))
        self.assertEqual(self.rpc("notifications/initialized", {}, sid, rid=None)[2], 202)
        names = [t["name"] for t in self.rpc("tools/list", {}, sid)[0]["result"]["tools"]]
        self.assertEqual(names[:4], ["next", "task", "tasks", "inbox"])

        self.do("new P1 Export loses the filter\n", "you")
        said, failed = self.call(sid, "next")
        self.assertFalse(failed)
        self.assertIn("next T1", said)
        said, _ = self.call(sid, "say", code="T1", kind="progress", text="Found it: the filter is dropped\non export")
        self.assertIn("ok T1 progress", said)
        said, _ = self.call(sid, "set", code="T1", status="doing", tags=["bug"])
        self.assertIn("ok T1 status=doing", said)
        self.assertIn("+#bug", said)
        said, _ = self.call(sid, "new", title="Export the sort too", pri="P2", parent="T1", tags=["ux"])
        self.assertIn("ok T2 new", said)
        card, _ = self.call(sid, "task", code="T1")
        self.assertIn("Found it: the filter is dropped", card)
        self.assertIn("claude-code · mcp", card)  # this connection is the session on it
        self.assertIn("Export the sort too", self.call(sid, "tasks", tag="ux")[0])
        said, _ = self.call(sid, "say", code="T1", kind="ask", text="Keep the old export?", choices=["Keep", "Drop"])
        self.assertIn("ok T1 ask", said)
        said, failed = self.call(sid, "say", code="T1", kind="done", text="Fixed; the test covers it")
        self.assertFalse(failed)
        self.assertIn("status=review", said)
        said, _ = self.call(sid, "next")  # nothing left: told what to do over MCP, not a curl wait with BASE in it
        self.assertIn("nothing to do now. End your turn, or call next with wait", said)
        self.assertNotIn("BASE", said)

    def test_a_wrong_call_says_what_is_wrong(self) -> None:
        _, sid, _ = self.rpc("initialize", {"clientInfo": {"name": "codex-mcp-client"}})
        self.assertTrue(sid.startswith("codex."))
        said, failed = self.call(sid, "task", code="T999")
        self.assertTrue(failed)
        said, failed = self.call(sid, "do", commands="T999 doing")
        self.assertTrue(failed)
        self.assertIn("err", said)
        got, _, _ = self.rpc("tools/call", {"name": "next", "arguments": {}}, "")  # no session
        self.assertIn("initialize first", got["error"]["message"])
        with self.assertRaises(urllib.error.HTTPError) as e:
            urllib.request.urlopen(self.p + "/mcp", timeout=10)
        self.assertEqual(e.exception.code, 405)
