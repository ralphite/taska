"""B606 (Yadong's choice, #8331): /next puts an item Yadong replied on first while an agent is working on it (in
progress); otherwise his reply waits its turn by priority, so a P2 he wrote on does not jump ahead of a P0. In progress
means an agent is working on it now (r942); asking does not change the status (D110)."""

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


class NextOrder(unittest.TestCase):
    proc: "subprocess.Popen[bytes]"
    base: str

    @classmethod
    def setUpClass(cls) -> None:
        s = socket.socket()
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
        s.close()
        cls.base = f"http://127.0.0.1:{port}"
        root = tempfile.mkdtemp(prefix="taska-next-")
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

    def next(self) -> str:
        return urllib.request.urlopen(self.p + "/next?by=claude-code", timeout=10).read().decode()

    def new(self, line: str) -> str:
        code = self.do(f"new {line}\n").split()[1]
        self.page({"op": "set", "ref": code, "f": {"status": "open"}})  # Yadong approves it
        return code

    def test_replies_on_started_work_first_new_work_by_priority(self) -> None:
        low = self.new("task P2 now Tidy the footer")
        high = self.new("bug P0 now Saving drops the last word")
        self.do(f"{low} progress Looked at the footer: the colours are off.\n")
        self.page({"op": "say", "ref": low, "text": "Use the grey from the header."})
        self.assertIn(f"next {high}", self.next())  # a reply on work not begun waits for the P0
        self.do(f"{high} doing\n{high} done\n")
        self.assertIn(f"resume {low}: the user replied", self.next())  # then its turn comes, with the reply shown
        self.do(f"{low} doing\n{low} progress Tried the header's grey.\n")
        other = self.new("bug P0 now Export ignores the filter")
        self.page({"op": "say", "ref": low, "text": "Darker, please."})
        self.assertIn(f"resume {low}: the user replied", self.next())  # begun: his reply comes before the new P0
        self.assertNotIn(f"next {other}", self.next())
        self.do(f"{other} doing\n{other} ask Keep the old export as well?\n")
        self.assertIn("doing", self.status(other))  # asking leaves the status as it is (D110: no automatic open)
        self.page({"op": "say", "ref": other, "text": "No."})
        self.assertRegex(self.next(), rf"resume ({low}|{other}): the user replied")  # both begun: a reply comes first


if __name__ == "__main__":
    unittest.main()
