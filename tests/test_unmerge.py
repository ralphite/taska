"""An old rule merged into another can be taken back out and retired (10-30): it keeps its words and history, shows
again as its own item, and the one it went into says it was taken out."""

from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class TakeOutOfAMerge(unittest.TestCase):
    proc: "subprocess.Popen[bytes]"

    @classmethod
    def setUpClass(cls) -> None:
        s = socket.socket()
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
        s.close()
        base = f"http://127.0.0.1:{port}"
        root = tempfile.mkdtemp(prefix="taska-unmerge-")
        env = {k: v for k, v in os.environ.items() if "KEY" not in k}
        cls.proc = subprocess.Popen([sys.executable, "-m", "taska", "serve", "--host", "127.0.0.1", "--port", str(port), "--root",
                                     os.path.join(root, "data"), "--organizer", "off", "--log-db", ""], cwd=os.path.join(ROOT, "server"),
                                    env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(150):
            try:
                urllib.request.urlopen(base + "/health", timeout=2)
                break
            except OSError:
                time.sleep(0.1)
        req = urllib.request.Request(base + "/api/projects", data=b'{"title": "demo"}', headers={"Content-Type": "application/json"})
        cls.p = base + "/p/" + json.loads(urllib.request.urlopen(req, timeout=10).read())["name"]

    @classmethod
    def tearDownClass(cls) -> None:
        cls.proc.terminate()
        cls.proc.wait(10)

    def do(self, text: str) -> str:
        return urllib.request.urlopen(urllib.request.Request(self.p + "/do?by=claude-code", data=text.encode()), timeout=10).read().decode()

    def page(self, *commands: dict) -> dict:
        body = json.dumps({"id": f"t-{time.time()}", "commands": list(commands)}).encode()
        req = urllib.request.Request(self.p + "/api/commands", data=body, headers={"Content-Type": "application/json"})
        try:
            return json.loads(urllib.request.urlopen(req, timeout=10).read())
        except urllib.error.HTTPError as e:
            return json.loads(e.read())

    def card(self, code: str) -> str:
        """A rule's card by its number: "R1" alone would name input r1."""
        return urllib.request.urlopen(self.p + f"/{code.lstrip('R')}?ui=1", timeout=10).read().decode()

    def test_taken_out_and_retired(self) -> None:
        old = self.do("new rule P1 now Long replies go in a document\n").split()[1]
        new = self.do("new rule P0 now How we talk\n").split()[1]
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
