"""B607 (Yadong's choice, #7744): words Yadong writes on an item that waits for review, without Accept, take it back to
in progress, so its mark and "Your agent's turn" agree. An agent's words, and Accept, do not."""

from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class ReplyOnAnItemInReview(unittest.TestCase):
    proc: "subprocess.Popen[bytes]"
    base: str

    @classmethod
    def setUpClass(cls) -> None:
        s = socket.socket()
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
        s.close()
        cls.base = f"http://127.0.0.1:{port}"
        root = tempfile.mkdtemp(prefix="taska-review-")
        env = {k: v for k, v in os.environ.items() if "KEY" not in k}
        cls.proc = subprocess.Popen([sys.executable, "-m", "taska", "serve", "--host", "127.0.0.1", "--port", str(port), "--root",
                                     os.path.join(root, "data"), "--organizer", "off", "--log-db", ""], cwd=os.path.join(ROOT, "server"),
                                    env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(150):
            try:
                urllib.request.urlopen(cls.base + "/health", timeout=2)
                break
            except OSError:
                time.sleep(0.1)
        req = urllib.request.Request(cls.base + "/api/projects", data=b'{"title": "demo"}', headers={"Content-Type": "application/json"})
        cls.p = cls.base + "/p/" + json.loads(urllib.request.urlopen(req, timeout=10).read())["name"]

    @classmethod
    def tearDownClass(cls) -> None:
        cls.proc.terminate()
        cls.proc.wait(10)

    def do(self, text: str) -> str:
        return urllib.request.urlopen(urllib.request.Request(self.p + "/do?by=claude-code", data=text.encode()), timeout=10).read().decode()

    def page(self, *commands: dict) -> None:
        body = json.dumps({"id": f"t-{time.time()}", "commands": list(commands)}).encode()
        urllib.request.urlopen(urllib.request.Request(self.p + "/api/commands", data=body, headers={"Content-Type": "application/json"}), timeout=10).read()

    def status(self, code: str) -> str:
        return urllib.request.urlopen(self.p + f"/{code}?ui=1", timeout=10).read().decode().split("\n", 1)[0]

    def test_yadongs_words_take_it_back_to_in_progress(self) -> None:
        code = self.do("new task P1 now Export keeps the filter\n").split()[1]
        self.page({"op": "set", "ref": code, "f": {"status": "open"}})  # Yadong approves it
        self.do(f"{code} doing\n")
        self.do(f"{code} done\n")
        self.assertIn("review", self.status(code))
        self.do(f"{code} progress Handed over.\n")  # an agent's words leave it waiting for review
        self.assertIn("review", self.status(code))
        self.page({"op": "input", "text": "The sort is lost too.", "scope": code})
        self.assertIn("doing", self.status(code))


if __name__ == "__main__":
    unittest.main()
