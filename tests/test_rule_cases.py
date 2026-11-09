"""The page's copies of the server's rules are checked against cases the server's own code made
(web/src/model/ruleCases.gen.ts, written by tools/rule_cases.py). This writes them again and fails when the file is
stale: run `python3 tools/rule_cases.py`, then `npm --prefix web test` says which copy no longer agrees."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import rule_cases  # noqa: E402


class RuleCasesAreCurrent(unittest.TestCase):
    def test_the_cases_are_the_servers(self) -> None:
        with open(rule_cases.OUT, encoding="utf-8") as fh:
            kept = fh.read()
        self.assertTrue(rule_cases.render() == kept, "web/src/model/ruleCases.gen.ts is stale: run python3 tools/rule_cases.py")


if __name__ == "__main__":
    unittest.main()
