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

    def test_an_edit_shows_on_its_message_not_as_a_copy(self):  # S1
        self.runop({'op': 'input', 'text': 'The sing in button should sit under the password field', 'scope': 'F1'})
        own = lambda: next(x for x in self.s.items[1]['thread'] if x['src'] == 'r2')
        n = len(self.s.items[1]['thread'])
        self.runop({'op': 'amend', 'id': 'r2', 'v': 0, 'mode': 'edit', 'text': 'The sign in button should sit under the password field'})
        self.assertEqual(len(self.s.items[1]['thread']), n)  # nobody wrote since: no second copy
        self.assertEqual(own()['text'], 'The sign in button should sit under the password field')
        self.assertTrue(own()['edited'])
        self.runop({'op': 'say', 'ref': 'F1', 'kind': 'ask', 'text': 'Which page?'}, 'codex')
        self.runop({'op': 'amend', 'id': 'r2', 'v': 1, 'mode': 'append', 'text': 'On the login page.'})
        last = self.s.items[1]['thread'][-1]  # an agent asked since: one short line after it says what changed
        self.assertEqual(last['text'], 'Added to r2:\nOn the login page.')
        self.assertTrue(self.s.replied(self.s.items[1]))
        self.runop({'op': 'amend', 'id': 'r2', 'v': 2, 'mode': 'edit', 'text': 'The sign in button should sit under the email field\n\nOn the login page.'})
        self.assertEqual(self.s.items[1]['thread'][-1]['text'], 'Edited r2: \u201cpassword\u201d \u2192 \u201cemail\u201d')
        self.assertNotIn('r2 updated', json.dumps(self.s.items[1]['thread']))
        replay = taska.Store(str(self.path))
        self.assertEqual(replay.items, self.s.items)
        replay.out.close()

    def test_a_voice_comment_keeps_its_recording(self):  # F184: one send posts each quote's words, with its recording
        self.runop({'op': 'doc', 'ref': 'F1', 'md': '# Plan\n\nFirst part.\n\nSecond part.'})
        f = self.s.save_file('voice 0-03.webm', 'audio/webm', b'fake audio')
        d = self.s.docs[1]
        keys = [taska.block_key(t) for _, t in taska.md_blocks(d['md'])]
        self.runop({'op': 'dc', 'd': 1, 'key': keys[1], 'quote': 'First', 'text': 'Say why', 'files': [dict(f, tr='Say why')]})
        self.runop({'op': 'dc', 'd': 1, 'key': keys[2], 'quote': 'Second part', 'text': 'Drop it'})
        c = d['comments']
        self.assertEqual([(x['text'], [y['f'] for y in x['files']]) for x in c], [('Say why', [f['f']]), ('Drop it', [])])
        self.assertIn(f['f'], self.s.doc_text(d))
        with self.assertRaises(AssertionError):
            self.runop({'op': 'dc', 'd': 1, 'key': keys[1], 'text': ''})
        replay = taska.Store(str(self.path))
        self.assertEqual(replay.docs[1]['comments'], c)
        replay.out.close()

    def test_a_comment_on_the_whole_document(self):  # B247: nothing picked is still a comment, on all of it
        self.runop({'op': 'doc', 'ref': 'F1', 'md': '# Plan\n\nFirst part.\n\nSecond part.'})
        self.runop({'op': 'dc', 'd': 1, 'key': 'doc', 'text': 'Looks right overall'})
        self.runop({'op': 'dc', 'd': 1, 'para': '0', 'text': 'Thanks, done'}, 'codex')  # an agent answers with D1 reply 0
        d = self.s.docs[1]
        self.assertEqual([(c['key'], c['text']) for c in self.s.doc_whole(d)], [('doc', 'Looks right overall'), ('doc', 'Thanks, done')])
        self.assertEqual(self.s.doc_view(d)[1], [])  # not a comment whose paragraph went away
        self.assertIn('¶0 comments on the whole document:\n   > you', self.s.doc_text(d))
        self.assertEqual(self.s.doc_open(d), 0)  # the agent answered it

    def test_your_comment_can_be_edited_deleted_and_brought_back(self):  # B258
        self.runop({'op': 'doc', 'ref': 'F1', 'md': '# Plan\n\nFirst part.'})
        self.runop({'op': 'dc', 'd': 1, 'key': 'doc', 'text': 'In the wrong place'})
        self.runop({'op': 'dc', 'd': 1, 'para': '0', 'text': 'Noted'}, 'codex')
        d = self.s.docs[1]
        mine, theirs = d['comments']
        self.runop({'op': 'dcedit', 'd': 1, 'id': mine['id'], 'text': 'Better words'})
        self.assertEqual((mine['text'], bool(mine.get('edited'))), ('Better words', True))
        for op, by in [({'op': 'dcdel', 'd': 1, 'id': theirs['id']}, 'you'), ({'op': 'dcdel', 'd': 1, 'id': mine['id']}, 'codex'),
                       ({'op': 'dcedit', 'd': 1, 'id': mine['id'], 'text': ' '}, 'you'), ({'op': 'dcundel', 'd': 1, 'id': mine['id']}, 'you')]:
            lines, _ = self.s.run_all([(0, op)], by)  # only your own, never empty, and only a deleted one comes back
            self.assertTrue(lines[0].startswith('err'), (op, lines))
        self.runop({'op': 'dcdel', 'd': 1, 'id': mine['id']})
        self.assertEqual([c['text'] for c in d['comments']], ['Noted'])
        self.assertNotIn('Better words', self.s.doc_text(d))
        self.runop({'op': 'dcundel', 'd': 1, 'id': mine['id']})
        self.assertEqual([c['text'] for c in d['comments']], ['Better words', 'Noted'])  # back in its place
        replay = taska.Store(str(self.path))
        self.assertEqual(replay.docs[1]['comments'], d['comments'])
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
