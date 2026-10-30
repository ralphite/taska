"""F568: a voice note's words as said, word for word, are kept with its input (before, only next to the audio)."""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.domain.model import FileRef  # noqa: E402
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
        f = s.inputs["r1"].files[0]
        self.assertEqual((f.tr, f.heard), (TIDY, SAID))

    def test_kept_once_for_notes_heard_before(self):
        s = state({"k": "tr", "src": "r1", "f": VOICE["f"], "tr": TIDY, "by": "you", "t": T % 2},
                  {"k": "heard", "notes": {"r1": {VOICE["f"]: SAID}}, "by": "taska", "t": T % 3})
        self.assertEqual(s.inputs["r1"].files[0].heard, SAID)
        self.assertEqual(s.inputs["r1"].text, TIDY)  # what everyone reads is still the tidied words

    def test_the_same_words_are_kept_once(self):
        f = FileRef(f="f1", name="v").with_words(TIDY, TIDY)
        self.assertIsNone(f.heard)
        self.assertEqual(FileRef(f="f1", name="v", heard=SAID).with_words(TIDY).heard, SAID)


if __name__ == "__main__":
    unittest.main()
