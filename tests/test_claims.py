"""Agents claim what they work on (F194): /next gives each agent an item no other agent is on, says which items the
others hold, and lets a claim go after CLAIM_TTL of quiet."""
import importlib.util
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('taska', Path(__file__).resolve().parents[1] / 'taska.py')
taska = importlib.util.module_from_spec(spec)
spec.loader.exec_module(taska)


class ClaimTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.s = taska.Store(str(Path(self.tmp.name) / 'taska.jsonl'))
        self.s.name = 'qa'
        self.do('new bug P1 Crash on save\nnew bug P1 Wrong total\nnew task P2 Update docs', 'you')

    def tearDown(self):
        self.s.out.close()
        self.tmp.cleanup()

    def do(self, text, by):
        with self.s.cond:
            lines, _ = self.s.run_all(taska.parse_dsl(text), by)
        self.assertTrue(all(x.startswith('ok') for x in lines), lines)

    def next(self, who=None):
        with self.s.cond:
            text, _ = self.s.next_text(None, who)
        return text

    def picked(self, text):
        return next(line.split()[1] for line in text.split('\n') if line.startswith('next '))

    def test_two_agents_get_different_items(self):
        a = self.next('claude-code')
        self.assertEqual(self.picked(a), 'B1')
        b = self.next('codex')
        self.assertEqual(self.picked(b), 'B2')
        self.assertIn('others are on (skip): B1 (claude-code)', b)
        self.assertEqual(self.picked(self.next('claude-code')), 'B1')  # its own item stays its own

    def test_work_written_back_holds_the_claim(self):
        self.do('B2 doing\nB2 progress on it', 'codex')
        t = self.next('claude-code')
        self.assertEqual(self.picked(t), 'B1')
        self.assertIn('B2 (codex)', t)

    def test_a_quiet_claim_lets_go(self):
        self.next('claude-code')
        self.do('B2 doing', 'codex')
        later = time.time() + taska.CLAIM_TTL + 5
        with patch.object(taska.time, 'time', return_value=later):
            t = self.next('gemini')
        self.assertNotIn('others are on', t)
        self.assertEqual(self.picked(t), 'B2')  # in progress first, now free

    def test_without_a_name_nothing_changes(self):
        self.next('claude-code')
        self.assertEqual(self.picked(self.next()), 'B1')


if __name__ == '__main__':
    unittest.main()
