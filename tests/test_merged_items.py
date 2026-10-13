"""B5: a merged item lives on in the item it went into. A reply addressed to it (a page that still shows it, a link,
an old address) lands on that item, never on the merged one."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('taska', Path(__file__).resolve().parents[1] / 'taska.py')
taska = importlib.util.module_from_spec(spec)
spec.loader.exec_module(taska)


class MergedItemTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.s = taska.Store(str(Path(self.tmp.name) / 'taska.jsonl'))
        self.s.name = 'qa'
        self.do('new idea Offline mode for the mobile app\nnew task Sync on reconnect\nnew feature Offline sync', 'you')
        self.do('I1 merge T2', 'claude-code')

    def tearDown(self):
        self.s.out.close()
        self.tmp.cleanup()

    def do(self, text, by):
        lines, _ = self.s.run_all(taska.parse_dsl(text), by)
        self.assertTrue(all(x.startswith('ok') for x in lines), lines)

    def reply(self, scope, text):
        lines, _ = self.s.run_all([(0, {'op': 'input', 'text': text, 'scope': scope})], 'you')
        self.assertTrue(lines[0].startswith('ok'), lines)
        return self.s.inputs[lines[0].split()[1]]

    def said(self, n):
        return [x['text'] for x in self.s.items[n]['thread']]

    def test_a_reply_to_a_merged_item_lands_where_it_went(self):
        inp = self.reply('I1', 'Use the staging account from last week')
        self.assertEqual(inp['scope'], 2)
        self.assertIn('Use the staging account from last week', self.said(2))
        self.assertNotIn('Use the staging account from last week', self.said(1))
        self.assertIn(inp['id'], self.s.items[2]['srcs'])

    def test_it_follows_merges_all_the_way(self):
        self.do('T2 merge F3', 'claude-code')
        inp = self.reply('1', 'Two merges later')
        self.assertEqual(inp['scope'], 3)
        self.assertIn('Two merges later', self.said(3))
        self.assertTrue(all('Two merges later' not in self.said(n) for n in (1, 2)))

    def test_a_live_item_keeps_its_replies(self):
        inp = self.reply('T2', 'Straight to the item')
        self.assertEqual(inp['scope'], 2)


if __name__ == '__main__':
    unittest.main(verbosity=2)
