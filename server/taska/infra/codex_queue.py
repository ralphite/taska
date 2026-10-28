"""The public Codex CLI queue and the desktop's queued-thread wake link.

Neither operation runs a model. A successful enqueue is not a model receipt:
the receiving agent acknowledges the notification separately.
"""

from __future__ import annotations

import os
import re
import json
import selectors
import subprocess
import time
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

    def take(self, target: str, queued_id: str) -> bool:
        """Claim one queued message through the public API, without resuming its writer.

        Only a confirmed deletion permits hook delivery. If the desktop already
        consumed it, the normal queued turn owns delivery instead.
        """
        result = self.request("thread/queue/delete", {"threadId": thread_id(target),
                                                     "queuedSubmissionId": queued_id})
        return result.get("deleted") is True

    def request(self, method: str, params: dict) -> dict:
        """One bounded public app-server request; no thread/start or model calls."""
        process = subprocess.Popen([self.binary, "app-server"], stdin=subprocess.PIPE,
                                   stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        assert process.stdin and process.stdout
        selector = selectors.DefaultSelector()
        selector.register(process.stdout, selectors.EVENT_READ)
        buffered = b""

        def send(value: dict) -> None:
            assert process.stdin
            process.stdin.write(json.dumps(value).encode() + b"\n")
            process.stdin.flush()

        def receive(request_id: int) -> dict:
            nonlocal buffered
            deadline = time.monotonic() + 15
            while True:
                while b"\n" in buffered:
                    line, buffered = buffered.split(b"\n", 1)
                    answer = json.loads(line)
                    if answer.get("id") == request_id:
                        if "error" in answer:
                            raise DeliveryError(str(answer["error"])[:500])
                        return answer["result"]
                remaining = deadline - time.monotonic()
                if remaining <= 0 or not selector.select(remaining):
                    raise DeliveryError("Codex queue request timed out", uncertain=True)
                assert process.stdout
                chunk = os.read(process.stdout.fileno(), 65536)
                if not chunk:
                    raise DeliveryError("Codex queue connection closed", uncertain=True)
                buffered += chunk

        try:
            send({"id": 1, "method": "initialize", "params": {
                "clientInfo": {"name": "taska_notifications", "version": "1"},
                "capabilities": {"experimentalApi": True}}})
            receive(1)
            send({"method": "initialized"})
            send({"id": 2, "method": method, "params": params})
            return receive(2)
        finally:
            selector.close()
            process.terminate()
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
            process.stdin.close()
            process.stdout.close()

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
