"""The public Codex CLI queue and the desktop's queued-thread wake link.

Neither operation runs a model. A successful enqueue is not a model receipt:
the receiving agent acknowledges the notification separately.
"""

from __future__ import annotations

import os
import re
import subprocess
import uuid
from typing import List


class DeliveryError(Exception):
    def __init__(self, message: str, uncertain: bool = False):
        super().__init__(message)
        self.uncertain = uncertain


def thread_id(value: str) -> str:
    try:
        return str(uuid.UUID(value))
    except (ValueError, AttributeError) as ex:
        raise ValueError("a Codex session UUID is required") from ex


class CodexQueue:
    def __init__(self) -> None:
        self.binary = os.environ.get("TASKA_CODEX_BIN", "/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex")

    def enqueue(self, target: str, message: str) -> str:
        target = thread_id(target)
        result = self._run([self.binary, "queue", "--thread", target, "--message", message], submitting=True)
        match = re.fullmatch(r"Queued message ([0-9a-f-]{36}) for thread " + re.escape(target) + r"\.", result.strip())
        if not match:
            raise DeliveryError("Codex did not return a queue receipt; delivery needs reconciliation", uncertain=True)
        return match[1]

    def wake(self, target: str) -> None:
        self._run(["/usr/bin/open", "-g", "codex://threads/wake/" + thread_id(target)])

    @staticmethod
    def _run(args: List[str], submitting: bool = False) -> str:
        try:
            result = subprocess.run(args, stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=30)
        except OSError as ex:
            raise DeliveryError(str(ex)) from ex
        except subprocess.TimeoutExpired as ex:
            raise DeliveryError("Codex delivery timed out", uncertain=submitting) from ex
        if result.returncode:
            raise DeliveryError((result.stderr or result.stdout or "Codex delivery failed")[-500:], uncertain=submitting)
        return result.stdout
