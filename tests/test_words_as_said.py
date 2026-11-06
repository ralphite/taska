"""F568: a voice note's words as said, word for word, are kept with it (before, only next to the audio). B682: in the
note's one record, beside its tidied words; the input keeps only what was typed."""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.domain.projection.core import replay  # noqa: E402

T = "2026-10-30T13:40:%02d-07:00"
VOICE = {"f": "f1-voice.webm", "name": "voice.webm", "mime": "audio/webm", "size": 100, "wait": True}
TIDY, SAID = "Sync it.", "Uh, sync, sync it."


def state(*more):
    rows = [{"k": "in", "id": "r1", "by": "you", "text": "", "files": [VOICE], "q": "q1", "t": T % 1}, *more]
    return replay(rows, lambda seq, why: None)


class WordsAsSaid(unittest.TestCase):
    def test_words_in_bring_them(self):
        s = state({"k": "tr", "src": "r1", "f": VOICE["f"], "tr": TIDY, "heard": SAID, "by": "you", "t": T % 2})
        v = s.voices[VOICE["f"]]
        self.assertEqual((v.tidied, v.said, v.state), (TIDY, SAID, "done"))
        self.assertEqual(s.inputs["r1"].text, "")  # what was typed: nothing

    def test_kept_once_for_notes_heard_before(self):
        s = state({"k": "tr", "src": "r1", "f": VOICE["f"], "tr": TIDY, "by": "you", "t": T % 2},
                  {"k": "heard", "notes": {"r1": {VOICE["f"]: SAID}}, "by": "taska", "t": T % 3})
        self.assertEqual((s.voices[VOICE["f"]].said, s.voices[VOICE["f"]].words), (SAID, TIDY))  # tidied is read

    def test_a_file_carries_no_words(self):
        s = state()
        self.assertEqual(sorted(s.inputs["r1"].files[0].to_row()), ["f", "mime", "name", "size"])


if __name__ == "__main__":
    unittest.main()
