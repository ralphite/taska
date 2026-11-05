"""D115 #43: a phone's quiet hours are its own: from when to when (local time, 22:00 to 08:00 unless changed), kept
with its push subscription; Taska holds pushes to it inside them, a span over midnight included."""

from __future__ import annotations

import os
import sys
import tempfile
import time
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.services.push import Push, in_quiet, minutes  # noqa: E402


class QuietHours(unittest.TestCase):
    def test_a_time_of_day(self) -> None:
        self.assertEqual(minutes("07:30", 0), 450)
        self.assertEqual(minutes("24:00", 5), 5)
        self.assertEqual(minutes(None, 5), 5)
        self.assertEqual(minutes("soon", 5), 5)

    def test_spans(self) -> None:
        night = {"quiet": True}  # none of its own: 22:00 to 08:00
        self.assertTrue(in_quiet(night, 23 * 60))
        self.assertTrue(in_quiet(night, 7 * 60 + 59))
        self.assertFalse(in_quiet(night, 8 * 60))
        lunch = {"quiet": True, "from": 12 * 60, "to": 13 * 60}  # within a day
        self.assertTrue(in_quiet(lunch, 12 * 60 + 30))
        self.assertFalse(in_quiet(lunch, 23 * 60))
        self.assertFalse(in_quiet({"quiet": False, "from": 0, "to": 1439}, 600))
        self.assertFalse(in_quiet({"quiet": True, "from": 600, "to": 600}, 600))  # from equal to to: none

    def test_kept_with_the_subscription_and_kept_to(self) -> None:
        with tempfile.TemporaryDirectory() as root:
            push = Push(root)
            push.subscribe({"endpoint": "https://push.example/a"}, True, "21:15", "06:45")
            push.subscribe({"endpoint": "https://push.example/b"}, True)
            self.assertEqual([(x["from"], x["to"]) for x in push.subs], [(21 * 60 + 15, 6 * 60 + 45), (22 * 60, 8 * 60)])
            self.assertEqual(Push(root).subs[0]["from"], 21 * 60 + 15)  # saved
            sent = []
            push._send = lambda sub: sent.append(sub["endpoint"]) or True  # type: ignore[method-assign]
            push.check(lambda: [])  # the first look: nothing new yet
            at = list(time.localtime())
            at[3], at[4] = 21, 30
            with mock.patch("time.localtime", return_value=time.struct_time(at)):
                push.check(lambda: [{"project": "p", "code": "T1", "kind": "ask"}])
            self.assertEqual(sent, ["https://push.example/b"])  # a: quiet from 21:15; b: not until 22:00


if __name__ == "__main__":
    unittest.main()
