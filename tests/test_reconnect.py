"""I833 (Yadong r1433 r1435): a session that lost its connection (the machine restarted) is brought back by another
session of its app. With one connected, the user's Reconnect hands it a narrow job first (send the lost one a message,
then go back to its own work); with none, the answer is what to give one new session, which brings back every lost
one. A session that waited for work before a restart and has not called since is lost; one that calls is back."""

from __future__ import annotations

import json
import os
import tempfile
import threading
import time
import unittest
import urllib.request

from support import ProjectCase, ServerCase
from taska.services.project import Project
from taska.services.reconnects import Reconnects
from taska.services.workspace import Workspace

A, B, C = "aaaaaaaa-0000-0000-0000-000000000001", "bbbbbbbb-0000-0000-0000-000000000002", "cccccccc-0000-0000-0000-000000000003"


class Asks(unittest.TestCase):
    def test_one_relay_at_a_time_and_gone_once_back(self):
        t = [1000.0]
        rc = Reconnects(clock=lambda: t[0])
        rc.add(B, "claude-code", "demo", "Export work")
        rc.add(C, "codex", "demo", "")  # Codex is woken through its own queue: never asked for
        self.assertIsNone(rc.for_relay("claude-code", B))  # not to itself
        self.assertEqual(rc.for_relay("claude-code", A).sid, B)
        self.assertIsNone(rc.for_relay("claude-code", A))  # it has it: not again while it sends it
        self.assertIsNone(rc.for_relay("claude-code", "dddddddd-1"))  # nor to another meanwhile
        t[0] += 121  # not sent in two minutes: another connected session is asked
        self.assertEqual(rc.for_relay("claude-code", "dddddddd-1").sid, B)
        self.assertTrue(rc.heard(B))
        self.assertEqual(rc.pending(), [])


class LostOverARestart(ProjectCase):
    def test_a_session_that_waited_and_is_not_back_is_lost(self):
        self.p.agents.saw("claude-code", 1, "Export work", B)  # waits for work as the machine goes down
        self.p.close()
        self.p = Project(self.tmp.name, "demo")
        ag = self.p.agents
        self.assertEqual(ag.lostness.lost(ag.lostness.started + 60), set())  # a minute on: it may still come back by itself
        self.assertEqual(ag.lostness.lost(ag.lostness.started + 200), {B})
        self.assertEqual([r.get("lost") for a in ag.presence() for r in a.get("sessions", [])], [None])  # not marked yet...
        ag.lostness.started -= 200
        rows = [r for a in ag.presence() for r in a.get("sessions", [])]
        self.assertEqual([(r["sid"], r.get("lost")) for r in rows], [(B, True)])  # ...then marked lost
        ag.saw("claude-code", 0, "Export work", B)  # it called: back
        self.assertEqual(ag.lostness.lost(), set())

    def test_still_lost_after_another_restart(self):
        self.p.agents.saw("claude-code", 1, "Export work", B)
        self.p.close()
        self.p = Project(self.tmp.name, "demo")
        self.p.agents.saw("claude-code", 1, "Other", A)  # another waits now: it saves who waits, B still with them
        self.p.close()
        self.p = Project(self.tmp.name, "demo")
        self.assertEqual(self.p.agents.lostness.lost(self.p.agents.lostness.started + 200), {A, B})


class Bringing(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.desk = tempfile.TemporaryDirectory()
        os.makedirs(os.path.join(self.desk.name, "x", "y"))
        with open(os.path.join(self.desk.name, "x", "y", "local_b.json"), "w") as f:
            json.dump({"sessionId": "local_b", "cliSessionId": B, "title": "Export work", "isArchived": False}, f)
        os.environ["TASKA_CLAUDE_DESKTOP"] = self.desk.name
        self.ws = Workspace(self.tmp.name)
        self.p = next(iter(self.ws.projects.values()))
        self.p.agents.saw("claude-code", 0, "Export work", B)
        self.p.agents.lostness.called.pop(B)  # long ago

    def tearDown(self):
        os.environ.pop("TASKA_CLAUDE_DESKTOP", None)
        self.ws.close()
        self.tmp.cleanup()
        self.desk.cleanup()

    def test_a_connected_session_is_handed_the_message_first(self):
        self.p.agents.saw("claude-code", 1, "Planner", A)  # waits for work now
        got = self.ws.reconnect(self.p.slug, B, "http://127.0.0.1:7340")
        self.assertEqual(got, {"ok": True, "relay": True})
        job = self.ws.relay_for("claude-code", A, "http://127.0.0.1:7340")
        self.assertIn('SendMessage to "local_b"', job)
        self.assertIn(f"curl -s \"http://127.0.0.1:7340/p/{self.p.slug}/next?by=claude-code&sid=$CLAUDE_CODE_SESSION_ID\"", job)
        self.assertIn("Do only this, then go back to what you were doing", job)
        self.assertEqual(self.ws.relay_for("claude-code", A, "http://127.0.0.1:7340"), "")

    def test_with_none_connected_a_new_session_brings_back_every_lost_one(self):
        self.p.agents.saw("claude-code", 0, "Old", C)
        self.p.agents.lostness.called.pop(C)
        self.p.agents.lostness.was, self.p.agents.lostness.heard = {C: time.time()}, set()  # C waited before the restart
        self.p.agents.lostness.started -= 200
        got = self.ws.reconnect(self.p.slug, B, "http://127.0.0.1:7340")
        self.assertFalse(got["relay"])
        self.assertIn('curl -s "http://127.0.0.1:7340/api/reconnects?app=claude-code"', got["text"])
        listing = self.ws.lost_list("claude-code", "http://127.0.0.1:7340")
        self.assertIn("these 2 sessions", listing)
        self.assertIn('"local_b"', listing)
        self.assertIn(f'"cliSessionId": "{C}"', listing)  # no record of it in the app: how to find it

    def test_an_archived_session_is_not_brought_back(self):
        with open(os.path.join(self.desk.name, "x", "y", "local_b.json"), "w") as f:
            json.dump({"sessionId": "local_b", "cliSessionId": B, "title": "Export work", "isArchived": True}, f)
        with self.assertRaises(Exception):
            self.ws.reconnect(self.p.slug, B, "http://127.0.0.1:7340")


class OverTheWire(ServerCase):
    def test_the_waiting_session_gets_the_job_at_once_and_the_ask_ends_when_it_is_back(self):
        urllib.request.urlopen(self.p + f"/next?by=claude-code&session=Lost&sid={B}", timeout=10).read()
        got: list = []
        waiting = threading.Thread(target=lambda: got.append(urllib.request.urlopen(
            self.p + f"/next?by=claude-code&session=Planner&sid={A}&wait=20", timeout=30).read().decode()))
        waiting.start()
        time.sleep(0.5)
        t0 = time.time()
        req = urllib.request.Request(self.p + "/api/reconnect", data=json.dumps({"sid": B}).encode(),
                                     headers={"Content-Type": "application/json"})
        self.assertTrue(json.loads(urllib.request.urlopen(req, timeout=10).read())["relay"])
        waiting.join(15)
        self.assertLess(time.time() - t0, 5)
        self.assertIn("reconnect first", got[0])
        self.assertIn('"cliSessionId": "', got[0])
        urllib.request.urlopen(self.p + f"/next?by=claude-code&session=Lost&sid={B}", timeout=10).read()  # back
        self.assertNotIn("reconnect first", urllib.request.urlopen(self.p + f"/next?by=claude-code&session=Planner&sid={A}", timeout=10).read().decode())


if __name__ == "__main__":
    unittest.main()
