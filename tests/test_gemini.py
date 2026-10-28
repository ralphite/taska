"""The Gemini client without the network: what it sends, when it tries again, what it answers."""

import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "server"))

from taska.domain.vocab import Refused  # noqa: E402
from taska.infra.gemini import Failed, Gemini, Question  # noqa: E402

REPLY = {"candidates": [{"content": {"parts": [{"text": "thinking...", "thought": True}, {"text": " Hello "}]}}],
         "usageMetadata": {"promptTokenCount": 3}}


class Fake:
    """A transport that answers from a list: a reply, or a Failed to raise."""

    def __init__(self, *answers):
        self.answers, self.sent = list(answers), []

    def __call__(self, url, data, headers, timeout):
        self.sent.append((url, json.loads(data), headers))
        got = self.answers.pop(0)
        if isinstance(got, Failed):
            raise got
        return got


def client(fake):
    waits = []
    return Gemini(key=lambda: "k", model="m", post=fake, pause=waits.append, clock=lambda: 0.0), waits


class GeminiTest(unittest.TestCase):
    def test_asks_and_answers_the_words(self):
        fake = Fake(REPLY)
        g, _ = client(fake)
        self.assertEqual(g.ask("organizer", Question("be brief", [{"text": "hi"}], think=8)), "Hello")
        url, body, headers = fake.sent[0]
        self.assertTrue(url.endswith("/models/m:generateContent"))
        self.assertEqual(headers["x-goog-api-key"], "k")
        self.assertEqual(body["systemInstruction"], {"parts": [{"text": "be brief"}]})
        self.assertEqual(body["generationConfig"], {"temperature": 0.2, "thinkingConfig": {"thinkingBudget": 8}})

    def test_a_json_field(self):
        fake = Fake({"candidates": [{"content": {"parts": [{"text": '{"words": " a b "}'}]}}]})
        g, _ = client(fake)
        self.assertEqual(g.ask("voice", Question("", [], answer_in=("words", "what was said"))), "a b")
        self.assertEqual(fake.sent[0][1]["generationConfig"]["responseSchema"]["required"], ["words"])

    def test_without_the_thinking_switch_at_once(self):
        fake = Fake(Failed(400, "thinking is not supported"), REPLY)
        g, waits = client(fake)
        g.ask("voice", Question("", []))
        self.assertNotIn("thinkingConfig", fake.sent[1][1]["generationConfig"])
        self.assertEqual(waits, [])

    def test_busy_then_answers(self):
        g, waits = client(Fake(Failed(503, "busy"), Failed(None, "reset"), REPLY))
        self.assertEqual(g.ask("voice", Question("", [])), "Hello")
        self.assertEqual(waits, [2, 2])

    def test_gives_up(self):
        g, _ = client(Fake(Failed(429, "slow down\nmore"), Failed(429, "slow down"), Failed(429, "slow down")))
        with self.assertRaisesRegex(Refused, "Gemini HTTP 429: slow down"):
            g.ask("voice", Question("", []))
        g, _ = client(Fake(Failed(403, "no key")))
        with self.assertRaisesRegex(Refused, "Gemini HTTP 403"):
            g.ask("voice", Question("", []))


if __name__ == "__main__":
    unittest.main()
