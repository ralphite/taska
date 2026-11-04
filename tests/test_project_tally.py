"""F667: each project's counts in the projects' list (the sidebar's card), as its page counts them: open and finished
on Items, what needs you, its inputs and documents; archived, deleted and settled rules left out."""

from __future__ import annotations

import os
import sys
import unittest
from typing import Any

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "server"))

from taska.domain.projection.core import replay  # noqa: E402
from taska.services.workspace import tally  # noqa: E402

T = "2026-11-04T10:00:%02d-08:00"


def add(n: int, title: str, status: str = "open", type_: str = "feature") -> dict:
    return {"k": "add", "n": n, "by": "you", "title": title, "src": None, "type": type_, "pri": "P2", "when": "now",
            "status": status, "body": "", "next": "", "parent": None, "t": T % n}


def said(rid: str, text: str, t: int) -> dict:
    return {"k": "in", "id": rid, "by": "you", "text": text, "scope": None, "files": [], "t": T % t}


def doc(d: int, n: int, t: int) -> dict:
    return {"k": "doc", "d": d, "n": n, "title": f"Plan {d}", "md": "Steps.", "by": "x", "t": T % t}


LOG: Any = [
    add(1, "Export keeps the filter"),
    add(2, "Saving drops the last word", status="doing"),
    add(3, "Old footer", status="done"),
    add(4, "Never mind", status="dropped"),
    add(5, "Put away", status="done"),
    add(6, "Gone"),
    add(7, "Exports write what the list shows", type_="rule"),
    add(8, "Agents ask before deleting", status="proposed", type_="rule"),
    said("r1", "Keep the filter.", 20),
    said("r2", "Never mind that.", 21),
    {"k": "del", "src": "r2", "ns": [], "kept": [], "by": "you", "t": T % 22},
    doc(1, 1, 23),
    doc(2, 6, 24),
    {"k": "arch", "ns": [5], "on": True, "by": "you", "t": T % 25},
    {"k": "idel", "ns": [6], "by": "you", "t": T % 26},
]


class Tally(unittest.TestCase):
    def test_counts_as_the_page_counts(self) -> None:
        got = tally(replay(LOG, lambda seq, why: None))
        # open: 1, 2 and the proposed rule (8); closed: 3, 4 (5 is archived, 6 deleted, 7 a settled rule)
        self.assertEqual(got["open"], 3)
        self.assertEqual(got["closed"], 2)
        self.assertEqual(got["needs"], 1)  # the proposed rule waits on you
        self.assertEqual(got["inputs"], 1)  # r2 was deleted
        self.assertEqual(got["docs"], 1)  # doc 2 went with its deleted item


if __name__ == "__main__":
    unittest.main()
