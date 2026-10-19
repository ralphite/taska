"""The page's behaviour tests (v2/web/e2e), run against a Taska on a fresh, empty data folder.

The same tests run against v2 and against the old one-file app: they are what v2 must do as the old app did.

    python3 v2/tests/run_e2e.py                      against v2 (build the page first: npm run build in v2/web)
    python3 v2/tests/run_e2e.py --old path/taska.py  against the old app
    python3 v2/tests/run_e2e.py -- --project=phone   anything after -- goes to Playwright

Each test makes its own project through the agent interface, so the tests never share data and never touch
~/.taska.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import V2, Server  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--old", help="run against this old taska.py instead of v2")
    ap.add_argument("rest", nargs=argparse.REMAINDER)
    a = ap.parse_args()
    srv = Server(a.old or "v2")
    try:
        env = dict(os.environ, TASKA_URL=srv.base)
        rest = [x for x in a.rest if x != "--"]
        return subprocess.run(["npx", "playwright", "test", *rest], cwd=os.path.join(V2, "web"), env=env).returncode
    finally:
        srv.stop()


if __name__ == "__main__":
    sys.exit(main())
