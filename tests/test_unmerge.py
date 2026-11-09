"""An item merged into another can be taken back out and closed (10-30): it keeps its words and history, shows again
as its own item, and the one it went into says it was taken out."""

from __future__ import annotations

import json
import time
import unittest
import urllib.error
import urllib.request

from support import ServerCase


class TakeOutOfAMerge(ServerCase):
    def page(self, *commands: dict) -> dict:
        body = json.dumps({"id": f"t-{time.time()}", "commands": list(commands)}).encode()
        req = urllib.request.Request(self.p + "/api/commands", data=body, headers={"Content-Type": "application/json"})
        try:
            return json.loads(urllib.request.urlopen(req, timeout=10).read())
        except urllib.error.HTTPError as e:
            return json.loads(e.read())

    def card(self, code: str) -> str:
        return urllib.request.urlopen(self.p + f"/{code}?ui=1", timeout=10).read().decode()

    def test_taken_out_and_retired(self) -> None:
        old = self.do("new task P1 now Long replies go in a document\n").split()[1]
        new = self.do("new task P0 now How we talk\n").split()[1]
        self.do(f"{old} merge {new}\n")
        self.assertIn(f"merged into {new}", self.card(old))
        self.page({"op": "unmerge", "ref": old}, {"op": "set", "ref": old, "f": {"status": "dropped"}})
        card = self.card(old)
        self.assertNotIn("merged into", card)
        self.assertIn("dropped", card.split("\n", 1)[0])
        self.assertIn("Long replies go in a document", card)
        self.assertIn(f"Took out {old}", self.card(new))
        self.assertIn("not merged", json.dumps(self.page({"op": "unmerge", "ref": old})))


if __name__ == "__main__":
    unittest.main()
