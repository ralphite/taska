"""T424 for the organizer: when its service is busy, slow or out of reach, the input waits and is asked again by
itself, longer each time; only a failure that cannot go away by itself (a refused key) shows as failed."""

import os
import sys
import tempfile
import threading
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.domain import events as ev  # noqa: E402
from taska.domain.vocab import Refused  # noqa: E402
from taska.services import organizer as org  # noqa: E402
from taska.services.project import Project  # noqa: E402


class Clock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


class OrganizerRetry(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = Project(self.tmp.name, "demo")
        self.p.emit(ev.InputAdded(by="you", id="r1", text="Export loses the filter"))
        self.clock = Clock()
        self.o = org.Organizer(self.p, clock=self.clock)

    def tearDown(self):
        self.p.close()
        self.tmp.cleanup()

    def organize(self, answer):
        with mock.patch.object(org.gemini, "ask", side_effect=answer):
            self.o.organize("r1")

    def test_busy_waits_and_asks_again_later(self):
        inp = lambda: self.p.state.inputs["r1"]  # noqa: E731
        self.organize(Refused("Gemini HTTP 503: This model is currently experiencing high demand"))
        self.assertIsNone(inp().org)  # not failed: still waiting to be organized
        self.assertFalse(self.o.due(inp()))
        self.clock.now += 15
        self.assertTrue(self.o.due(inp()))
        self.organize(Refused("Gemini unreachable: TimeoutError('The read operation timed out')"))
        self.assertIsNone(inp().org)
        self.clock.now += 15
        self.assertFalse(self.o.due(inp()))  # the second wait is longer
        self.clock.now += 15
        self.assertTrue(self.o.due(inp()))
        self.organize(lambda *a, **k: "pass")
        self.assertTrue(inp().org.ok)
        self.assertNotIn("r1", self.o.later)

    def test_a_refused_key_fails_at_once(self):
        self.organize(Refused("Gemini HTTP 403: API key not valid"))
        self.assertFalse(self.p.state.inputs["r1"].org.ok)
        self.assertFalse(self.o.due(self.p.state.inputs["r1"]))

    def test_an_earlier_busy_failure_is_asked_again(self):
        self.p.emit(ev.Organized(src="r1", ok=False, msg="Gemini HTTP 503: busy", by="org"))
        self.assertTrue(self.o.due(self.p.state.inputs["r1"]))

    def test_the_wait_is_capped(self):
        for _ in range(12):
            self.organize(Refused("Gemini HTTP 503"))
        until, tries = self.o.later["r1"]
        self.assertEqual(tries, 12)
        self.assertEqual(until - self.clock.now, 600)


class OrganizerTogether(unittest.TestCase):
    """B684 (Yadong: one at a time is not needed): inputs are organized at the same time, not one after another."""

    def test_two_inputs_are_organized_at_once(self):
        tmp = tempfile.TemporaryDirectory()
        p = Project(tmp.name, "demo")
        p.organizing.on = True
        p.emit(ev.InputAdded(by="you", id="r1", text="Export loses the filter"))
        p.emit(ev.InputAdded(by="you", id="r2", text="The coupon box is in the way"))
        both, go = threading.Barrier(2, timeout=5), threading.Event()

        def ask(*a, **k):
            both.wait()  # each waits until the other is being asked too
            go.wait(5)
            return "pass"

        with mock.patch.object(org.gemini, "ask", side_effect=ask):
            org.Organizer(p).start()
            with p.lock:
                self.assertTrue(p.news.wait_for(lambda: p.organizing.busy == {"r1", "r2"}, timeout=5))
            go.set()
            with p.lock:
                self.assertTrue(p.news.wait_for(lambda: all(p.state.inputs[r].org for r in ("r1", "r2")), timeout=5))
            p.gone = True
            p.news.bump()
        p.close()
        tmp.cleanup()


if __name__ == "__main__":
    unittest.main()
