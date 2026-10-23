"""T487: each word a voice note got wrong and someone corrected goes into the log (kind voicefix), counted by SQL."""

from __future__ import annotations

import json
import os
import shutil
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
SERVER = os.path.join(os.path.dirname(HERE), "server")
COUNT = ("select lower(json_extract(data,'$.wrong')) heard, lower(json_extract(data,'$.right')) said, count(*) n "
         "from logs where kind='voicefix' group by 1, 2 order by n desc")


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


class VoiceFixTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.mkdtemp()
        shutil.copytree(os.path.join(REPO, "tests", "fixtures", "my-app"), os.path.join(self.tmp, "old", "my-app"))
        self.root = os.path.join(self.tmp, "new")
        subprocess.run([sys.executable, "-m", "taska", "import", "--from", os.path.join(self.tmp, "old"), "--to", self.root],
                       cwd=SERVER, check=True, capture_output=True)
        self.port = free_port()
        self.srv = subprocess.Popen([sys.executable, "-m", "taska", "serve", "--port", str(self.port), "--root", self.root, "--organizer", "off"],
                                    cwd=SERVER, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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

    def post(self, path: str, body: dict) -> dict:
        r = urllib.request.Request(f"http://127.0.0.1:{self.port}{path}", json.dumps(body).encode(), {"Content-Type": "application/json"})
        return json.load(urllib.request.urlopen(r, timeout=5))

    def rows(self, sql: str) -> list:
        for _ in range(50):  # the log is written from a thread of its own
            db = sqlite3.connect(os.path.join(self.root, "logs.db"))
            try:
                out = db.execute(sql).fetchall()
            except sqlite3.OperationalError:
                out = []
            db.close()
            if out:
                return out
            time.sleep(0.1)
        return []

    def test_fixes_are_logged_and_counted(self) -> None:
        rid = self.post("/p/my-app/api/op", {"op": "input", "text": "the escape button is gray"})["res"][0].split()[1]
        self.post("/p/my-app/api/op", {"op": "correct", "id": rid, "wrong": "escape", "right": "skip", "v": 0})
        self.post("/api/corrections", {"wrong": "Escape", "right": "skip", "project": "my-app", "item": "B1", "file": "f9-voice.webm"})
        self.post("/api/corrections", {"wrong": "Escape", "right": "skip", "undo": True})  # putting back a fix is no new error
        self.post("/api/corrections", {"right": "Taska"})  # a word to hear right is not a fix
        time.sleep(0.5)
        self.assertEqual(self.rows(COUNT), [("escape", "skip", 2)])
        got = self.rows("select project, who, data from logs where kind='voicefix' order by id")
        self.assertEqual([(p, w, json.loads(d)["via"]) for p, w, d in got], [("my-app", "you", "input"), ("my-app", "you", "draft")])
        self.assertEqual(json.loads(got[0][2])["input"], rid)
        self.assertEqual(json.loads(got[1][2]), {"wrong": "Escape", "right": "skip", "via": "draft", "file": "f9-voice.webm"})


if __name__ == "__main__":
    unittest.main()
