"""T868 (Yadong r1467 r1469): when where the organizer filed an input is a guess, it says so with a line
`guess <why>`; the input keeps it (what the organizer did, its org note) and the page shows it under where it went.
A sure filing has no line and looks as before; a guess with nothing filed is not kept."""

import os
import sys
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from support import ProjectCase  # noqa: E402
from taska.agent_text.language import parse  # noqa: E402
from taska.agent_text.organizer_text import INSTRUCTIONS  # noqa: E402
from taska.domain import events as ev  # noqa: E402
from taska.domain.projection import replay  # noqa: E402
from taska.services import organizer as org  # noqa: E402


class OrganizerGuess(ProjectCase):
    def setUp(self) -> None:
        super().setUp()
        self.p.run(parse("new P1 Export loses the filter\nnew P1 Sort by date\n"), "you")
        self.o = org.Organizer(self.p)

    def organize(self, rid: str, text: str, answer: str) -> None:
        self.p.emit(ev.InputAdded(by="you", id=rid, text=text))
        with mock.patch.object(org.gemini, "ask", side_effect=lambda *a, **k: answer):
            self.o.organize(rid)

    def test_a_guess_is_kept_with_why_and_a_sure_filing_has_none(self) -> None:
        self.organize("r1", "the csv one also drops the sort", "T1 say The csv export drops the sort too\nguess it speaks of the export, most like T1")
        note = self.p.state.inputs["r1"].org
        self.assertTrue(note.ok)
        self.assertEqual(note.guess, "it speaks of the export, most like T1")
        self.assertEqual(note.to_row()["guess"], "it speaks of the export, most like T1")
        self.assertNotIn("guess", self.p.state.tasks[1].thread[-1].text)  # the line is not a command nor a message
        self.organize("r2", "sorting should be by date", "T2 say Sort by date, newest first")
        self.assertIsNone(self.p.state.inputs["r2"].org.guess)
        self.assertNotIn("guess", self.p.state.inputs["r2"].org.to_row())

    def test_a_guess_survives_a_restart_and_needs_something_filed(self) -> None:
        self.organize("r1", "hm", "ack r1\nguess not sure what this is")
        self.assertIsNone(self.p.state.inputs["r1"].org.guess)
        self.organize("r2", "the csv one too", "T1 say The csv one too\nguess most like T1")
        again = replay([e.to_row() for e in self.p.state.events], lambda seq, why: None)
        self.assertEqual(again.inputs["r2"].org.guess, "most like T1")

    def test_the_organizer_is_told_when_to_write_it_and_of_no_types(self) -> None:
        self.assertIn("guess <why, one short line>", INSTRUCTIONS)
        self.assertNotIn("Types: feature", INSTRUCTIONS)

    def test_a_title_adds_no_meaning_the_user_did_not_say(self) -> None:
        # T884 (Yadong r1495): what is unclear is left in their words for the agent, or asked; never written as a guess
        self.assertIn("never add a meaning they did not say", INSTRUCTIONS)
        self.assertIn("keep their unclear words as they are and leave it to the agent, or ask", INSTRUCTIONS)
