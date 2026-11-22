"""T870 (Yadong r113 r1476, D157): Taska opens a Claude Code session the user sees in the Claude app's sidebar, for a
task nobody is on: the app's own link (claude://code/new?q=...) with what the session is to do, then one Return in it.
Never a folder (the app asks the user to confirm one, and that is theirs to confirm); only while the user leaves the
Mac alone; at most once an hour for a task and three times an hour in all; the window in front is put back. With no
idle session to wake, the watch (T869) opens one before it tells the user."""

import os
import subprocess
import sys
import tempfile
import time
import unittest
from urllib.parse import unquote

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import support  # noqa: E402,F401  (the server on the path)
from taska.agent_text.language import parse  # noqa: E402
from taska.services import opener as op  # noqa: E402
from taska.services import watch as w  # noqa: E402
from taska.services.workspace import Workspace  # noqa: E402


class Mac:
    """The commands Taska runs, answered as a Mac would."""

    def __init__(self) -> None:
        self.idle = 300.0
        self.calls: list = []
        self.keys_fail = ""

    def __call__(self, args):
        self.calls.append(list(args))
        out, code, err = "", 0, ""
        if args[0] == "ioreg":
            out = f'  |   "HIDIdleTime" = {int(self.idle * 1e9)}\n'
        elif args[0] == "osascript" and "frontmost" in " ".join(args):
            out = "Google Chrome\n"
        elif args[0] == "osascript" and "keystroke return" in " ".join(args) and self.keys_fail:
            code, err = 1, self.keys_fail
        return subprocess.CompletedProcess(args, code, out, err)


class Opening(unittest.TestCase):
    def setUp(self) -> None:
        self.mac = Mac()
        self.now = [1_800_000_000.0]
        self.o = op.Opener(run=self.mac, clock=lambda: self.now[0], sleep=lambda s: None, platform="darwin")

    def test_it_opens_the_apps_link_presses_return_and_puts_the_window_back(self) -> None:
        self.assertEqual(self.o.open("http://127.0.0.1:7340", "system-design", "T50"), "opened")
        link = next(c[1] for c in self.mac.calls if c[0] == "open")
        self.assertTrue(link.startswith("claude://code/new?q="))
        self.assertNotIn("folder=", link)  # the user confirms a folder, never Taska
        said = unquote(link.split("q=", 1)[1])
        self.assertIn("project system-design, task T50", said)
        self.assertIn("http://127.0.0.1:7340/p/system-design/next?by=claude-code", said)
        self.assertIn("/p/system-design/listen?by=claude-code", said)
        keys = [c for c in self.mac.calls if c[0] == "osascript" and "keystroke return" in " ".join(c)]
        self.assertEqual(len(keys), 1)
        self.assertIn('tell application "Google Chrome" to activate', " ".join(self.mac.calls[-1]))

    def test_never_while_the_user_uses_the_mac_nor_twice_for_a_task_nor_more_than_three_an_hour(self) -> None:
        self.mac.idle = 5
        self.assertIn("the user is using this Mac", self.o.open("r", "p", "T1"))
        self.assertFalse(any(c[0] == "open" for c in self.mac.calls))
        self.mac.idle = 300
        self.assertEqual(self.o.open("r", "p", "T1"), "opened")
        self.assertIn("within the hour", self.o.open("r", "p", "T1"))
        self.assertEqual(self.o.open("r", "p", "T2"), "opened")
        self.assertEqual(self.o.open("r", "p", "T3"), "opened")
        self.assertIn("3 sessions were opened within the hour", self.o.open("r", "p", "T4"))
        self.now[0] += 3601
        self.assertEqual(self.o.open("r", "p", "T4"), "opened")

    def test_without_the_mac_allowing_keys_it_says_how_to_allow_them(self) -> None:
        self.mac.keys_fail = "System Events got an error: osascript is not allowed to send keystrokes. (1002)"
        said = self.o.open("r", "p", "T1")
        self.assertIn("could not press Return", said)
        self.assertIn("Privacy & Security › Accessibility", said)
        self.assertEqual(op.Opener(run=self.mac, platform="linux").open("r", "p", "T1"), "not opened: only on a Mac with the Claude app")


class OffUnlessLive(unittest.TestCase):
    def test_a_workspace_opens_no_session_unless_the_live_taska_turns_it_on(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:  # a test once opened a real session in the Claude app
            ws = Workspace(tmp)
            try:
                self.assertIsNone(ws.opener)
            finally:
                ws.close()


class FollowedUp(unittest.TestCase):
    """r117: whoever sends the message is not done once it is sent: Taska follows it up; the session asked for not
    taking the work, Taska opens a new one, and tells the user only if that does not take it either."""

    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.ws = Workspace(self.tmp.name)
        self.ws.local = "http://127.0.0.1:7340"
        self.p = self.ws.projects["default"]
        self.mac = Mac()
        self.now = [time.time()]
        sid = "aaaaaaaa-1111-4111-8111-000000000001"
        self.ws.opener = op.Opener(run=self.mac, clock=lambda: self.now[0], sleep=lambda s: None, platform="darwin")
        self.ws.reconnects._clock = lambda: self.now[0]
        self.watch = w.Watch(self.ws, self.ws.listeners, lambda x: type("S", (), {"status": "idle"})() if x == sid else None,
                             lambda x: {"id": "local_x", "title": "one", "archived": False} if x == sid else None,
                             clock=lambda: self.now[0])
        self.p.agents.saw("claude-code", 0, "one", sid)
        self.p.run(parse("new P1 Gather the questions\n"), "you")
        self.watch.check()

    def tearDown(self) -> None:
        self.ws.close()
        self.tmp.cleanup()

    def test_not_taken_after_the_message_a_new_session_then_the_user(self) -> None:
        self.now[0] += w.GRACE + 1
        self.assertEqual(self.watch.check(), ["default T1: asked to wake one"])
        job = self.ws.dispatch("d", 0, self.ws.local)
        self.assertIn("Taska follows it up itself", job)
        self.ws.reconnects.heard("aaaaaaaa-1111-4111-8111-000000000001")  # it came, but did not take T1
        self.now[0] += w.COME + 1
        self.assertEqual(self.watch.check(), ["default T1: the session asked for did not take it; opened a new one"])
        self.now[0] += w.COME + 1
        self.assertIn("told the user", self.watch.check()[0])


class TheWatchOpensOne(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.ws = Workspace(self.tmp.name)
        self.ws.local = "http://127.0.0.1:7340"
        self.p = self.ws.projects["default"]
        self.mac = Mac()
        self.now = [time.time()]
        self.ws.opener = op.Opener(run=self.mac, clock=lambda: self.now[0], sleep=lambda s: None, platform="darwin")
        self.watch = w.Watch(self.ws, self.ws.listeners, lambda sid: None, lambda sid: None, clock=lambda: self.now[0])
        self.p.agents.saw("claude-code", 0, "", "")  # an agent works here
        self.p.run(parse("new P1 Gather the questions\n"), "you")
        self.watch.check()

    def tearDown(self) -> None:
        self.ws.close()
        self.tmp.cleanup()

    def test_none_to_wake_opens_a_session_and_the_user_is_told_only_if_it_does_not_come(self) -> None:
        self.now[0] += w.GRACE + 1
        self.assertEqual(self.watch.check(), ["default T1: opened a session for it"])
        self.now[0] += 60
        self.assertEqual(self.watch.check(), [])
        self.now[0] += w.COME
        self.assertIn("told the user", self.watch.check()[0])

    def test_while_the_user_uses_the_mac_it_waits_then_tells(self) -> None:
        self.mac.idle = 3
        self.now[0] += w.GRACE + 1
        self.assertEqual(self.watch.check(), [])  # tried again later
        self.now[0] += w.COME
        got = self.watch.check()
        self.assertIn("not opened: the user is using this Mac", got[0])
        self.assertIn("told the user", got[1])


if __name__ == "__main__":
    unittest.main()
