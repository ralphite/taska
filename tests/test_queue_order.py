"""Do this next (F197): the user puts an item first of its priority; /next follows, a higher priority still comes
first, the latest "next" goes first, and "-" puts it back in the usual order (oldest first)."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('taska', Path(__file__).resolve().parents[1] / 'taska.py')
taska = importlib.util.module_from_spec(spec)
spec.loader.exec_module(taska)


class QueueOrderTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.s = taska.Store(str(Path(self.tmp.name) / 'taska.jsonl'))
        self.s.name = 'qa'
        self.do('new bug P1 First\nnew bug P1 Second\nnew bug P1 Third\nnew bug P0 Urgent')

    def tearDown(self):
        self.s.out.close()
        self.tmp.cleanup()

    def do(self, text, by='you'):
        with self.s.cond:
            lines, _ = self.s.run_all(taska.parse_dsl(text), by)
        self.assertTrue(all(x.startswith('ok') for x in lines), lines)

    def op(self, op):
        with self.s.cond:
            lines, _ = self.s.run_all([(0, op)], 'you')
        self.assertTrue(lines[0].startswith('ok'), lines)

    def picked(self):
        with self.s.cond:
            text, _ = self.s.next_text()
        return next(line.split()[1] for line in text.split('\n') if line.startswith('next '))

    def test_next_within_its_priority(self):
        self.do('B4 done')  # the P0 out of the way
        self.assertEqual(self.picked(), 'B1')
        self.op({'op': 'set', 'ref': 'B3', 'f': {'rank': -100}})
        self.assertEqual(self.picked(), 'B3')
        self.op({'op': 'set', 'ref': 'B2', 'f': {'rank': -200}})  # put next later: it goes first
        self.assertEqual(self.picked(), 'B2')
        self.op({'op': 'set', 'ref': 'B2', 'f': {'rank': None}})
        self.op({'op': 'set', 'ref': 'B3', 'f': {'rank': '-'}})
        self.assertEqual(self.picked(), 'B1')

    def test_a_higher_priority_still_comes_first(self):
        self.op({'op': 'set', 'ref': 'B3', 'f': {'rank': -100}})
        self.assertEqual(self.picked(), 'B4')


if __name__ == '__main__':
    unittest.main()
