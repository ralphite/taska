"""Deleting an input (F177): it goes to Deleted with the items only it made, while no agent has worked on them; the
rest stay and only lose it from their sources. Restore (Undo, Z, Settings) puts all of it back."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('taska', Path(__file__).resolve().parents[1] / 'taska.py')
taska = importlib.util.module_from_spec(spec)
spec.loader.exec_module(taska)


class DeleteTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / 'taska.jsonl'
        self.s = taska.Store(str(self.path))
        self.s.name = 'qa'

    def tearDown(self):
        self.s.out.close()
        self.tmp.cleanup()

    def run_op(self, op, by='you', ok=True):
        lines, _ = self.s.run_all([(0, op)], by)
        self.assertEqual(lines[0].startswith('ok'), ok, lines)
        return lines[0]

    def replayed(self):
        again = taska.Store(str(self.path))
        again.out.close()
        return again

    def two_items_from_r1(self):  # r1 makes T1 and its subitem T2, as the organizer or Make item would
        self.run_op({'op': 'input', 'text': 'Nightly backup, and check that it restores'})
        self.run_op({'op': 'new', 'type': 'task', 'title': 'Nightly backup', 'src': 'r1'}, 'org')
        self.run_op({'op': 'new', 'type': 'task', 'title': 'Check that the backup restores', 'parent': 'T1', 'src': 'r1'}, 'org')

    def test_delete_takes_the_items_only_it_made_and_restore_brings_them_back(self):
        self.two_items_from_r1()
        self.assertEqual(self.s.state()['inputs'][0]['drop'], {'go': [1, 2], 'keep': []})  # what the page's Delete says it will do
        self.assertEqual(self.run_op({'op': 'delete', 'id': 'r1'}), 'ok r1 deleted with T1 T2')
        st = self.s.state()
        self.assertEqual((st['items'], st['inputs']), ([], []))
        self.assertEqual([(d['id'], [i['code'] for i in d['items']], d['kept']) for d in st['deleted']], [('r1', ['T1', 'T2'], [])])
        self.assertNotIn('T1', self.s.next_text()[0])  # agents don't get them any more
        self.assertNotIn('T1', self.s.listing({}))
        self.assertEqual(self.s.pending(), [])
        self.assertIn('r1 deleted with T1 T2', self.s.log(1))
        again = self.replayed()
        self.assertEqual((again.items, again.inputs), (self.s.items, self.s.inputs))
        self.assertEqual(self.run_op({'op': 'restore', 'id': 'r1'}), 'ok r1 restored with T1 T2')  # Undo, Z, or Settings > Deleted
        st = self.s.state()
        self.assertEqual(([i['code'] for i in st['items']], [r['id'] for r in st['inputs']], st['deleted']), (['T1', 'T2'], ['r1'], []))
        self.assertIn('T2', self.s.next_text()[0])
        again = self.replayed()
        self.assertEqual((again.items, again.inputs), (self.s.items, self.s.inputs))

    def test_an_item_with_other_inputs_stays_and_only_loses_this_one(self):
        self.two_items_from_r1()
        self.run_op({'op': 'input', 'text': 'Keep 30 days of backups', 'scope': 'T1'})  # r2: you wrote about T1 again
        self.assertEqual(self.s.items[1]['srcs'], ['r1', 'r2'])
        line = self.run_op({'op': 'delete', 'id': 'r1'})
        self.assertEqual(line, 'ok r1 deleted with T2; kept T1 (it has other inputs)')
        it = self.s.items[1]
        self.assertEqual((it.get('deleted'), it['srcs']), (None, ['r2']))
        self.assertEqual([i['code'] for i in self.s.state()['items']], ['T1'])
        self.assertEqual(self.s.state()['deleted'][0]['kept'], [{'n': 1, 'code': 'T1', 'title': 'Nightly backup', 'type': 'task', 'why': 'it has other inputs'}])
        self.run_op({'op': 'restore', 'id': 'r1'})
        self.assertEqual(self.s.items[1]['srcs'], ['r1', 'r2'])
        again = self.replayed()
        self.assertEqual((again.items, again.inputs), (self.s.items, self.s.inputs))

    def test_an_item_an_agent_worked_on_stays(self):
        self.two_items_from_r1()
        self.run_op({'op': 'say', 'ref': 'T2', 'kind': 'progress', 'text': 'Restored last night\'s backup on a spare disk'}, 'codex')
        line = self.run_op({'op': 'delete', 'id': 'r1'})  # T2 stays, and so does T1, its parent
        self.assertEqual(line, 'ok r1 deleted; kept T1 (a subitem of it stays), T2 (an agent already worked on it)')
        self.assertEqual([i['code'] for i in self.s.state()['items']], ['T1', 'T2'])
        self.assertEqual((self.s.items[1]['srcs'], self.s.items[2]['srcs']), ([], []))

    def test_an_agent_making_an_item_is_not_working_on_it(self):
        self.run_op({'op': 'input', 'text': 'A dark mode'})
        self.run_op({'op': 'new', 'type': 'feature', 'title': 'Dark mode', 'src': 'r1'}, 'codex')  # proposed, nobody worked on it
        self.assertEqual(self.run_op({'op': 'delete', 'id': 'r1'}), 'ok r1 deleted with F1')

    def test_a_reply_goes_from_the_item_it_was_on(self):
        self.run_op({'op': 'new', 'type': 'bug', 'title': 'Crash on upload'})
        self.run_op({'op': 'input', 'text': 'It happens with HEIC files only', 'scope': 'B1'})
        self.assertEqual([x['text'] for x in self.s.items[1]['thread']], ['It happens with HEIC files only'])
        self.assertEqual(self.run_op({'op': 'delete', 'id': 'r1'}), 'ok r1 deleted')  # B1 was there before: it stays, quietly
        it = self.s.items[1]
        self.assertEqual((it['thread'], it['srcs'], it.get('deleted')), ([], [], None))
        self.run_op({'op': 'restore', 'id': 'r1'})
        self.assertEqual(([x['text'] for x in it['thread']], it['srcs']), (['It happens with HEIC files only'], ['r1']))
        again = self.replayed()
        self.assertEqual((again.items, again.inputs), (self.s.items, self.s.inputs))

    def test_an_agent_on_a_deleted_item_hears_it(self):
        self.two_items_from_r1()
        self.run_op({'op': 'delete', 'id': 'r1'})
        line = self.run_op({'op': 'set', 'ref': 'T1', 'f': {'status': 'doing'}}, 'codex')
        self.assertIn('the user deleted T1 together with input r1: stop working on it', line)
        self.assertIn('deleted by the user together with input r1', self.s.card(self.s.items[1]))
        self.assertIn('[deleted by the user]', self.s.input_card(self.s.inputs['r1']))
        self.assertNotIn('deleted', self.run_op({'op': 'say', 'ref': 'T1', 'text': 'ok'}))  # the user is not told

    def test_a_deleted_input_waits_for_nobody(self):
        self.run_op({'op': 'input', 'text': 'Typo in the footer'})
        self.run_op({'op': 'delete', 'id': 'r1'})
        self.assertEqual((self.s.pending(), self.s.for_agent()), ([], []))
        self.assertIn('restore it first', self.run_op({'op': 'amend', 'id': 'r1', 'mode': 'edit', 'v': 0, 'text': 'Typo in the header'}, ok=False))
        self.assertIn('deleted already', self.run_op({'op': 'delete', 'id': 'r1'}, ok=False))
        self.assertIn('only the user', self.run_op({'op': 'restore', 'id': 'r1'}, 'codex', ok=False))
        self.run_op({'op': 'restore', 'id': 'r1'})
        self.assertEqual([i['id'] for i in self.s.for_agent()], ['r1'])
        self.assertIn('not deleted', self.run_op({'op': 'restore', 'id': 'r1'}, ok=False))


if __name__ == '__main__':
    unittest.main(verbosity=2)
