"""B832 (r1423): a waiting session handed the same item, unchanged, three times in a row and not taking it (it waited
for its own item only: a P0 item went to nobody for nine hours) is told about once to the user on that item; the item
is no longer held for it, so other sessions get it, and its own wait holds instead of answering at once again."""

import time
import unittest
import urllib.request

from support import ServerCase
from taska.domain.offers import Offers


class OffersAlone(unittest.TestCase):
    def test_three_times_unchanged_is_not_taken_and_told_once(self) -> None:
        o = Offers()
        self.assertFalse(o.handed("s", 5, "a"))
        self.assertFalse(o.handed("s", 5, "a"))
        self.assertFalse(o.passed("s", 5, "a"))
        self.assertTrue(o.handed("s", 5, "a"))
        self.assertTrue(o.passed("s", 5, "a"))
        self.assertFalse(o.handed("s", 5, "a"))  # told once
        self.assertFalse(o.passed("s", 5, "b"))  # the item changed: handed to it again

    def test_anything_done_on_it_or_another_item_starts_the_count_again(self) -> None:
        o = Offers()
        o.handed("s", 5, "a")
        o.handed("s", 5, "b")
        o.handed("s", 6, "a")
        self.assertFalse(o.handed("s", 5, "b"))


class OffersServed(ServerCase):
    def wait(self, session: str, secs: int = 1) -> "tuple[str, float]":
        t0 = time.time()
        text = urllib.request.urlopen(self.p + f"/next?by=claude-code&session={session}&wait={secs}", timeout=secs + 10).read().decode()
        return text, time.time() - t0

    def test_a_session_that_does_not_take_its_work_lets_it_go_and_the_user_is_told(self) -> None:
        self.do("new P0 now Look up the nerve map\n", session="other")
        self.page({"op": "set", "ref": "T1", "f": {"status": "open"}})
        for _ in range(3):
            text, took = self.wait("t31")
            self.assertIn("next T1", text)
            self.assertLess(took, 0.9)
        card = urllib.request.urlopen(self.p + "/T1?by=claude-code").read().decode()
        self.assertIn("taska", card)
        self.assertIn("连着 3 次拿到这件都没接", card)
        # its wait now holds; another session is handed the item
        _, took = self.wait("t31")
        self.assertGreaterEqual(took, 0.9)
        self.assertIn("next T1", self.wait("fresh")[0])


if __name__ == "__main__":
    unittest.main()
