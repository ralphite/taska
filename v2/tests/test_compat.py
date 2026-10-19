"""v2 gives the agents and the page the same answers as the one-file Taska (the golden files).

    python3 -m unittest v2/tests/test_compat.py          (or: python3 v2/tests/test_compat.py [scenario ...])

Where v2 answers differently on purpose (a bug of the old app fixed), the difference is listed in FIXED with why.
"""

from __future__ import annotations

import difflib
import json
import os
import sys
import unittest
from typing import Any, Dict, List

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from harness import run_scenario  # noqa: E402
from scenarios import ALL  # noqa: E402

GOLDEN = os.path.join(os.path.dirname(os.path.abspath(__file__)), "golden")

# (scenario, answer name): why v2 answers differently. The old app dropped the connection there.
FIXED = {
    ("docs", "log docs"): "the old /log stopped on document moves and deletions (it read them as the organizer's)",
    ("page_ops", "log"): "the old /log stopped on item deletions, hidden messages and moved replies",
}


def golden(name: str) -> List[Dict[str, Any]]:
    with open(os.path.join(GOLDEN, name + ".json"), encoding="utf-8") as f:
        out: List[Dict[str, Any]] = json.load(f)
        return out


def differences(name: str) -> List[str]:
    want, got = golden(name), run_scenario("v2", ALL[name])
    out: List[str] = []
    for i, (w, g) in enumerate(zip(want, got)):
        if (name, w["name"]) in FIXED:
            if g["status"] == 0:
                out.append(f"#{i} {w['name']}: still no answer")
            continue
        if w != g:
            a = json.dumps(w, ensure_ascii=False, indent=1, sort_keys=True).splitlines()
            b = json.dumps(g, ensure_ascii=False, indent=1, sort_keys=True).splitlines()
            out.append(f"#{i} {w['name']}:\n" + "\n".join(difflib.unified_diff(a, b, "old", "v2", lineterm="", n=2)))
    if len(want) != len(got):
        out.append(f"{len(want)} answers expected, {len(got)} given")
    return out


class Compat(unittest.TestCase):
    maxDiff = None


def _make(name: str) -> Any:
    def test(self: Compat) -> None:
        diff = differences(name)
        self.assertFalse(diff, "\n\n".join(diff))
    return test


for _name in ALL:
    setattr(Compat, f"test_{_name}", _make(_name))


if __name__ == "__main__":
    names = sys.argv[1:] or list(ALL)
    bad = 0
    for n in names:
        d = differences(n)
        print(f"== {n}: {'same' if not d else str(len(d)) + ' differences'}")
        for x in d:
            print(x)
        bad += len(d)
    sys.exit(1 if bad else 0)
