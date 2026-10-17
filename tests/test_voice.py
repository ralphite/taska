"""Voice notes (T101): the two transcriptions, a phone's processed notes heard by the strong model too, Traditional to
Simplified, the spelling hints, what may be misheard, transcripts kept next to the audio, inputs that go in once, and a
stop that finishes the work at hand. Words sent for later (B165) are tested in test_voice_words.py.
Gemini is replaced by a fake here; scripts/transcribe_check.py runs the real thing on real recordings.
Chinese is written escaped (R66)."""
import array
import importlib.util
import json
import math
import os
import shutil
import socket
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
import wave
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
    """Answers by model: main -> self.main (a list, one per call), speech model -> self.asr, text-only -> self.t2s,
    the strong model -> self.pro (a list, one per call)."""

    def __init__(self, main, asr, t2s=None, pro=()):
        self.main, self.asr, self.t2s, self.pro, self.calls = list(main), asr, t2s, list(pro), []

    def __call__(self, model, body, timeout=120):
        self.calls.append((model, body))
        if model == taska.ASR_MODEL:
            if isinstance(self.asr, Exception):
                raise self.asr
            return reply(self.asr, asr=True)
        parts = body['contents'][0]['parts']
        if not any('inline_data' in p for p in parts):  # the Traditional -> Simplified request
            return reply(json.dumps({'text': self.t2s}))
        r = (self.pro if model == taska.PRO_MODEL else self.main).pop(0)
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

    def fake(self, main, asr, t2s=None, pro=()):
        f = FakeGemini(main, asr, t2s, pro)
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

    def test_a_slow_strong_model_is_not_waited_for(self):  # it once took 250 s on a phone note: capped, the others' words go on
        full = 'one two three four five six seven eight nine ten eleven twelve'
        f, p = self.fake([full], full)
        slow = lambda model, body, timeout=120: (time.sleep(3), {})[1] if model == taska.PRO_MODEL else f(model, body, timeout)
        with patch.object(taska, 'voice_gated', lambda path, mime: 1.8), patch.object(taska, 'gemini_call', slow), \
                patch.object(taska, 'PRO_CAP', 0.5), patch.object(taska, 'VOICE_BUDGET', 2):
            t0 = time.time()
            out = taska.transcribe(self.s, b'x', 'audio/mp4', None, path='voice.m4a')
        self.assertLess(time.time() - t0, 2)
        self.assertEqual((out['tr'], out['tr_by'], out['pro_error']), (full, 'main', 'the strong model timed out after 0 s'))
        self.assertEqual(set(out['times']), {'main', 'asr', 'pro', 'total'})
        self.assertGreaterEqual(out['times']['pro'], 0.5)
        f, p = self.fake([], full)  # the main model hangs too: the speech model's words, within the budget
        hang = lambda model, body, timeout=120: f(model, body, timeout) if model == taska.ASR_MODEL else (time.sleep(3), {})[1]
        with patch.object(taska, 'voice_gated', lambda path, mime: 1.8), patch.object(taska, 'gemini_call', hang), \
                patch.object(taska, 'PRO_CAP', 0.5), patch.object(taska, 'VOICE_CAP', 0.8):
            t0 = time.time()
            out = taska.transcribe(self.s, b'x', 'audio/mp4', None, path='voice.m4a')
        self.assertLess(time.time() - t0, 2)
        self.assertEqual((out['tr'], out['tr_by']), (full, 'asr'))
        self.assertIn('timed out', out['main_error'])

    def test_the_strong_model_past_its_cap_sends_fuller_words_later(self):
        short = 'one two three four five six seven eight nine ten'
        full = short + ' eleven twelve thirteen fourteen'
        for pro, want in ((full, full), (short + ' eleven', None)):  # clearly more words: they follow; about as many: no
            f, p = self.fake([short], short)
            slow = lambda model, body, timeout=120: (time.sleep(0.8), reply(json.dumps({'transcript': pro})))[1] if model == taska.PRO_MODEL else f(model, body, timeout)
            got = threading.Event()
            box = {}
            with patch.object(taska, 'voice_gated', lambda path, mime: 1.8), patch.object(taska, 'gemini_call', slow), \
                    patch.object(taska, 'PRO_CAP', 0.3), patch.object(taska, 'PRO_LATE', 5):
                out = taska.transcribe(self.s, b'x', 'audio/mp4', None, path='voice.m4a', later=lambda w: (box.update(w=w), got.set()))
                self.assertEqual((out['tr'], out['more']), (short, True))
                self.assertTrue(got.wait(5))
            self.assertEqual(box['w'], want)

    def test_a_phone_note_with_its_pauses_cut_to_silence(self):  # both models stopped early on such iPhone notes
        full = 'one two three four five six seven eight nine ten eleven twelve'
        with patch.object(taska, 'voice_gated', lambda path, mime: 1.8):
            f, p = self.fake(['one two three'], 'one two three four', pro=[full])
            with p:
                out = taska.transcribe(self.s, b'x', 'audio/mp4', None, path='voice.m4a')
            self.assertEqual((out['tr'], out['tr_by'], out['gated'], out['doubts']), (full, 'pro', True, []))
            f, p = self.fake(['one two three'], full, pro=[full + ' thirteen'])  # stopped early: not asked again, the strong one heard it
            with p:
                out = taska.transcribe(self.s, b'x', 'audio/mp4', None, path='voice.m4a')
            self.assertEqual((out['tr'], out['tr_by']), (full + ' thirteen', 'pro'))
            self.assertEqual([m for m, _ in f.calls].count(taska.VOICE_MODEL), 1)
            f, p = self.fake([full], full, pro=['one two'])  # the strong one heard less: the main one's words
            with p:
                out = taska.transcribe(self.s, b'x', 'audio/mp4', None, path='voice.m4a')
            self.assertEqual((out['tr'], out['tr_by']), (full, 'main'))
            f, p = self.fake([full], full, pro=[taska.Err('Gemini HTTP 503'), taska.Err('Gemini HTTP 503')])
            with p:
                out = taska.transcribe(self.s, b'x', 'audio/mp4', None, path='voice.m4a')
            self.assertEqual((out['tr'], out['tr_by']), (full, 'main'))
            self.assertIn('503', out['pro_error'])
            f, p = self.fake(['DevTools export'], None, pro=['DevTools export'])  # nobody spoke (B092)
            with p:
                out = taska.transcribe(self.s, b'x', 'audio/mp4', None, path='voice.m4a')
            self.assertEqual(out['tr'], '')
            f, p = self.fake([taska.Err('down')], taska.Err('down'), pro=['only the strong one'])
            with p:
                out = taska.transcribe(self.s, b'x', 'audio/mp4', None, path='voice.m4a')
            self.assertEqual((out['tr'], out['tr_by']), ('only the strong one', 'pro'))
        f, p = self.fake([full], full)  # any other note: two models, not three
        with p:
            taska.transcribe(self.s, b'x', 'audio/webm', None, path='voice.webm')
        self.assertNotIn(taska.PRO_MODEL, [m for m, _ in f.calls])

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


@unittest.skipUnless(shutil.which('afconvert'), 'needs macOS afconvert')
class GatedTests(unittest.TestCase):
    """A phone's voice processing cuts the pauses inside speech to exact digital silence; a computer's leaves noise."""

    def note(self, gap):
        tmp = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
        tmp.close()
        self.addCleanup(os.unlink, tmp.name)
        tone = [int(6000 * math.sin(i / 3)) for i in range(16000)]
        with wave.open(tmp.name, 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(16000)
            w.writeframes(array.array('h', tone + gap + tone).tobytes())
        return tmp.name

    def test_exact_silence_inside_speech(self):
        self.assertAlmostEqual(taska.voice_gated(self.note([0] * 16000), 'audio/wav'), 1.0, delta=0.1)
        self.assertEqual(taska.voice_gated(self.note([(i * 7919) % 5 - 2 for i in range(16000)]), 'audio/wav'), 0.0)  # a quiet room
        self.assertEqual(taska.voice_gated(self.note([0] * 16000), 'audio/webm'), 0.0)  # not one macOS decodes: not looked at
        self.assertEqual(taska.voice_gated('/nonexistent.m4a', 'audio/mp4'), 0.0)


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


class KeptTranscriptTests(StoreCase):
    def wait(self, fid):
        for _ in range(300):
            if self.s.trs[fid]['done']:
                return self.s.trs[fid]
            time.sleep(0.01)
        self.fail('the transcription never finished')

    def test_kept_next_to_the_audio_and_used_after_a_restart(self):
        f = self.s.save_file('voice 0-03.webm', 'audio/webm', b'audio')
        fake, p = self.fake(['hello'], 'hello')
        with p:
            self.s.transcribe_later(f['f'], b'audio', 'audio/webm', None)
            self.assertEqual(self.wait(f['f'])['tr'], 'hello')
        self.assertEqual(len(fake.calls), 2)  # both models, once
        self.assertTrue(Path(self.s.local(f['f']) + '.tr.json').is_file())
        again = taska.Store(self.s.path)  # Taska restarted: the page asks again
        fake2, p2 = self.fake([], None)
        with p2:
            again.transcribe_later(f['f'], b'audio', 'audio/webm', None)
        self.assertEqual((again.trs[f['f']]['done'], again.trs[f['f']]['tr'], fake2.calls), (True, 'hello', []))
        again.out.close()

    def test_failures_are_not_kept(self):
        f = self.s.save_file('voice 0-03.webm', 'audio/webm', b'audio')
        fake, p = self.fake([taska.Err('down')], taska.Err('down'))
        with p:
            self.s.transcribe_later(f['f'], b'audio', 'audio/webm', None)
            self.assertIn('down', self.wait(f['f'])['err'])
        self.assertFalse(Path(self.s.local(f['f']) + '.tr.json').exists())

    def test_an_input_sent_twice_goes_in_once(self):
        op = {'op': 'input', 'text': 'hello', 'q': 'abc123'}
        a, _ = self.s.run_all([(0, op)], 'you')
        b, _ = self.s.run_all([(0, op)], 'you')
        self.assertEqual(a, b)
        self.assertEqual(sum(1 for i in self.s.inputs.values() if i['text'] == 'hello'), 1)
        replay = taska.Store(self.s.path)
        self.assertEqual(replay.qids, {'abc123': a[0].split()[1]})
        replay.out.close()


def free_port():
    with socket.socket() as so:
        so.bind(('127.0.0.1', 0))
        return so.getsockname()[1]


class ServerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.hub = patch.object(taska, 'HUB', taska.Hub(self.tmp.name, False))
        self.hub.start()
        self.port = free_port()
        self.srv = taska.Server(('127.0.0.1', self.port), taska.Handler)
        self.t = threading.Thread(target=self.srv.serve_forever, daemon=True)
        self.t.start()
        self.base = f'http://127.0.0.1:{self.port}/p/default/'

    def tearDown(self):
        self.srv.shutdown()
        self.srv.server_close()
        self.hub.stop()
        self.tmp.cleanup()

    def call(self, path, data=None, ctype='application/octet-stream'):
        req = urllib.request.Request(self.base + path, data=data, headers={'Content-Type': ctype}, method='POST' if data is not None else 'GET')
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return r.status, json.load(r)
        except urllib.error.HTTPError as ex:
            return ex.code, json.load(ex)

    def test_an_agent_reading_an_item_is_kept(self):  # F220: "Read by" under your words, with no answer yet
        get = lambda path: urllib.request.urlopen(self.base + path, timeout=20).read().decode()
        self.call('api/op', json.dumps({'op': 'new', 'title': 'Dark mode', 'type': 'feature'}).encode(), 'application/json')
        self.call('api/op', json.dumps({'op': 'input', 'text': 'Follow the system', 'scope': 'F1'}).encode(), 'application/json')
        read = lambda: next(i for i in json.loads(get('api/state'))['items'] if i['n'] == 1).get('read', {})
        get('F1?ui=1')  # the page itself is no agent
        self.assertEqual(read(), {})
        get('F1?by=codex')
        self.assertEqual(set(read()), {'codex'})
        self.call('api/op', json.dumps({'op': 'cfg', 'auto': True}).encode(), 'application/json')
        self.call('api/op', json.dumps({'op': 'ack', 'ids': ['r1']}).encode(), 'application/json')
        self.assertIn('F1', get('next?by=claude-code'))  # /next gave it: read too
        self.assertEqual(set(read()), {'codex', 'claude-code'})
        hub = taska.Hub(self.tmp.name, False)  # kept on disk
        self.assertEqual(set(hub.projects['default'].reads[1]), {'codex', 'claude-code'})

    def test_transcription_preferences_for_every_project(self):  # F183
        def prefs(text=None):
            req = urllib.request.Request(f'http://127.0.0.1:{self.port}/api/voiceprefs', method='GET' if text is None else 'POST',
                                         data=None if text is None else json.dumps({'text': text}).encode(), headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=20) as r:
                return json.load(r)
        self.assertEqual(prefs(), {'text': taska.VOICE_PREFS, 'default': True})
        self.assertEqual(prefs('Write numbers as digits.\nKeep English as spoken.  ')['text'], 'Write numbers as digits.\nKeep English as spoken.')
        self.assertEqual(taska.Hub(self.tmp.name, False).voice_prefs()['text'], 'Write numbers as digits.\nKeep English as spoken.')  # kept on disk
        fake = FakeGemini(['hello Taska'], 'hello Taska')
        with patch.object(taska, 'gemini_call', fake):
            code, f = self.call('api/file?name=voice.webm&transcribe=1', b'audio', 'audio/webm')
            self.call(f'api/transcript?f={f["f"]}', b'')
        prompt = next(b for m, b in fake.calls if m == taska.VOICE_MODEL)['contents'][0]['parts'][0]['text']
        self.assertIn("preferences for the transcript (follow them, but never add words nobody said):\nWrite numbers as digits.", prompt)
        self.assertEqual(prefs(''), {'ok': True, 'text': taska.VOICE_PREFS, 'default': True})  # empty: the default again

    def test_upload_then_words_then_again_by_file_id(self):
        fake = FakeGemini(['hello Taska'], 'hello Taska')
        with patch.object(taska, 'gemini_call', fake):
            code, f = self.call('api/file?name=voice.webm&transcribe=1', b'audio', 'audio/webm')
            self.assertEqual((code, f['pending']), (200, True))  # B165: the answer comes at once
            code, d = self.call(f'api/transcript?f={f["f"]}', b'')  # waits for the words
        self.assertEqual((code, d['done'], d['tr'], d['tr_by']), (200, True, 'hello Taska', 'main'))
        code, d = self.call(f'api/transcript?f={f["f"]}')  # again, by file id, without waiting
        self.assertEqual((code, d['tr']), (200, 'hello Taska'))
        self.assertEqual(self.call('api/transcript?f=f99-nothing.webm')[0], 404)

    def test_a_failed_one_is_tried_again_when_asked(self):
        with patch.object(taska, 'gemini_call', FakeGemini([taska.Err('down')], taska.Err('down'))):
            code, f = self.call('api/file?name=voice.webm&transcribe=1', b'audio', 'audio/webm')
            code, d = self.call(f'api/transcript?f={f["f"]}', b'')
        self.assertIn('down', d['tr_error'])
        with patch.object(taska, 'gemini_call', FakeGemini(['second try'], 'second try')):
            code, d = self.call(f'api/transcript?f={f["f"]}&again=1', b'')
        self.assertEqual((d['tr'], d['tr_error']), ('second try', ''))

    def test_a_stop_finishes_the_transcription_at_hand(self):
        def slow(*a, **k):
            time.sleep(1.5)
            return {'tr': 'finished', 'tr_by': 'main', 'alt': 'finished', 'doubts': []}
        with patch.object(taska, 'transcribe', slow):
            code, f = self.call('api/file?name=voice.webm&transcribe=1', b'audio', 'audio/webm')
            time.sleep(0.3)
            self.srv.shutdown()  # what SIGTERM does
            t0 = time.time()
            self.srv.drain(10)
        self.assertGreater(time.time() - t0, 0.5)  # it waited for the transcription running in the background
        self.assertEqual(taska.HUB.projects['default'].trs[f['f']]['tr'], 'finished')
        self.assertTrue(Path(taska.HUB.projects['default'].local(f['f']) + '.tr.json').is_file())
        with self.assertRaises(OSError):  # and takes no new requests
            urllib.request.urlopen(self.base + 'agent', timeout=2)


if __name__ == '__main__':
    unittest.main(verbosity=2)
