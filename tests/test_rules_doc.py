"""I693 (r1116, r1118, r1128): a project's rules are one Markdown document with versions. Yadong decided: every save is
a version (who, when, why; the same writer's saves less than 10 minutes apart are one version that keeps every why,
newest first), restored versions are new versions, agents only propose changes by named sections with a why and
Yadong approves or declines, a proposal whose sections changed since it was written goes back to its agent, the
organizer changes sections from his words at once, agents read GET /rules and are told once when the rules change;
the rule items were moved once into version 1 and deleted (old texts that name their codes stay as they are), and
rule is no type of item.
Change these only on Yadong's explicit word, and cite it."""

from __future__ import annotations

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from support import ProjectCase
from taska.agent_text import render  # noqa: E402
from taska.agent_text.language import parse  # noqa: E402
from taska.domain import sections, versions  # noqa: E402
from taska.domain.model import SectionEdit  # noqa: E402
from taska.domain.projection import replay  # noqa: E402

T = "2026-11-06T10:%02d:00-08:00"
RULES = "## Communication\n\n- Write in Taska.\n\n## Commits\n\n- Commit messages are in English."


def write(d: int, md: str, by: str, minute: int, why: str = "", **more: object) -> dict:
    return {"k": "doc", "d": d, "n": 0, "kind": "rules", "title": "Rules", "md": md, "by": by, "why": why,
            "t": T % minute, **more}


class Versions(unittest.TestCase):
    def test_one_writer_within_ten_minutes_is_one_version_with_every_why(self) -> None:
        st = replay([write(1, "a", "you", 0, "first"), write(1, "b", "you", 5, "second"), write(1, "c", "you", 16, ""),
                     write(1, "d", "org", 17, "from r3")], lambda *a: None)
        vs = versions.versions(st, st.rules)  # type: ignore[arg-type]
        self.assertEqual([(x.v, x.by, x.md) for x in vs], [(1, "you", "b"), (2, "you", "c"), (3, "org", "d")])
        self.assertEqual(vs[0].whys, ["second", "first"])  # newest first (review #4)

    def test_a_restore_stands_alone_and_its_undo_takes_it_away(self) -> None:
        log = [write(1, "a", "you", 0), write(1, "b", "you", 20), write(1, "a", "you", 21, "Restored v1", restored=1)]
        st = replay(log, lambda *a: None)
        self.assertEqual([x.v for x in versions.versions(st, st.rules)], [1, 2, 3])  # type: ignore[arg-type]
        st = replay(log + [write(1, "b", "you", 22, undo=3)], lambda *a: None)
        self.assertEqual([(x.v, x.md) for x in versions.versions(st, st.rules)], [(1, "a"), (2, "b")])  # type: ignore[arg-type]


class Sections(unittest.TestCase):
    def test_replace_add_delete_by_name(self) -> None:
        md = sections.apply(RULES, [SectionEdit("replace", "commits", "- In the imperative."),
                                    SectionEdit("add", "Tests", "- Run them.", after="Communication"),
                                    SectionEdit("delete", "Communication")])
        self.assertEqual(md, "## Tests\n\n- Run them.\n\n## Commits\n\n- In the imperative.")

    def test_only_a_changed_section_sends_a_proposal_back(self) -> None:  # review #5
        edits = [SectionEdit("replace", "Commits", "- Short.")]
        other = RULES.replace("Write in Taska.", "Write in Taska only.")
        self.assertEqual(sections.changed_since(RULES, other, edits), [])
        self.assertEqual(sections.changed_since(RULES, RULES.replace("English", "French"), edits), ["Commits"])

    def test_the_agents_change_reads_by_section(self) -> None:
        [(_, c)] = parse("rules propose Tests first\n  replace ## Commits\n    - Short.\n  delete ## Communication\n")
        self.assertEqual(c["op"], "rpropose")
        self.assertEqual([(e.op, e.section, e.md) for e in sections.read_edits(c["body"])],
                         [("replace", "Commits", "- Short."), ("delete", "Communication", "")])


class Commands(ProjectCase):
    def run_(self, text: str, by: str) -> str:
        return "\n".join(self.p.run(parse(text), by)[0])

    def page(self, by: str = "you", **c: object) -> str:
        return "\n".join(self.p.run([(0, c)], by)[0])

    def test_agents_only_propose_and_the_user_approves(self) -> None:
        self.page(op="rules", md=RULES)
        self.assertIn("err", self.page("codex", op="rules", md="mine"))  # agents never write it whole
        self.assertIn("err", self.run_("rules propose\n  delete ## Commits\n", "codex"))  # why is required (r1128 #7)
        self.assertIn("ok rules proposal", self.run_("rules propose No commits\n  delete ## Commits\n", "codex"))
        self.assertEqual(self.p.state.rules.md, RULES)  # type: ignore[union-attr]
        p = self.p.state.rules.proposals[0]  # type: ignore[union-attr]
        self.assertIn("approved", self.page(op="rdecide", p=p.id, ok=True))
        vs = versions.versions(self.p.state, self.p.state.rules)  # type: ignore[arg-type]
        self.assertEqual((vs[-1].v, vs[-1].by, vs[-1].whys, vs[-1].p), (2, "codex", ["No commits"], p.id))
        self.assertNotIn("Commits", self.p.state.rules.md)  # type: ignore[union-attr]

    def test_a_proposal_goes_back_when_its_section_changed(self) -> None:
        self.page(op="rules", md=RULES)
        self.run_("rules propose Short commits\n  replace ## Commits\n    - Short.\n", "codex")
        self.run_("rules propose Taska only\n  replace ## Communication\n    - Taska only.\n", "codex")
        self.page(op="rules", md=RULES.replace("English", "French"), why="French")
        states = [x.state for x in self.p.state.rules.proposals]  # type: ignore[union-attr]
        self.assertEqual(states, ["stale", "wait"])
        self.assertIn("sent back", render.proposal_text(self.p.state, self.p.state.rules.proposals[0]))  # type: ignore[union-attr]
        self.assertEqual(len(render.proposals_for(self.p.state, "codex")), 1)

    def test_the_organizer_changes_sections_at_once_with_its_input(self) -> None:
        self.page(op="rules", md=RULES)
        self.page(op="input", text="from now on commits in the imperative", id="x1")
        rid = next(iter(self.p.state.inputs))
        out = "\n".join(self.p.run(parse(f"rules edit Imperative commits src={rid}\n  replace ## Commits\n    - Imperative.\n"),
                                   "org")[0])
        self.assertIn("ok rules v2", out)
        v = versions.versions(self.p.state, self.p.state.rules)[-1]  # type: ignore[arg-type]
        self.assertEqual((v.by, v.srcs, v.whys), ("org", [rid], ["Imperative commits"]))

    def test_restore_is_a_new_version_and_undo_takes_it_back(self) -> None:
        self.page(op="rules", md="## One")
        self.page(op="rules", md="## One\n\nfirst")  # a minute later, the same writer: still v1
        self.run_("rules propose Two\n  add ## Two\n", "codex")
        self.page(op="rdecide", p=self.p.state.rules.proposals[0].id, ok=True)  # type: ignore[union-attr]
        self.assertIn("v1 restored", self.page(op="rrestore", v=1))
        vs = versions.versions(self.p.state, self.p.state.rules)  # type: ignore[arg-type]
        self.assertEqual([(x.v, x.restored) for x in vs], [(1, None), (2, None), (3, 1)])
        self.assertEqual(self.p.state.rules.md, "## One\n\nfirst")  # type: ignore[union-attr]
        seq = vs[-1].seqs[-1]
        self.page(op="rundo", seq=seq)
        self.assertEqual(self.p.state.rules.md, "## One\n\nfirst\n\n## Two")  # type: ignore[union-attr]
        self.assertEqual(len(versions.versions(self.p.state, self.p.state.rules)), 2)  # type: ignore[arg-type]

    def test_agents_read_the_version_and_are_told_once_what_changed(self) -> None:
        self.page(op="rules", md=RULES)
        self.assertIn("Project rules, version 1, the user", render.rules_text(self.p.state))
        self.assertEqual(self.p.agents.rule_news(self.p.state, "codex"), [])  # the first call only sets the mark
        self.page(op="rules", md=RULES.replace("English", "French"), why="French now")
        news = self.p.agents.rule_news(self.p.state, "codex")
        self.assertTrue(news[0].startswith("the rules changed to v1 by the user: French now"), news)
        self.assertIn("  changed: Commits", news)
        self.assertIn("    + - Commit messages are in French.", news)
        self.assertEqual(self.p.agents.rule_news(self.p.state, "codex"), [])  # once

    def test_a_rule_item_is_refused(self) -> None:
        self.assertIn("type must be one of feature/bug/idea/task", self.page(op="new", type="rule", title="Commits"))


if __name__ == "__main__":
    unittest.main()
