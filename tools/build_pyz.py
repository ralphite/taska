"""Build the release: one file, taska.pyz, that runs everything with `python3 taska.pyz` (no Node, no packages).

It holds the server (server/taska) and the built page (web/dist, made by `npm run build` in web).

    python3 tools/build_pyz.py                 build the page, then dist/taska.pyz
    python3 tools/build_pyz.py --skip-web      use the page already built in web/dist
    python3 tools/build_pyz.py --out /tmp/taska.pyz
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import zipapp

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVER = os.path.join(ROOT, "server", "taska")
WEB = os.path.join(ROOT, "web")
DIST = os.path.join(WEB, "dist")


def main() -> int:
    ap = argparse.ArgumentParser(description="Build taska.pyz")
    ap.add_argument("--skip-web", action="store_true", help="use the page already in web/dist")
    ap.add_argument("--out", default=os.path.join(ROOT, "dist", "taska.pyz"))
    a = ap.parse_args()
    if not a.skip_web:
        npm = shutil.which("npm")
        if not npm:
            print("npm is needed to build the page (or pass --skip-web)", file=sys.stderr)
            return 1
        subprocess.run([npm, "run", "build"], cwd=WEB, check=True)
    if not os.path.isfile(os.path.join(DIST, "index.html")):
        print(f"no built page in {DIST}: run `npm run build` in web", file=sys.stderr)
        return 1
    with tempfile.TemporaryDirectory() as tmp:
        pkg = os.path.join(tmp, "taska")
        shutil.copytree(SERVER, pkg, ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "web_dist"))
        shutil.copytree(DIST, os.path.join(pkg, "web_dist"))
        with open(os.path.join(tmp, "__main__.py"), "w", encoding="utf-8") as f:
            f.write("from taska.cli import main\n\nmain()\n")
        os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
        zipapp.create_archive(tmp, target=a.out, interpreter="/usr/bin/env python3", compressed=True)
    print(f"{a.out}  {os.path.getsize(a.out) // 1024} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
