"""R594, one of Yadong's strictest rules (10-24): nothing wakes an agent only to find there is nothing to do. Checked
with every other check (npm run check: before each ship and every night), T603 (r868):

  - what Taska tells agents (/agent, /skill, and /next with nothing to do) says to end the turn, never to wait or poll;
  - the retired polling waker cannot start an agent, even when invoked directly;
  - no recognized idle-check schedule on this Mac is switched on at any frequency (the Codex
    automations of the ChatGPT app, Claude's scheduled tasks). Skipped where those folders do not exist.
"""

from __future__ import annotations

import glob
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import tomllib
import unittest
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOME = os.path.expanduser("~")
sys.path.insert(0, os.path.join(ROOT, "server"))
from taska.domain.agent_work_policy import idle_check_prompt


class WhatAgentsAreTold(unittest.TestCase):
    """The words a Taska of its own (an empty data folder, a free port) gives an agent."""

    proc: "subprocess.Popen[bytes]"
    base: str
    texts: dict

    @classmethod
    def setUpClass(cls) -> None:
        s = socket.socket()
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
        s.close()
        cls.base = f"http://127.0.0.1:{port}"
        root = tempfile.mkdtemp(prefix="taska-idle-")
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
        name = json.loads(urllib.request.urlopen(req, timeout=10).read())["name"]
        get = lambda path: urllib.request.urlopen(cls.base + path, timeout=10).read().decode()
        cls.texts = {"agent": get(f"/p/{name}/agent"), "skill": get("/skill"), "next": get(f"/p/{name}/next?by=codex")}

    @classmethod
    def tearDownClass(cls) -> None:
        cls.proc.terminate()
        cls.proc.wait(10)

    def test_nothing_to_do_means_end_the_turn(self) -> None:
        self.assertIn("nothing to do now. End your turn", self.texts["next"])
        self.assertIn("Nothing to do: end your turn", self.texts["agent"])
        self.assertIn("Nothing to do: end your turn", self.texts["skill"])

    def test_no_word_says_to_wait_or_poll(self) -> None:
        for name, text in self.texts.items():
            for line in text.splitlines():
                self.assertNotRegex(line, r"(?i)wait (with|for work)[^.]*next\?wait|waits and returns as soon as work arrives\. Repeat", f"{name}: {line}")
        for name in ("agent", "skill"):
            self.assertNotIn("while o=$(curl", self.texts[name], name)
            self.assertNotIn("/next?wait=", self.texts[name], name)
            self.assertNotIn("codex exec resume", self.texts[name], name)
            self.assertNotIn("Taska wakes your session", self.texts[name], name)
            self.assertIn("at any frequency", self.texts[name], name)
            self.assertRegex(self.texts[name], r"Never wait in\s+(the\s+)?foreground, poll, or set a timer", name)
        self.assertIn("never wait, poll or set a timer", self.texts["next"])


class RetiredWaker(unittest.TestCase):
    def test_old_entry_point_cannot_start_models_or_wait(self) -> None:
        for args in ([], ["--once"], ["--dry"]):
            with self.subTest(args=args):
                result = subprocess.run([sys.executable, os.path.join(ROOT, "tools", "waker.py"), *args],
                                        capture_output=True, text=True, timeout=3,
                                        env={**os.environ, "TASKA_URL": "http://127.0.0.1:1",
                                             "CODEX_BIN": "/usr/bin/false", "CLAUDE_BIN": "/usr/bin/false"})
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("retired", result.stderr.lower())


class SchedulesOnThisMac(unittest.TestCase):
    def test_no_codex_automation_wakes_a_model_to_check_for_work_at_any_frequency(self) -> None:
        files = glob.glob(os.path.join(HOME, ".codex", "automations", "*", "automation.toml"))
        if not files:
            self.skipTest("no Codex automations here")
        bad = []
        for f in files:
            with open(f, "rb") as fh:
                a = tomllib.load(fh)
            if a.get("status") != "PAUSED" and idle_check_prompt(str(a.get("prompt", ""))):
                bad.append(f"{a.get('name')} ({a.get('rrule')}): {f}")
        self.assertEqual(bad, [], "switched on, waking a model at any frequency to check for work (R594): pause it")

    def test_no_claude_scheduled_task_wakes_a_model_to_check_for_work_at_any_frequency(self) -> None:
        files = glob.glob(os.path.join(HOME, "Library", "Application Support", "Claude", "claude-code-sessions", "*", "*", "scheduled-tasks.json"))
        if not files:
            self.skipTest("no Claude scheduled tasks here")
        bad = []
        for f in files:
            with open(f, encoding="utf-8") as fh:
                tasks = json.load(fh).get("scheduledTasks", [])
            for t in tasks:
                cron = t.get("cronExpression") or ""
                if not t.get("enabled"):
                    continue
                skill = os.path.join(HOME, ".claude", "scheduled-tasks", str(t.get("id")), "SKILL.md")
                words = open(skill, encoding="utf-8").read() if os.path.exists(skill) else ""
                if idle_check_prompt(words):
                    bad.append(f"{t.get('id')} ({cron})")
        self.assertEqual(bad, [], "switched on, waking a model at any frequency to check for work (R594): turn it off")


if __name__ == "__main__":
    unittest.main()
