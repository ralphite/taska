"""The page's copies of the server's rules are checked against cases the server's own code made
(web/src/model/ruleCases.gen.ts), and its words are the server's (web/src/model/vocab.gen.ts), both written by
tools/rule_cases.py. This writes them again and fails when a file is stale: run `python3 tools/rule_cases.py`, then
`npm --prefix web run check` says which copy no longer agrees."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import rule_cases  # noqa: E402


class RuleCasesAreCurrent(unittest.TestCase):
    def test_the_cases_and_the_words_are_the_servers(self) -> None:
        for path, text in zip((rule_cases.OUT, rule_cases.VOCAB), rule_cases.render()):
            with open(path, encoding="utf-8") as fh:
                kept = fh.read()
            self.assertTrue(text == kept, f"{Path(path).name} is stale: run python3 tools/rule_cases.py")


if __name__ == "__main__":
    unittest.main()
