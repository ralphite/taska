"""Use Codex's native queue and request desktop processing of that queue."""

from __future__ import annotations

import os
import re
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


class CodexQueue:
    def __init__(self) -> None:
        self.binary = os.environ.get("TASKA_CODEX_BIN", "/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex")

    def enqueue(self, target: str, message: str) -> str:
        target = thread_id(target)
        result = self._run([self.binary, "queue", "--thread", target, "--message", message])
        match = re.fullmatch(r"Queued message ([0-9a-f-]{36}) for thread " + re.escape(target) + r"\.", result.strip())
        if not match:
            raise DeliveryError("Codex did not return a queue receipt; check its native queue before resending")
        return match[1]

    def wake(self, target: str) -> None:
        self._run(["/usr/bin/open", "-g", "codex://threads/wake/" + thread_id(target)])

    @staticmethod
    def _run(args: List[str]) -> str:
        try:
            result = subprocess.run(args, stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=30)
        except (OSError, subprocess.TimeoutExpired) as ex:
            raise DeliveryError(str(ex)) from ex
        if result.returncode:
            raise DeliveryError((result.stderr or result.stdout or "Codex delivery failed")[-500:])
        return result.stdout
