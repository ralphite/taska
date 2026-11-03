"""F479: the phone's search finds things in every project, by the words and (when allowed) by what they mean, with
embeddings: each line's vector is kept by its words, so only new and changed lines (and the words searched for) are
embedded, and nothing a search answered is kept. The embedder is always a fake here: no test asks Gemini."""

from __future__ import annotations

import math
import os
import sys
import tempfile
import time
import unittest
from typing import Any, List, Tuple

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "server"))

from taska.agent_text.language import parse  # noqa: E402
from taska.domain import finding  # noqa: E402
from taska.domain.projection.core import replay  # noqa: E402
from taska.infra.vectors import Vectors  # noqa: E402
from taska.page_api.find import find_view  # noqa: E402
from taska.services import meaning  # noqa: E402
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


# what the fake embedder knows: a line's vector counts these words in it, so lines about the same things are close
CONCEPTS = ("export", "filter", "sort", "sav", "word", "drop", "pause", "missing", "contact")


class FakeEmbed:
    def __init__(self) -> None:
        self.calls: List[Tuple[str, List[str]]] = []

    def __call__(self, who: str, texts: List[str], task: str) -> List[List[float]]:
        self.calls.append((task, list(texts)))
        return [[float(t.lower().count(c)) for c in CONCEPTS] for t in texts]

    def texts(self, task: str) -> List[str]:
        return [t for k, ts in self.calls if k == task for t in ts]


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

    def meaning(self, embed: FakeEmbed, allowed: bool = True, settle: Any = None) -> Meaning:
        self.ws.meaning = Meaning(SearchByMeaning(self.ws.root), allowed=allowed, embed=embed, key=lambda: "test-key",
                                  path=os.path.join(self.ws.root, "meaning.db"), lists=self.ws.short_lists,
                                  settle=settle)
        self.addCleanup(self.ws.meaning.close)
        return self.ws.meaning

    def line(self, project: str, starts: str) -> str:
        return next(w for _, w in finding.short_list(self.ws.projects[project].state) if w.startswith(starts))

    def test_by_the_words_when_not_allowed(self) -> None:
        embed = FakeEmbed()
        self.meaning(embed, allowed=False)
        view = find_view(self.ws, "export", "home")
        self.assertEqual(view["by"], "words")
        self.assertEqual([x["project"] for x in view["found"]], ["home", "shop"])
        self.assertEqual(view["found"][0]["item"]["title"], "Export contacts with the sort kept")
        self.ws.meaning.warm()
        self.assertEqual(embed.calls, [])

    def test_turned_off_or_no_key_sends_nothing(self) -> None:
        embed = FakeEmbed()
        m = self.meaning(embed, settle=0.01)
        open(os.path.join(self.ws.root, "search-by-meaning-off"), "w").close()
        self.assertEqual(find_view(self.ws, "export", "shop")["by"], "words")
        m.soon()
        m.warm()
        os.remove(os.path.join(self.ws.root, "search-by-meaning-off"))
        m._key = lambda: None
        self.assertEqual(find_view(self.ws, "export", "shop")["by"], "words")
        self.assertEqual(embed.calls, [])
        self.assertIsNone(m._thread)

    def test_by_meaning_closest_first_here_first(self) -> None:
        embed = FakeEmbed()
        self.meaning(embed)
        view = find_view(self.ws, "the thing that drops words", "shop")
        self.assertEqual(view["by"], "meaning")
        self.assertEqual([(x["project"], x["item"]["title"]) for x in view["found"][:2]],
                         [("shop", "Saving drops the last word"), ("home", "Saving drops the last word")])
        self.assertEqual(embed.texts("RETRIEVAL_QUERY"), ["the thing that drops words"])
        self.assertIn(self.line("shop", "F2 "), embed.texts("RETRIEVAL_DOCUMENT"))

    def test_vectors_are_kept_and_reused(self) -> None:
        embed = FakeEmbed()
        self.meaning(embed)
        find_view(self.ws, "the thing that drops words", "shop")
        lines = embed.texts("RETRIEVAL_DOCUMENT")
        self.assertEqual(len(lines), len(set(lines)))  # the same words in two projects: embedded once
        embed.calls.clear()
        find_view(self.ws, "the filter on export", "shop")
        self.assertEqual(embed.calls, [("RETRIEVAL_QUERY", ["the filter on export"])])
        # kept in the file: after a restart only the words searched for are embedded
        again = FakeEmbed()
        self.meaning(again)
        view = find_view(self.ws, "the filter on export", "shop")
        self.assertEqual(view["found"][0]["item"]["title"], "Export keeps the filter")
        self.assertEqual(again.calls, [("RETRIEVAL_QUERY", ["the filter on export"])])

    def test_new_and_changed_lines_are_found_at_once(self) -> None:
        embed = FakeEmbed()
        self.meaning(embed)
        find_view(self.ws, "the thing that drops words", "shop")
        embed.calls.clear()
        shop = self.ws.projects["shop"]
        shop.run(parse("new bug P1 Words go missing after a pause\n"), "claude-code")
        view = find_view(self.ws, "missing words after a pause", "shop")
        self.assertEqual(view["found"][0]["item"]["title"], "Words go missing after a pause")
        self.assertEqual(embed.texts("RETRIEVAL_DOCUMENT"), [self.line("shop", "B3 ")])
        embed.calls.clear()
        shop.run(parse("F1 title Export keeps the sort you set\n"), "claude-code")
        view = find_view(self.ws, "export with the sort", "shop")
        self.assertEqual(embed.texts("RETRIEVAL_DOCUMENT"), [self.line("shop", "F1 ")])
        self.assertEqual(view["found"][0]["item"]["title"], "Export keeps the sort you set")

    def test_warm_up_embeds_and_lets_go_of_old_lines(self) -> None:
        embed = FakeEmbed()
        m = self.meaning(embed, settle=0.01)
        m.soon()
        deadline = time.monotonic() + 5
        while not embed.calls and time.monotonic() < deadline:
            time.sleep(0.01)
        self.assertTrue(embed.texts("RETRIEVAL_DOCUMENT"))
        self.assertEqual(embed.texts("RETRIEVAL_QUERY"), [])
        m.close()
        assert m._thread is not None
        m._thread.join(2)
        store = Vectors(os.path.join(self.ws.root, "meaning.db"))
        old = meaning.hash_of(self.line("shop", "F1 "))
        self.assertIn(old, store.all(meaning.MODEL))
        self.ws.projects["shop"].run(parse("F1 title Export keeps every filter\n"), "claude-code")
        m.warm()
        kept = store.all(meaning.MODEL)
        self.assertNotIn(old, kept)
        self.assertIn(meaning.hash_of(self.line("shop", "F1 ")), kept)
        self.assertEqual(len(kept), len({w for _, _, short in self.ws.short_lists() for _, w in short}))

    def test_nothing_close_enough_finds_nothing_by_meaning(self) -> None:
        embed = FakeEmbed()
        self.meaning(embed)
        self.assertEqual(self.ws.meaning.rank("purple elephant banana", self.ws.short_lists()), [])
        view = find_view(self.ws, "purple elephant banana", "shop")
        self.assertEqual((view["by"], view["found"]), ("meaning", []))


class TheFloor(unittest.TestCase):
    def test_close_enough_and_above_the_baseline(self) -> None:
        def at(score: float) -> Any:
            return meaning.unit([score, math.sqrt(1 - score * score)])

        q = meaning.unit([1.0, 0.0])
        few = [(("p", "a"), at(0.9)), (("p", "b"), at(0.62)), (("p", "c"), at(0.5))]
        self.assertEqual(meaning.closest(q, few), [("p", "a"), ("p", "b")])
        # many lines all about as close (short replies that match anything): only what stands above them counts
        many = [(("p", "x%d" % i), at(0.64)) for i in range(60)] + [(("p", "a"), at(0.75)), (("p", "b"), at(0.70))]
        self.assertEqual(meaning.closest(q, many), [("p", "a")])
        close = [(("p", "a%d" % i), at(0.9)) for i in range(40)] + [(("p", "x%d" % i), at(0.5)) for i in range(60)]
        self.assertEqual(meaning.closest(q, close), [("p", "a%d" % i) for i in range(meaning.MOST)])


if __name__ == "__main__":
    unittest.main()
