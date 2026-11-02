"""T582 #2 (DNS rebinding): a request from this machine is let in without the key only when its address names this
machine (an IP, localhost, this machine's name); a web page pointing its own domain here still needs the key."""

from __future__ import annotations

import http.client
import os
import socket
import subprocess
import sys
import tempfile
import time
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class KnownHost(unittest.TestCase):
    def setUp(self) -> None:
        s = socket.socket()
        s.bind(("127.0.0.1", 0))
        self.port = s.getsockname()[1]
        s.close()
        root = tempfile.mkdtemp(prefix="taska-host-")
        env = {k: v for k, v in os.environ.items() if "KEY" not in k}
        self.proc = subprocess.Popen([sys.executable, "-m", "taska", "serve", "--host", "127.0.0.1", "--port", str(self.port), "--root",
                                      os.path.join(root, "data"), "--organizer", "off", "--log-db", ""], cwd=os.path.join(ROOT, "server"),
                                     env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.addCleanup(lambda: (self.proc.terminate(), self.proc.wait(10)))
        for _ in range(150):
            try:
                if self.status("127.0.0.1", "/health"):
                    break
            except OSError:
                time.sleep(0.1)

    def status(self, host: str, path: str = "/api/projects") -> int:
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        c.request("GET", path, headers={"Host": host})
        r = c.getresponse()
        r.read()
        c.close()
        return r.status

    def test_only_this_machines_names_skip_the_key(self) -> None:
        for host in (f"127.0.0.1:{self.port}", f"localhost:{self.port}", "taska.localhost", f"[::1]:{self.port}"):
            self.assertEqual(self.status(host), 200, host)
        for host in (f"evil.example.com:{self.port}", "attacker.test"):
            self.assertEqual(self.status(host), 401, host)


if __name__ == "__main__":
    unittest.main()
