"""F568: a voice note's words as said, word for word, are kept with it (before, only next to the audio). B682: in the
note's one record, beside its tidied words; the input keeps only what was typed."""

import unittest

import support  # noqa: F401  (puts the server on the path)
from taska.domain.projection.core import replay

T = "2026-10-30T13:40:%02d-07:00"
VOICE = {"f": "f1-voice.webm", "name": "voice.webm", "mime": "audio/webm", "size": 100}
TIDY, SAID = "Sync it.", "Uh, sync, sync it."


def state(*more):
    rows = [{"k": "in", "id": "r1", "by": "you", "text": "", "files": [VOICE], "q": "q1", "t": T % 1}, *more]
    return replay(rows, lambda seq, why: None)


class WordsAsSaid(unittest.TestCase):
    def test_its_words_bring_them(self):
        s = state({"k": "voice", "f": VOICE["f"], "state": "done", "src": "r1", "said": SAID, "tidied": TIDY, "by": "taska",
                   "t": T % 2})
        v = s.voices[VOICE["f"]]
        self.assertEqual((v.tidied, v.said, v.state), (TIDY, SAID, "done"))
        self.assertEqual(s.inputs["r1"].text, "")  # what was typed: nothing

    def test_a_file_carries_no_words(self):
        s = state()
        self.assertEqual(sorted(s.inputs["r1"].files[0].to_row()), ["f", "mime", "name", "size"])


if __name__ == "__main__":
    unittest.main()
