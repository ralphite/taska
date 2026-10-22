"""B442: words that start a title stay in it ("new task P1 now Review the pages"), and the organizer, which writes
down what the user said, never puts an item in review."""

from __future__ import annotations

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.dsl import parse_dsl  # noqa: E402


def new(line: str) -> dict:
    op = parse_dsl(line)[0][1]
    assert isinstance(op, dict), op
    return {k: v for k, v in op.items() if k != "body"}


class NewTitleTests(unittest.TestCase):
    def test_status_word_starts_title(self) -> None:
        self.assertEqual(new("new task P1 now Review all pages"),
                         {"op": "new", "title": "Review all pages", "type": "task", "pri": "P1", "when": "now"})
        self.assertEqual(new("new idea Done list")["title"], "Done list")

    def test_capitalized_or_repeated_word_starts_title(self) -> None:
        self.assertEqual(new("new task P1 now Later view")["title"], "Later view")
        self.assertEqual(new("new task Bug in the list")["type"], "task")
        self.assertEqual(new("new bug later Archive page")["title"], "Archive page")

    def test_documented_options_still_count(self) -> None:
        self.assertEqual(new("new bug P1 now parent=B03 src=r12 Export ignores the filter"),
                         {"op": "new", "title": "Export ignores the filter", "type": "bug", "pri": "P1", "when": "now",
                          "parent": "B03", "src": "r12"})
        self.assertEqual(new("new bug status=doing X")["status"], "doing")


if __name__ == "__main__":
    unittest.main()
