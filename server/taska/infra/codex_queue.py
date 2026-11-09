"""Use Codex's native queue and request desktop processing of that queue."""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import uuid
from typing import List


class DeliveryError(Exception):
    pass


def thread_id(value: str) -> str:
    try:
        return str(uuid.UUID(value))
    except (ValueError, AttributeError) as ex:
        raise ValueError("a Codex session UUID is required") from ex


MAC_APP_CODEX = "/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex"
OPEN = "/usr/bin/open"  # macOS: hands the wake link to the Codex desktop app


def codex_binary() -> str:
    """$TASKA_CODEX_BIN, else the desktop app's CLI (macOS), else `codex` on the PATH (Linux)."""
    named = os.environ.get("TASKA_CODEX_BIN")
    if named:
        return named
    if os.path.exists(MAC_APP_CODEX):
        return MAC_APP_CODEX
    return shutil.which("codex") or MAC_APP_CODEX


class CodexQueue:
    def __init__(self) -> None:
        self.binary = codex_binary()

    def enqueue(self, target: str, message: str) -> str:
        target = thread_id(target)
        result = self._run([self.binary, "queue", "--thread", target, "--message", message])
        match = re.fullmatch(r"Queued message ([0-9a-f-]{36}) for thread " + re.escape(target) + r"\.", result.strip())
        if not match:
            raise DeliveryError("Codex did not return a queue receipt; check its native queue before resending")
        return match[1]

    def wake(self, target: str) -> None:
        """Ask the desktop app to process the queue now. Without it (Linux), the queued message waits for the
        thread's next turn."""
        if not os.path.exists(OPEN):
            return
        self._run([OPEN, "-g", "codex://threads/wake/" + thread_id(target)])

    @staticmethod
    def _run(args: List[str]) -> str:
        try:
            result = subprocess.run(args, stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=30)
        except (OSError, subprocess.TimeoutExpired) as ex:
            raise DeliveryError(str(ex)) from ex
        if result.returncode:
            raise DeliveryError((result.stderr or result.stdout or "Codex delivery failed")[-500:])
        return result.stdout
