"""T822 (Yadong r1405): when the strong model has not answered in as long as nine in ten of its latest answers took
(17 s at first), the next model is asked beside it and the first words win; and hearing that has got slow (of the
latest 30 notes over one in five first tries unanswered, or one note over 60 s) opens one bug in the taska project,
none more while it is open. No model is called: the models here are fakes."""

import json
import os
import sys
import tempfile
import threading
import time
import unittest
from collections import Counter
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from support import ProjectCase
from taska.services import transcribe as tr  # noqa: E402
from taska.services import voice_health as vh  # noqa: E402

SAID = "导出的时候保留我设的筛选。"


class Hedge(unittest.TestCase):
    def setUp(self):
        self.patches = [mock.patch.object(tr.tools, name, value) for name, value in
                        (("processed_silence", lambda path, mime: 0.0), ("duration", lambda path: 0.0),
                         ("louder", lambda data, mime: b""), ("pieces", lambda path: ([], 0.0)))]
        self.patches += [mock.patch.object(tr, "voice_asr", lambda audio, vocab: SAID),
                         mock.patch.object(tr.time, "sleep", lambda s: None)]
        for p in self.patches:
            p.start()
        self.told = []

    def tearDown(self):
        for p in self.patches:
            p.stop()

    def heard(self, main, hedge):
        h = tr.Hearing(context=lambda scope: (Counter(), [], []), fixes=lambda: [], prefs=lambda: "", tidy=lambda: False,
                       hedge=lambda: hedge, heard=lambda ok, secs: self.told.append(ok))
        with mock.patch.object(tr, "voice_main", main):
            return tr.transcribe(h, b"audio", "audio/webm", None)

    def test_a_first_try_with_no_answer_in_time_has_the_next_model_asked_beside_it(self):
        gone = threading.Event()

        def main(audio, prompt, model=None):
            if model == tr.HEAR_MODELS[0]:
                gone.wait(2)  # it does not answer (in time)
                return "too late"
            return SAID
        t0 = time.time()
        out = self.heard(main, 0.1)
        gone.set()
        self.assertLess(time.time() - t0, 1.5)  # not the first try's whole wait
        pro = [s for s in out["steps"] if s["step"].startswith("pro")]
        self.assertEqual([(s["step"], s["model"]) for s in pro], [("pro", tr.HEAR_MODELS[0]), ("pro_2", tr.HEAR_MODELS[1])])
        self.assertTrue(pro[1].get("chosen"))
        self.assertEqual((out["tr"], out["tr_by"], out["hedge"]), (SAID, "pro", 0.1))

    def test_an_answer_in_time_wins_and_nothing_else_is_asked(self):
        out = self.heard(lambda audio, prompt, model=None: SAID, 5)
        self.assertEqual([s["step"] for s in out["steps"] if s["step"].startswith("pro")], ["pro"])
        self.assertEqual(self.told, [True])

    def test_both_failing_go_on_to_the_next_try(self):
        tries = []

        def main(audio, prompt, model=None):
            tries.append(model)
            if len(tries) == 1:
                threading.Event().wait(0.3)
            if len(tries) < 3:
                raise tr.Refused("Gemini HTTP 503")
            return SAID
        out = self.heard(main, 0.05)
        self.assertEqual([s["step"] for s in out["steps"] if s["step"].startswith("pro")], ["pro", "pro_2", "pro_3"])
        self.assertEqual(out["tr"], SAID)
        self.assertEqual(self.told, [False])

    def test_the_time_is_nine_in_ten_of_the_latest_answers(self):
        self.assertEqual(vh.hedge_after([1.0] * 5), 17)  # too few answers yet
        self.assertEqual(vh.hedge_after([float(x) for x in range(1, 21)]), 19)
        self.assertEqual(vh.hedge_after([1.0] * 20), vh.HEDGE_MIN)
        self.assertEqual(vh.hedge_after([90.0] * 20), vh.HEDGE_MAX)


class Alarm(ProjectCase):
    def test_slow_hearing_opens_one_bug_until_it_is_closed(self):
        root = tempfile.mkdtemp()
        health = vh.VoiceHealth(root)
        self.assertIsNone(vh.alarm([True] * 30, [15.0] * 30, 17))
        self.assertIsNotNone(vh.alarm([True] * 23 + [False] * 7, [15.0] * 30, 17))  # 7 of 30: over one in five
        self.assertIsNone(vh.alarm([True] * 24 + [False] * 6, [15.0] * 30, 17))  # 6 of 30: one in five
        self.assertIsNotNone(vh.alarm([True] * 3, [15.0, 61.0], 17))  # one over 60 s
        for _ in range(9):
            health.heard(True, 5.0)
            self.assertIsNone(health.done(15.0))
        health.heard(False, 34.0)
        said = health.done(93.1)
        self.assertIn("93 秒", said[1])
        p = self.p
        health.report(said, p)
        health.report(said, p)  # the first is still open: no second
        bugs = [it for it in p.state.tasks.values() if it.title == said[0]]
        self.assertEqual(len(bugs), 1)
        self.assertIsNone(health.done(15.0))  # counting started again
        with p.lock:
            p.run([(0, {"op": "set", "ref": p.state.code(bugs[0].n), "f": {"status": "dropped"}})], "you")
        health.report(said, p)
        self.assertEqual(len([it for it in p.state.tasks.values() if it.title == said[0]]), 2)

    def test_counting_starts_again_after_a_bug_also_after_a_restart(self):
        # T825: a restart read the notes counted for the bug before back in, and the next note made another bug
        root = tempfile.mkdtemp()
        os.makedirs(os.path.join(root, "home", "home-files"))
        for i in range(12):
            rec = {"times": {"total": 90.0}, "steps": [{"step": "pro", "model": "m", "error": "timed out", "secs": 30.0}]}
            with open(os.path.join(root, "home", "home-files", f"f{i}-voice_0-05.webm.tr.json"), "w") as f:
                json.dump(rec, f)
        self.assertIsNotNone(vh.VoiceHealth(root).done(None))  # the bug
        again = vh.VoiceHealth(root)  # Taska restarted
        again.heard(True, 5.0)
        self.assertIsNone(again.done(12.0))  # only the notes after it count

    def test_read_from_the_notes_records_when_taska_starts(self):
        root = tempfile.mkdtemp()
        os.makedirs(os.path.join(root, "home", "home-files"))
        for i in range(12):
            rec = {"times": {"total": 10.0}, "steps": [{"step": "pro", "model": "m", "text": "x", "secs": 4.0 + i}]}
            with open(os.path.join(root, "home", "home-files", f"f{i}-voice_0-05.webm.tr.json"), "w") as f:
                json.dump(rec, f)
        self.assertEqual(vh.VoiceHealth(root).hedge(), 14)  # 4 to 15 s: nine in ten took 14 s or less


if __name__ == "__main__":
    unittest.main()
