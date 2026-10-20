"""T293: a page with a copy of the state asks only for what changed since; merged, it equals the whole state."""
import importlib.util
import shutil
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('taska', REPO / 'taska.py')
taska = importlib.util.module_from_spec(spec)
spec.loader.exec_module(taska)
KEYS = (('items', 'n'), ('inputs', 'id'), ('docs', 'd'))


def merge(was, d):  # what the page does (mergeState)
    for kind, idk in KEYS:
        drop, fresh = set(d['drop'][kind]), {x[idk]: x for x in d[kind]}
        out = [fresh.get(x[idk], x) for x in was[kind] if x[idk] not in drop]
        have = {x[idk] for x in out}
        was[kind] = out + [x for x in d[kind] if x[idk] not in have]
    return was


class DeltaTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        shutil.copytree(REPO / 'tests' / 'fixtures' / 'my-app', Path(self.tmp.name) / 'my-app')
        self.hub = taska.Hub(self.tmp.name, False)
        self.s = self.hub.projects['my-app']

    def tearDown(self):
        for s in self.hub.projects.values():
            s.out.close()
        self.tmp.cleanup()

    def same(self, a, b):
        for kind, idk in KEYS:
            self.assertEqual({x[idk]: x for x in a[kind]}, {x[idk]: x for x in b[kind]}, kind)

    def test_only_changes_come_and_merge_to_the_whole(self):
        s = self.s
        full = s.state_since()
        self.assertNotIn('delta', full)
        code = s.code(next(iter(s.items)))
        with s.cond:
            s.run_all(taska.parse_dsl(f'{code} say A word from the agent\nnew bug P1 A new one'), 'claude-code')
            s.run_all([(0, {'op': 'input', 'text': 'Something new'})], 'you')
        d = s.state_since(full['sv'], full['boot'])
        self.assertEqual(d['delta'], full['sv'])
        self.assertEqual(len(d['items']), 2)  # the one talked on and the new one
        self.assertEqual(len(d['inputs']), 1)
        self.same(merge(full, d), s.state_since())

    def test_nothing_changed_sends_nothing(self):
        full = self.s.state_since()
        d = self.s.state_since(full['sv'], full['boot'])
        self.assertEqual((d['items'], d['inputs'], d['docs']), ([], [], []))

    def test_another_boot_gets_everything(self):
        full = self.s.state_since()
        self.assertNotIn('delta', self.s.state_since(full['sv'], 'old-boot'))


    def test_the_phone_keeps_only_the_page_views(self):  # the service worker's list is the server's list of views
        import re
        views = re.search(r'\(([^)]*)\)', taska.VIEW_PATH.pattern)[1]
        self.assertIn(views, taska.SW)

    def test_the_organizer_keeps_your_pictures_and_links(self):  # R319
        import os
        s = self.s
        os.makedirs(s.fdir, exist_ok=True)
        open(os.path.join(s.fdir, 'f900-shot.png'), 'wb').write(b'png')
        with s.cond:
            s.run_all([(0, {'op': 'input', 'text': 'Slow, see https://example.com/trace', 'files': [{'f': 'f900-shot.png', 'name': 'shot.png', 'mime': 'image/png'}]})], 'you')
            rid = max(s.inputs, key=lambda r: int(r[1:]))
            code = s.code(next(iter(s.items)))
            s.run_all(taska.parse_dsl(f'{code} say The page is slow'), 'org', src=rid)
        said = s.items[int(code[1:])]['thread'][-1]
        self.assertEqual([f['f'] for f in said.get('files', [])], ['f900-shot.png'])
        self.assertIn('https://example.com/trace', said['text'])

if __name__ == '__main__':
    unittest.main()
