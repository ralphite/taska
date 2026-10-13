"""The page's addresses (T102, B162): a browser opening one gets the page, an agent's curl keeps getting text."""
import shutil
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
SECTIONS = ('settings', 'connect', 'phone', 'spellings', 'log', 'about')  # the sections of This project
BROWSER = {'Sec-Fetch-Mode': 'navigate', 'Accept': 'text/html', 'User-Agent': 'Mozilla/5.0'}


class ViewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        shutil.copytree(REPO / 'tests' / 'fixtures' / 'my-app', Path(cls.tmp.name) / 'my-app')
        with socket.socket() as s:
            s.bind(('127.0.0.1', 0))
            port = s.getsockname()[1]
        cls.base = f'http://127.0.0.1:{port}/p/my-app/'
        cls.srv = subprocess.Popen([sys.executable, str(REPO / 'taska.py'), '--host', '127.0.0.1', '--port', str(port), '--root', cls.tmp.name,
                                    '--organizer', 'off'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(100):
            try:
                urllib.request.urlopen(cls.base + 'rules', timeout=1)
                break
            except OSError:
                time.sleep(0.05)

    @classmethod
    def tearDownClass(cls):
        cls.srv.terminate()
        cls.srv.wait(5)
        cls.tmp.cleanup()

    def get(self, path, headers=None):
        try:
            with urllib.request.urlopen(urllib.request.Request(self.base + path, headers=headers or {'User-Agent': 'curl/8'}), timeout=5) as r:
                return r.status, r.headers.get('Content-Type', ''), r.read().decode()
        except urllib.error.HTTPError as ex:
            return ex.code, ex.headers.get('Content-Type', ''), ex.read().decode()

    def test_each_section_opens_the_page_in_a_browser(self):
        for sec in SECTIONS:
            code, ctype, body = self.get(sec, BROWSER)
            self.assertEqual((code, ctype.split(';')[0]), (200, 'text/html'), sec)
            self.assertTrue('id="projectNav"' in body, f'/{sec} is not the page with the sections')

    def test_agents_keep_the_text_of_connect_and_log(self):
        code, _, body = self.get('connect')
        self.assertEqual(code, 200)
        self.assertTrue(body.startswith('#!/bin/sh'), body[:40])
        code, _, body = self.get('log?n=3')
        self.assertEqual(code, 200)
        self.assertTrue(body.strip() and all(line.startswith('#') for line in body.strip().split('\n')), body)

    def test_the_other_sections_are_not_agent_addresses(self):
        for sec in ('settings', 'phone', 'spellings', 'about'):
            self.assertEqual(self.get(sec)[0], 404, sec)


if __name__ == '__main__':
    unittest.main(verbosity=2)
