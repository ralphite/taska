"""B626: a voice note's words that come in after its input was sent (an agent or the organizer read it without them)
reach the agents as an update, but the message is not marked edited: you changed nothing."""

import sys
import os
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.domain.projection.core import replay  # noqa: E402

T = "2026-10-30T13:40:%02d-07:00"
VOICE = {"f": "f1-voice_0-08.webm", "name": "voice 0-08.webm", "mime": "audio/webm", "size": 100, "wait": True}
WORDS = "\u540c\u6b65\u4e00\u4e0b"


def rows(late: bool, amend: bool = False):
    out = [
        {"k": "add", "n": 1, "by": "claude-code", "title": "Sync", "type": "task", "pri": "P2", "when": "now", "status": "open", "body": "", "t": T % 0},
        {"k": "in", "id": "r1", "by": "you", "text": "http://example.test/n/D1", "scope": 1, "files": [VOICE], "q": "q1", "t": T % 14},
        {"k": "tr", "src": "r1", "f": VOICE["f"], "tr": WORDS, "by": "you", "late": late, "t": T % 22},
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
        self.assertIn(WORDS, m.text)
        self.assertIsNone(m.edited)
        self.assertFalse(state.inputs["r1"].acked)  # it comes back to the agents with its words

    def test_words_in_time_are_not_an_edit(self):
        m = message(replay(rows(late=False), lambda seq, why: None))
        self.assertIn(WORDS, m.text)
        self.assertIsNone(m.edited)

    def test_words_you_change_are_an_edit(self):
        self.assertIsNotNone(message(replay(rows(late=True, amend=True), lambda seq, why: None)).edited)


if __name__ == "__main__":
    unittest.main()
