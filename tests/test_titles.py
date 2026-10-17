"""Item titles never keep the guide's options (B222): `new [src=r12] Title` files r12 as the item's source, and
old titles with "[src=r12]" in them read clean, their input still a source."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('taska', Path(__file__).resolve().parents[1] / 'taska.py')
taska = importlib.util.module_from_spec(spec)
spec.loader.exec_module(taska)


class TitleTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / 'taska.jsonl'
        self.s = taska.Store(str(self.path))
        self.s.name = 'qa'

    def tearDown(self):
        self.s.out.close()
        self.tmp.cleanup()

    def do(self, text, by='codex'):  # what an agent's POST /do runs
        lines, _ = self.s.run_all(taska.parse_dsl(text), by)
        return lines

    def test_options_in_brackets_are_options(self):
        self.s.run_all([(0, {'op': 'input', 'text': 'Export ignores the filter'})], 'you')
        lines = self.do('new [bug] [P1] [now] [src=r1] Export ignores the active filter')
        self.assertTrue(lines[0].startswith('ok B1 new'), lines)
        it = self.s.items[1]
        self.assertEqual((it['title'], it['type'], it['pri'], it['srcs']), ('Export ignores the active filter', 'bug', 'P1', ['r1']))
        self.assertTrue(self.s.inputs['r1']['acked'])  # as src=r1 always did

    def test_an_option_at_the_end(self):
        self.s.run_all([(0, {'op': 'input', 'text': 'Docs for the API'})], 'you')
        self.do('new task Write the API docs [src=r1]')
        self.assertEqual((self.s.items[1]['title'], self.s.items[1]['srcs']), ('Write the API docs', ['r1']))

    def test_words_about_the_tags_stay(self):
        self.do('new bug Titles should not contain [src=...] tags')
        self.assertEqual(self.s.items[1]['title'], 'Titles should not contain [src=...] tags')
        self.do('new task Open the settings in a new tab')
        self.assertEqual(self.s.items[2]['title'], 'the settings in a new tab')  # bare words before the title were always options

    def test_old_titles_read_clean_and_keep_their_input(self):
        self.s.run_all([(0, {'op': 'input', 'text': 'Redo the input box'})], 'you')
        with self.s.lock:  # what the organizer wrote before the fix: the option stayed in the title, no src
            self.s.emit({'k': 'add', 'n': 1, 'by': 'org', 'title': '[src=r1] Redo the input box', 'type': 'bug', 'pri': 'P2', 'when': 'now', 'status': 'open'})
            self.s.emit({'k': 'set', 'n': 1, 'by': 'org', 'f': {'title': '[P1] [src=r1] Redo the input box UI'}, 'was': {'title': 'x'}})
        self.s.out.close()
        again = taska.Store(str(self.path))
        again.out.close()
        it = again.items[1]
        self.assertEqual((it['title'], it['srcs']), ('Redo the input box UI', ['r1']))
        self.assertFalse(again.inputs['r1']['acked'])  # whether it was handled stays as it was
        self.assertIn('[src=r1]', next(json.loads(l) for l in open(self.path) if '"add"' in l)['title'])  # the log itself is not rewritten
        self.s = again

    def test_the_guide_shows_no_brackets_to_copy(self):  # the agents' guide and the organizer's instructions
        line = next(l for l in taska.GRAMMAR.splitlines() if l.strip().startswith('new '))
        self.assertNotIn('[', line)
        self.assertNotIn('[P0-P3]', taska.ORG)
        self.assertNotIn('[now|later]', taska.ORG)


if __name__ == '__main__':
    unittest.main(verbosity=2)
