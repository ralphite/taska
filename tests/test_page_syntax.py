"""The page's scripts parse (a stray comment or brace once left the whole app on Loading). Needs node; skipped without."""
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

SRC = (Path(__file__).resolve().parents[1] / 'taska.py').read_text(encoding='utf-8')


def scripts(name):
    start = SRC.index(f"{name} = r'''") + len(f"{name} = r'''")
    page = SRC[start:SRC.index("'''", start)]
    return '\n'.join(re.findall(r'<script>(.*?)</script>', page, re.S))


@unittest.skipUnless(shutil.which('node'), 'node is not installed')
class PageSyntaxTests(unittest.TestCase):
    def check(self, name):
        with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
            f.write(scripts(name))
        r = subprocess.run(['node', '--check', f.name], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr[:800])

    def test_app_page_parses(self):
        self.check('PAGE')

    def test_index_page_parses(self):
        self.check('INDEX')


if __name__ == '__main__':
    unittest.main()
