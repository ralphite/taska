"""T726: a voice note's record has four states (voice_states), the steps between them are listed, the reducer
follows them, a page is told the state in every answer about the words, and no other state is written."""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.domain import events as ev  # noqa: E402
from taska.domain.projection import apply  # noqa: E402
from taska.domain.state import ProjectState  # noqa: E402
from taska.domain.voice_states import DONE, FAILED, NONE, STATES, STEPS, WAIT, after, answer_state  # noqa: E402
from taska.services.project import Project  # noqa: E402
from taska.services.voice_jobs import Job, answer  # noqa: E402

FID = "f1-voice_0-08.webm"


class TheSteps(unittest.TestCase):
    def test_the_listed_steps_are_the_rule(self):
        for frm, step, to in STEPS:
            self.assertEqual(after(frm, step, has_words=frm == DONE), to, (frm, step))

    def test_words_in_stay(self):
        for step in STATES:
            self.assertEqual(after(DONE, step, has_words=True), DONE)

    def test_the_reducer_follows_them(self):
        st = ProjectState()
        seq = [(WAIT, ""), (WAIT, ""), (DONE, "Keep the sort."), (FAILED, ""), (WAIT, "")]
        want = [WAIT, WAIT, DONE, DONE, DONE]
        for i, ((state, words), to) in enumerate(zip(seq, want)):
            apply(st, ev.VoiceHeard(f=FID, state=state, tidied=words, said=words, seq=i + 1, t="t", by="taska"))
            self.assertEqual(st.voices[FID].state, to, i)
        self.assertEqual(st.voices[FID].tidied, "Keep the sort.")

    def test_tried_again_after_nobody_was_heard(self):
        st = ProjectState()
        for i, state in enumerate([WAIT, NONE, WAIT, DONE]):
            apply(st, ev.VoiceHeard(f=FID, state=state, tidied="Hi." if state == DONE else "", seq=i + 1, t="t",
                                    by="taska"))
        self.assertEqual((st.voices[FID].state, st.voices[FID].tidied), (DONE, "Hi."))


class WhatAPageIsTold(unittest.TestCase):
    def test_every_answer_says_the_state(self):
        self.assertEqual(answer(FID, Job(t0=0))["state"], WAIT)
        self.assertEqual(answer(FID, Job(t0=0, early="Keep"))["state"], WAIT)
        self.assertTrue(answer(FID, Job(t0=0, early="Keep"))["more"])
        self.assertEqual(answer(FID, Job(t0=0, done=True, tr="Keep the sort."))["state"], DONE)
        self.assertEqual(answer(FID, Job(t0=0, done=True))["state"], NONE)
        self.assertEqual(answer(FID, Job(t0=0, done=True, err="Gemini HTTP 503"))["state"], FAILED)
        self.assertEqual(answer(FID, None)["state"], FAILED)  # no such voice note
        self.assertEqual(answer_state(False, "x", ""), WAIT)


class NoOtherState(unittest.TestCase):
    def test_a_state_not_listed_is_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Project(tmp, "demo")
            try:
                with p.lock, self.assertRaises(ValueError):
                    p.voice.record(FID, "heard")
                self.assertNotIn(FID, p.state.voices)
            finally:
                p.close()


if __name__ == "__main__":
    unittest.main()
