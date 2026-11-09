"""T687 (Yadong's choice, #9729): a voice note's first words show as soon as the speech model has them (about 2 s); the
main model's and tidied words take their place when they are in. Until then the input waits for them, so nobody
organizes or reads it twice, and the change is not an edit of yours. Change only on Yadong's explicit word.
B682: the words are the voice note's own record; the input keeps only what was typed."""

import os
import sys
import threading
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from support import ProjectCase
from taska.services.voice_jobs import answer  # noqa: E402

FID = "f1-voice_0-08.webm"
FIRST = "导出的时候保留筛选"
FINAL = "导出时要保留我设的筛选。"


class EarlyVoiceWords(ProjectCase):
    def setUp(self):
        super().setUp()
        self.heard, self.go = threading.Event(), threading.Event()

        def transcriber(data, mime, scope, path, first):
            first(FIRST)
            self.heard.set()
            self.go.wait(10)
            return {"tr": FINAL, "heard": FIRST, "tr_by": "main"}

        self.p.voice.set_transcriber(transcriber)
        self.assertEqual(self.p.files.save("voice 0-08.webm", "audio/webm", b"audio").f, FID)

    def tearDown(self):
        self.go.set()
        job = self.p.voice.jobs.get(FID)
        if job:
            with self.p.lock:
                self.p.news.wait_for(lambda: job.done, timeout=5)
        super().tearDown()

    def start(self):
        self.p.voice.start(FID, b"audio", "audio/webm", None)
        self.assertTrue(self.heard.wait(5))

    def finish(self):
        job = self.p.voice.jobs[FID]
        self.go.set()
        with self.p.lock:
            self.p.news.wait_for(lambda: job.done, timeout=5)

    def send(self, words=None):
        """As the page sends it: what was typed (nothing here), the note, and its words as they were in the box."""
        lines, _ = self.p.run([(0, {"op": "input", "text": "", "q": "q1", "files": [{"f": FID, "name": "voice 0-08.webm", "mime": "audio/webm"}],
                                    **({"words": {FID: words}} if words else {})})], "you")
        self.assertTrue(lines[0].startswith("ok"), lines)

    def test_the_page_gets_the_first_words_then_the_final_ones(self):
        self.start()
        with self.p.lock:
            got = answer(FID, self.p.voice.jobs[FID])
        self.assertEqual((got["done"], got["tr"], got["more"]), (True, FIRST, True))
        self.finish()
        with self.p.lock:
            got = answer(FID, self.p.voice.jobs[FID])
        self.assertEqual(got["tr"], FINAL)
        self.assertNotIn("more", got)

    def test_sent_before_the_words_it_shows_the_first_words_and_waits_for_the_final_ones(self):
        self.send()
        self.start()
        inp = self.p.state.inputs["r1"]
        self.assertEqual((inp.text, self.p.state.voices[FID].words), ("", FIRST))
        self.assertTrue(self.p.voice.held(inp))  # the organizer and agents wait for the final words
        self.finish()
        inp = self.p.state.inputs["r1"]
        self.assertEqual((inp.text, self.p.state.voices[FID].words), ("", FINAL))
        self.assertFalse(inp.history)  # not an edit: nobody had read it

    def test_sent_with_the_first_words_they_give_way_to_the_final_ones(self):
        self.start()
        self.send(FIRST)  # the page put the first words in the box and sent them: not a correction of yours
        self.assertIsNone(self.p.state.voices[FID].fixed)
        self.finish()
        self.assertEqual((self.p.state.inputs["r1"].text, self.p.state.voices[FID].words), ("", FINAL))


if __name__ == "__main__":
    unittest.main()
