"""F768 (Yadong r1290, r1296): the Agents dialog lists every agent session seen in a project, each with what its app
says of it now (working, idle, waiting on the user, gone), the item it is on, and the session that started it (a
manager's worker says &parent=<the manager's session name>). What the page gets for each session."""

from __future__ import annotations

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from support import ProjectCase
from taska.http import agent_routes  # noqa: E402
from taska.http.messages import Request  # noqa: E402
from taska.infra.agent_sessions import Session  # noqa: E402

CC = "aaaaaaaa-1111-2222-3333-444444444444"
W1 = "cccccccc-1111-2222-3333-444444444444"
AG = "dddddddd-1111-2222-3333-444444444444"


class SessionsInPresence(ProjectCase):
    def call(self, path: str, body: bytes = b"") -> str:
        req = Request("POST" if body else "GET", path, {}, "127.0.0.1", read_body=lambda limit: body)
        if path.startswith("/do"):
            res = agent_routes.do(req, self.p)
        else:
            res = agent_routes.get(req, self.p, path.split("?")[0], "http://x/p/demo")
        assert res is not None
        return res.body.decode() if isinstance(res.body, bytes) else str(res.body)

    def sessions(self, agent: str) -> dict:
        rows = {r["name"]: r for r in agent_routes.presence(self.p)["agents"]}
        return {s["name"]: s for s in rows[agent].get("sessions", [])}

    def test_worker_names_its_parent_and_holds_its_item(self) -> None:
        self.p.run([(0, {"op": "new", "type": "task", "pri": "P1", "when": "now", "title": "Export loses the filter"})], "you")
        self.call(f"/next?by=claude-code&session=Manager&sid={CC}")
        self.call(f"/do?by=claude-code&session=worker-1&parent=Manager&sid={W1}", b"T1 doing\n")
        s = self.sessions("claude-code")
        self.assertEqual(s["worker-1"]["parent"], "Manager")
        self.assertEqual(s["worker-1"]["sid"], W1)
        self.assertEqual(s["worker-1"]["on"]["n"], 1)
        self.assertNotIn("parent", s["Manager"])
        self.assertNotIn("on", s["Manager"])

    def test_what_the_app_says_of_each_session(self) -> None:
        self.call(f"/next?by=claude-code&session=Manager&sid={CC}")
        self.call(f"/next?by=claude-code&session=worker-1&sid={W1}")
        with self.p.lock:
            self.p.agents.see_sessions({
                CC: Session("claude-code", CC, "Manager", "/Users/x/dev/app", "busy", "", 5),
                W1: Session("claude-code", W1, "worker-1", "/w", "waiting", "approve plan", 7),
            })
            s = {x["name"]: x for x in self.p.agents.presence(self.p.state)[0]["sessions"]}
        self.assertEqual((s["Manager"]["status"], s["Manager"]["since"], s["Manager"]["cwd"]), ("busy", 5, "/Users/x/dev/app"))
        self.assertNotIn("waitingFor", s["Manager"])
        self.assertEqual((s["worker-1"]["status"], s["worker-1"]["waitingFor"]), ("waiting", "approve plan"))
        v = self.p.agents.version
        with self.p.lock:
            self.p.agents.see_sessions({CC: Session("claude-code", CC, "Manager", "/Users/x/dev/app", "idle", "", 9)})
        self.assertEqual(self.p.agents.version, v + 1)  # working to idle is news for the page

    def test_one_id_is_one_session_when_its_title_changes(self) -> None:
        self.call(f"/next?by=claude-code&session=Old%20title&sid={CC}")
        self.call(f"/next?by=claude-code&session=New%20title&sid={CC}")
        self.assertEqual(list(self.sessions("claude-code")), ["New title"])

    def test_antigravity_known_by_its_id_and_its_waker(self) -> None:
        self.call(f"/next?by=antigravity&session=Lead&sid={AG}&lead=1")
        with self.p.lock:
            self.p.waker.holding(AG, 1)  # its waker waits for work for it
        s = self.sessions("antigravity")
        self.assertEqual(list(s), ["Lead"])  # the waker's calls by the id alone are the same session
        self.assertTrue(s["Lead"]["waiting"])
        self.assertNotIn("status", s["Lead"])  # Antigravity's app is not read: seen lately, or gone


if __name__ == "__main__":
    unittest.main()
