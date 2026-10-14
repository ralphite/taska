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


if __name__ == '__main__':
    unittest.main()
