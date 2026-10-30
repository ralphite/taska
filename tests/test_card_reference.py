"""F568: an agent reading an item gets, last, every input it came from in time order: the words once, with one line
for those already in the body or the thread above."""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.agent_text.render import Reading, card  # noqa: E402
from taska.domain.projection.core import replay  # noqa: E402

T = "2026-10-30T13:%02d:00-07:00"


def reading():
    rows = [
        {"k": "in", "id": "r1", "by": "you", "text": "Export keeps the filter.", "q": "q1", "t": T % 1},
        {"k": "add", "n": 1, "by": "org", "title": "Export filter", "src": "r1", "type": "bug", "pri": "P1", "when": "now",
         "status": "open", "body": "Export keeps the filter.", "t": T % 2},
        {"k": "in", "id": "r2", "by": "you", "text": "And the sort too.", "scope": 1, "q": "q2", "t": T % 3},
    ]
    st = replay(rows, lambda seq, why: None)
    return Reading(state=st, held=lambda inp: False, organizer_on=False, file_ref=lambda f: f, file_path=lambda f: f)


class Reference(unittest.TestCase):
    def test_last_and_in_time_order_once(self):
        rd = reading()
        text = card(rd, rd.state.items[1])
        ref = text[text.index("reference: the user's own words"):]
        self.assertTrue(text.rstrip().endswith(ref.rstrip()))  # the last section
        self.assertIn("r1 10-30 13:01: in the body above", ref)
        self.assertRegex(ref, r"r2 10-30 13:03: in the thread above \(#\d+\)")
        self.assertLess(ref.index("r1 "), ref.index("r2 "))


if __name__ == "__main__":
    unittest.main()
