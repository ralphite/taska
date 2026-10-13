"""F173: a project has a name for people and an address that never changes. Any name works (spaces, Chinese, emoji);
the address (/p/<address>, also its folder) is made from it once. Rename changes only the name. Delete moves the project
aside with everything in it (agents asking for work hear it was deleted), Restore brings it back exactly, and only
Delete forever, on a deleted project, removes anything."""
import importlib.util
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('taska', REPO / 'taska.py')
taska = importlib.util.module_from_spec(spec)
spec.loader.exec_module(taska)


def close(hub):
    for s in hub.projects.values():
        s.out.close()


class HubTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.hub = taska.Hub(self.tmp.name, organizer=False)

    def tearDown(self):
        close(self.hub)
        self.tmp.cleanup()

    def items(self, s, *titles):
        lines, _ = s.run_all([(0, {'op': 'new', 'title': t}) for t in titles], 'you')
        self.assertTrue(all(x.startswith('ok') for x in lines), lines)

    def test_any_name_gets_an_address_once(self):
        for title, slug in {'Home Budget': 'home-budget', 'Café Ops': 'cafe-ops', 'my-app': 'my-app', '  Spaced   out ': 'spaced-out',
                            '🚀 Launch': 'launch'}.items():
            s = self.hub.add(title)
            self.assertEqual((s.name, s.title), (slug, ' '.join(title.split())))
        s = self.hub.add('笔记')
        self.assertRegex(s.name, r'^p-[a-z0-9]{4}$')
        self.assertEqual(s.title, '笔记')
        self.assertEqual(self.hub.add('Home budget!').name, 'home-budget-2')  # an address in use: a number on the end
        self.assertFalse(any('"name"' in line for line in (self.root / 'my-app' / 'taska.jsonl').read_text().splitlines()),
                         'a name that is its own address needs no record')

    def test_names_differ_and_fit(self):
        self.hub.add('Notes')
        for bad in ('notes', '   ', 'x' * 61):
            with self.assertRaises(taska.Err):
                self.hub.add(bad)

    def test_rename_keeps_the_address_and_lasts(self):
        s = self.hub.add('notes')
        self.items(s, 'Buy milk')
        r, was = self.hub.rename('notes', 'Notes 笔记')
        self.assertEqual((r.name, r.title, was), ('notes', 'Notes 笔记', 'notes'))
        self.assertIn("renamed the project 'Notes 笔记'", s.log(5))
        self.hub.add('Other')
        with self.assertRaises(taska.Err):
            self.hub.rename('notes', 'other')  # another project's name
        again = taska.Hub(self.tmp.name, organizer=False)  # after a restart
        try:
            self.assertEqual((again.projects['notes'].title, len(again.projects['notes'].active())), ('Notes 笔记', 1))
            self.assertEqual({p['name']: p['title'] for p in again.summary()}['notes'], 'Notes 笔记')
        finally:
            close(again)

    def test_delete_moves_it_aside_and_restore_brings_it_back(self):
        s = self.hub.add('Side Quest')
        self.items(s, 'One', 'Two')
        self.hub.delete('side-quest')
        self.assertNotIn('side-quest', self.hub.projects)
        self.assertFalse((self.root / 'side-quest').exists())
        self.assertTrue((self.root / '.deleted' / 'side-quest' / 'taska.jsonl').is_file())
        self.assertEqual([(d['name'], d['title'], d['items']) for d in self.hub.deleted()], [('side-quest', 'Side Quest', 2)])
        self.assertTrue(s.next_text()[0].startswith('Project side-quest was deleted'))
        self.assertTrue(s.run_all([(0, {'op': 'new', 'title': 'Too late'})], 'you')[0][0].startswith('err'))  # nothing more is written
        self.assertEqual(self.hub.add('Side quest!').name, 'side-quest-2')  # its address stays taken
        r = self.hub.restore('side-quest')
        self.assertEqual((r.title, sorted(i['title'] for i in r.active())), ('Side Quest', ['One', 'Two']))
        self.assertEqual(self.hub.deleted(), [])
        self.assertFalse((self.root / 'side-quest' / 'deleted.json').exists())
        self.items(r, 'Three')  # it works again

    def test_delete_forever_only_once_deleted(self):
        self.hub.add('Old')
        with self.assertRaises(taska.Err):
            self.hub.purge('old')  # not deleted
        self.hub.delete('old')
        self.hub.purge('old')
        self.assertFalse((self.root / '.deleted' / 'old').exists())
        for bad in ('old', '../default', ''):
            with self.assertRaises(taska.Err):
                self.hub.restore(bad)
        with self.assertRaises(taska.Err):
            self.hub.purge('../default')
        self.assertTrue((self.root / 'default' / 'taska.jsonl').is_file())


class ApiTests(unittest.TestCase):
    """The same through the API the page uses, and what an agent hears."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        with socket.socket() as s:
            s.bind(('127.0.0.1', 0))
            cls.port = s.getsockname()[1]
        cls.srv = subprocess.Popen([sys.executable, str(REPO / 'taska.py'), '--host', '127.0.0.1', '--port', str(cls.port), '--root', cls.tmp.name,
                                    '--organizer', 'off'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(100):
            try:
                urllib.request.urlopen(f'http://127.0.0.1:{cls.port}/health', timeout=1)
                break
            except OSError:
                time.sleep(0.05)

    @classmethod
    def tearDownClass(cls):
        cls.srv.terminate()
        cls.srv.wait(5)
        cls.tmp.cleanup()

    def call(self, path, body=None):
        req = urllib.request.Request(f'http://127.0.0.1:{self.port}{path}', data=None if body is None else json.dumps(body).encode(),
                                     headers={'Content-Type': 'application/json', 'User-Agent': 'curl/8'}, method='GET' if body is None else 'POST')
        try:
            with urllib.request.urlopen(req, timeout=5) as r:
                text = r.read().decode()
                return r.status, json.loads(text) if r.headers.get_content_type() == 'application/json' else text
        except urllib.error.HTTPError as ex:
            text = ex.read().decode()
            return ex.code, json.loads(text) if ex.headers.get_content_type() == 'application/json' else text

    def test_the_whole_way_round(self):
        code, d = self.call('/api/projects', {'title': 'Website 官网'})
        self.assertEqual((code, d['name'], d['title']), (200, 'website', 'Website 官网'))
        self.assertEqual(self.call('/api/projects', {'name': 'plain'})[1]['name'], 'plain')  # the old way still works
        self.assertEqual({p['name']: p['title'] for p in self.call('/api/projects')[1]}['website'], 'Website 官网')
        code, d = self.call('/api/projects/rename', {'name': 'website', 'title': 'Site'})
        self.assertEqual((code, d['title'], d['was']), (200, 'Site', 'Website 官网'))
        self.assertEqual(self.call('/p/website/api/state')[1]['title'], 'Site')
        self.assertEqual(self.call('/api/projects/delete', {'name': 'website'})[0], 200)
        self.assertNotIn('website', [p['name'] for p in self.call('/api/projects')[1]])
        self.assertEqual([d['title'] for d in self.call('/api/projects/deleted')[1]], ['Site'])
        code, text = self.call('/p/website/next?by=codex')
        self.assertEqual(code, 404)
        self.assertIn('was deleted', text)
        self.assertEqual(self.call('/api/projects/restore', {'name': 'website'})[1]['title'], 'Site')
        self.assertTrue(self.call('/p/website/next?by=codex')[1].startswith('keep-going'))
        self.call('/api/projects/delete', {'name': 'website'})
        self.assertEqual(self.call('/api/projects/purge', {'name': 'website'})[0], 200)
        self.assertEqual(self.call('/api/projects/deleted')[1], [])
        code, d = self.call('/api/projects/rename', {'name': 'nope', 'title': 'x'})
        self.assertEqual((code, d['ok']), (400, False))


if __name__ == '__main__':
    unittest.main()
