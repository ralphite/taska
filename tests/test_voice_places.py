"""B838 (Yadong r1434 r1437 r1439 r1440): what was said is one text, as in Nota: a voice note's words show where it was
put in the words typed (its place), whatever was added first; a note with no place (said before this) shows after
them, as before. Agents read the same order."""

from __future__ import annotations

import unittest

from support import ProjectCase
from taska.domain import events as ev
from taska.domain.voices import for_agents


class VoicePlaces(ProjectCase):
    def note(self, words: str, at=None):
        f = self.p.files.save("voice_0-08.webm", "audio/webm", b"audio")
        self.p.emit(ev.VoiceHeard(f=f.f, state="done", tidied=words, said=words, by="taska"))
        row = {"f": f.f, "name": f.name, "mime": "audio/webm"}
        return {**row, "at": at} if at is not None else row

    def run_one(self, cmd):
        lines, _ = self.p.run([(0, cmd)], "you")
        self.assertTrue(lines[0].startswith("ok"), lines)
        return lines[0].split()[1]

    def said(self, rid: str) -> str:
        inp = self.p.state.inputs[rid]
        return for_agents(self.p.state, inp.text, inp.files)

    def test_words_typed_after_a_voice_note_come_after_it_and_a_note_added_last_comes_last(self):
        rid = self.run_one({"op": "input", "text": "", "files": [self.note("First, the export.", at=0)]})
        self.run_one({"op": "amend", "id": rid, "mode": "append", "text": "Typed after it."})
        self.run_one({"op": "amend", "id": rid, "mode": "append", "text": "", "files": [self.note("Said last.")]})
        self.assertEqual(self.said(rid), "voice 0:08: First, the export.\nTyped after it.\nvoice 0:08: Said last.")

    def test_a_note_put_in_the_middle_of_the_words_reads_there(self):
        rid = self.run_one({"op": "input", "text": "Before it. After it.", "files": [self.note("In the middle.", at=11)]})
        self.assertEqual(self.said(rid), "Before it.\nvoice 0:08: In the middle.\nAfter it.")

    def test_an_edit_moves_its_notes_where_they_are_now(self):
        n = self.note("Spoken.", at=0)
        rid = self.run_one({"op": "input", "text": "Typed.", "files": [n]})
        self.assertEqual(self.said(rid), "voice 0:08: Spoken.\nTyped.")
        self.run_one({"op": "amend", "id": rid, "mode": "edit", "v": self.p.state.inputs[rid].v, "text": "Typed.",
                      "places": {n["f"]: 6}})
        self.assertEqual(self.said(rid), "Typed.\nvoice 0:08: Spoken.")

    def test_a_note_with_no_place_comes_after_the_words_as_before(self):
        rid = self.run_one({"op": "input", "text": "Typed.", "files": [self.note("Spoken.")]})
        self.assertEqual(self.said(rid), "Typed.\nvoice 0:08: Spoken.")


if __name__ == "__main__":
    unittest.main()
