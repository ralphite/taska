"""A Claude Code session the user sees in the Claude app's sidebar, opened by Taska itself (T870, T871 D157; Yadong
r113 r1476). An agent woken by Taska (not by the user's own words to it) is not allowed to start a session, and a
session started from the command line is not in the app's sidebar; so Taska, a program of the user's on this machine,
opens one the way the app documents: the link claude://code/new?q=<words> opens a new Claude Code session with the words
in its box, and Taska presses Return in it once (macOS's own automation; the first time the user allows it in System
Settings › Privacy & Security › Accessibility). No folder is passed: the app asks the user to confirm a folder that comes
with a link, and that is the user's to confirm, never Taska's; the session opens in the app's own folder.

Only while the user leaves this Mac alone (no input for IDLE seconds: it never takes the keyboard from them), at most
once an hour for a task and PER_HOUR times an hour in all; afterwards the window that was in front is put back."""

from __future__ import annotations

import subprocess
import sys
import threading
import time
from typing import Callable, Dict, List, Optional, Sequence
from urllib.parse import quote

IDLE = 60  # seconds without input on this Mac before Taska may press a key in it
PER_HOUR = 3
LOAD = 4.0  # seconds the app takes to show the new session's box

Run = Callable[[Sequence[str]], "subprocess.CompletedProcess[str]"]


ASKING = ("macOS is asking on this Mac whether the program that runs Taska (Python) may control the computer: allow "
          "it there (once; System Settings › Privacy & Security › Accessibility and Automation), then ask again")


def _run(args: Sequence[str]) -> "subprocess.CompletedProcess[str]":
    """A command, given 15 s: macOS's automation waits while it asks the user to allow it (the first time)."""
    try:
        return subprocess.run(list(args), capture_output=True, text=True, timeout=15)
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(list(args), 124, "", "timed out: " + ASKING)
    except OSError as ex:
        return subprocess.CompletedProcess(list(args), 127, "", str(ex))


def idle_seconds(run: Run = _run) -> float:
    """How long this Mac has had no keyboard or mouse input (0 when it cannot tell)."""
    try:
        out = run(["ioreg", "-c", "IOHIDSystem"]).stdout
    except (OSError, subprocess.SubprocessError):
        return 0.0
    for line in out.splitlines():
        if "HIDIdleTime" in line:
            try:
                return int(line.rsplit("=", 1)[1].strip()) / 1e9
            except ValueError:
                return 0.0
    return 0.0


def prompt(root: str, slug: str, code: str, words: str = "") -> str:
    """What the new session is told: connect to the project and take the task."""
    base = f"{root}/p/{slug}"
    return (f"Taska opened this session for work nobody is on: project {slug}, task {code}. Run curl -s "
            f"\"{base}/next?by=claude-code&sid=$CLAUDE_CODE_SESSION_ID\" (read {base}/agent once for how to work) and do "
            f"{code}, reporting on it in Taska as the guide says. When you wait for work, wait with Taska's script: "
            f"curl -s \"{base}/listen?by=claude-code\" | sh (Bash run_in_background)." + (f"\n{words}" if words else ""))


class Opener:
    def __init__(self, run: Run = _run, clock: Callable[[], float] = time.time, sleep: Callable[[float], None] = time.sleep,
                 platform: str = sys.platform) -> None:
        self.run, self.clock, self.sleep, self.platform = run, clock, sleep, platform
        self._lock = threading.Lock()
        self.opened: Dict[str, float] = {}  # "<project> <task>" -> when a session was opened for it
        self.recent: List[float] = []

    def can(self, key: str) -> Optional[str]:
        """Why a session cannot be opened for `key` now (None: it can)."""
        if self.platform != "darwin":
            return "only on a Mac with the Claude app"
        now = self.clock()
        if now - self.opened.get(key, -1e12) < 3600:
            return "a session was opened for it within the hour"
        if len([t for t in self.recent if now - t < 3600]) >= PER_HOUR:
            return f"{PER_HOUR} sessions were opened within the hour"
        if idle_seconds(self.run) < IDLE:
            return "the user is using this Mac (Taska opens one only while it is left alone for a minute)"
        return None

    def open(self, root: str, slug: str, code: str, words: str = "") -> str:
        """Open a session for task `code` of project `slug` -> "opened" or why not."""
        key = f"{slug} {code}"
        with self._lock:
            why = self.can(key)
            if why:
                return f"not opened: {why}"
            r = self.run(["osascript", "-e", 'tell application "System Events" to get name of first application process whose frontmost is true'])
            if r.returncode == 124:
                return f"not opened: {ASKING}"
            front = (r.stdout or "").strip() if r.returncode == 0 else ""
            link = "claude://code/new?q=" + quote(prompt(root, slug, code, words), safe="")
            r = self.run(["open", link])
            if r.returncode != 0:
                return f"not opened: the Claude app did not open the link ({(r.stderr or '').strip()[:200]})"
            self.sleep(LOAD)
            r = self.run(["osascript", "-e", 'tell application "Claude" to activate', "-e", "delay 0.5", "-e",
                          'tell application "System Events" to keystroke return'])
            if r.returncode == 124:
                return f"not opened: the new session's box is filled but {ASKING}"
            if r.returncode != 0:
                err = (r.stderr or "").strip()
                hint = (" Allow it once: System Settings › Privacy & Security › Accessibility, turn on the program that "
                        "runs Taska (python3), then ask again.") if "assistive" in err or "1002" in err or "not allowed" in err else ""
                return f"not opened: the new session's box is filled but Taska could not press Return ({err[:200]}).{hint}"
            now = self.clock()
            self.opened[key] = now
            self.recent = [t for t in self.recent if now - t < 3600] + [now]
            if front and front != "Claude":
                self.run(["osascript", "-e", f'tell application "{front}" to activate'])
            return "opened"

