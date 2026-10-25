"""R594, one of Yadong's strictest rules (10-24): nothing wakes an agent only to find there is nothing to do. Checked
with every other check (npm run check: before each ship and every night), T603 (r868):

  - what Taska tells agents (/agent, /skill, and /next with nothing to do) says to end the turn, never to wait or poll;
  - the waker (v2/tools/waker.py) wakes an agent only for news, never while one is around, at most twice for the same
    news, and says so in Taska when a wake-up did not take or the news is still unhandled;
  - no schedule on this Mac is switched on that wakes a model to look at Taska more than once an hour (the Codex
    automations of the ChatGPT app, Claude's scheduled tasks). Skipped where those folders do not exist.
"""

from __future__ import annotations

import glob
import importlib.util
import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import time
import tomllib
import types
import unittest
import urllib.request
from typing import Any, List

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(APP)
HOME = os.path.expanduser("~")
TASKA = re.compile(r"taska|127\.0\.0\.1:7340|/next\b", re.I)


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
                                     os.path.join(root, "data"), "--organizer", "off", "--log-db", ""], cwd=os.path.join(APP, "server"),
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
                if "while o=$(curl" in line or line.lstrip().startswith("`while o=$(curl"):
                    continue  # the background command that wakes only when it ends, the one way of waiting allowed
                self.assertNotRegex(line, r"(?i)wait (with|for work)[^.]*next\?wait|waits and returns as soon as work arrives\. Repeat", f"{name}: {line}")
        for name in ("agent", "skill"):
            self.assertRegex(self.texts[name], r"Never wait in\s+(the\s+)?foreground, poll, or set a timer", name)
        self.assertIn("never wait, poll or set a timer", self.texts["next"])


def waker() -> Any:
    spec = importlib.util.spec_from_file_location("waker", os.path.join(ROOT, "v2", "tools", "waker.py"))
    assert spec and spec.loader
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


class TheWaker(unittest.TestCase):
    """The waker with Taska, the sessions and the wake-up replaced by stand-ins, so nothing is woken for real."""

    def setUp(self) -> None:
        self.w = waker()
        self.told: List[str] = []
        self.woke: List[str] = []
        self.news = "first handle the inbox (1):\nr33 10-24 you\n  fix the tap\n\n"
        self.agents: List[dict] = []
        w = self.w
        w.tell = lambda text: self.told.append(text)
        w.get = lambda path, timeout=10: json.dumps([{"name": "home", "agents": self.agents}]) if path == "/api/projects" else self.news
        w.session_for = lambda name, now: ("codex", "s1", "/tmp", "/tmp/s1.jsonl")
        w.wake = lambda project, agent, sid, cwd, path, what, dry: self.woke.append(project) or f"woke {agent} {sid}"
        self.now = time.time()
        w.time = types.SimpleNamespace(time=lambda: self.now, strftime=time.strftime, sleep=time.sleep)  # its clock only

    def rounds(self, n: int, apart_s: float = 31 * 60) -> None:
        state: dict = {}
        for _ in range(n):
            self.w.round_(state, False)
            self.now += apart_s

    def test_no_news_wakes_nobody(self) -> None:
        self.news = "nothing to do now. End your turn\n"
        self.rounds(5)
        self.assertEqual(self.woke, [])

    def test_an_agent_around_is_not_woken(self) -> None:
        self.agents = [{"name": "codex", "t": self.now * 1000, "waiting": False}]
        self.w.round_({}, False)
        self.assertEqual(self.woke, [])

    def test_the_same_news_is_woken_for_twice_at_most_then_said_once(self) -> None:
        self.rounds(8)
        self.assertEqual(len(self.woke), 2)
        self.assertEqual(len(self.told), 1)
        self.assertIn("fix the tap", self.told[0])

    def test_a_wake_up_that_did_not_take_is_said(self) -> None:
        with tempfile.NamedTemporaryFile("w", suffix=".log", delete=False) as log:
            p = subprocess.Popen(["/bin/sh", "-c", "echo 'Error: thread already has an active writer'; exit 1"], stdout=log)
            p.wait()
        self.w.RUNNING["home"] = (p, log.name, "codex s1")
        self.w.failed({}, self.now)
        self.assertEqual(len(self.told), 1)
        self.assertIn("active writer", self.told[0])


def often(rrule: str) -> bool:
    """A schedule that fires more than once an hour."""
    freq = re.search(r"FREQ=(\w+)", rrule)
    every = int((re.search(r"INTERVAL=(\d+)", rrule) or ["", "1"])[1])
    return bool(freq) and (freq.group(1) == "SECONDLY" or (freq.group(1) == "MINUTELY" and every < 60))


class SchedulesOnThisMac(unittest.TestCase):
    def test_no_codex_automation_wakes_a_model_to_look_at_taska_often(self) -> None:
        files = glob.glob(os.path.join(HOME, ".codex", "automations", "*", "automation.toml"))
        if not files:
            self.skipTest("no Codex automations here")
        bad = []
        for f in files:
            with open(f, "rb") as fh:
                a = tomllib.load(fh)
            if a.get("status") != "PAUSED" and often(str(a.get("rrule", ""))) and TASKA.search(str(a.get("prompt", ""))):
                bad.append(f"{a.get('name')} ({a.get('rrule')}): {f}")
        self.assertEqual(bad, [], "switched on, waking a model more than once an hour to look at Taska (R594): pause it")

    def test_no_claude_scheduled_task_wakes_a_model_to_look_at_taska_often(self) -> None:
        files = glob.glob(os.path.join(HOME, "Library", "Application Support", "Claude", "claude-code-sessions", "*", "*", "scheduled-tasks.json"))
        if not files:
            self.skipTest("no Claude scheduled tasks here")
        bad = []
        for f in files:
            with open(f, encoding="utf-8") as fh:
                tasks = json.load(fh).get("scheduledTasks", [])
            for t in tasks:
                cron = t.get("cronExpression") or ""
                minute = cron.split()[0] if cron else ""
                if not t.get("enabled") or not cron or re.fullmatch(r"\d+", minute):
                    continue  # off, once, or at one minute of the hours it names
                skill = os.path.join(HOME, ".claude", "scheduled-tasks", str(t.get("id")), "SKILL.md")
                words = open(skill, encoding="utf-8").read() if os.path.exists(skill) else ""
                if TASKA.search(words):
                    bad.append(f"{t.get('id')} ({cron})")
        self.assertEqual(bad, [], "switched on, waking a model more than once an hour to look at Taska (R594): turn it off")


if __name__ == "__main__":
    unittest.main()
