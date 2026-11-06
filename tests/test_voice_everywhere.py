"""B682 (Yadong: every voice note has its words, bound to the voice, the same everywhere): wherever a voice note is
(an input, a reply on an item, a document's comment), agents, the change log, search and moves read its one record;
what was typed stays only what was typed."""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.agent_text import render  # noqa: E402
from taska.domain import events as ev  # noqa: E402
from taska.domain.finding import by_words  # noqa: E402
from taska.services.moves import Moves  # noqa: E402
from taska.services.project import Project  # noqa: E402

WORDS = "导出的时候保留我设的筛选"
SAID = "导出的时候呢保留我设的那个筛选"


class VoiceEverywhere(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        for name in ("demo", "other"):
            os.makedirs(os.path.join(self.tmp.name, name))
        self.p = Project(os.path.join(self.tmp.name, "demo"), "demo")

    def tearDown(self):
        self.p.close()
        self.tmp.cleanup()

    def note(self, p=None, words=WORDS, said=SAID):
        p = p or self.p
        f = p.files.save("voice_0-08.webm", "audio/webm", b"audio")
        p.emit(ev.VoiceHeard(f=f.f, state="done", tidied=words, said=said, by="taska"))
        return {"f": f.f, "name": f.name, "mime": "audio/webm"}

    def run_one(self, cmd, p=None):
        lines, _ = (p or self.p).run([(0, cmd)], "you")
        self.assertTrue(lines[0].startswith("ok"), lines)
        return lines[0]

    def item(self):
        self.run_one({"op": "new", "title": "Export", "type": "feature"})
        return 1

    def test_an_input_by_voice_keeps_only_what_was_typed_and_agents_read_its_words(self):
        self.run_one({"op": "input", "text": "", "files": [self.note()]})
        st = self.p.state
        self.assertEqual(st.inputs["r1"].text, "")
        card = render.input_card(self.p.reading(), st.inputs["r1"])
        self.assertIn("voice 0:08: " + WORDS, card)
        self.assertIn("word for word: " + SAID, card)
        self.assertNotIn(".webm", card)  # its words, not an empty text and a path
        self.assertIn(WORDS, render.log(st, 5))  # the change log says what was said
        self.assertEqual([f.key for f in by_words(st, "保留我设的筛选")], ["r1"])

    def test_a_reply_by_voice_is_read_with_its_words_on_the_item(self):
        n = self.item()
        self.run_one({"op": "input", "text": "Also:", "scope": n, "files": [self.note()]})
        card = render.card(self.p.reading(), self.p.state.items[n])
        self.assertIn("you: Also:\nvoice 0:08: " + WORDS, card)

    def test_a_voice_comment_is_read_with_its_words_and_found(self):
        n = self.item()
        self.run_one({"op": "doc", "ref": "F1", "title": "Plan", "md": "# Plan\n\nThe export keeps the filter."})
        self.run_one({"op": "dc", "d": 1, "key": "doc", "text": "", "files": [self.note()]})
        st = self.p.state
        self.assertEqual(st.docs[1].comments[0].text, "")
        self.assertIn("you", render.doc_text(self.p.reading(), st.docs[1]))
        self.assertIn("voice 0:08: " + WORDS, render.doc_text(self.p.reading(), st.docs[1]))
        self.assertIn(f"D1 comment {WORDS!r}", render.log(st, 3))
        self.assertIn("d1", [f.key for f in by_words(st, "保留我设的筛选")])
        self.assertEqual(n, 1)

    def test_words_you_change_go_to_the_note_once_everywhere(self):
        note = self.note()
        self.run_one({"op": "input", "text": "typed", "files": [note], "words": {note["f"]: "导出时保留筛选和排序"}})
        v = self.p.state.voices[note["f"]]
        self.assertEqual((v.tidied, v.was, bool(v.fixed)), ("导出时保留筛选和排序", WORDS, True))
        self.assertEqual(self.p.state.inputs["r1"].text, "typed")
        self.run_one({"op": "correct", "id": "r1", "wrong": "排序", "right": "顺序", "v": self.p.state.inputs["r1"].v})
        self.assertEqual(self.p.state.voices[note["f"]].tidied, "导出时保留筛选和顺序")
        self.assertEqual(self.p.state.inputs["r1"].text, "typed")

    def test_the_words_go_with_a_moved_input_and_a_moved_item(self):
        there = Project(os.path.join(self.tmp.name, "other"), "other")
        try:
            self.run_one({"op": "input", "text": "", "files": [self.note()]})
            got = Moves().input(self.p, there, "r1")
            moved = there.state.inputs[got["as"]]
            self.assertEqual([there.state.voices[f.f].tidied for f in moved.files], [WORDS])
            n = self.item()
            self.run_one({"op": "doc", "ref": "F1", "title": "Plan", "md": "# Plan\n\nThe export keeps the filter."})
            self.run_one({"op": "dc", "d": 1, "key": "doc", "text": "", "files": [self.note(words="还要保留排序")]})
            Moves().item(self.p, there, f"F{n}")
            doc = next(d for d in there.state.docs.values())
            self.assertIn("还要保留排序", doc.md)  # a voice comment is not dropped
            carried = [f for it in there.state.items.values() for x in it.thread for f in x.files]
            self.assertIn("还要保留排序", [there.state.voices[f.f].tidied for f in carried if f.f in there.state.voices])
        finally:
            there.close()


if __name__ == "__main__":
    unittest.main()
