"""B326: a save the page sends again under the same id (after a lost answer) is done once."""

from __future__ import annotations

import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


class OpOnceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.mkdtemp()
        shutil.copytree(os.path.join(REPO, "tests", "fixtures", "my-app"), os.path.join(self.tmp, "old", "my-app"))
        subprocess.run([sys.executable, "-m", "taska", "import", "--from", os.path.join(self.tmp, "old"), "--to", os.path.join(self.tmp, "new")],
                       cwd=os.path.join(os.path.dirname(HERE), "server"), check=True, capture_output=True)
        self.port = free_port()
        self.srv = subprocess.Popen([sys.executable, "-m", "taska", "serve", "--port", str(self.port), "--root", os.path.join(self.tmp, "new"), "--organizer", "off"],
                                    cwd=os.path.join(os.path.dirname(HERE), "server"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(100):
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{self.port}/health", timeout=1)
                break
            except OSError:
                time.sleep(0.1)

    def tearDown(self) -> None:
        self.srv.terminate()
        self.srv.wait(5)
        shutil.rmtree(self.tmp, ignore_errors=True)

    def post(self, cid: str) -> dict:
        body = json.dumps({"op": "input", "text": "said once"}).encode()
        r = urllib.request.Request(f"http://127.0.0.1:{self.port}/p/my-app/api/op?cid={cid}", body, {"Content-Type": "application/json"})
        return json.load(urllib.request.urlopen(r, timeout=5))

    def test_the_same_save_twice_is_done_once(self) -> None:
        a, b = self.post("c1"), self.post("c1")
        self.assertEqual(a["res"], b["res"])
        self.post("c2")
        inbox = urllib.request.urlopen(f"http://127.0.0.1:{self.port}/p/my-app/inbox?ui=1", timeout=5).read().decode()
        self.assertEqual(inbox.count("said once"), 2)  # c1 once, c2 once


if __name__ == "__main__":
    unittest.main()
