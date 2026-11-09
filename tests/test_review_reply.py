"""B607 (Yadong's choice, #7744): words Yadong writes on an item that waits for review, without Accept, take it back to
in progress, so its mark and "Your agent's turn" agree. An agent's words, and Accept, do not. r1082: a reply on an item
already done opens it again too. Change only on Yadong's explicit word."""

from __future__ import annotations

import unittest
import urllib.request

from support import ServerCase


class ReplyOnAnItemInReview(ServerCase):
    def status(self, code: str) -> str:
        return urllib.request.urlopen(self.p + f"/{code}?ui=1", timeout=10).read().decode().split("\n", 1)[0]

    def test_yadongs_words_take_it_back_to_open(self) -> None:
        code = self.do("new task P1 now Export keeps the filter\n").split()[1]
        self.page({"op": "set", "ref": code, "f": {"status": "open"}})  # Yadong approves it
        self.do(f"{code} doing\n")
        self.do(f"{code} done\n")
        self.assertIn("review", self.status(code))
        self.do(f"{code} progress Handed over.\n")  # an agent's words leave it waiting for review
        self.assertIn("review", self.status(code))
        self.page({"op": "input", "text": "The sort is lost too.", "scope": code})
        self.assertIn("open", self.status(code))

    def test_a_reply_on_a_done_item_opens_it(self) -> None:
        code = self.do("new task P1 now Import keeps the order\n").split()[1]
        self.page({"op": "set", "ref": code, "f": {"status": "done"}})  # Yadong marks it done
        self.assertIn("done", self.status(code))
        self.do(f"{code} say Noted.\n")  # an agent's words leave it done
        self.assertIn("done", self.status(code))
        self.page({"op": "input", "text": "One more thing.", "scope": code})
        self.assertIn("open", self.status(code))


if __name__ == "__main__":
    unittest.main()
