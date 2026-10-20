"""F291: the user's order (rank) comes before priority; items never placed go in by priority."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "server"))
from taska.views import sort_queue  # noqa: E402


def item(n, pri, rank=None, status="open"):
    return {"n": n, "pri": pri, "rank": rank, "status": status}


class QueueOrderTests(unittest.TestCase):
    def codes(self, items):
        return [i["n"] for i in sort_queue(items)]

    def test_without_an_order_priority_then_oldest(self):
        self.assertEqual(self.codes([item(3, "P1"), item(1, "P2"), item(2, "P1")]), [2, 3, 1])

    def test_your_order_beats_priority(self):
        self.assertEqual(self.codes([item(1, "P0", rank=1), item(2, "P2", rank=0)]), [2, 1])

    def test_new_items_go_in_by_priority(self):
        # your order: 10 (P2), 11 (P0), 12 (P3); a new P1 goes before the first of them with a lower priority
        got = self.codes([item(10, "P2", 0), item(11, "P0", 1), item(12, "P3", 2), item(20, "P1"), item(21, "P3")])
        self.assertEqual(got, [20, 10, 11, 12, 21])

    def test_in_progress_first(self):
        self.assertEqual(self.codes([item(1, "P0", rank=0), item(2, "P3", status="doing")]), [2, 1])


if __name__ == "__main__":
    unittest.main()
