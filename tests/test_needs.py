"""What needs you, in every project (F193): /api/needs lists each item an agent asks about or is blocked on, and each
one waiting for approval or acceptance, across projects; closed and merged items are not in it."""
import importlib.util
import shutil
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('taska', REPO / 'taska.py')
taska = importlib.util.module_from_spec(spec)
spec.loader.exec_module(taska)


class NeedsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        for name in ('my-app', 'other'):
            shutil.copytree(REPO / 'tests' / 'fixtures' / 'my-app', Path(self.tmp.name) / name)
        self.hub = taska.Hub(self.tmp.name, False)

    def tearDown(self):
        for s in self.hub.projects.values():
            s.out.close()
        self.tmp.cleanup()

    def kinds(self, project):
        return {x['code']: x['kind'] for x in self.hub.needs() if x['project'] == project}

    def test_every_project_and_every_kind(self):
        mine = self.kinds('my-app')
        self.assertEqual(mine, self.kinds('other'))
        self.assertEqual(set(mine.values()), {'review', 'ask', 'proposed', 'block'})
        counts = {p['name']: p['needs'] for p in self.hub.summary()}
        self.assertEqual(len(mine), counts['my-app'])  # the same count the sidebar shows

    def test_a_closed_item_leaves_the_list(self):
        code = next(c for c, k in self.kinds('other').items() if k == 'review')
        s = self.hub.projects['other']
        with s.cond:
            lines, _ = s.run_all(taska.parse_dsl(f'{code} done'), 'you')
        self.assertTrue(lines[0].startswith('ok'), lines)
        self.assertNotIn(code, self.kinds('other'))
        self.assertIn(code, self.kinds('my-app'))

    def test_your_reply_answers_a_review_or_a_proposal(self):  # B286: what you wrote is your answer: the agent picks it up
        s = self.hub.projects['other']
        for kind in ('review', 'proposed'):
            code = next(c for c, k in self.kinds('other').items() if k == kind)
            with s.cond:
                lines, _ = s.run_all([(0, {'op': 'input', 'text': 'Not quite: one more thing', 'scope': code})], 'you')
            self.assertTrue(lines[0].startswith('ok'), lines)
            self.assertNotIn(code, self.kinds('other'))
            self.assertIn(code, s.next_text()[0].split('in review, the user accepts them (skip)')[-1])  # not skipped: it comes back to the agent
        counts = {p['name']: p['needs'] for p in self.hub.summary()}
        self.assertEqual(len(self.kinds('other')), counts['other'])


    def test_after_your_reply_the_agent_hands_it_back(self):  # B299: no deadlock once you replied
        s = self.hub.projects['other']
        code = next(c for c, k in self.kinds('other').items() if k == 'review')
        with s.cond:
            s.run_all([(0, {'op': 'input', 'text': 'Not quite', 'scope': code})], 'you')
            lines, _ = s.run_all(taska.parse_dsl(f'{code} done'), 'claude-code')  # done again, with no words
        self.assertIn('back with the user', lines[0])
        self.assertEqual(self.kinds('other').get(code), 'review')
        code = next(c for c, k in self.kinds('other').items() if k == 'proposed')
        with s.cond:
            s.run_all([(0, {'op': 'input', 'text': 'Why?', 'scope': code})], 'you')
            lines, _ = s.run_all(taska.parse_dsl(f'{code} doing'), 'claude-code')
            self.assertIn('say', lines[0])  # it is told how to move it on
            s.run_all(taska.parse_dsl(f'{code} say Because it saves a step'), 'claude-code')
        self.assertEqual(self.kinds('other').get(code), 'proposed')

    def test_done_with_words_says_them(self):  # T307: "B03 done <what changed>" was refused before
        s = self.hub.projects['other']
        code = next(c for c, k in self.kinds('other').items() if k == 'proposed')
        with s.cond:
            s.run_all(taska.parse_dsl(f'{code} open'), 'you')
            lines, _ = s.run_all(taska.parse_dsl(f'{code} done Shipped it: the export keeps the filter\n  How to check: export twice'), 'claude-code')
        self.assertTrue(all(x.startswith('ok') for x in lines), lines)
        it = s.items[int(code[1:])]
        self.assertEqual(it['status'], 'review')
        self.assertIn('How to check', it['thread'][-1]['text'])
        self.assertEqual(it['thread'][-1]['kind'], 'progress')

if __name__ == '__main__':
    unittest.main()
