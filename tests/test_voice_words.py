"""B165: a voice note's words never hold up the box. You can send before they are in: the message goes at once with
its recording, the words are added to it when they come, and agents and the organizer get it with its words."""
import importlib.util
import json
import tempfile
import threading
import time
import unittest
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
        patcher = patch.object(taska, 'transcribe', side_effect=lambda *a: self.go.wait(5) and self.answer)
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
        self.assertEqual(self.s.items[1]['thread'][-1]['text'], f'{rid} updated:\n' + 'Dark mode please\n' + WORDS)

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
        self.assertIn(f'{rid} updated:', self.s.items[1]['thread'][-1]['text'])
        self.assertIn(WORDS, self.s.next_text()[0])

    def test_the_log_names_the_words(self):
        f = self.voice()
        self.op({'op': 'input', 'text': '', 'files': [f]})
        self.finish()
        self.assertIn('voice note words', self.s.log(3))
        self.assertTrue(json.loads(self.path.read_text().strip().split('\n')[-1])['k'] == 'tr')


if __name__ == '__main__':
    unittest.main(verbosity=2)
