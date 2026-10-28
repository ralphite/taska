"""Current API contracts: agent and page writes agree, files and history survive a restart, and retries are safe."""

from __future__ import annotations

import json
from contextlib import closing
import os
from pathlib import Path
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request

from check_data import inspect

ROOT = Path(__file__).resolve().parents[1]


class ApiContractTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="taska-contract-")
        self.addCleanup(self.temp.cleanup)
        self.data = Path(self.temp.name) / "data"
        self.log = open(Path(self.temp.name) / "server.log", "wb")
        self.addCleanup(self.log.close)
        self.proc = None
        self.addCleanup(self.stop)
        self.start()
        _, body = self.call("/api/projects", {"title": "Contract check"})
        self.project = "/p/" + json.loads(body)["name"]
        self.serial = 0

    def start(self) -> None:
        with socket.socket() as port:
            port.bind(("127.0.0.1", 0))
            number = port.getsockname()[1]
        self.base = f"http://127.0.0.1:{number}"
        env = {k: v for k, v in os.environ.items() if "KEY" not in k and k not in ("GOOGLE_APPLICATION_CREDENTIALS", "PYTHONPATH")}
        self.proc = subprocess.Popen(
            [sys.executable, "-m", "taska", "serve", "--host", "127.0.0.1", "--port", str(number),
             "--root", str(self.data), "--organizer", "off", "--log-db", ""],
            cwd=ROOT / "server", env=env, stdout=self.log, stderr=subprocess.STDOUT,
        )
        for _ in range(150):
            if self.proc.poll() is not None:
                self.fail("server stopped: " + (Path(self.temp.name) / "server.log").read_text())
            try:
                if self.call("/health")[0] == 200:
                    return
            except OSError:
                time.sleep(0.02)
        self.fail("server did not start")

    def stop(self) -> None:
        if self.proc is not None:
            self.proc.terminate()
            try:
                self.proc.wait(10)
            except subprocess.TimeoutExpired:
                self.proc.kill()
                self.proc.wait()
            self.proc = None

    def call(self, path: str, data=None, kind: str = "application/json") -> tuple:
        if data is not None and not isinstance(data, bytes):
            data = json.dumps(data).encode()
        request = urllib.request.Request(self.base + path, data=data, headers={"Content-Type": kind})
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as error:
            return error.code, error.read()

    def get(self, path: str):
        status, body = self.call(path)
        self.assertEqual(status, 200, body)
        return json.loads(body)

    def do(self, words: str) -> str:
        status, body = self.call(self.project + "/do?by=codex&session=contract", words.encode(), "text/plain")
        self.assertEqual(status, 200, body)
        return body.decode()

    def page(self, *commands: dict, request_id: str = "") -> dict:
        self.serial += 1
        status, body = self.call(self.project + "/api/commands", {"id": request_id or str(self.serial), "commands": commands})
        self.assertEqual(status, 200, body)
        answer = json.loads(body)
        self.assertTrue(answer["ok"], answer)
        return answer

    def test_reads_writes_files_and_sync_survive_restart(self) -> None:
        made = self.do("new bug P1 now Export keeps the filter\n  Keep the selected rows.\n")
        self.assertIn("ok B1 new (proposed", made)
        self.assertIn("only the user can approve", self.do("B1 doing\n"))
        self.page({"op": "set", "ref": "B1", "f": {"status": "open"}})
        self.assertIn("status=doing", self.do("B1 doing\n"))
        uploaded = self.call(self.project + "/api/file?name=sample.txt", b"kept attachment", "text/plain")
        self.assertEqual(uploaded[0], 200)
        fid = json.loads(uploaded[1])["f"]
        answer = self.do(f"B1 say files={fid} Attached the sample.\n"
                         "B1 ask Which format?\n  - ( ) CSV\n  - ( ) JSON\n"
                         "B1 doc Export plan\n  # Export plan\n\n  Keep the selected rows.\n"
                         "D1 reply \u00b61 Checked the plan.\n"
                         "new task P2 later parent=B1 Keep the name\n"
                         "new rule Keep all attachments\n")
        self.assertNotIn("err ", answer)
        self.assertIn("ok D1 new on B1", answer)
        self.page({"op": "input", "text": "Use CSV.", "scope": "B1", "id": "answer-1"})
        self.page({"op": "set", "ref": "T2", "f": {"status": "open"}},
                  {"op": "set", "ref": "R3", "f": {"status": "open"}})
        self.assertIn("status=review", self.do("T2 done Done.\nB1 done Done.\n"))
        self.page({"op": "set", "ref": "T2", "f": {"status": "done"}},
                  {"op": "set", "ref": "B1", "f": {"status": "done"}},
                  {"op": "archive", "refs": ["B1"], "on": True})
        view = self.get(self.project + "/api/view")
        self.assertTrue(view["full"])
        self.assertEqual([(it["n"], it["archived"]) for it in view["items"] if it["n"] in (1, 2)], [(1, True), (2, True)])
        before = {kind: view[kind] for kind in ("items", "inputs", "docs")}
        paths = ["/B1", "/T2", "/D1", "/r1", "/rules", "/inbox", "/items?status=all&archived=all", "/log?n=100"]
        answers = {p: self.call(self.project + p + ("&" if "?" in p else "?") + "ui=1") for p in paths}
        for status, body in answers.values():
            self.assertEqual(status, 200, body)
        for path in ("/agent", "/connect", "/next?ui=1"):
            self.assertEqual(self.call(self.project + path)[0], 200)
        for path in ("/skill", "/api/needs", "/api/search?q=Export", "/api/projects/deleted",
                     "/api/views", "/api/corrections", "/api/voiceprefs"):
            self.assertEqual(self.call(path)[0], 200)
        self.stop()
        counts, warnings = inspect(self.data / "contract-check/taska.db")
        self.assertEqual(warnings, [])
        self.assertEqual((counts["items"], counts["docs"], counts["inputs"]), (3, 1, 1))
        self.start()
        after = self.get(self.project + "/api/view?cursor=" + view["cursor"])
        self.assertTrue(after["full"], "a cursor from before a restart must get the full state")
        self.assertEqual({kind: after[kind] for kind in before}, before)
        for path, expected in answers.items():
            self.assertEqual(self.call(self.project + path + ("&" if "?" in path else "?") + "ui=1"), expected, path)
        self.assertEqual(self.call(self.project + "/f/" + fid), (200, b"kept attachment"))

    def test_command_retries_and_errors_do_not_duplicate_changes(self) -> None:
        command = {"op": "new", "type": "task", "title": "One item"}
        first = self.page(command, request_id="same-request")
        self.assertEqual(self.page(command, request_id="same-request"), first)
        self.assertEqual(len(self.get(self.project + "/api/view")["items"]), 1)
        failed = self.do("nonsense here\n99 say missing\nT1 P7\nT1 merge T1\n")
        self.assertEqual(sum(line.startswith("err ") for line in failed.splitlines()), 4)
        self.assertEqual(len(self.get(self.project + "/api/view")["items"]), 1)
        self.stop()
        db_path = self.data / "contract-check/taska.db"
        with closing(sqlite3.connect(db_path)) as db:
            stored = db.execute("SELECT seq,data FROM events ORDER BY seq").fetchall()
        self.start()
        self.assertEqual(len(self.get(self.project + "/api/view")["items"]), 1)
        self.stop()
        with closing(sqlite3.connect(db_path)) as db:
            self.assertEqual(db.execute("SELECT seq,data FROM events ORDER BY seq").fetchall(), stored)


if __name__ == "__main__":
    unittest.main()
