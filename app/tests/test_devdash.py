"""The dashboard for making Taska: counts and times from the page's log, never words."""

import json
import os
import sqlite3
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "server"))

from taska.domain import events as ev  # noqa: E402
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

    def test_rounds_of_work(self) -> None:
        """F576: each round from started (doing) to handed over (review) or done, with its minutes and the tokens of
        the cost line that came with it; a round put back before it was handed over does not count."""
        def at(m: int) -> str:
            return f"2026-10-24T10:{m:02d}:00+00:00"

        done = SimpleNamespace(by="claude-code", t=at(41), text="Done.\n成本：40 分钟 · 66,321 token（读缓存 8,163,512）· 34 步")
        st = SimpleNamespace(
            events=[
                ev.ItemAdded(n=1, status="open", t=at(0)),
                ev.FieldsSet(n=1, f={"status": "doing"}, t=at(1)),
                ev.FieldsSet(n=1, f={"status": "review"}, t=at(41)),
                ev.FieldsSet(n=1, f={"status": "doing"}, t=at(50)),  # sent back: a second round
                ev.FieldsSet(n=1, f={"status": "done"}, t=at(55)),
                ev.ItemAdded(n=2, status="doing", t=at(2)),
                ev.FieldsSet(n=2, f={"status": "open"}, t=at(9)),  # put back: no round
                ev.FieldsSet(n=2, f={"pri": "P0"}, t=at(10)),
            ],
            items={1: SimpleNamespace(title="Export keeps the filter", thread=[done], live=True),
                   2: SimpleNamespace(title="Put back", thread=[], live=True)},
            code=lambda n: f"T{n:02d}",
        )
        got = [(r["code"], r["minutes"], r["tokens"]) for r in devdash.rounds("taska", st)]  # type: ignore[arg-type]
        self.assertEqual(got, [("T01", 40, 66321), ("T01", 5, None)])


if __name__ == "__main__":
    unittest.main()
