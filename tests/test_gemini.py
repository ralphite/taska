"""The Gemini client without the network: what it sends, when it tries again, what it answers."""

import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "server"))

from taska.domain.vocab import Refused  # noqa: E402
from taska.infra.gemini import (DOCUMENT, EMBED_BATCH, EMBED_DIMS, EMBED_MODEL, QUERY, Failed, Gemini,  # noqa: E402
                                Question)

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
    return Gemini(key=lambda: "k", model="m", post=fake, pause=waits.append, clock=lambda: 0.0, jitter=lambda: 0.5), waits


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
        self.assertEqual(waits, [1, 2])

    def test_servers_busy_waits_longer_each_time(self):
        """B684 (Yadong: aim the retries at what happens most, its servers busy and its rates): 1, 2, 4, 8, 16 s."""
        g, waits = client(Fake(*[Failed(503, "high demand")] * 5, REPLY))
        self.assertEqual(g.ask("voice", Question("", [])), "Hello")
        self.assertEqual(waits, [1, 2, 4, 8, 16])

    def test_over_a_rate_waits_as_long_as_it_says(self):
        detail = '{"error": {"code": 429, "status": "RESOURCE_EXHAUSTED", "details": [{"retryDelay": "23s"}]}}'
        g, waits = client(Fake(Failed(429, detail), REPLY))
        self.assertEqual(g.ask("voice", Question("", [])), "Hello")
        self.assertEqual(waits, [23.5])

    def test_a_request_that_ran_out_of_time_is_not_sent_again(self):
        g, waits = client(Fake(Failed(None, "TimeoutError('The read operation timed out')"), REPLY))
        with self.assertRaisesRegex(Refused, "Gemini unreachable: TimeoutError"):
            g.ask("voice", Question("", []))
        self.assertEqual(waits, [])

    def test_gives_up(self):
        g, _ = client(Fake(Failed(429, "slow down\nmore"), *[Failed(429, "slow down")] * 5))
        with self.assertRaisesRegex(Refused, "Gemini HTTP 429: slow down"):
            g.ask("voice", Question("", []))
        g, _ = client(Fake(Failed(403, "no key")))
        with self.assertRaisesRegex(Refused, "Gemini HTTP 403"):
            g.ask("voice", Question("", []))

    def test_embeds_in_batches_and_logs_sizes_only(self):
        texts = ["secret line %d" % i for i in range(EMBED_BATCH + 20)]

        def vectors(n):
            return {"embeddings": [{"values": [0.5] * EMBED_DIMS} for _ in range(n)]}

        fake = Fake(Failed(503, "busy"), vectors(EMBED_BATCH), vectors(20))
        g, waits = client(fake)
        with self.assertLogs("taska", "INFO") as logged:
            got = g.embed("search", texts, DOCUMENT)
        self.assertEqual((len(got), waits), (len(texts), [1]))
        url, body, _ = fake.sent[1]
        self.assertTrue(url.endswith(f"/models/{EMBED_MODEL}:batchEmbedContents"))
        self.assertEqual(len(body["requests"]), EMBED_BATCH)
        self.assertEqual(body["requests"][0]["taskType"], "RETRIEVAL_DOCUMENT")
        self.assertEqual(body["requests"][0]["outputDimensionality"], EMBED_DIMS)
        self.assertEqual(len(fake.sent[2][1]["requests"]), 20)
        kept = repr([r.__dict__.get("f") for r in logged.records])
        self.assertNotIn("secret line", kept)
        self.assertIn("'texts': 20", kept)
        g, _ = client(Fake({"embeddings": []}))
        with self.assertRaisesRegex(Refused, "unexpected format"):
            g.embed("search", ["a"], QUERY)


if __name__ == "__main__":
    unittest.main()
