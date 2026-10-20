"""T293: a page with a copy of the state asks only for what changed since; merged, it equals the whole state.
R319: what the organizer files from an input keeps the input's files and links. (Ported from the old app's tests.)"""

from __future__ import annotations

import os
import shutil
import sys
import tempfile
import unittest
from typing import Any, Dict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "server"))
from taska import importer  # noqa: E402
from taska.dsl import parse_dsl  # noqa: E402
from taska.hub import Hub  # noqa: E402

REPO = os.path.dirname(os.path.dirname(HERE))
KEYS = (("items", "n"), ("inputs", "id"), ("docs", "d"))


def merge(was: Dict[str, Any], d: Dict[str, Any]) -> Dict[str, Any]:  # what the page does (mergeState)
    for kind, idk in KEYS:
        drop, fresh = set(d["drop"][kind]), {x[idk]: x for x in d[kind]}
        out = [fresh.get(x[idk], x) for x in was[kind] if x[idk] not in drop]
        have = {x[idk] for x in out}
        was[kind] = out + [x for x in d[kind] if x[idk] not in have]
    return was


class DeltaTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        src = os.path.join(self.tmp.name, "old")
        shutil.copytree(os.path.join(REPO, "tests", "fixtures", "my-app"), os.path.join(src, "my-app"))
        importer.run(src, os.path.join(self.tmp.name, "new"))
        self.hub = Hub(os.path.join(self.tmp.name, "new"), False)
        self.s = self.hub.projects["my-app"]

    def tearDown(self) -> None:
        for s in self.hub.projects.values():
            s.close()
        self.tmp.cleanup()

    def same(self, a: Dict[str, Any], b: Dict[str, Any]) -> None:
        for kind, idk in KEYS:
            self.assertEqual({x[idk]: x for x in a[kind]}, {x[idk]: x for x in b[kind]}, kind)

    def test_only_changes_come_and_merge_to_the_whole(self) -> None:
        s = self.s
        full = s.state_since()
        self.assertNotIn("delta", full)
        code = s.code(next(iter(s.items)))
        with s.cond:
            s.run_all(parse_dsl(f"{code} say A word from the agent\nnew bug P1 A new one"), "claude-code")
            s.run_all([(0, {"op": "input", "text": "Something new"})], "you")
        d = s.state_since(full["sv"], full["boot"])
        self.assertEqual(d["delta"], full["sv"])
        self.assertEqual(len(d["items"]), 2)  # the one talked on and the new one
        self.assertEqual(len(d["inputs"]), 1)
        self.same(merge(full, d), s.state_since())

    def test_nothing_changed_sends_nothing(self) -> None:
        full = self.s.state_since()
        d = self.s.state_since(full["sv"], full["boot"])
        self.assertEqual((d["items"], d["inputs"], d["docs"]), ([], [], []))

    def test_another_boot_gets_everything(self) -> None:
        full = self.s.state_since()
        self.assertNotIn("delta", self.s.state_since(full["sv"], "old-boot"))

    def test_the_organizer_keeps_your_pictures_and_links(self) -> None:  # R319
        s = self.s
        os.makedirs(s.fdir, exist_ok=True)
        with open(os.path.join(s.fdir, "f900-shot.png"), "wb") as f:
            f.write(b"png")
        with s.cond:
            s.run_all([(0, {"op": "input", "text": "Slow, see https://example.com/trace",
                            "files": [{"f": "f900-shot.png", "name": "shot.png", "mime": "image/png"}]})], "you")
            rid = max(s.inputs, key=lambda r: int(r[1:]))
            code = s.code(next(iter(s.items)))
            s.run_all(parse_dsl(f"{code} say The page is slow"), "org", src=rid)
        said = s.items[int(code[1:])]["thread"][-1]
        self.assertEqual([f["f"] for f in said.get("files", [])], ["f900-shot.png"])
        self.assertIn("https://example.com/trace", said["text"])


if __name__ == "__main__":
    unittest.main()
