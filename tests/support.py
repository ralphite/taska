"""What the server tests share: a project of their own in a folder of its own (ProjectCase), and a Taska server of
their own with one project (ServerCase). Neither touches ~/.taska; both take everything away after."""

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
from typing import Any, Dict, Optional

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "server"))

from taska.services.project import Project  # noqa: E402


class ProjectCase(unittest.TestCase):
    """A fresh project, demo, in a folder of its own: self.p. A test's own setUp calls this one first."""

    p: Project

    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.p = Project(self.tmp.name, "demo")

    def tearDown(self) -> None:
        self.p.close()
        self.tmp.cleanup()


class ServerCase(unittest.TestCase):
    """A Taska server of the class's own (an empty data folder, a free port, no key, no organizer) with one project,
    demo: self.p is its address."""

    proc: "subprocess.Popen[bytes]"
    base: str
    p: str
    root: str

    @classmethod
    def setUpClass(cls) -> None:
        with socket.socket() as s:
            s.bind(("127.0.0.1", 0))
            port = s.getsockname()[1]
        cls.base = f"http://127.0.0.1:{port}"
        cls.root = tempfile.mkdtemp(prefix="taska-test-")
        env = {k: v for k, v in os.environ.items() if "KEY" not in k}
        cls.proc = subprocess.Popen([sys.executable, "-m", "taska", "serve", "--host", "127.0.0.1", "--port", str(port),
                                     "--root", os.path.join(cls.root, "data"), "--organizer", "off", "--log-db", ""],
                                    cwd=os.path.join(ROOT, "server"), env=env, stdout=subprocess.DEVNULL,
                                    stderr=subprocess.DEVNULL)
        for _ in range(150):
            try:
                urllib.request.urlopen(cls.base + "/health", timeout=2)
                break
            except OSError:
                time.sleep(0.1)
        req = urllib.request.Request(cls.base + "/api/projects", data=b'{"title": "demo"}',
                                     headers={"Content-Type": "application/json"})
        cls.p = cls.base + "/p/" + json.loads(urllib.request.urlopen(req, timeout=10).read())["name"]

    @classmethod
    def tearDownClass(cls) -> None:
        cls.proc.terminate()
        cls.proc.wait(10)
        shutil.rmtree(cls.root, ignore_errors=True)

    def do(self, text: str, by: str = "claude-code", session: Optional[str] = None) -> str:
        """Agent commands, as an agent sends them -> the answer."""
        url = self.p + f"/do?by={by}" + (f"&session={session}" if session else "")
        return urllib.request.urlopen(urllib.request.Request(url, data=text.encode()), timeout=10).read().decode()

    def page(self, *commands: Dict[str, Any]) -> Dict[str, Any]:
        """Changes as the page sends them -> its answer."""
        body = json.dumps({"id": f"t-{time.time()}", "commands": list(commands)}).encode()
        req = urllib.request.Request(self.p + "/api/commands", data=body, headers={"Content-Type": "application/json"})
        return json.loads(urllib.request.urlopen(req, timeout=10).read())

    def get(self, path: str) -> str:
        """A page of the project's, as text (its path after the project's address)."""
        return urllib.request.urlopen(self.p + path, timeout=10).read().decode()
