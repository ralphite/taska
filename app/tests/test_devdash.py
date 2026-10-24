"""The dashboard for making Taska: counts and times from the page's log, never words."""

import json
import os
import sqlite3
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "server"))

from taska.services import devdash  # noqa: E402


class DashboardTest(unittest.TestCase):
    def setUp(self) -> None:
        self.db = os.path.join(tempfile.mkdtemp(), "logs.db")
        c = sqlite3.connect(self.db)
        c.execute("CREATE TABLE logs (t TEXT, source TEXT, kind TEXT, project TEXT, tab TEXT, ms INTEGER, data TEXT)")
        now = datetime.now(timezone.utc)

        def t(m: int) -> str:
            return (now - timedelta(minutes=m)).strftime("%Y-%m-%dT%H:%M:%S")

        c.executemany("INSERT INTO logs VALUES (?,?,?,?,?,?,?)", [
            (t(30), "page", "voice start", "taska", "a", None, "{}"),
            (t(29), "page", "voice stop and send", "taska", "a", None, "{}"),
            (t(20), "page", "open", "taska", "a", None, json.dumps({"d": {"n": 5}})),
            (t(10), "page", "net", "taska", "a", 1800, json.dumps({"why": "slow", "url": "/p/taska/api/changes?c=1", "via": "tunnel"})),
            (t(5), "page", "draft", "taska", "a", None, json.dumps({"msg": "words never counted"})),
        ])
        c.commit()
        c.close()

    def test_counts_what_you_did(self) -> None:
        d = devdash.summary(self.db, None, lambda p, n: ("T05", "An item"))
        self.assertEqual(d["actions"], 3)  # the page's own notes (net, draft) are not things you did
        self.assertEqual(d["voice"]["n"], 1)
        self.assertEqual(d["voice"]["ends"], [("sent as it was", 1)])
        self.assertEqual(d["items"], [{"project": "taska", "code": "T05", "title": "An item", "n": 1}])
        self.assertEqual(d["slow"]["where"], [("/p/*/api/changes", 1)])
        self.assertNotIn("words never counted", json.dumps(d))

    def test_no_log(self) -> None:
        self.assertEqual(devdash.summary(None, 7, lambda p, n: None)["actions"], 0)


if __name__ == "__main__":
    unittest.main()
