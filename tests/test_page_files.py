"""The same page assets are served from a source build, an explicit deployment folder and a release archive."""

import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server"))

from taska.http.static import PageFiles  # noqa: E402


class PageFilesTest(unittest.TestCase):
    def test_explicit_folder_and_asset_policy(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            (folder / "assets").mkdir()
            (folder / "index.html").write_bytes(b'<script src="/assets/index-test.js"></script>')
            (folder / "assets/index-test.js").write_bytes(b"export {}")
            (folder / "sw.js").write_bytes(b"self.skipWaiting()")
            page = PageFiles(temp)
            self.assertEqual(page.version(), "index-test.js")
            self.assertEqual(page.file("/assets/index-test.js"),
                             (b"export {}", "text/javascript; charset=utf-8", "public, max-age=31536000, immutable"))
            self.assertEqual(page.file("/sw.js")[2], "no-cache")
            self.assertIsNone(page.read("../index.html"))
            self.assertIsNone(page.read("/etc/passwd"))
            self.assertIsNone(page.read("..\\index.html"))
            self.assertIsNone(page.file("/assets/../index.html"))
            self.assertIsNone(page.file("/missing.js"))
            with patch.dict(os.environ, {"TASKA_WEB_DIST": temp}):
                self.assertEqual(PageFiles().index(), page.index())

    def test_zipapp_reads_its_bundled_page(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            stage = root / "stage"
            shutil.copytree(ROOT / "server/taska", stage / "taska", ignore=shutil.ignore_patterns("__pycache__"))
            public = stage / "taska/web_dist"
            (public / "assets").mkdir(parents=True)
            (public / "index.html").write_bytes(b'<script src="/assets/index-release.js"></script>')
            (public / "assets/index-release.js").write_bytes(b"release asset")
            (stage / "__main__.py").write_text(
                "from taska.http.static import PageFiles\n"
                "page = PageFiles()\n"
                "assert page.version() == 'index-release.js'\n"
                "assert page.file('/assets/index-release.js')[0] == b'release asset'\n"
                "assert page.index().startswith(b'<script')\n"
                "assert page.file('/assets/missing.js') is None\n"
                "print('bundled page served')\n"
            )
            archive = root / "taska.pyz"
            with zipfile.ZipFile(archive, "w") as out:
                for path in stage.rglob("*"):
                    if path.is_file():
                        out.write(path, path.relative_to(stage))
            env = {k: v for k, v in os.environ.items() if k not in ("PYTHONPATH", "TASKA_WEB_DIST")}
            result = subprocess.run([sys.executable, str(archive)], cwd=temp, env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("bundled page served", result.stdout)


if __name__ == "__main__":
    unittest.main()
