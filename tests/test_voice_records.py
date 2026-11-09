"""B682 (Yadong: every voice note has its words, in versions bound to the voice, the same everywhere): one record of
a voice note's words, written by every step of working them out and by a correction of yours; once per project, the
words taken out of the texts that held them, made from what was kept before."""

import os
import sys
import threading
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from support import ProjectCase
from taska.domain import events as ev  # noqa: E402
from taska.domain.model import FileRef  # noqa: E402
from taska.domain.projection import apply, replay  # noqa: E402
from taska.domain.voice_split import copies_in, plan, take_out  # noqa: E402

FID = "f1-voice_0-08.webm"
FIRST = "导出的时候保留筛选"
FINAL = "导出时要保留我设的筛选。"
AS_SAID = "导出的时候呢要保留我设的那个筛选"
T = "2026-11-05T10:00:%02d-08:00"
VOICE = {"f": FID, "name": "voice 0-08.webm", "mime": "audio/webm", "size": 100}


def voice_file(**more):
    return FileRef(f=FID, name="voice 0-08.webm", mime="audio/webm", **more)


class JobsWriteTheRecord(ProjectCase):
    def setUp(self):
        super().setUp()
        self.heard, self.go = threading.Event(), threading.Event()

        def transcriber(data, mime, scope, path, first):
            first(FIRST)
            self.heard.set()
            self.go.wait(10)
            return {"tr": FINAL, "heard": AS_SAID, "tr_by": "main"}

        self.p.voice.set_transcriber(transcriber)

    def tearDown(self):
        self.go.set()
        super().tearDown()

    def test_each_step_of_the_words_is_in_the_one_record(self):
        self.p.voice.start(FID, b"audio", "audio/webm", None)
        self.assertTrue(self.heard.wait(5))
        v = self.p.state.voices[FID]
        self.assertEqual((v.state, v.early, v.words), ("wait", FIRST, FIRST))  # the first words, at once (T687)
        job = self.p.voice.jobs[FID]
        self.go.set()
        with self.p.lock:
            self.p.news.wait_for(lambda: job.done, timeout=5)
        v = self.p.state.voices[FID]
        self.assertEqual((v.state, v.tidied, v.said, v.early), ("done", FINAL, AS_SAID, ""))

    def test_nobody_heard_and_failed_are_said(self):
        self.p.voice.set_transcriber(lambda *a: {"tr": ""})
        self.p.voice.start(FID, b"audio", "audio/webm", None)
        with self.p.lock:
            self.p.news.wait_for(lambda: self.p.voice.jobs[FID].done, timeout=5)
        self.assertEqual(self.p.state.voices[FID].state, "none")

        def broken(*a):
            raise RuntimeError("models down")

        other = "f2-voice_0-03.webm"
        self.p.voice.set_transcriber(broken)
        self.p.voice.start(other, b"audio", "audio/webm", None)
        with self.p.lock:
            self.p.news.wait_for(lambda: self.p.voice.jobs[other].done, timeout=5)
        self.assertEqual((self.p.state.voices[other].state, self.p.state.voices[other].err), ("failed", "models down"))


class Record(unittest.TestCase):
    def test_your_words_stay_yours_when_a_model_says_more(self):
        state = replay([], lambda *a: None)
        apply(state, ev.VoiceHeard(f=FID, state="done", tidied=FIRST, said=FIRST, by="taska", t=T % 1))
        apply(state, ev.VoiceFixed(f=FID, tidied=FINAL, by="you", t=T % 2))
        apply(state, ev.VoiceHeard(f=FID, state="done", tidied="fuller words", said="fuller words", by="taska", t=T % 3))
        v = state.voices[FID]
        self.assertEqual((v.tidied, v.fixed, v.was, v.said), (FINAL, T % 2, "fuller words", "fuller words"))

    def test_the_rows_read_back_the_same(self):
        for e in (ev.VoiceHeard(f=FID, state="wait", early=FIRST, src="r1", late=True, by="taska", t=T % 1),
                  ev.VoiceFixed(f=FID, tidied=FINAL, src="r1", by="you", t=T % 2)):
            self.assertEqual(ev.decode(e.to_row()).to_row(), e.to_row())


class SplitOnce(unittest.TestCase):
    def test_take_out_finds_the_words_as_they_are_or_as_you_changed_them(self):
        self.assertEqual(take_out("see this\n" + FINAL, [FINAL], FINAL)[:2], ("see this", FINAL))
        changed = "导出时要保留我自己设的筛选。"
        rest, found, how = take_out("Look:\n" + changed, [FINAL], FINAL)
        self.assertEqual((rest, found, how), ("Look:", changed, "fuzzy"))
        self.assertEqual(take_out("unrelated words", [FINAL], FINAL)[2], "none")

    def rows(self):
        return [
            {"k": "in", "id": "r1", "by": "you", "text": "", "scope": None, "files": [dict(VOICE, wait=True)], "t": T % 1},
            {"k": "tr", "src": "r1", "f": FID, "tr": FINAL, "heard": AS_SAID, "by": "you", "t": T % 2},
            {"k": "in", "id": "r2", "by": "you", "text": "typed first\n" + "第二条", "scope": None,
             "files": [{"f": "f2-voice_0-02.webm", "name": "voice 0-02.webm", "mime": "audio/webm", "tr": "第二条"}], "t": T % 3},
            {"k": "add", "n": 1, "by": "codex", "title": "Docs", "type": "task", "pri": "P2", "when": "now",
             "status": "open", "body": "", "t": T % 4},
            {"k": "doc", "d": 1, "n": 1, "title": "D", "md": "# D\n\nA paragraph.", "by": "codex", "t": T % 5},
            {"k": "dc", "d": 1, "key": "doc", "quote": "", "text": "评论的话", "by": "you",
             "files": [{"f": "f3-voice_0-04.webm", "name": "voice 0-04.webm", "mime": "audio/webm", "tr": "评论的话"}], "t": T % 6},
        ]

    def test_records_are_made_and_texts_keep_only_what_was_typed(self):
        rows = self.rows()
        state = replay(rows, lambda *a: None)
        event, report = plan(state, {"f3-voice_0-04.webm": {"tr": "评论的话", "heard": "评论的那些话"}}, copies_in(rows), T % 9)
        apply(state, ev.decode(event.to_row()))  # as it is stored and read back
        self.assertTrue(state.voices_split)
        self.assertEqual(state.inputs["r1"].text, "")
        self.assertEqual(state.inputs["r2"].text, "typed first")
        self.assertEqual(state.docs[1].comments[0].text, "")
        self.assertEqual(state.voices[FID].said, AS_SAID)
        self.assertEqual(state.voices["f2-voice_0-02.webm"].tidied, "第二条")
        self.assertEqual(state.voices["f3-voice_0-04.webm"].said, "评论的那些话")
        self.assertEqual((report.voices, report.not_found), (3, []))


if __name__ == "__main__":
    unittest.main()
