"""F846: tools/ui_usage.py counts each control on the phone and the desktop and tells the taps that seemed to do
nothing (the same control again within a moment), the swipes and the list filters."""

from __future__ import annotations

import os
import sys
import unittest
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tools"))

from ui_usage import usage  # noqa: E402


class UiUsage(unittest.TestCase):
    def test_controls_sides_taps_again_swipes_and_filters(self) -> None:
        t0 = datetime(2026, 11, 20, tzinfo=timezone.utc)
        at = lambda s: t0 + timedelta(seconds=s)  # noqa: E731
        u = usage([
            (at(0), "tap", {"what": "Type · T", "role": "button", "where": "/p/sd/T10", "via": "tunnel"}),
            (at(0.4), "tap", {"what": "Type · T", "role": "button", "where": "/p/sd/T10", "via": "tunnel"}),
            (at(9), "tap", {"what": "Type · T", "role": "button", "where": "/p/sd/T10", "via": "local"}),
            (at(10), "tap", {"what": "Open T12 Fix it", "role": "row", "where": "/p/sd/", "via": "tunnel"}),
            (at(11), "swipe", {"dir": "right", "what": "Done", "n": "12"}),
            (at(12), "tap", {"what": "Later", "role": "button", "from": "swipe", "via": "tunnel"}),
            (at(13), "view", {"to": "/p/sd/?status=wait"}),
        ])
        self.assertEqual(dict(u["used"]["Type · T"]), {"phone": 2, "desk": 1})
        self.assertEqual(u["again"]["Type · T"], 1)
        self.assertEqual(u["used"]["row (opens the task)"]["phone"], 1)
        self.assertEqual(u["used"]["Later (under a swiped row)"]["phone"], 1)
        self.assertEqual(u["swipes"][("right", "Done")], 1)
        self.assertEqual(u["filters"]["status=wait"], 1)


if __name__ == "__main__":
    unittest.main()
