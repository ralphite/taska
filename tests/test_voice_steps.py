"""T697 r(D121), Yadong's decisions on how a voice note becomes words:
1. the organizer writes an item's body from the note's tidied words, complete; the word-for-word line is given to it
   only to judge whether something was misheard;
2. every step that ran is kept (its model, its words or its error, how long it took, whether its words were chosen),
   in the transcript next to the audio and in what the page gets for the note;
3. no separate step turns Traditional characters Simplified: the transcribing and tidying instructions say so.
Change only on Yadong's explicit word. No model is called: the models here are fakes."""

import json
import os
import sys
import tempfile
import threading
import unittest
from collections import Counter
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from support import ProjectCase
from taska.agent_text import render  # noqa: E402
from taska.agent_text.organizer_text import INSTRUCTIONS  # noqa: E402
from taska.domain import events as ev  # noqa: E402
from taska.domain import voice_words  # noqa: E402
from taska.domain.vocab import Refused  # noqa: E402
from taska.services import organizer, transcribe as tr  # noqa: E402
from taska.services.project import Project  # noqa: E402
from taska.services.voice_jobs import answer  # noqa: E402

SAID = "嗯那个导出的时候呢保留我设的那个那个筛选，然后列表也要记住。"
TIDIED = "导出的时候保留我设的筛选，然后列表也要记住。"
ASR = "嗯那个导出的时候呢保留我设的那个筛选然后列表也要记住"


def hearing(tidy=True):
    return tr.Hearing(context=lambda scope: (Counter(), [], []), fixes=lambda: [], prefs=lambda: "", tidy=lambda: tidy)


class Steps(unittest.TestCase):
    def setUp(self):
        self.patches = [mock.patch.object(tr.tools, name, value) for name, value in
                        (("processed_silence", lambda path, mime: 0.0), ("duration", lambda path: 0.0),
                         ("louder", lambda data, mime: b""), ("pieces", lambda path: ([], 0.0)))]
        self.patches.append(mock.patch.object(tr, "voice_asr", lambda audio, vocab: ASR))
        self.patches.append(mock.patch.object(tr, "ask", lambda *a, **k: TIDIED))
        self.patches.append(mock.patch.object(tr.time, "sleep", lambda s: None))
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()

    def heard(self, main, tidy=True):
        with mock.patch.object(tr, "voice_main", main):
            return tr.transcribe(hearing(tidy), b"audio", "audio/webm", None)

    def test_every_step_is_kept_with_its_model_words_time_and_which_was_chosen(self):
        out = self.heard(lambda audio, prompt, model=None: SAID)
        steps = {s["step"]: s for s in out["steps"]}
        self.assertEqual([s["step"] for s in out["steps"]], ["pro", "asr", "tidy"])
        self.assertEqual((steps["pro"]["model"], steps["pro"]["text"], steps["pro"].get("chosen")), (tr.PRO_MODEL, SAID, True))
        self.assertEqual((steps["asr"]["model"], steps["asr"]["text"], steps["asr"].get("chosen")), (tr.ASR_MODEL, ASR, None))
        self.assertEqual((steps["tidy"]["model"], steps["tidy"]["text"], steps["tidy"].get("chosen")), (tr.VOICE_MODEL, TIDIED, True))
        self.assertTrue(all(isinstance(s["secs"], float) for s in out["steps"]))
        self.assertEqual((out["tr"], out["heard"], out["tr_by"]), (TIDIED, SAID, "pro"))

    def test_a_step_that_failed_keeps_its_error_and_the_other_is_chosen(self):
        def refused(audio, prompt, model=None):
            raise Refused("Gemini refused it twice (OTHER)")
        out = self.heard(refused, tidy=False)
        steps = {s["step"]: s for s in out["steps"]}
        self.assertEqual(steps["pro"]["error"], "Gemini refused it twice (OTHER)")
        self.assertNotIn("text", steps["pro"])
        self.assertTrue(steps["asr"]["chosen"])
        self.assertNotIn("tidy", steps)  # not asked: not a step
        self.assertEqual(out["tr"], ASR)

    def test_the_strong_model_has_no_time_limit_and_is_asked_again_when_it_fails(self):
        # D121 (Yadong, 11-06): "why at most 10 s? there is no limit: wait for it, and when it fails, ask again"
        self.assertFalse(hasattr(tr, "PRO_CAP"))
        tries = []

        def flaky(audio, prompt, model=None):
            tries.append(model)
            if len(tries) < 3:
                raise Refused("Gemini HTTP 503")
            return SAID
        out = self.heard(flaky)
        self.assertEqual(len(tries), 3)
        steps = [s for s in out["steps"] if s["step"].startswith("pro")]
        self.assertEqual([s["step"] for s in steps], ["pro", "pro_2", "pro_3"])
        self.assertEqual([s.get("error") for s in steps[:2]], ["Gemini HTTP 503"] * 2)
        self.assertEqual((steps[2]["text"], steps[2].get("chosen"), out["tr_by"]), (SAID, True, "pro"))

    def test_a_try_with_no_answer_in_30_s_fails_and_is_asked_again(self):
        # T697 (Yadong, 11-06, "照这个改"): each try waits PRO_TRY (30 s); a stalled one is a failed try
        self.assertEqual(tr.PRO_TRY, 30)
        tries = []

        def stalls_once(audio, prompt, model=None):
            tries.append(1)
            if len(tries) == 1:
                threading.Event().wait(0.3)  # time.sleep is a no-op in these tests
            return SAID
        with mock.patch.object(tr, "PRO_TRY", 0.1):
            out = self.heard(stalls_once)
        steps = [s for s in out["steps"] if s["step"].startswith("pro")]
        self.assertEqual([s["step"] for s in steps], ["pro", "pro_2"])
        self.assertIn("timed out", steps[0]["error"])
        self.assertEqual((steps[1]["text"], out["tr_by"]), (SAID, "pro"))

    def test_the_words_set_aside_are_kept_too(self):
        out = self.heard(lambda audio, prompt, model=None: "导出")  # it stopped early: the speech model's words
        steps = {s["step"]: s for s in out["steps"]}
        self.assertEqual((steps["pro"]["text"], steps["pro"].get("chosen"), steps["asr"].get("chosen")), ("导出", None, True))

    def test_kept_next_to_the_audio_and_given_to_the_page(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Project(tmp, "demo")
            try:
                f = p.files.save("voice_0-08.webm", "audio/webm", b"audio").f
                res = self.heard(lambda audio, prompt, model=None: SAID)
                p.voice.keep(f, res)
                with open(p.file_path(f) + ".tr.json", encoding="utf-8") as fh:
                    self.assertEqual(json.load(fh)["steps"], res["steps"])
                with p.lock:
                    got = answer(f, p.voice.job(f))
                self.assertEqual([s["step"] for s in got["steps"]], ["pro", "asr", "tidy"])
            finally:
                p.close()


class Simplified(unittest.TestCase):
    def test_the_instructions_say_simplified_and_no_step_converts(self):
        for text in (voice_words.VOICE_SYSTEM, voice_words.VOICE_RULES, voice_words.TIDY_SYSTEM):
            self.assertIn("简体字", text)  # Simplified characters
        for gone in ("simplified", "T2S_SYSTEM", "T2S_HINT"):
            self.assertFalse(hasattr(tr, gone) or hasattr(voice_words, gone), gone)


class OrganizerBody(ProjectCase):
    def setUp(self):
        super().setUp()
        f = self.p.files.save("voice_0-08.webm", "audio/webm", b"audio")
        self.p.emit(ev.VoiceHeard(f=f.f, state="done", tidied=TIDIED, said=SAID, by="taska"))
        lines, _ = self.p.run([(0, {"op": "input", "text": "", "files": [{"f": f.f, "name": f.name, "mime": "audio/webm"}]})], "you")
        self.assertTrue(lines[0].startswith("ok"), lines)

    def test_the_word_for_word_line_is_only_to_check_for_misheard_words(self):
        with self.p.lock:
            text = organizer.context(self.p, self.p.state.inputs["r1"])
        self.assertIn("voice 0:08: " + TIDIED, text)
        said = next(line for line in text.split("\n") if SAID in line)
        self.assertIn("only to check whether a word was misheard", said)
        self.assertIn("never copy it into a body", said)

    def test_the_body_is_the_tidied_words_complete(self):
        self.assertIn("those are its tidied words, and the body is written from them,\n  complete", INSTRUCTIONS)
        self.assertIn("Leave out only fillers", INSTRUCTIONS)
        self.assertIn("rewrite\n  them by your own understanding", INSTRUCTIONS)
        self.assertIn('use\n  it only to judge whether a word in the tidied words was misheard', INSTRUCTIONS)
        self.assertNotIn("exactly as said", INSTRUCTIONS)

    def test_agents_read_the_note_as_before(self):
        with self.p.lock:
            card = render.input_card(self.p.reading(), self.p.state.inputs["r1"])
        self.assertIn("word for word: " + SAID, card)
        self.assertNotIn("misheard", card)


if __name__ == "__main__":
    unittest.main()
