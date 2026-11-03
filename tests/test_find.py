"""F479: the phone's search finds things in every project, by the words and (when allowed) by what they mean, with
one Gemini question per search, asked again every time (nothing kept). The Gemini client is always a fake here: no test asks Gemini."""

from __future__ import annotations

import os
import sys
import tempfile
import unittest
from typing import Any, List

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "server"))

from taska.agent_text.language import parse  # noqa: E402
from taska.domain import finding  # noqa: E402
from taska.domain.projection.core import replay  # noqa: E402
from taska.page_api.find import find_view  # noqa: E402
from taska.services.meaning import Meaning  # noqa: E402
from taska.services.settings import SearchByMeaning  # noqa: E402
from taska.services.workspace import Workspace  # noqa: E402

T = "2026-11-02T10:00:%02d-08:00"


def add(n: int, title: str, body: str = "", type_: str = "feature", parent: Any = None) -> dict:
    return {"k": "add", "n": n, "by": "you", "title": title, "src": None, "type": type_, "pri": "P2", "when": "now",
            "status": "open", "body": body, "next": "", "parent": parent, "t": T % n}


LOG = [
    add(1, "Export keeps the filter you set", "The export writes every row"),
    add(2, "Saving drops the last word"),
    add(3, "Exports write what the list shows", type_="rule"),
    {"k": "in", "id": "r1", "by": "you", "text": "The export should keep the filter I set.", "scope": None, "files": [],
     "t": T % 20},
    {"k": "doc", "d": 1, "n": 1, "title": "Plan: the export keeps the filter", "md": "Read the filter first.", "by": "x",
     "t": T % 21},
]


class ByTheWords(unittest.TestCase):
    def test_the_words_that_carry_meaning(self) -> None:
        self.assertEqual(finding.terms("Where the export loses my filter?"), ["export", "loses", "filter"])
        self.assertEqual(finding.terms("导出丢了筛选"), ["导出", "出丢", "丢了", "了筛", "筛选"])

    def test_closest_first_every_kind(self) -> None:
        st = replay(LOG, lambda seq, why: None)
        found = finding.by_words(st, "where the export loses my filter")
        self.assertEqual([(f.kind, f.key) for f in found][:2], [("items", "i1"), ("docs", "d1")])
        self.assertEqual({f.kind for f in found}, {"items", "rules", "inputs", "docs"})
        self.assertNotIn("i2", [f.key for f in found])
        self.assertEqual(finding.by_words(st, "the where my"), [])


class FakeAsk:
    def __init__(self, answer: str = "") -> None:
        self.calls: List[Any] = []
        self.answer = answer

    def __call__(self, who: str, system: str, parts: List[Any], **kw: Any) -> str:
        self.calls.append(parts[0]["text"])
        return self.answer


class InEveryProject(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory(prefix="taska-find-")
        self.addCleanup(self.tmp.cleanup)
        self.ws = Workspace(self.tmp.name)
        self.addCleanup(self.ws.close)
        for name in ("shop", "home"):
            p = self.ws.add(name)
            text = (f"new feature P2 Export {'contacts with the sort kept' if name == 'home' else 'keeps the filter'}\n"
                    "new feature P2 Saving drops the last word\n")
            lines, _ = p.run(parse(text), "claude-code")
            self.assertNotIn("err", " ".join(lines))

    def meaning(self, ask: FakeAsk, allowed: bool = True) -> None:
        self.ws.meaning = Meaning(SearchByMeaning(self.ws.root), allowed=allowed, ask=ask, key=lambda: "test-key")

    def test_by_the_words_when_not_allowed(self) -> None:
        ask = FakeAsk("1")
        self.meaning(ask, allowed=False)
        view = find_view(self.ws, "export", "home")
        self.assertEqual(view["by"], "words")
        self.assertEqual([x["project"] for x in view["found"]], ["home", "shop"])
        self.assertEqual(view["found"][0]["item"]["title"], "Export contacts with the sort kept")
        self.assertEqual(ask.calls, [])

    def test_turned_off_asks_nothing(self) -> None:
        ask = FakeAsk("1")
        self.meaning(ask)
        open(os.path.join(self.ws.root, "search-by-meaning-off"), "w").close()
        self.assertEqual(find_view(self.ws, "export", "shop")["by"], "words")
        self.assertEqual(ask.calls, [])

    def test_by_meaning_asked_each_time(self) -> None:
        ask = FakeAsk()
        self.meaning(ask)
        # the list: the project you are in first; the answer names its lines, closest first
        find_view(self.ws, "the thing that keeps my rows", "shop")
        lines = ask.calls[0].splitlines()
        self.assertIn("## Project shop", lines[2])
        saving = next(ln for ln in lines if "Saving drops" in ln and ln[0].isdigit()).split(".")[0]
        ask.answer = saving + ", 999"
        view = find_view(self.ws, "the thing that drops words", "shop")
        self.assertEqual(view["by"], "meaning")
        self.assertEqual(view["found"][0]["item"]["title"], "Saving drops the last word")
        self.assertEqual(view["found"][0]["project"], "shop")
        # the same words again: asked again, with what the project has now
        lines, _ = self.ws.projects["shop"].run(parse("new bug P1 Words go missing after a pause\n"), "claude-code")
        find_view(self.ws, "the thing that drops words", "shop")
        self.assertEqual(len(ask.calls), 3)
        self.assertIn("Words go missing after a pause", ask.calls[2])


if __name__ == "__main__":
    unittest.main()
