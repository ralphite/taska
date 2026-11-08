"""B724 (approved by Yadong: "cost doesn't matter, user experience does"; "use five models and take the first three
results"; "watch for rate limits and change strategy if it happens"): where the fast and the strong model heard a
voice note differently in a way that changes the meaning, five reviewers hear it again with both transcripts and the
project's words; the first three answers count, a reading two of them give is used, and a spot they split on is
left as a doubt. Both transcription models and the reviewers are told the project's words. A recent rate limit means
three reviewers, a little apart, logged. No model is called: the models here are fakes."""

import json
import os
import re
import sys
import threading
import time
import unittest
from collections import Counter
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.domain import voice_vote as vote  # noqa: E402
from taska.domain.voice_words import PRODUCT_WORDS  # noqa: E402
from taska.infra import gemini  # noqa: E402
from taska.services import transcribe as tr  # noqa: E402
from taska.services import voice_vote as vv  # noqa: E402

STRONG = "我们把这个改成 P1，然后 story 里也要有。"
FAST = "我们把这个改成P2然后storage里也要有"
AUDIO = {"inline_data": {"mime_type": "audio/webm", "data": ""}}
SPOT = re.compile(r'^(\d+)\. transcript 1: (".*?") \| transcript 2: (".*")$', re.M)


def answer_for(prompt, truth):
    """A reviewer's answer: for each spot, the side whose words are truth[n], else truth[n] as its own words."""
    spots = []
    for n, one, two in SPOT.findall(prompt):
        want = truth.get(int(n))
        if want is None:
            continue
        one, two = json.loads(one), json.loads(two)
        pick = "1" if one == want else "2" if two == want else "own"
        spots.append({"n": int(n), "pick": pick, **({"words": want} if pick == "own" else {})})
    return json.dumps({"spots": spots}, ensure_ascii=False)


class Reviewers:
    """Fake reviewers: the k-th one asked waits wait[k] seconds and answers truth[k] (or raises it, an exception)."""

    def __init__(self, *plan):
        self.plan, self.prompts, self.lock = list(plan), [], threading.Lock()

    def __call__(self, model, body, timeout):
        with self.lock:
            k = len(self.prompts)
            self.prompts.append(body["contents"][0]["parts"][0]["text"])
        wait, truth = self.plan[k]
        threading.Event().wait(wait)
        if isinstance(truth, Exception):
            raise truth
        return {"candidates": [{"content": {"parts": [{"text": answer_for(self.prompts[k], truth)}]}}]}

    def asked(self, n, within=2.0):
        end = time.time() + within
        while len(self.prompts) < n and time.time() < end:
            threading.Event().wait(0.01)
        return len(self.prompts)


class Disputes(unittest.TestCase):
    def test_what_does_not_change_the_meaning_is_no_disagreement(self):
        same = [("嗯那个导出的时候呢保留我设的那个那个筛选，然后列表也要记住。", "嗯那个导出的时候呢保留我设的那个筛选然后列表也要记住"),  # fillers, a stutter, punctuation
                ("看一下 B722 和 DevTools", "看一下B七二二和dev tools"),  # a number in Chinese, spaces and case
                ("把 forms approve 一下", "把form approved一下"),  # English word forms
                ("改三个地方", "改3个地方"), ("就是这个按钮要大一点", "这个按钮要大一点"), ("他说的对", "她说得对"),
                ("我们 merge 一下", "我们莫奇一下")]  # English kept where the speech model wrote it in Chinese
        for a, b in same:
            self.assertEqual(vote.disputes(a, b), [], (a, b))

    def test_what_changes_the_meaning_is(self):
        got = [(x.was, x.alt, x.why) for x in vote.disputes(STRONG, FAST)]
        self.assertEqual(got, [("P1", "P2", "number"), ("story", "storage", "english")])
        self.assertEqual([(x.was, x.alt, x.why) for x in vote.disputes("Taska 的界面", "task 啊界面")], [("Taska", "task", "english")])
        self.assertEqual([x.why for x in vote.disputes("这个不要上线。", "这个要上线")], ["negation"])


class Settle(unittest.TestCase):
    def settle(self, reviewers, strong=STRONG, fast=FAST):
        steps = []
        with mock.patch.object(vv, "ask_reviewer", reviewers), mock.patch.object(vv, "recent_limits", lambda models: 0):
            words, doubts = vv.settle(steps, AUDIO, strong, fast, "The product's words: Taska, story", ["pro-model"])
        return words, doubts, steps

    def test_no_disagreement_no_vote(self):
        r = Reviewers()
        words, doubts, steps = self.settle(r, "导出的时候，保留筛选。", "导出的时候呢保留筛选")
        self.assertEqual((words, doubts, steps, r.prompts), ("导出的时候，保留筛选。", [], [], []))

    def test_five_asked_the_first_three_count_two_agreeing_win_a_split_is_a_doubt(self):
        r = Reviewers((0.0, {1: "P2", 2: "story"}), (0.05, {1: "P2", 2: "storage"}), (0.1, {1: "P1", 2: "stories"}),
                      (0.6, {1: "P1", 2: "story"}), (0.6, {1: "P1", 2: "story"}))
        words, doubts, steps = self.settle(r)
        self.assertEqual(r.asked(5), 5)
        self.assertEqual(words, "我们把这个改成 P2，然后 story 里也要有。")  # P2: two of three; story: split, kept
        self.assertEqual(len(doubts), 1)
        self.assertEqual((doubts[0]["was"], doubts[0]["why"]), ("story", "english"))
        self.assertIn(doubts[0]["alt"], ("storage", "stories"))
        self.assertEqual(sorted(doubts[0]["alts"]), ["storage", "stories"])
        step = steps[0]
        self.assertEqual((step["step"], step["model"], step["text"], step["chosen"]), ("vote", "pro-model × 5", words, True))
        self.assertEqual(sum(1 for x in step["reviewers"] if x.get("used")), 3)
        self.assertEqual([x.get("error") for x in step["reviewers"] if not x.get("used")], ["not needed: three answered first"] * 2)
        self.assertEqual([x["picks"][-1] for x in step["spots"]], ["result: B", "result: doubt"])
        self.assertEqual(sum(1 for x in step["reviewers"] if x.get("swap")), 2)  # some see the fast words first
        self.assertIn("⟦1⟧P1⟦/1⟧", r.prompts[0] + r.prompts[1])

    def test_only_two_in_time_their_agreement_counts_else_the_strong_words_and_a_doubt(self):
        r = Reviewers((0.0, {1: "P2", 2: "story"}), (0.0, {1: "P2", 2: "storage"}),
                      (1.5, {1: "P1", 2: "story"}), (1.5, {}), (1.5, {}))
        with mock.patch.object(vv, "VOTE_WAIT", 0.4):
            words, doubts, steps = self.settle(r)
        self.assertEqual(words, "我们把这个改成 P2，然后 story 里也要有。")
        self.assertEqual([(d["was"], d["alt"]) for d in doubts], [("story", "storage")])
        self.assertEqual([x.get("error") for x in steps[0]["reviewers"] if not x.get("used")], ["no answer within 0 s"] * 3)

    def test_none_answered_the_strong_words_and_every_spot_a_doubt(self):
        boom = gemini.Refused("Gemini HTTP 503: busy")
        r = Reviewers(*[(0.0, boom)] * 5)
        words, doubts, steps = self.settle(r)
        self.assertEqual(words, STRONG)
        self.assertEqual([(d["was"], d["alt"]) for d in doubts], [("P1", "P2"), ("story", "storage")])
        self.assertIn("no reviewer answered", steps[0]["error"])
        self.assertNotIn("chosen", steps[0])


class RateLimits(unittest.TestCase):
    def setUp(self):
        self.calls, self.lock = [], threading.Lock()
        self.patches = [mock.patch.object(gemini.client, "post", self.post), mock.patch.object(gemini.client, "pause", lambda s: None),
                        mock.patch.object(gemini.client, "limited", []), mock.patch.object(vv, "STAGGER", 0.05)]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()

    def post(self, url, data, headers, timeout):
        with self.lock:
            self.calls.append(time.time())
            k = len(self.calls)
        if k == 1:
            raise gemini.Failed(429, '{"error": {"status": "RESOURCE_EXHAUSTED", "message": "quota"}}')
        prompt = json.loads(data)["contents"][0]["parts"][0]["text"]
        return {"candidates": [{"content": {"parts": [{"text": answer_for(prompt, {1: "P2", 2: "story"})}]}}]}

    def test_a_rate_limit_means_three_reviewers_a_little_apart_and_it_is_logged(self):
        steps = []
        vv.settle(steps, AUDIO, STRONG, FAST, "", ["pro-model"])
        self.assertEqual(gemini.client.limits(600, ["pro-model"]), 1)  # remembered by the client
        self.assertNotIn("limited", steps[0])
        before = len(self.calls)
        with self.assertLogs("taska", "WARNING") as logs:
            words, doubts = vv.settle(steps, AUDIO, STRONG, FAST, "", ["pro-model"])
        self.assertTrue(any("1 rate limits in the last 10 min: 3 reviewers instead of 5" in m for m in logs.output), logs.output)
        self.assertEqual(steps[1]["limited"], {"recent": 1, "within": 600.0, "reviewers": 3, "apart": 0.05})
        self.assertEqual(steps[1]["model"], "pro-model × 3")
        end = time.time() + 2
        while len(self.calls) < before + 3 and time.time() < end:
            threading.Event().wait(0.01)
        self.assertEqual(len(self.calls), before + 3)
        later = sorted(self.calls[before:])
        self.assertGreaterEqual(later[2] - later[0], 0.09)  # started 0.05 s apart
        self.assertEqual((words, doubts), ("我们把这个改成 P2，然后 story 里也要有。", []))

    def test_other_models_limits_do_not_count(self):
        gemini.client.limited.append((gemini.client.clock(), "another-model"))
        self.assertEqual(vv.recent_limits(["pro-model"]), 0)


class Glossary(unittest.TestCase):
    def test_the_projects_words_go_to_both_models_and_the_reviewers(self):
        prompts, vocabs = [], []
        r = Reviewers(*[(0.0, {1: "P2", 2: "story"})] * 5)
        fixes = [{"wrong": "task 啊", "right": "Taska"}, {"right": "Nota"}]
        h = tr.Hearing(context=lambda scope: (Counter({"VoiceSteps": 3}), ["B724 Make the voice words right"], ["Make the voice words right"]),
                       fixes=lambda: fixes, prefs=lambda: "", tidy=lambda: True)
        tidied = []

        def main(audio, prompt, model=None):
            prompts.append(prompt)
            return STRONG

        def asr(audio, vocab):
            vocabs.append(vocab)
            return FAST

        def tidy(*a, **k):
            tidied.append(a[2][0]["text"])
            return a[2][0]["text"]
        with mock.patch.object(tr.tools, "processed_silence", lambda path, mime: 0.0), mock.patch.object(tr.tools, "duration", lambda path: 0.0), \
                mock.patch.object(tr, "voice_main", main), mock.patch.object(tr, "voice_asr", asr), mock.patch.object(tr, "ask", tidy), \
                mock.patch.object(vv, "ask_reviewer", r), mock.patch.object(vv, "recent_limits", lambda models: 0):
            out = tr.transcribe(h, b"audio", "audio/webm", None)
        for text in (prompts[0], r.prompts[0]):
            for word in ("B724 Make the voice words right", "Taska (not task 啊)", "Storybook", "VoiceSteps"):
                self.assertIn(word, text)
        self.assertIn("Nota", r.prompts[0])
        self.assertTrue(set(PRODUCT_WORDS) <= set(vocabs[0]))
        self.assertTrue({"B724", "Taska", "Nota", "VoiceSteps"} <= set(vocabs[0]))
        self.assertLessEqual(len(vocabs[0]), 100)
        self.assertEqual([s["step"] for s in out["steps"]], ["pro", "asr", "vote", "tidy"])
        self.assertTrue(out["steps"][2]["chosen"])
        self.assertEqual(tidied[0], "我们把这个改成 P2，然后 story 里也要有。")  # tidying starts from the voted words
        self.assertEqual((out["doubts"], out["tr_by"]), ([], "pro"))


if __name__ == "__main__":
    unittest.main()
