"""D115 #20: an empty project's first steps tick themselves from real data. Use on your phone is done once Taska was
opened on a phone (its view asked for by a phone's browser) or a phone gets its pushes; the project's facts say so."""

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
IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148"


class PhoneStep(unittest.TestCase):
    def test_a_phone_opening_taska_ticks_use_on_your_phone(self) -> None:
        s = socket.socket()
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
        s.close()
        base = f"http://127.0.0.1:{port}"
        root = tempfile.mkdtemp(prefix="taska-firstrun-")
        env = {k: v for k, v in os.environ.items() if "KEY" not in k}
        proc = subprocess.Popen([sys.executable, "-m", "taska", "serve", "--host", "127.0.0.1", "--port", str(port), "--root",
                                 os.path.join(root, "data"), "--organizer", "off", "--log-db", ""], cwd=os.path.join(ROOT, "server"),
                                env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            for _ in range(150):
                try:
                    urllib.request.urlopen(base + "/health", timeout=2)
                    break
                except OSError:
                    time.sleep(0.1)

            def phone(ua: str) -> bool:
                req = urllib.request.Request(base + "/p/default/api/view", headers={"User-Agent": ua})
                return json.loads(urllib.request.urlopen(req, timeout=10).read())["project"]["phone"]

            self.assertFalse(phone("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"))
            self.assertTrue(phone(IPHONE))
            self.assertTrue(phone("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"))  # kept: the computer sees it too
        finally:
            proc.terminate()
            proc.wait(10)


if __name__ == "__main__":
    unittest.main()
