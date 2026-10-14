"""Search across projects (F196): /api/search finds the words in the other projects' items (title, text, thread) and
inputs, every word required, and leaves out the project you are in."""
import importlib.util
import shutil
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('taska', REPO / 'taska.py')
taska = importlib.util.module_from_spec(spec)
spec.loader.exec_module(taska)


class SearchTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        for name in ('my-app', 'other'):
            shutil.copytree(REPO / 'tests' / 'fixtures' / 'my-app', Path(self.tmp.name) / name)
        self.hub = taska.Hub(self.tmp.name, False)
        s = self.hub.projects['other']
        with s.cond:
            s.run_all(taska.parse_dsl('new bug Invoice totals round the wrong way\n  Found it in the tax step'), 'codex')

    def tearDown(self):
        for s in self.hub.projects.values():
            s.out.close()
        self.tmp.cleanup()

    def test_words_in_a_title_and_the_text(self):
        hits = self.hub.search('invoice tax', skip='my-app')
        self.assertEqual([(h['project'], h['kind'], h['title']) for h in hits], [('other', 'item', 'Invoice totals round the wrong way')])

    def test_every_word_and_the_project_you_are_in(self):
        self.assertEqual(self.hub.search('invoice nowhere', skip='my-app'), [])
        both = {h['project'] for h in self.hub.search('export')}
        self.assertEqual(both, {'my-app', 'other'})
        self.assertEqual({h['project'] for h in self.hub.search('export', skip='my-app')}, {'other'})

    def test_inputs_too(self):
        word = self.hub.projects['other'].inputs['r1']['text'].split()[0]
        self.assertIn(('input', 'r1'), {(h['kind'], h['code']) for h in self.hub.search(word, skip='my-app')})


if __name__ == '__main__':
    unittest.main()
