"""B741: a session waiting for work (/next?wait=N) is not woken by the item it already holds and works on, so a
background wait that only gets its own doing item back holds instead of answering at once; a plain /next still gives
that item (a session that lost its place finds it again), and anything new wakes the wait."""

import threading
import time
import unittest
import urllib.request

from support import ServerCase


class WaitOwnItem(ServerCase):
    def next(self, wait: int = 0, session: str = "main") -> "tuple[str, float]":
        url = self.p + f"/next?by=claude-code&session={session}" + (f"&wait={wait}" if wait else "")
        t0 = time.time()
        text = urllib.request.urlopen(url, timeout=wait + 10).read().decode()
        return text, time.time() - t0

    def test_a_wait_holds_over_its_own_doing_item_and_wakes_for_new_work(self) -> None:
        self.do("new task P1 now Ship the export\n", session="main")
        self.page({"op": "set", "ref": "T1", "f": {"status": "open"}})
        first, _ = self.next()
        self.assertIn("next T1", first)
        self.page({"op": "set", "ref": "T1", "f": {"status": "doing"}})
        self.assertIn("next T1", self.next()[0])  # it holds its doing item

        # its own doing item again: the wait holds to its end, then says it once
        text, took = self.next(wait=2)
        self.assertGreaterEqual(took, 1.8, "the wait was woken by the item it already holds")
        self.assertIn("next T1", text)

        # a plain /next still gives the session its item at once
        text, took = self.next()
        self.assertIn("next T1", text)
        self.assertLess(took, 1.5)

        # something new wakes the wait before its end
        later = threading.Timer(1.0, lambda: self.page({"op": "input", "text": "Also the sort, please.", "q": "w1"}))
        later.start()
        text, took = self.next(wait=8)
        later.join()
        self.assertLess(took, 6, "new work did not wake the wait")
        self.assertNotIn("nothing to do now", text)


if __name__ == "__main__":
    unittest.main()
