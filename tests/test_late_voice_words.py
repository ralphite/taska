"""B626: a voice note's words that come in after its input was sent (an agent or the organizer read it without them)
reach the agents as an update, but the message is not marked edited: you changed nothing. B682: the words are the
note's record; the input and its message keep what was typed."""

import sys
import os
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.domain.projection.core import replay  # noqa: E402

T = "2026-10-30T13:40:%02d-07:00"
VOICE = {"f": "f1-voice_0-08.webm", "name": "voice 0-08.webm", "mime": "audio/webm", "size": 100}
WORDS = "同步一下"
LINK = "http://example.test/n/D1"


def rows(late: bool, amend: bool = False):
    words = {"k": "voice", "f": VOICE["f"], "state": "done", "src": "r1", "tidied": WORDS, "said": WORDS, "late": late,
             "by": "taska", "t": T % 22}
    out = [
        {"k": "add", "n": 1, "by": "claude-code", "title": "Sync", "type": "task", "pri": "P2", "when": "now", "status": "open", "body": "", "t": T % 0},
        {"k": "in", "id": "r1", "by": "you", "text": LINK, "scope": 1, "files": [VOICE], "q": "q1", "t": T % 14},
        {"k": "ack", "ids": ["r1"], "by": "claude-code", "t": T % 15},
        words,
    ]
    if amend:
        out.append({"k": "amend", "src": "r1", "mode": "edit", "text": "http://example.test/n/D2", "by": "you", "t": T % 30})
    return out


def message(state):
    return next(x for x in state.items[1].thread if x.src == "r1")


class LateVoiceWords(unittest.TestCase):
    def test_words_in_late_are_not_an_edit(self):
        state = replay(rows(late=True), lambda seq, why: None)
        m = message(state)
        self.assertEqual((m.text, state.voices[VOICE["f"]].words), (LINK, WORDS))
        self.assertIsNone(m.edited)
        self.assertFalse(state.inputs["r1"].acked)  # it comes back to the agents with its words
        self.assertIn(LINK, state.inputs["r1"].history[-1].text)

    def test_words_in_time_are_not_an_edit(self):
        state = replay(rows(late=False), lambda seq, why: None)
        self.assertIsNone(message(state).edited)
        self.assertTrue(state.inputs["r1"].acked)

    def test_words_you_change_are_an_edit(self):
        self.assertIsNotNone(message(replay(rows(late=True, amend=True), lambda seq, why: None)).edited)


if __name__ == "__main__":
    unittest.main()
