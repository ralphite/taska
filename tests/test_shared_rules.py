"""I779 (D134, approved 11-15 "照这个做"): shared rules are documents kept once for the whole Taska, each with a name; a
project's rules are a template where a line of its own `{{编程}}` puts the shared rules 编程 there (`{{编程 › 测试}}`
only its section 测试). What is kept is the line; whoever reads the rules (GET /rules, the organizer) gets the text in
its place, each part saying which shared rules it came from, first that the project's own words win; a name not found
is said in its place. Rules with no such line read exactly as before. A shared rule puts no other in (one level).
Change these only on Yadong's explicit word, and cite it."""

from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
import urllib.error
import urllib.request

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from support import ServerCase  # noqa: E402
from taska.agent_text import render  # noqa: E402
from taska.domain import includes  # noqa: E402
from taska.services.workspace import Workspace  # noqa: E402

CODING = "## 需求（改功能时）\n\n- 先想清楚。\n\n## 测试\n\n- 按风险测。"
COMMON = "- 一切沟通都在 Taska。"
SHARED = {"编程": CODING, "通用": COMMON}


class Expanding(unittest.TestCase):
    def test_the_whole_shared_rule_in_its_place_each_heading_marked(self) -> None:
        got = includes.expand("{{编程}}\n\n## Own\n\n- mine", SHARED)
        self.assertEqual(got, "## 需求（改功能时） (from shared rules “编程”)\n\n- 先想清楚。\n\n## 测试 (from shared rules “编程”)"
                              "\n\n- 按风险测。\n\n## Own\n\n- mine")

    def test_text_without_a_heading_says_where_it_came_from(self) -> None:
        self.assertEqual(includes.expand("{{通用}}", SHARED), "(From shared rules “通用”:)\n- 一切沟通都在 Taska。")

    def test_one_section_by_its_short_name_or_whole_heading(self) -> None:
        want = "## 需求（改功能时） (from shared rules “编程 › 需求”)\n\n- 先想清楚。"
        self.assertEqual(includes.expand("{{编程 › 需求}}", SHARED), want)
        self.assertEqual(includes.expand("{{ 编程 > 需求（改功能时） }}", SHARED), want.replace("编程 › 需求", "编程 › 需求（改功能时）"))

    def test_a_name_not_found_is_said_in_its_place(self) -> None:
        self.assertIn("(Not found: {{编程X}} names no shared rules called “编程X”", includes.expand("{{编程X}}", SHARED))
        self.assertIn("names no section “部署” in shared rules “编程”", includes.expand("{{编程 › 部署}}", SHARED))

    def test_no_line_is_the_text_exactly_as_it_was(self) -> None:
        for md in ["## A\n\n- b", "", "say {{编程}} inside a sentence", "```\n{{编程}}\n```"]:
            self.assertEqual(includes.expand(md, SHARED), md)
            self.assertEqual(includes.win_line(md), "")

    def test_the_projects_own_words_win(self) -> None:
        self.assertIn("this project's own words win", includes.win_line("{{编程}}"))

    def test_a_shared_rule_puts_no_other_in(self) -> None:
        with self.assertRaises(Exception):
            includes.check_shared_text("{{通用}}\n\n- more")

    def test_the_stories_agent_text_is_the_servers(self) -> None:  # web/src/stories/sharedRules.json
        path = os.path.join(os.path.dirname(__file__), "..", "web", "src", "stories", "sharedRules.json")
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        shared = {s["name"]: s["md"] for s in data["shared"]}
        self.assertEqual(data["agent"], includes.win_line(data["rules"]) + "\n\n" + includes.expand(data["rules"], shared))
        for s in data["shared"]:
            self.assertEqual(s["parts"], [{"name": p.name, "title": p.title, "md": p.md} for p in includes.parts(s["md"])])


class UsedBy(unittest.TestCase):
    def test_each_project_and_its_line_any_case_and_spacing(self) -> None:
        got = includes.used_by({"a": ("A", "{{编程}}\n\n{{ 编程 › 测试 }}"), "b": ("B", "{{通用}}"), "c": ("C", "no lines")},
                               ["编程", "通用", "写作"])
        self.assertEqual(got, {"编程": [("a", "A", "{{编程}}"), ("a", "A", "{{ 编程 › 测试 }}")], "通用": [("b", "B", "{{通用}}")],
                               "写作": []})


class Workspaces(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.ws = Workspace(self.tmp.name)
        self.p = self.ws.add("demo")

    def tearDown(self) -> None:
        self.ws.close()
        self.tmp.cleanup()

    def test_kept_once_for_every_project_with_versions_and_read_in_place(self) -> None:
        s = self.ws.shared_rules.add("编程")
        self.assertTrue(s.slug.startswith("~"))
        self.assertNotIn(s.slug, self.ws.projects)  # not a project: no list, count or search sees it
        self.assertEqual(s.run([(0, {"op": "rules", "md": CODING})], "you")[0], ["ok rules v1"])
        self.assertIn("err", s.run([(0, {"op": "rules", "md": "{{通用}}"})], "you")[0][0])  # one level
        self.p.run([(0, {"op": "rules", "md": "{{编程 › 测试}}\n\n## Own\n\n- mine"})], "you")
        text = render.rules_text(self.p.state, self.p.shared_texts())
        self.assertIn(includes.WIN, text)
        self.assertIn("## 测试 (from shared rules “编程 › 测试”)\n\n- 按风险测。\n\n## Own", text)
        self.assertEqual(self.p.state.rules.md, "{{编程 › 测试}}\n\n## Own\n\n- mine")  # the line is what is kept
        rows = self.ws.shared_listing()
        self.assertEqual([(r["name"], r["v"], [u["line"] for u in r["used"]]) for r in rows], [("编程", 1, ["{{编程 › 测试}}"])])
        self.assertEqual([x["name"] for x in rows[0]["parts"]], ["需求", "测试"])

    def test_they_open_again_after_a_restart(self) -> None:
        s = self.ws.shared_rules.add("通用")
        s.run([(0, {"op": "rules", "md": COMMON})], "you")
        self.ws.close()
        self.ws = Workspace(self.tmp.name)
        self.assertEqual(self.ws.shared_texts(), {"通用": COMMON})

    def test_a_name_is_one_no_other_has(self) -> None:
        self.ws.shared_rules.add("Coding")
        for bad in ["coding", "", "a{b", "x › y"]:
            with self.assertRaises(Exception):
                self.ws.shared_rules.add(bad)

    def test_rules_without_a_line_read_as_before(self) -> None:
        self.ws.shared_rules.add("编程")
        self.p.run([(0, {"op": "rules", "md": "## A\n\n- b"})], "you")
        self.assertEqual(render.rules_text(self.p.state, self.p.shared_texts()), render.rules_text(self.p.state))
        self.assertNotIn("shared", render.rules_text(self.p.state, self.p.shared_texts()))

    def test_an_agent_is_told_once_when_a_shared_rule_it_reads_changes(self) -> None:
        s = self.ws.shared_rules.add("编程")
        s.run([(0, {"op": "rules", "md": CODING})], "you")
        self.p.run([(0, {"op": "rules", "md": "{{编程}}"})], "you")
        st = self.p.state
        self.assertEqual(self.p.agents.shared_news(st, "codex", "", self.p.shared_texts()), [])  # the first call sets the mark
        s.run([(0, {"op": "rules", "md": CODING.replace("按风险测", "每次都测")})], "you")
        news = self.p.agents.shared_news(st, "codex", "", self.p.shared_texts())
        self.assertTrue(news and "“编程”" in news[0])
        self.assertEqual(self.p.agents.shared_news(st, "codex", "", self.p.shared_texts()), [])  # told once


class Api(ServerCase):
    def json(self, path: str, body: object = None) -> object:
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, headers={"Content-Type": "application/json"})
        return json.loads(urllib.request.urlopen(req, timeout=10).read())

    def test_made_written_listed_and_read_by_agents(self) -> None:
        made = self.json("/api/shared-rules", {"name": "编程"})
        slug = made["slug"]  # type: ignore[index]
        rule = self.base + "/p/" + slug
        body = {"id": "x1", "commands": [{"op": "rules", "md": CODING, "why": "first"}]}
        req = urllib.request.Request(rule + "/api/commands", data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
        self.assertIn("ok rules v1", json.loads(urllib.request.urlopen(req, timeout=10).read())["results"][0])
        self.page({"op": "rules", "md": "{{编程}}\n\n{{写作}}"})
        rows = self.json("/api/shared-rules")
        self.assertEqual(rows[0]["used"][0]["line"], "{{编程}}")  # type: ignore[index]
        rules = self.get("/rules")
        self.assertIn("## 测试 (from shared rules “编程”)", rules)
        self.assertIn("(Not found: {{写作}}", rules)
        view = json.loads(urllib.request.urlopen(rule + "/api/view", timeout=10).read())  # its page: the Rules tab's
        self.assertEqual(next(d for d in view["docs"] if d.get("kind") == "rules")["md"], CODING)
        for agent in ("/rules", "/next"):  # no agent works in shared rules
            with self.assertRaises(urllib.error.HTTPError):
                urllib.request.urlopen(rule + agent, timeout=10)
        self.assertNotIn(slug, [p["name"] for p in self.json("/api/projects")])  # type: ignore[union-attr]
        with self.assertRaises(urllib.error.HTTPError):
            self.json("/api/shared-rules", {"name": "编程"})


if __name__ == "__main__":
    unittest.main()
