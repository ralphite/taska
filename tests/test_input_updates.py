import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('taska', Path(__file__).resolve().parents[1] / 'taska.py')
taska = importlib.util.module_from_spec(spec)
spec.loader.exec_module(taska)

class AmendTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / 'taska.jsonl'
        self.s = taska.Store(str(self.path))
        self.s.name = 'qa'
        self.s.org_on = True
        f = self.s.save_file('sample.txt', 'text/plain', b'fixture')
        self.runop({'op':'input', 'text':'Original words', 'files':[f]})
        self.runop({'op':'new', 'title':'Example item', 'src':'r1'}, 'org')
        self.runop({'op':'say', 'ref':'F1', 'kind':'progress', 'text':'Reviewed initial input'}, 'codex')

    def tearDown(self):
        self.s.out.close()
        self.tmp.cleanup()

    def runop(self, op, by='you'):
        lines, labels = self.s.run_all([(0,op)], by)
        self.assertTrue(lines[0].startswith('ok'), lines)
        return lines

    def amend(self, text='Additional context', v=0, mode='append'):
        return self.runop({'op':'amend','id':'r1','v':v,'mode':mode,'text':text})

    def test_legacy_append_replay_keeps_identity_files_and_links(self):
        before = json.loads(json.dumps(self.s.inputs['r1']))
        self.amend()
        inp = self.s.inputs['r1']
        self.assertEqual(self.s.nin, 1)
        self.assertEqual(inp['text'], 'Original words\n\nAdditional context')
        self.assertEqual(inp['files'], before['files'])
        self.assertEqual(inp['touched'], [1])
        self.assertFalse(inp['acked'])
        self.assertIsNone(inp['org'])
        self.assertEqual(inp['history'][0]['text'], before['text'])
        self.assertTrue(self.s.replied(self.s.items[1]))
        replay = taska.Store(str(self.path))
        self.assertEqual(replay.inputs, self.s.inputs)
        self.assertEqual(replay.items, self.s.items)
        replay.out.close()

    def test_conflict_and_oversize_do_not_mutate(self):
        self.amend()
        for op in [dict(v=0,text='stale'), dict(v=1,text='x'*taska.MAX_TEXT), dict(v=1,text=' ')]:
            rev = self.s.rev
            lines,_ = self.s.run_all([(0,{'op':'amend','id':'r1','mode':'append',**op})], 'you')
            self.assertTrue(lines[0].startswith('err'), lines)
            self.assertEqual(self.s.rev,rev)

    def test_organizer_discards_stale_plan_then_processes_latest(self):
        org = taska.Organizer(self.s)
        self.amend()
        def during(*args, **kwargs):
            self.amend('Latest correction', 1, 'edit')
            return 'F1 title STALE'
        with patch.object(taska, 'gemini', side_effect=during):
            org.process(self.s.inputs['r1'])
        self.assertEqual(self.s.items[1]['title'], 'Example item')
        self.assertIsNone(self.s.inputs['r1']['org'])
        self.assertFalse(self.s.inputs['r1']['acked'])
        with patch.object(taska, 'gemini', return_value='F1 title Current title'):
            org.process(self.s.inputs['r1'])
        self.assertEqual(self.s.items[1]['title'], 'Current title')
        self.assertFalse(self.s.inputs['r1']['acked'])
        self.assertTrue(self.s.inputs['r1']['org']['keep'])
        self.assertTrue(self.s.inputs['r1']['org']['changed'])
        self.assertIn('r1',self.s.inbox())
        self.assertIn('Latest correction',self.s.inbox())

    def test_undo_only_reverts_latest_organizer_cycle(self):
        self.amend()
        with patch.object(taska, 'gemini', return_value='F1 title Updated title'):
            taska.Organizer(self.s).process(self.s.inputs['r1'])
        with self.s.lock:
            self.s.emit({'k':'undo','src':'r1','by':'you'})
        self.assertEqual(self.s.items[1]['title'],'Example item')
        self.assertNotEqual(self.s.items[1]['status'],'dropped')
        self.assertEqual(self.s.inputs['r1']['text'],'Original words\n\nAdditional context')

    def test_context_includes_linked_closed_item(self):
        self.runop({'op':'set','ref':'F1','f':{'status':'done'}})
        self.amend()
        context = taska.Organizer(self.s).context(self.s.inputs['r1'])
        self.assertIn('Example item', context)
        self.assertIn('Previous input text', context)
        self.assertIn('completed external actions',context)

    def test_no_change_plan_stays_in_inbox_without_undo(self):
        self.amend()
        with patch.object(taska, 'gemini', return_value='ack r1\npass'):
            taska.Organizer(self.s).process(self.s.inputs['r1'])
        self.assertFalse(self.s.inputs['r1']['acked'])
        self.assertFalse(self.s.inputs['r1']['org']['changed'])

    def test_moved_and_noop(self):
        rev = self.s.rev
        self.amend('Original words',mode='edit')
        self.assertEqual(self.s.rev,rev)
        with self.s.lock:
            self.s.emit({'k':'moved','src':'r1','to':'elsewhere','as':'r2','by':'you'})
        lines,_ = self.s.run_all([(0,{'op':'amend','id':'r1','v':0,'mode':'edit','text':'New'})], 'you')
        self.assertTrue(lines[0].startswith('err'), lines)

if __name__ == '__main__':
    unittest.main(verbosity=2)
