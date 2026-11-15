"""B788 (Yadong r1339 "都做"): the voice notes whose words fell back since the last nightly run are filed as one open
bug, once."""

from __future__ import annotations

import http.server
import json
import os
import sqlite3
import sys
import tempfile
import threading
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tools"))

import voice_fallbacks  # noqa: E402


class Fallbacks(unittest.TestCase):
    def setUp(self) -> None:
        self.dir = tempfile.mkdtemp()
        self.db = os.path.join(self.dir, "logs.db")
        con = sqlite3.connect(self.db)
        con.execute("CREATE TABLE logs (id INTEGER PRIMARY KEY, t TEXT, level TEXT, source TEXT, kind TEXT, project TEXT, data TEXT, message TEXT)")
        con.execute("INSERT INTO logs (t, kind, project, data) VALUES ('2026-11-15T00:57:15+00:00', 'voicefallback', 'system-design', ?)",
                    (json.dumps({"f": "f130-voice_4-58.m4a", "why": "tidying (gemini-4-hydrogen) kept the words as said: no answer within 8 s"}),))
        con.execute("INSERT INTO logs (t, kind, data) VALUES ('2026-11-15T00:58:00+00:00', 'gemini', '{}')")
        con.commit()
        con.close()
        self.got = []
        got = self.got

        class Taska(http.server.BaseHTTPRequestHandler):
            def do_POST(self) -> None:  # noqa: N802
                body = self.rfile.read(int(self.headers["Content-Length"])).decode()
                got.append((self.path, body))
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b"ok B900 new\n" if "/do" in self.path else b'{"ok": true}')

            def log_message(self, *a) -> None:
                pass

        self.srv = http.server.HTTPServer(("127.0.0.1", 0), Taska)
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.url = f"http://127.0.0.1:{self.srv.server_port}"
        self.state = os.path.join(self.dir, "last")
        with open(self.state, "w") as fh:
            fh.write("2026-11-14T00:00:00+00:00")

    def tearDown(self) -> None:
        self.srv.shutdown()

    def test_what_fell_back_is_filed_once_as_an_open_bug(self) -> None:
        self.assertEqual(voice_fallbacks.main(self.db, self.url, self.state), 0)
        (do, text), (cmd, change) = self.got
        self.assertIn("/do?", do)
        self.assertTrue(text.startswith("new bug P1 now Voice notes fell back 1 time ("))
        self.assertIn("system-design f130-voice_4-58.m4a: tidying (gemini-4-hydrogen) kept the words as said", text)
        self.assertEqual(json.loads(change)["commands"][0], {"op": "set", "ref": "B900", "f": {"status": "open"}})
        # the next night: nothing new, nothing filed
        self.assertEqual(voice_fallbacks.main(self.db, self.url, self.state), 0)
        self.assertEqual(len(self.got), 2)


if __name__ == "__main__":
    unittest.main()
