"""B762 (Yadong r1280, r1283, r1286, 11-13): Taska cannot wake an Antigravity session from outside, so the session
keeps Taska's waker running in its own terminal. The waker is woken by Taska only when there is work and the session
is idle (once, not again while it works); nothing shows on the page while it works; only when the user writes and no
waker has waited for 15 minutes is it said, once, as an item, closed again when a waker comes back. Change only on
Yadong's explicit word."""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import threading
import time
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from support import ProjectCase
from taska.http import agent_routes  # noqa: E402
from taska.http.messages import Request  # noqa: E402

A = "aaaaaaaa-1111-2222-3333-444444444444"
B = "bbbbbbbb-1111-2222-3333-444444444444"


class Clock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


class Waker(ProjectCase):
    def setUp(self) -> None:
        super().setUp()
        self.clock = Clock()
        self.p.waker.clock = self.clock
        self.p.waker.started = self.clock.now

    def call(self, path: str) -> str:
        req = Request("GET", path, {}, "127.0.0.1", read_body=lambda limit: b"")
        res = agent_routes.get(req, self.p, path.split("?")[0], "http://x/p/demo")
        assert res is not None
        return res.body.decode() if isinstance(res.body, bytes) else str(res.body)

    def work(self, title: str = "Export loses the filter") -> None:
        self.p.run([(0, {"op": "new", "type": "task", "pri": "P1", "when": "now", "title": title})], "you")

    def test_an_idle_session_is_woken_once_for_work_not_again_while_it_works(self) -> None:
        self.assertIn("nothing to do now", self.call(f"/next?by=antigravity&sid={A}&lead=1"))
        self.assertEqual(self.call(f"/wake?wait=0&sid={A}"), "nothing to do now\n")
        self.work()
        self.assertEqual(self.call(f"/wake?wait=0&sid={A}"), "wake\n")
        self.assertEqual(self.call(f"/wake?wait=0&sid={A}"), "nothing to do now\n")  # woken: it works now
        self.assertIn("next T1 ", self.call(f"/next?by=antigravity&sid={A}"))
        self.work("Another one")
        self.assertEqual(self.call(f"/wake?wait=0&sid={A}"), "nothing to do now\n")  # it takes it on its next /next
        self.p.run([(0, {"op": "set", "ref": "T1", "f": {"status": "dropped"}, "src": None}),
                    (0, {"op": "set", "ref": "T2", "f": {"status": "dropped"}, "src": None})], "you")
        self.assertIn("nothing to do now", self.call(f"/next?by=antigravity&sid={A}"))  # idle again
        self.work("A third")
        self.assertEqual(self.call(f"/wake?wait=0&sid={A}"), "wake\n")

    def test_the_wait_ends_when_work_comes(self) -> None:
        self.call(f"/next?by=antigravity&sid={A}&lead=1")
        out: list = []
        t = threading.Thread(target=lambda: out.append(self.call(f"/wake?wait=30&sid={A}")))
        start = time.time()
        t.start()
        time.sleep(0.3)
        self.work()
        t.join(5)
        self.assertEqual(out, ["wake\n"])
        self.assertLess(time.time() - start, 5)

    def test_a_woken_session_that_stays_silent_is_woken_again_after_10_minutes(self) -> None:
        self.call(f"/next?by=antigravity&sid={A}&lead=1")
        self.work()
        self.assertEqual(self.call(f"/wake?wait=0&sid={A}"), "wake\n")
        self.clock.now += 601
        self.assertEqual(self.call(f"/wake?wait=0&sid={A}"), "wake\n")

    def test_a_replaced_session_s_waker_stops(self) -> None:
        self.call(f"/next?by=antigravity&sid={A}&lead=1")
        self.call(f"/next?by=antigravity&sid={B}&lead=1")
        self.assertTrue(self.call(f"/wake?wait=0&sid={A}").startswith("replaced:"))

    def test_nothing_is_said_while_it_works_once_when_it_does_not(self) -> None:
        self.call(f"/next?by=antigravity&sid={A}&lead=1")
        self.call(f"/wake?wait=0&sid={A}")
        say = lambda text: self.p.run([(0, {"op": "input", "text": text, "q": text})], "you")  # noqa: E731
        self.clock.now += 600
        say("one")
        time.sleep(0.2)
        self.assertEqual([i.title for i in self.p.state.items.values()], [])  # gone a short while: nothing said
        self.clock.now += 400
        say("two")
        say("three")
        time.sleep(0.3)
        alarms = [i for i in self.p.state.items.values() if "Antigravity" in i.title]
        self.assertEqual(len(alarms), 1)
        self.assertEqual(alarms[0].status, "proposed")  # in front of the user, in Needs you
        self.call(f"/wake?wait=0&sid={A}")  # a waker waits again: the alarm went away, and so does its item
        self.assertTrue(self.p.state.items[alarms[0].n].deleted)

    def test_the_script_starts_one_waker_and_wakes_by_a_message(self) -> None:
        script = self.call("/waker")
        self.assertIn('$2/wake?wait=540', script)
        self.assertIn('"http://x/p/demo" "$sid"', script)
        self.assertIn("taska-waker-demo-", script)
        self.assertIn('agentapi" send-message --title=Taska', script)
        with tempfile.NamedTemporaryFile("w", suffix=".sh", delete=False) as f:
            f.write(script)
        try:
            self.assertEqual(subprocess.run(["sh", "-n", f.name]).returncode, 0)
        finally:
            os.unlink(f.name)


if __name__ == "__main__":
    unittest.main()
