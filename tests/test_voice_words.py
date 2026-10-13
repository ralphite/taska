"""B165: a voice note's words never hold up the box. You can send before they are in: the message goes at once with
its recording, the words are added to it when they come, and agents and the organizer get it with its words."""
import importlib.util
import json
import socket
import tempfile
import threading
import time
import unittest
import urllib.request
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('taska', Path(__file__).resolve().parents[1] / 'taska.py')
taska = importlib.util.module_from_spec(spec)
spec.loader.exec_module(taska)

WORDS = 'Follow the system setting, please.'


class VoiceWordsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / 'taska.jsonl'
        self.s = taska.Store(str(self.path))
        self.s.name = 'qa'
        self.op({'op': 'new', 'title': 'Dark mode', 'type': 'feature'})
        self.go = threading.Event()  # the stand-in for Gemini answers when this is set
        self.answer = WORDS
        patcher = patch.object(taska, 'transcribe', side_effect=lambda *a, **k: self.go.wait(5) and {'tr': self.answer, 'tr_by': 'main'})
        patcher.start()
        self.addCleanup(patcher.stop)

    def tearDown(self):
        self.s.out.close()
        self.tmp.cleanup()

    def op(self, op, by='you'):
        lines, _ = self.s.run_all([(0, op)], by)
        self.assertTrue(lines[0].startswith('ok'), lines)
        return lines[0].split()[1]

    def voice(self):
        f = self.s.save_file('voice 0-04.webm', 'audio/webm', b'\x1aE\xdf\xa3' + b'\0' * 100)
        self.s.transcribe_later(f['f'], b'audio', 'audio/webm', 1)
        return f

    def finish(self):
        self.go.set()
        for _ in range(200):
            if all(j['done'] for j in self.s.trs.values()):
                time.sleep(0.05)  # the job emits under the lock right after it is done
                return
            time.sleep(0.01)
        self.fail('the transcription never finished')

    def test_sent_before_the_words_it_goes_at_once_and_gets_them(self):
        f = self.voice()
        rid = self.op({'op': 'input', 'text': 'And keep it simple.', 'scope': 'F1', 'files': [f]})
        inp, it = self.s.inputs[rid], self.s.items[1]
        self.assertEqual(it['thread'][-1]['text'], 'And keep it simple.')  # on the item right away
        self.assertNotIn(inp, self.s.for_agent())  # but agents get it with its words
        self.assertTrue(next(i for i in self.s.state()['inputs'] if i['id'] == rid).get('tr_wait'))
        self.assertIn('nothing to do now', self.s.next_text()[0])
        self.finish()
        self.assertEqual(inp['text'], 'And keep it simple.\n' + WORDS)
        self.assertEqual(inp['files'][0]['tr'], WORDS)
        self.assertEqual(it['thread'][-1]['text'], inp['text'])  # the message on the item shows the words too
        self.assertIn(inp, self.s.for_agent())
        self.assertIn(WORDS, self.s.next_text()[0])
        self.assertFalse(inp.get('history'))  # nobody had read it: no "updated" version
        replay = taska.Store(str(self.path))  # the log says the same after a restart
        self.assertEqual(replay.inputs[rid]['text'], inp['text'])
        self.assertEqual(replay.items[1]['thread'][-1]['text'], inp['text'])
        replay.out.close()

    def test_words_in_before_the_send_go_with_it(self):
        f = self.voice()
        self.finish()  # in, but the page sent before it heard
        rid = self.op({'op': 'input', 'text': '', 'scope': 'F1', 'files': [f]})
        self.assertEqual(self.s.inputs[rid]['text'], WORDS)
        self.assertEqual(self.s.inputs[rid]['files'][0]['tr'], WORDS)
        self.assertIn(self.s.inputs[rid], self.s.for_agent())

    def test_words_already_in_the_text_are_not_added_twice(self):
        f = self.voice()
        self.finish()
        rid = self.op({'op': 'input', 'text': 'Note: ' + WORDS, 'files': [dict(f, tr=WORDS)]})
        self.assertEqual(self.s.inputs[rid]['text'], 'Note: ' + WORDS)

    def test_no_words_or_a_failure_lets_it_go_as_it_is(self):
        self.answer = ''
        f = self.voice()
        rid = self.op({'op': 'input', 'text': 'Listen to this', 'files': [f]})
        self.finish()
        self.assertEqual(self.s.inputs[rid]['text'], 'Listen to this')
        self.assertIn(self.s.inputs[rid], self.s.for_agent())

    def test_details_with_a_voice_note_get_its_words(self):  # B168 details, sent before the words were in
        rid = self.op({'op': 'input', 'text': 'Dark mode please', 'scope': 'F1'})
        f = self.voice()
        self.op({'op': 'amend', 'id': rid, 'v': 0, 'mode': 'append', 'text': '', 'files': [f]})
        self.assertNotIn(self.s.inputs[rid], self.s.for_agent())
        self.finish()
        self.assertEqual(self.s.inputs[rid]['text'], 'Dark mode please\n' + WORDS)
        own = self.s.items[1]['thread'][-1]  # S1: its own message shows the words, marked edited; nobody wrote since
        self.assertEqual((own['src'], own['text'], bool(own.get('edited'))), (rid, 'Dark mode please\n' + WORDS, True))

    def test_words_after_an_agent_read_it_come_back_as_an_update(self):
        f = self.voice()
        rid = self.op({'op': 'input', 'text': 'See the voice note', 'scope': 'F1', 'files': [f]})
        self.s.trs[f['f']]['t0'] -= taska.TR_HOLD + 1  # waited too long: agents got it without the words
        self.assertIn(self.s.inputs[rid], self.s.for_agent())
        self.op({'op': 'ack', 'ids': [rid]}, by='claude-code')
        self.finish()
        inp = self.s.inputs[rid]
        self.assertFalse(inp['acked'])
        self.assertEqual(inp['history'][-1]['text'], 'See the voice note')
        own = self.s.items[1]['thread'][-1]  # S1: its message, edited in place (the agent wrote nothing since)
        self.assertEqual((own['text'], bool(own.get('edited'))), ('See the voice note\n' + WORDS, True))
        self.assertIn('(edited', self.s.card(self.s.items[1]))
        self.assertIn(WORDS, self.s.next_text()[0])

    def test_the_log_names_the_words(self):
        f = self.voice()
        self.op({'op': 'input', 'text': '', 'files': [f]})
        self.finish()
        self.assertIn('voice note words', self.s.log(3))
        self.assertTrue(json.loads(self.path.read_text().strip().split('\n')[-1])['k'] == 'tr')

    # Found in review (T101): words that came while the organizer worked on the input, an edit opened before them,
    # an input moved meanwhile, a restart, and a hold running out.

    def test_words_while_the_organizer_works_on_it_make_its_plan_stale(self):
        f = self.voice()
        rid = self.op({'op': 'input', 'text': '', 'scope': 'F1', 'files': [f]})
        self.s.org_on = True
        self.s.trs[f['f']]['t0'] -= taska.TR_HOLD + 1  # the hold ran out: the organizer takes it without its words

        def plan(*a, **k):  # the words come in while it thinks
            self.finish()
            return ''
        with self.s.cond:
            inp = dict(self.s.inputs[rid])
            self.s.org_busy = rid
        with patch.object(taska, 'gemini', plan):
            taska.Organizer(self.s).process(inp)
        inp = self.s.inputs[rid]
        self.assertEqual(inp['text'], WORDS)
        self.assertFalse(inp['acked'])  # the plan made without the words is dropped, not acknowledged
        self.assertIsNone(inp['org'])  # and the organizer takes it again, with them
        self.assertIn(inp, [i for i in self.s.pending() if not i['org'] and not self.s.held(i)])

    def test_an_edit_opened_before_the_words_cannot_save_over_them(self):
        f = self.voice()
        rid = self.op({'op': 'input', 'text': 'See the note', 'files': [f]})
        v = self.s.inputs[rid].get('v', 0)  # Edit opened now
        self.finish()
        lines, _ = self.s.run_all([(0, {'op': 'amend', 'id': rid, 'mode': 'edit', 'v': v, 'text': 'See the note, please'})], 'you')
        self.assertTrue(lines[0].startswith('err'), lines)  # "changed ... reopen it"
        self.assertEqual(self.s.inputs[rid]['text'], 'See the note\n' + WORDS)

    def test_words_a_restart_cut_off_are_worked_out_on_start(self):
        def pending():  # a voice note being worked out when Taska is killed
            f = self.s.save_file('voice 0-04.webm', 'audio/webm', b'\x1aE\xdf\xa3' + b'\0' * 100)
            self.s.trs[f['f']] = {'t0': time.time(), 'done': False, 'tr': '', 'err': ''}
            return f
        a, b = pending(), pending()
        ra = self.op({'op': 'input', 'text': 'Listen', 'files': [a]})
        rb = self.op({'op': 'input', 'text': 'And this', 'files': [b]})
        self.op({'op': 'ack', 'ids': [rb]}, by='claude-code')  # an agent took it without the words
        song = self.s.save_file('song.mp3', 'audio/mpeg', b'ID3')  # attached, not recorded: not transcribed
        rc = self.op({'op': 'input', 'text': 'A song', 'files': [song]})
        again = taska.Store(str(self.path))  # killed and started again: nothing is being worked out
        self.go.set()
        again.resume_words()
        self.assertEqual(sorted(again.trs), sorted([a['f'], b['f']]))
        for _ in range(300):
            if all(j['done'] for j in again.trs.values()):
                break
            time.sleep(0.01)
        time.sleep(0.05)
        self.assertEqual(again.inputs[ra]['text'], 'Listen\n' + WORDS)
        self.assertEqual(again.inputs[rb]['files'][0]['tr'], WORDS)
        self.assertFalse(again.inputs[rb]['acked'])  # late words: back to the agent with them
        self.assertEqual(again.inputs[rc]['text'], 'A song')
        again.out.close()


def free_port():
    with socket.socket() as so:
        so.bind(('127.0.0.1', 0))
        return so.getsockname()[1]


class VoiceWordsServerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.hub = patch.object(taska, 'HUB', taska.Hub(self.tmp.name, False))
        self.hub.start()
        self.go = threading.Event()
        p = patch.object(taska, 'transcribe', side_effect=lambda *a, **k: self.go.wait(10) and {'tr': WORDS, 'tr_by': 'main'})
        p.start()
        self.addCleanup(p.stop)
        self.srv = taska.Server(('127.0.0.1', free_port()), taska.Handler)
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.base = f'http://127.0.0.1:{self.srv.server_address[1]}/p/default/'

    def tearDown(self):
        self.go.set()
        self.srv.shutdown()
        self.srv.server_close()
        self.hub.stop()
        self.tmp.cleanup()

    def call(self, path, data=None, ctype='application/json'):
        req = urllib.request.Request(self.base + path, data=data, headers={'Content-Type': ctype}, method='GET' if data is None else 'POST')
        with urllib.request.urlopen(req, timeout=20) as r:
            body = r.read().decode()
            return json.loads(body) if r.headers.get_content_type() == 'application/json' else body

    def send_voice(self, text=''):
        f = self.call('api/file?name=voice.webm&transcribe=1', b'audio', 'audio/webm')
        return f, self.call('api/op', json.dumps({'op': 'input', 'text': text, 'files': [f]}).encode())['res'][0].split()[1]

    def test_words_follow_an_input_moved_meanwhile(self):  # F79
        taska.HUB.add('other')
        f, rid = self.send_voice()
        moved = self.call('api/move', json.dumps({'id': rid, 'to': 'other'}).encode())
        self.go.set()
        other = taska.HUB.projects['other']
        for _ in range(300):
            inp = other.inputs[moved['as']]
            if inp['files'][0].get('tr'):
                break
            time.sleep(0.01)
        self.assertEqual((inp['text'], inp['files'][0]['tr']), (WORDS, WORDS))
        self.assertTrue(Path(other.local(inp['files'][0]['f']) + '.tr.json').is_file())  # kept there too

    def test_a_hold_running_out_wakes_a_waiting_agent(self):
        with patch.object(taska, 'TR_HOLD', 0.5):
            self.send_voice('See the voice note')
            t0 = time.time()
            text = self.call('next?wait=8&by=claude-code')
            took = time.time() - t0
        self.assertIn('See the voice note', text)
        self.assertLess(took, 3)  # when the hold ran out, not when the wait did


if __name__ == '__main__':
    unittest.main(verbosity=2)
