"""T728: what becomes of an input on Taska's side has its states and steps in one place (domain/input_states); the
organizer, the agents' inbox and a voice note's late words ask it; one rule says a failure goes away by itself (the
organizer asks again and writes nothing: a failure written is one to fix); Undo of a filing is refused when there is
no filing of the organizer's to take back."""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from support import ProjectCase
from taska.agent_text.language import parse  # noqa: E402
from taska.domain import events as ev, input_states as st, rules  # noqa: E402
from taska.domain.model import Input, OrgNote  # noqa: E402
from taska.services import organizer as org  # noqa: E402
from taska.services.project import Project  # noqa: E402


def inp(**f: object) -> Input:
    return Input(**{"id": "r1", "t": "t", "by": "you", "text": "Fix the sort", "scope": None, "files": [], "seq": 1, **f})  # type: ignore[arg-type]


def note(ok: bool = True, msg: str = "Created B1", **f: object) -> OrgNote:
    return OrgNote(**{"ok": ok, "msg": msg, "t": "t", "keep": False, **f})  # type: ignore[arg-type]


class TheStates(unittest.TestCase):
    def test_the_steps_join_listed_states_and_reach_every_one(self) -> None:
        reached = {None}
        for _ in st.STATES:
            reached |= {to for frm, _, to in st.STEPS if frm in reached}
        self.assertEqual(reached - {None}, set(st.STATES))
        for frm, _, to in st.STEPS:
            self.assertIn(to, st.STATES)
            self.assertTrue(frm is None or frm in st.STATES)

    def test_each_state_from_its_fields(self) -> None:
        cases = [
            (inp(), True, (), st.QUEUED),
            (inp(), False, (), st.AGENTS),
            (inp(), True, ("r1",), st.ORGANIZING),
            (inp(kind="cancelled"), True, (), st.CANCELLED),
            (inp(acked=True, org=note()), True, (), st.HANDLED),
            (inp(org=note(keep=True)), True, (), st.LEFT),
            (inp(org=note(msg="Undone", undone=True)), True, (), st.UNDONE),
            (inp(org=note(False, "Gemini HTTP 401: API key not valid")), True, (), st.FAILED),
        ]
        for i, on, busy, want in cases:
            self.assertEqual(st.state_of(i, on, busy), want, (i.org, i.kind, on, busy))

    def test_a_step_not_listed_is_not_a_way(self) -> None:
        ways = {(f, t) for f, _, t in st.STEPS}
        self.assertNotIn((st.FAILED, st.UNDONE), ways)  # a failed filing has nothing to undo
        self.assertNotIn((st.AGENTS, st.UNDONE), ways)
        self.assertNotIn((st.QUEUED, st.HANDLED), ways)  # the organizer takes it first
        self.assertNotIn((st.MOVED, st.QUEUED), ways)

    def test_one_rule_for_a_failure_that_goes_away_by_itself(self) -> None:
        for msg in ("Gemini HTTP 503: overloaded", "Gemini HTTP 429: quota", "TimeoutError('timed out')", "Gemini gave an empty answer"):
            self.assertTrue(st.transient(msg), msg)
        for msg in ("Gemini HTTP 401: API key not valid", "B99 not found", "403 forbidden: unavailable"):
            self.assertFalse(st.transient(msg), msg)
        self.assertIs(org.transient, st.transient)  # the organizer's is this one


class WhoAsksThem(unittest.TestCase):
    def test_the_agents_inbox_is_as_before(self) -> None:
        """for_agent read the fields itself; it reads the states now, with the same inputs in it."""
        def old(i: Input, on: bool) -> bool:
            return (not on or bool(i.org)) and not (i.org and i.org.undone)
        grid = [inp(), inp(org=note()), inp(org=note(keep=True)), inp(org=note(msg="Undone", undone=True)),
                inp(org=note(False, "B99 not found"))]
        for on in (True, False):
            for i in grid:
                self.assertEqual(st.state_of(i, on, ()) in st.FOR_AGENTS, old(i, on), (i.org, on))

    def test_the_organizer_takes_queued_only(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            p = Project(tmp, "demo")
            try:
                o = org.Organizer(p)
                self.assertTrue(o.due(inp()))
                for i in (inp(org=note(False, "Gemini HTTP 401: API key")), inp(org=note()), inp(org=note(msg="Undone", undone=True))):
                    self.assertFalse(o.due(i), i.org)
            finally:
                p.close()

    def test_late_words_go_back_to_who_had_it(self) -> None:
        self.assertFalse(st.reached(inp(), ()))
        self.assertTrue(st.reached(inp(), ("r1",)))
        self.assertTrue(st.reached(inp(acked=True), ()))
        self.assertTrue(st.reached(inp(org=note(False, "B99 not found")), ()))
        self.assertTrue(st.reached(inp(org=note(keep=True)), ()))


class UndoOfAFiling(ProjectCase):
    def setUp(self) -> None:
        super().setUp()
        self.p.emit(ev.InputAdded(by="you", id="r1", text="The export ignores the filter"))

    def undo(self) -> str:
        return "\n".join(self.p.run([(0, {"op": "filing-undo", "id": "r1"})], "you")[0])

    def file(self, ok: bool, msg: str) -> None:
        self.p.run(parse("new bug Export ignores the filter"), "org", src="r1")
        self.p.emit(ev.Organized(src="r1", ok=ok, msg=msg, changed=True, by="org"))
        if ok:
            self.p.emit(ev.InputsAcked(ids=["r1"], by="org"))

    def test_the_organizers_filing_is_taken_back(self) -> None:
        self.file(True, "Created B1")
        self.assertIn("ok r1 filing undone", self.undo())
        self.assertTrue(self.p.state.inputs["r1"].org.undone)  # type: ignore[union-attr]

    def test_refused_when_the_organizer_failed(self) -> None:
        """T728: it made an item, then a command failed (its note not ok): the undo was let through before."""
        self.file(False, "Created B1 · Some commands failed: err: B99 not found")
        self.assertIn("err", self.undo())
        self.assertFalse(any(isinstance(e, ev.FilingUndone) for e in self.p.state.events))

    def test_refused_when_the_organizer_filed_nothing(self) -> None:
        """T728: no filing to take back (nothing to do, or only an agent changed things): it was marked undone."""
        self.p.emit(ev.Organized(src="r1", ok=True, msg="No changes needed", changed=False, by="org"))
        self.p.emit(ev.InputsAcked(ids=["r1"], by="org"))
        self.assertIn("err", self.undo())
        self.assertFalse(self.p.state.inputs["r1"].org.undone)  # type: ignore[union-attr]

    def test_refused_when_an_agent_handled_it(self) -> None:
        self.p.emit(ev.InputsAcked(ids=["r1"], by="codex"))
        self.assertIn("err", self.undo())


class ForAgentReadsTheStates(unittest.TestCase):
    def test_an_undone_one_waits_for_the_user(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            p = Project(tmp, "demo")
            try:
                p.emit(ev.InputAdded(by="you", id="r1", text="Fix the sort"))
                self.assertEqual(rules.for_agent(p.state, False, lambda i: False)[0].id, "r1")
                self.assertEqual(rules.for_agent(p.state, True, lambda i: False), [])
                p.emit(ev.Organized(src="r1", ok=True, msg="Left for agent", keep=True, by="org"))
                self.assertEqual(rules.for_agent(p.state, True, lambda i: False)[0].id, "r1")
                self.assertEqual(rules.for_agent(p.state, True, lambda i: True), [])  # its words to come: it waits
            finally:
                p.close()


if __name__ == "__main__":
    unittest.main()
