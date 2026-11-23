"""T879: when a strong model's servers are busy (503), its try fails within seconds and the next model is asked,
instead of the busy one being asked again for the try's whole 30 s (a note waited 77 s for its words)."""

import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import support  # noqa: E402,F401  (the server on the path)
from taska.infra import gemini  # noqa: E402
from taska.services import transcribe  # noqa: E402

REPLY = {"candidates": [{"content": {"parts": [{"text": '{"transcript": "Keep the sort."}'}]}}]}


class BusyStrongModel(unittest.TestCase):
    def ask_with(self, model):
        got = []

        def generate(who, m, body, timeout=120, attempts=gemini.ATTEMPTS):
            got.append((m, attempts))
            return REPLY
        with mock.patch.object(transcribe.client, "generate", generate):
            words = transcribe.voice_main({"inline_data": {}}, "hear it", model)
        return words, got

    def test_a_strong_model_is_asked_once_more_at_most(self):
        words, got = self.ask_with("gemini-4-hydrogen")
        self.assertEqual((words, got), ("Keep the sort.", [("gemini-4-hydrogen", 2)]))

    def test_the_main_model_keeps_its_attempts(self):
        _, got = self.ask_with(None)
        self.assertEqual(got, [(transcribe.VOICE_MODEL, gemini.ATTEMPTS)])

    def test_two_busy_answers_fail_the_try_within_seconds(self):
        waits = []
        post = mock.Mock(side_effect=[gemini.Failed(503, "high demand")] * 2)
        g = gemini.Gemini(key=lambda: "k", post=post, pause=waits.append)
        with self.assertRaisesRegex(gemini.Refused, "503"):
            g.generate("voice", "gemini-4-hydrogen", {"contents": []}, attempts=transcribe.STRONG_ATTEMPTS)
        self.assertEqual(post.call_count, 2)
        self.assertLess(sum(waits), 2)


if __name__ == "__main__":
    unittest.main()
