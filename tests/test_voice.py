"""Voice notes (T101): the two transcriptions, Traditional to Simplified, the spelling hints, what may be misheard,
transcripts kept next to the audio, inputs that go in once, and a stop that finishes the work at hand.
Gemini is replaced by a fake here; scripts/transcribe_check.py runs the real thing on real recordings.
Chinese is written escaped (R66)."""
import importlib.util
import json
import socket
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from collections import Counter
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('taska', Path(__file__).resolve().parents[1] / 'taska.py')
taska = importlib.util.module_from_spec(spec)
spec.loader.exec_module(taska)

DONE = '\u5b8c\u6210'                  # done
NOT_DONE = '\u6ca1\u6709' + DONE      # not done
AS_DONE = '\u4e3a' + DONE             # "as done": what was heard instead
MERGE_ZH = '\u5408\u5e76'             # merge, in Chinese
TRAD = '\u8a2d\u8a08\u898f\u7bc4'     # design rules, Traditional
SIMP = '\u8bbe\u8ba1\u89c4\u8303'     # the same, Simplified


def reply(text=None, block=None, asr=False):
    """A generateContent reply: text (JSON-wrapped for the main model), nothing (no speech), or a refusal."""
    if block:
        return {'promptFeedback': {'blockReason': block}}
    if text is None:
        return {'candidates': [{'finishReason': 'STOP'}]}
    part = {'audioTranscription': {'text': text}} if asr else {'text': text}
    return {'candidates': [{'content': {'parts': [part]}, 'finishReason': 'STOP'}]}


class FakeGemini:
    """Answers by model: main -> self.main (a list, one per call), speech model -> self.asr, text-only -> self.t2s."""

    def __init__(self, main, asr, t2s=None):
        self.main, self.asr, self.t2s, self.calls = list(main), asr, t2s, []

    def __call__(self, model, body, timeout=120):
        self.calls.append((model, body))
        if model == taska.ASR_MODEL:
            if isinstance(self.asr, Exception):
                raise self.asr
            return reply(self.asr, asr=True)
        parts = body['contents'][0]['parts']
        if not any('inline_data' in p for p in parts):  # the Traditional -> Simplified request
            return reply(json.dumps({'text': self.t2s}))
        r = self.main.pop(0)
        if isinstance(r, Exception):
            raise r
        return r if isinstance(r, dict) else reply(json.dumps({'transcript': r}))


class StoreCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.s = taska.Store(str(Path(self.tmp.name) / 'taska.jsonl'))
        self.s.name = 'qa'
        lines, _ = self.s.run_all([(0, {'op': 'new', 'title': 'DevTools export', 'body': 'see https://docs.example.com/d/1AbCdEfGhIjKlMnOpQ and r119'})], 'you')
        self.assertTrue(lines[0].startswith('ok'), lines)

    def tearDown(self):
        self.s.out.close()
        self.tmp.cleanup()

    def fake(self, main, asr, t2s=None):
        f = FakeGemini(main, asr, t2s)
        return f, patch.object(taska, 'gemini_call', f)


class TranscribeTests(StoreCase):
    def test_speech_model_hearing_nobody_wins(self):  # B092: the main model makes words up from silence
        f, p = self.fake(['DevTools export'], None)
        with p:
            out = taska.transcribe(self.s, b'x', 'audio/webm', None)
        self.assertEqual(out['tr'], '')

    def test_refused_twice_falls_back_to_speech_model(self):
        f, p = self.fake([reply(block='OTHER'), reply(block='OTHER')], 'Taska P0')
        with p:
            out = taska.transcribe(self.s, b'x', 'audio/webm', None)
        self.assertEqual((out['tr'], out['tr_by']), ('Taska P0', 'asr'))
        self.assertEqual(sum(1 for m, _ in f.calls if m == taska.VOICE_MODEL), 2)  # asked once more first
        self.assertIn('refused', out['main_error'])

    def test_refused_once_then_answered(self):
        f, p = self.fake([reply(block='OTHER'), 'mark it ' + NOT_DONE], 'mark it ' + NOT_DONE)
        with p:
            out = taska.transcribe(self.s, b'x', 'audio/webm', None)
        self.assertEqual((out['tr'], out['tr_by'], out['doubts']), ('mark it ' + NOT_DONE, 'main', []))

    def test_main_failing_or_empty_uses_speech_model(self):
        for main in (taska.Err('Gemini HTTP 500'), '', reply('not json')):
            f, p = self.fake([main], 'hello Taska')
            with p:
                out = taska.transcribe(self.s, b'x', 'audio/webm', None)
            self.assertEqual(out['tr'], 'hello Taska', main)

    def test_a_transcript_that_stopped_early(self):  # two iPhone notes kept only their first half-sentence
        full = 'one two three four five six seven eight nine ten eleven twelve'
        f, p = self.fake(['one two three', full], full)  # asked once more, it is whole
        with p:
            out = taska.transcribe(self.s, b'x', 'audio/mp4', None)
        self.assertEqual((out['tr'], out['tr_by']), (full, 'main'))
        f, p = self.fake(['one two three', 'one two three four'], full)  # still short: the speech model's words
        with p:
            out = taska.transcribe(self.s, b'x', 'audio/mp4', None)
        self.assertEqual((out['tr'], out['tr_by']), (full, 'asr'))
        self.assertIn('stopped early', out['main_error'])

    def test_both_failing_is_an_error(self):
        f, p = self.fake([taska.Err('Gemini HTTP 500')], taska.Err('Gemini unreachable'))
        with p, self.assertRaises(taska.Err):
            taska.transcribe(self.s, b'x', 'audio/webm', None)

    def test_traditional_made_simplified_with_one_text_request(self):
        f, p = self.fake([TRAD + ' tooltip'], SIMP + ' tooltip', t2s=SIMP + ' tooltip')
        with p:
            out = taska.transcribe(self.s, b'x', 'audio/webm', None)
        self.assertEqual(out['tr'], SIMP + ' tooltip')
        self.assertEqual(len(f.calls), 3)

    def test_a_conversion_that_changes_more_is_not_used(self):
        f, p = self.fake([TRAD + ' tooltip'], SIMP + ' tooltip', t2s=SIMP + ' popover')
        with p:
            out = taska.transcribe(self.s, b'x', 'audio/webm', None)
        self.assertEqual(out['tr'], TRAD + ' tooltip')

    def test_disagreement_is_flagged(self):
        f, p = self.fake(['mark it ' + AS_DONE], 'mark it ' + NOT_DONE)
        with p:
            out = taska.transcribe(self.s, b'x', 'audio/webm', None)
        self.assertEqual(out['doubts'], [{'was': AS_DONE, 'alt': NOT_DONE, 'why': 'negation'}])

    def test_corrections_are_hints_and_replace_after(self):
        hub = type('H', (), {'corrections': lambda self: [{'wrong': 'Get Hub', 'right': 'GitHub'}]})()
        f, p = self.fake(['like Get Hub'], 'like Get Hub')
        with p, patch.object(taska, 'HUB', hub):
            out = taska.transcribe(self.s, b'x', 'audio/webm', None)
        self.assertEqual(out['tr'], 'like GitHub')
        prompt = next(b for m, b in f.calls if m == taska.VOICE_MODEL)['contents'][0]['parts'][0]['text']
        self.assertIn('GitHub (not Get Hub)', prompt)
        self.assertIn('Spelling hints, only for words you actually hear: GitHub, Taska, DevTools, export\n', prompt)  # no URL, id or r119
        self.assertIn('Open items, only to recognize names and codes (do not copy them): I1 DevTools export', prompt)
        asr = next(b for m, b in f.calls if m == taska.ASR_MODEL)['generationConfig']['audioTranscriptionConfig']
        self.assertEqual(asr['customVocabulary'][:6], ['Taska', 'P0', 'P1', 'P2', 'P3', 'GitHub'])


class HintTests(unittest.TestCase):
    def test_terms_are_cleaned(self):
        words = Counter('agent agent agent DevTools SDK https docs.google.com/d/1AbCdEfGhIjKlMnOpQ r119 src localhost '
                        'Screenshot_2026-10-12.png and for must new Taska PROJECT_BRIEF.md test_export pytest B073 Codex'.split())
        terms = taska.voice_terms(words, [{'wrong': 'pie test', 'right': 'pytest'}])
        self.assertEqual(terms, ['pytest', 'Taska', 'DevTools', 'SDK', 'test_export', 'Codex', 'agent'])

    def test_traditional_characters(self):
        self.assertEqual(taska.traditional(TRAD + SIMP + 'abc'), list(TRAD))
        self.assertEqual(taska.traditional('\u55ef\u5443 ok'), [])  # um, uh: Simplified


class DoubtTests(unittest.TestCase):
    def test_what_is_flagged_and_what_is_not(self):
        d = taska.voice_doubts
        self.assertEqual(d('like ABC here', 'like ABD here'), [{'was': 'ABC', 'alt': 'ABD', 'why': 'english'}])
        self.assertEqual(d('we merge it', 'we ' + MERGE_ZH + ' it'), [])  # the speech model put English in Chinese
        self.assertEqual(d('P0 now', '\u4e03\u96f6 now'), [])
        self.assertEqual(d('\u4e09 items', '3 items'), [])  # one number written two ways
        self.assertEqual(d('the forms', 'the form'), [])
        self.assertEqual(d('DevTools', 'Dev Tools'), [])
        self.assertEqual(d('\u4e03\u96f6 now', 'P0 now'), [{'was': '\u4e03\u96f6 now', 'alt': 'P0 now', 'why': 'english', 'show': ['\u4e03\u96f6', 'P0']}])

    def test_unsure_marks(self):
        d = taska.voice_doubts('say Dev Toes(?) ok', 'say DevTools ok')
        self.assertEqual(d, [{'was': 'Dev Toes(?)', 'alt': 'DevTools', 'why': 'english', 'unsure': True}])
        d = taska.voice_doubts('say Toes(?) ok', 'say Toes ok')
        self.assertEqual(d, [{'was': 'Toes(?)', 'alt': '', 'why': 'unsure', 'unsure': True}])

    def test_the_same_words_twice_make_one_line(self):  # each place occurs once in the transcript, so each can be swapped
        tr = 'a search fox, then the search fox'
        d = taska.voice_doubts(tr, 'a search box, then the search box')
        self.assertEqual(d, [{'was': 'a search fox', 'alt': 'a search box', 'why': 'english', 'show': ['fox', 'box'],  # shown: the words alone
                              'also': [{'was': 'the search fox', 'alt': 'the search box'}]}])
        self.assertEqual(tr.count('a search fox') + tr.count('the search fox'), 2)

    def test_stutters_questions_and_variants_are_no_doubt(self):
        d = taska.voice_doubts
        self.assertEqual(d('\u6ca1\u6ca1\u6709 time', '\u6ca1\u6709 time'), [])  # "not not have": a stutter
        self.assertEqual(d('\u4f60\u80fd\u4e0d\u80fd\u505a', '\u4f60\u80fd\u505a'), [])  # "can or cannot": a question
        self.assertEqual(d('a dialogue box', 'a dialog box'), [])
        self.assertEqual(d('agent lamp ok', 'agent lab ok'), [{'was': 'lamp', 'alt': 'lab', 'why': 'english'}])


if __name__ == '__main__':
    unittest.main(verbosity=2)
