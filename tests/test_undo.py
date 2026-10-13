"""Undoing what you did on the page (T113): every change can be put back, and only while nothing else changed it."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('taska', Path(__file__).resolve().parents[1] / 'taska.py')
taska = importlib.util.module_from_spec(spec)
spec.loader.exec_module(taska)


class UndoTests(unittest.TestCase):
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

    def test_make_item_can_be_undone(self):  # A7: "Make item", then Undo or Z
        self.run_op({'op': 'input', 'text': 'Show the version in Settings'})
        self.run_op({'op': 'new', 'title': 'Show the version in Settings', 'src': 'r1'})
        self.assertTrue(self.s.inputs['r1']['acked'])
        self.run_op({'op': 'unmake', 'ref': 'I1'})
        it, inp = self.s.items[1], self.s.inputs['r1']
        self.assertEqual((it['status'], it['archived']), ('dropped', True))
        self.assertEqual((inp['acked'], inp['touched']), (False, []))
        again = self.replayed()
        self.assertEqual((again.items, again.inputs), (self.s.items, self.s.inputs))
        self.assertIn('unmade', self.s.log(5))

    def test_make_item_undo_only_while_nothing_else_happened(self):
        self.run_op({'op': 'input', 'text': 'Show the version in Settings'})
        self.run_op({'op': 'new', 'title': 'Show the version in Settings', 'src': 'r1'})
        self.run_op({'op': 'say', 'ref': 'I1', 'kind': 'progress', 'text': 'Started'}, 'codex')
        self.assertIn('changed since', self.run_op({'op': 'unmake', 'ref': 'I1'}, ok=False))
        self.assertEqual(self.s.items[1]['status'], 'open')

    def test_only_items_made_from_an_input(self):
        self.run_op({'op': 'new', 'title': 'Typed in by hand'})
        self.assertIn('not made from an input', self.run_op({'op': 'unmake', 'ref': 'I1'}, ok=False))


if __name__ == '__main__':
    unittest.main(verbosity=2)
