"""A18: a project's "N open" means one thing wherever it shows. The server's project list (the other projects in the
sidebar, the front page) counts what the project's own page counts as open: what Items holds that isn't finished,
rules an agent proposed included, since they wait in Items too; merged, archived and finished items not."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('taska', Path(__file__).resolve().parents[1] / 'taska.py')
taska = importlib.util.module_from_spec(spec)
spec.loader.exec_module(taska)


class CountTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.hub = taska.Hub(self.tmp.name, organizer=False)
        self.s = self.hub.add('qa')
        self.do('new feature Dark mode\nnew bug Export ignores the filter\nnew idea Offline mode\nnew task Old chore\n'
                'new rule Write commit messages in the imperative mood', 'you')
        self.do('new rule Run the tests before every commit', 'claude-code')  # proposed: it waits on the user in Items
        self.do('I3 merge F1', 'claude-code')
        self.do('T4 done\nT4 archive', 'you')

    def tearDown(self):
        for s in self.hub.projects.values():
            s.out.close()
        self.tmp.cleanup()

    def do(self, text, by):
        lines, _ = self.s.run_all(taska.parse_dsl(text), by)
        self.assertTrue(all(x.startswith('ok') for x in lines), lines)

    def page_open(self):
        """The page's openCount(): not merged, in Items (not archived; not a rule, unless proposed), not finished."""
        return sum(1 for i in self.s.items.values() if not i['merged_into'] and not i['archived']
                   and (i['type'] != 'rule' or i['status'] == 'proposed') and i['status'] not in taska.CLOSED)

    def test_the_project_list_counts_open_as_the_page_does(self):
        qa = next(p for p in self.hub.summary() if p['name'] == 'qa')
        self.assertEqual(qa['open'], 3)  # F1, B2 and the proposed rule R6; not I3 (merged), T4 (archived), R5 (a rule in force)
        self.assertEqual(qa['open'], self.page_open())
        self.assertEqual(qa['needs'], 1)  # the proposed rule

    def test_finishing_and_reopening_move_the_count(self):
        self.do('B2 done', 'you')
        self.assertEqual(next(p for p in self.hub.summary() if p['name'] == 'qa')['open'], 2)
        self.do('B2 open', 'you')
        self.assertEqual(next(p for p in self.hub.summary() if p['name'] == 'qa')['open'], 3)


if __name__ == '__main__':
    unittest.main(verbosity=2)
