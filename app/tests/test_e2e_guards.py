"""The browser checks of Yadong's requirements (app/web/e2e) each say what they guard, so a ship runs the ones its
change can break: every file or folder named there must exist, or the check would never run for it."""

import os
import re
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))

import e2e  # noqa: E402


class GuardsTest(unittest.TestCase):
    def test_every_guard_names_something_there(self) -> None:
        missing = []
        for spec, paths in e2e.guards().items():
            for g in paths:
                where = os.path.join(e2e.APP, g) if g.startswith("server/") else os.path.join(e2e.WEB, g)
                if not os.path.exists(where.rstrip("/")):
                    missing.append(f"{spec}: {g}")
        self.assertEqual(missing, [])

    def test_a_requirement_check_starts_with_its_codes(self) -> None:
        bad = []
        for spec in e2e.guards():
            if not spec.startswith("e2e/req/"):
                continue
            with open(os.path.join(e2e.WEB, spec), encoding="utf-8") as fh:
                for title in re.findall(r"^\s*test\(\s*[`'\"](.+?)[`'\"],", fh.read(), re.M):
                    if not re.match(r"(r\d+|[A-Z]\d+|#\d+)\b", title):
                        bad.append(f"{spec}: {title[:60]}")
        self.assertEqual(bad, [])


if __name__ == "__main__":
    unittest.main()
