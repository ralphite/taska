"""T860 (after T859, Yadong approved 11-21): an error in the page's code, from the page Taska serves now, becomes one
bug in the taska project as soon as a page reports it; none while that bug is open, a new one if it comes back after
it is closed; not what the page tells as an error on purpose, nor errors of a page from before an update."""

import json
import os
import sys
import tempfile
import unittest
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from support import ServerCase  # noqa: E402
from taska.services.page_errors import PER_DAY, PageErrorBugs  # noqa: E402
from taska.services.project import Project  # noqa: E402

BUILD = "index-NEW1.js"


def err(msg: str = "Uncaught TypeError: n.tags is not iterable", build: str = BUILD) -> dict:
    return {"msg": msg, "where": "/p/todos/new", "stack": f"TypeError: x\n    at ct (http://h/assets/{build}:11:2442)",
            "ua": "Chrome"}


class Bugs(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.taska = Project(self.tmp.name, "taska")
        self.now = [1_800_000_000.0]
        self.bugs = PageErrorBugs(clock=lambda: self.now[0])

    def tearDown(self) -> None:
        self.taska.close()
        self.tmp.cleanup()

    def seen(self, e: dict) -> object:
        return self.bugs.seen(e, "todos", BUILD, self.taska)

    def test_a_code_error_makes_one_p1_bug_with_where_it_happened(self) -> None:
        code = self.seen(err())
        it = next(iter(self.taska.state.items.values()))
        self.assertEqual(code, self.taska.state.code(it.n))
        self.assertEqual((it.tags, it.pri, it.status), (["bug"], "P1", "proposed"))  # Yadong approves it, as every bug Taska makes
        self.assertEqual(it.title, "页面报错：TypeError: n.tags is not iterable")
        for said in ("todos", "/p/todos/new", BUILD, "assets/index-NEW1.js:11:2442"):
            self.assertIn(said, it.body)

    def test_none_again_while_it_is_open_and_a_new_one_once_it_is_closed(self) -> None:
        first = self.seen(err())
        self.assertIsNone(self.seen(err("TypeError: n.tags is not iterable")))  # Safari words it without 'Uncaught'
        self.taska.run([(0, {"op": "set", "ref": first, "f": {"status": "done"}})], "you")
        self.assertNotEqual(self.seen(err()), first)
        self.assertEqual(len(self.taska.state.items), 2)

    def test_not_the_pages_own_messages_the_browsers_noise_or_a_page_from_before_an_update(self) -> None:
        for e in (err("Taska has an update"), err("ResizeObserver loop completed with undelivered notifications."),
                  err("iPhone blocked the microphone."), err(build="index-OLD0.js"), {"msg": "TypeError: x"}):
            self.assertIsNone(self.seen(e))
        self.assertIsNone(self.bugs.seen(err(), "todos", BUILD, None))  # no taska project here
        self.assertEqual(len(self.taska.state.items), 0)

    def test_at_most_a_few_a_day(self) -> None:
        made = [self.seen(err(f"TypeError: error {i}")) for i in range(PER_DAY + 2)]
        self.assertEqual(sum(1 for c in made if c), PER_DAY)
        self.now[0] += 86401
        self.assertIsNotNone(self.seen(err("TypeError: the next day")))


class FromThePage(ServerCase):
    def test_a_page_reporting_a_code_error_makes_the_bug(self) -> None:
        def post(url: str, body: dict) -> dict:
            req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
            return json.loads(urllib.request.urlopen(req, timeout=10).read())

        post(self.base + "/api/projects", {"title": "taska"})
        build = json.loads(urllib.request.urlopen(self.p + "/api/view", timeout=10).read())["server"]["page"]
        e = dict(err(build=build), kind="error", level="error")
        post(self.p + "/api/page-log", {"list": [e, dict(e, msg="Taska has an update")]})
        items = urllib.request.urlopen(self.base + "/p/taska/items?by=claude-code", timeout=10).read().decode()
        self.assertIn("页面报错：TypeError: n.tags is not iterable", items)
        self.assertEqual(items.count("页面报错"), 1)


if __name__ == "__main__":
    unittest.main()
