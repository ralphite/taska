"""T869 (Yadong r1470 r1473): work nobody takes is found and handed to someone. Each case of the plan (D156), on a real
workspace with the app's view of each session and the clock given:
- a task nobody is on for five minutes has an idle Claude session of its project woken: the dispatcher (or a session
  connected now) is handed the job of sending it a message through its app;
- before five minutes, or with a session on it (waiting with Taska's script and holding it, or at work on it), nothing;
- nobody idle to wake (busy, waiting on the user, archived, unknown to its app), nobody sending the message, or the woken
  session not coming: the user is told once, by a task, which goes by itself once the work is taken;
- groups, Later, tasks waiting on the user or on another task, or with subtasks open are not work to hand;
- a wait the session wrote itself does not count as waiting, and its next call is told to use Taska's script."""

import os
import sys
import tempfile
import time
import unittest
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from support import ServerCase  # noqa: E402
from taska.agent_text.guide_text import AGENT  # noqa: E402
from taska.agent_text.language import parse  # noqa: E402
from taska.services import watch as w  # noqa: E402
from taska.services.workspace import Workspace  # noqa: E402

IDLE = "aaaaaaaa-1111-4111-8111-000000000001"
BUSY = "bbbbbbbb-2222-4222-8222-000000000002"


class S:
    def __init__(self, status: str) -> None:
        self.status = status


class Watching(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.ws = Workspace(self.tmp.name)
        self.ws.local = "http://127.0.0.1:7340"
        self.p = self.ws.projects["default"]
        self.now = [time.time()]
        self.apps = {IDLE: S("idle"), BUSY: S("busy")}
        self.desk = {IDLE: {"id": "local_idle", "title": "Idle one", "archived": False},
                     BUSY: {"id": "local_busy", "title": "Busy one", "archived": False}}
        self.watch = w.Watch(self.ws, self.ws.listeners, lambda sid: self.apps.get(sid),
                             lambda sid: self.desk.get(sid), clock=lambda: self.now[0])
        self.ws.reconnects._clock = lambda: self.now[0]
        for sid, name in ((IDLE, "idle one"), (BUSY, "busy one")):
            self.p.agents.saw("claude-code", 0, name, sid)
        self.do("new P1 Gather the OpenAI questions\n")
        self.assertEqual(self.watch.check(), [])  # it starts counting when it first sees the task with nobody on it

    def tearDown(self) -> None:
        self.ws.close()
        self.tmp.cleanup()

    def do(self, text: str, by: str = "you") -> list:
        return self.p.run(parse(text), by)[0]

    def later(self, s: float) -> list:
        self.now[0] += s
        return self.watch.check()

    def alarm(self) -> dict:
        return self.p.store.db.get(w.KEY) or {}

    def test_an_idle_session_is_woken_after_five_minutes_through_the_dispatcher(self) -> None:
        self.assertEqual(self.later(w.GRACE - 10), [])  # not yet
        woken = []
        self.p.news.wake = lambda: woken.append(1)  # type: ignore[method-assign]
        self.assertEqual(self.later(20), ["default T1: asked to wake idle one"])
        self.assertTrue(woken)  # the sessions waiting now look again, so one connected may send it at once
        job = self.ws.dispatch("dispatcher-session-id", 0, self.ws.local)
        self.assertIn('Taska asks you to wake the Claude session "idle one" (project default): work waits for it (T1)', job)
        self.assertIn(f'"cliSessionId": "{IDLE}"', job)  # how its app is told (the app's record, read by Taska)
        self.assertIn("Taska: work waits in project default (T1)", job)
        self.assertIn("/p/default/listen?by=claude-code", job)
        self.assertEqual(self.ws.dispatch("dispatcher-session-id", 0, self.ws.local), "nothing to do now\n")  # once
        self.assertEqual(self.later(60), [])  # asked: not again, and not told while it may come

    def test_the_woken_session_takes_it_and_nothing_more_happens(self) -> None:
        self.later(w.GRACE + 1)
        self.ws.dispatch("d", 0, self.ws.local)
        self.assertTrue(self.ws.reconnects.heard(IDLE))  # it called Taska
        self.do("T1 doing\nT1 progress Looking for the questions\n", "claude-code")
        self.assertEqual(self.later(w.COME + 60), [])
        self.assertEqual(self.alarm(), {})

    def test_nobody_idle_to_wake_tells_the_user_once_and_it_goes_once_taken(self) -> None:
        self.apps[IDLE] = S("waiting")  # waiting on the user in its app
        got = self.later(w.GRACE + 1)
        self.assertEqual(len(got), 1)
        self.assertIn("default T1: told the user", got[0])
        ref = self.alarm()["T1"]
        note = next(t for t in self.p.state.tasks.values() if self.p.state.code(t.n) == ref)
        self.assertEqual(note.title, "没有 agent 在做 T1")
        self.assertIn("http://127.0.0.1:7340/dispatch", note.body)  # what to give a dispatcher
        self.assertEqual(self.later(60), [])  # once
        self.do("T1 doing\nT1 progress On it\n", "claude-code")
        self.assertEqual(self.later(60), [f"default T1: taken; the note to the user went ({ref})"])
        self.assertTrue(self.p.state.tasks[note.n].deleted)

    def test_an_archived_or_unknown_session_is_not_woken(self) -> None:
        self.desk[IDLE] = {"id": "local_idle", "title": "Idle one", "archived": True}
        self.assertIn("told the user", self.later(w.GRACE + 1)[0])
        self.desk.pop(IDLE)
        self.assertEqual(self.later(60), [])  # told already

    def test_nobody_sending_the_message_or_the_session_not_coming_tells_the_user(self) -> None:
        self.later(w.GRACE + 1)  # asked; no dispatcher or connected session takes the job
        self.assertEqual(self.later(w.HANDED - 30), [])
        self.assertIn("told the user", self.later(60)[0])

    def test_a_session_on_it_is_left_alone(self) -> None:
        self.p.state.claim(1, "claude-code · busy one", time.time())
        self.ws.listeners.start("default", "claude-code · busy one")  # holds it and waits with Taska's script
        self.assertEqual(self.later(w.GRACE + 1), [])
        self.ws.listeners.stop("default", "claude-code · busy one")  # its own kind of wait from now: not on it
        self.assertEqual(self.later(1), [])  # the five minutes start again
        self.assertEqual(self.later(w.GRACE + 1), ["default T1: asked to wake idle one"])

    def test_only_work_to_hand_counts(self) -> None:
        self.do("T1 later\nnew group P1 Questions\nnew P1 parent=T2 One\nnew P1 Two\nT4 after T3\nnew P1 Three\n"
                "new P1 Four\nnew P1 parent=T6 Five\nT6 open\n")
        self.do("T5 ask Which company first?\n", "claude-code")
        st = self.p.state
        self.assertEqual([st.code(t.n) for t in w.work(st)], ["T3", "T7"])  # not Later, a group, blocked, asking, kids open

    def test_a_wait_of_its_own_is_told_once_and_the_guide_gives_the_script(self) -> None:
        lis = self.ws.listeners
        lis.own_wait("default", IDLE)
        self.assertTrue(lis.tell("default", IDLE))
        self.assertFalse(lis.tell("default", IDLE))
        self.assertFalse(lis.listening("default", "claude-code · idle one"))
        self.assertIn('curl -s "BASE/listen?by=claude-code" | sh', AGENT)
        self.assertNotIn("while o=$(curl", AGENT)

    def test_after_a_restart_it_looks_again_from_the_start(self) -> None:
        self.later(w.GRACE - 60)
        fresh = w.Watch(self.ws, w.Listeners(), lambda sid: self.apps.get(sid), lambda sid: self.desk.get(sid),
                        clock=lambda: self.now[0])
        self.now[0] += 120
        self.assertEqual(fresh.check(), [])  # its five minutes start when it starts
        self.now[0] += w.GRACE
        self.assertEqual(fresh.check(), ["default T1: asked to wake idle one"])


class TheScriptOverHttp(ServerCase):
    def call(self, path: str) -> str:
        return urllib.request.urlopen(self.p + path, timeout=15).read().decode()

    def test_the_listen_script_and_a_wait_of_its_own(self) -> None:
        script = self.call("/listen?by=claude-code&session=worker")
        self.assertIn("&listen=1&session=worker", script)
        self.assertIn(self.p + "/next?wait=540&by=claude-code", script.replace("$B", self.p))
        self.do("new P1 Gather the questions\n", "you")
        self.call(f"/next?wait=1&by=claude-code&sid={IDLE}")  # a wait it wrote itself
        said = self.do("T1 progress started\n", session=None)
        self.assertNotIn("Your wait for work is one you wrote", said)  # another session: not told
        told = urllib.request.urlopen(urllib.request.Request(f"{self.p}/do?by=claude-code&sid={IDLE}", data=b"T1 progress on it\n"),
                                      timeout=10).read().decode()
        self.assertIn("Your wait for work is one you wrote, not Taska's", told)
        again = urllib.request.urlopen(urllib.request.Request(f"{self.p}/do?by=claude-code&sid={IDLE}", data=b"T1 progress more\n"),
                                       timeout=10).read().decode()
        self.assertNotIn("Your wait for work is one you wrote", again)  # once
        dispatcher = urllib.request.urlopen(self.base + "/api/dispatcher", timeout=10).read().decode()
        self.assertIn("You are Taska's dispatcher", dispatcher)
        self.assertIn(f'{self.base}/dispatch', dispatcher.replace('\\"', '"'))
        self.assertIn("api/dispatch?wait=540", urllib.request.urlopen(self.base + "/dispatch", timeout=10).read().decode())


if __name__ == "__main__":
    unittest.main()
