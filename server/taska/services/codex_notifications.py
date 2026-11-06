"""Send a short native Codex message for each committed user update.

Only the session binding is retained. Codex owns the message queue; Taska has
no notification outbox, delivery claims, acknowledgements or timed retries.
"""

from __future__ import annotations

import threading
from typing import TYPE_CHECKING, Any, Dict, Optional, Set

from ..domain import events as ev
from ..infra.codex_queue import CodexQueue, thread_id

if TYPE_CHECKING:
    from .project import Project

KEY = "codex_notifications_v1"
MESSAGE = "Taska \u6709\u65b0\u6d88\u606f\uff0c\u8bf7\u8bfb\u53d6\u5e76\u5904\u7406\u3002"


class CodexNotifications:
    def __init__(self, project: "Project", transport: Optional[CodexQueue] = None):
        self.project = project
        self.transport = transport or CodexQueue()
        self.closed = False
        self.sends: Set[threading.Thread] = set()
        stored = project.store.db.get(KEY) or {}
        # Preserve existing bindings, discarding the retired delivery ledger.
        self.data = {k: stored[k] for k in ("threadId", "projectPath", "enabled", "errorItem", "error") if k in stored}
        if self.data != stored:
            self._save()

    def bind(self, target: str) -> Dict[str, Any]:
        target = thread_id(target)
        with self.project.lock:
            self.data.update(threadId=target, projectPath=self.project.folder, enabled=True)
            self._save()
            return self.status()

    def disable(self) -> Dict[str, Any]:
        with self.project.lock:
            self.data["enabled"] = False
            self._save()
            return self.status()

    def _enabled(self) -> bool:
        # A QA/backup copy must not notify the original project's session.
        return bool(not self.closed and self.data.get("enabled") and self.data.get("threadId")
                    and self.data.get("projectPath") == self.project.folder)

    def eligible(self, event: ev.Event) -> bool:
        if isinstance(event, ev.InputAdded) and event.kind == "cancelled":
            return False  # a cancelled recording is kept, not sent (B627); sending it later is the update
        if isinstance(event, ev.VoiceHeard) and event.state == "wait":
            return False  # the first words: the input waits for its words (T687), they say it then
        voice = isinstance(event, (ev.VoiceHeard, ev.VoiceFixed))
        inp = self.project.state.inputs.get(event.src or "") if voice else None
        if inp is not None and inp.kind == "cancelled":
            return False
        if voice and inp is None:
            return False  # a note not sent yet, or a comment's: nothing for the agent's inbox
        if event.by == "you":
            return True
        return inp is not None and inp.by == "you"

    def on_event(self, event: ev.Event) -> None:
        """Called after Project.emit commits an event; never called on a timer."""
        with self.project.lock:
            if not self._enabled() or not self.eligible(event):
                return
            # Keep CLI I/O outside the project lock and HTTP request. There is no
            # Taska queue or deduplication: each actual signal can be sent again.
            sender = threading.Thread(target=self._send, args=(self.data["threadId"],),
                                      name="codex-send-" + self.project.slug, daemon=True)
            self.sends.add(sender)
            sender.start()

    def _send(self, target: str) -> None:
        try:
            self.transport.enqueue(target, MESSAGE)
            self.transport.wake(target)
        except Exception as ex:
            with self.project.lock:
                if not self.closed:
                    self._report_failure(str(ex)[:500])
        finally:
            with self.project.lock:
                self.sends.discard(threading.current_thread())

    def _report_failure(self, error: str) -> None:
        self.data["error"] = error
        print(f"taska: Codex delivery failed: {error}", flush=True)
        body = ("Codex \u6d88\u606f\u53d1\u9001\u5931\u8d25\u3002"
                "Taska \u66f4\u65b0\u5df2\u4fdd\u5b58\uff0c\u672a\u81ea\u52a8\u91cd\u8bd5\u3002\n" + error)
        ref = self.data.get("errorItem")
        if ref:
            command = {"op": "say", "ref": ref, "text": body, "kind": "progress"}
        else:
            command = {"op": "new", "type": "bug", "pri": "P1", "when": "now",
                       "title": "Codex \u6d88\u606f\u53d1\u9001\u5931\u8d25", "body": body}
        lines, _ = self.project.run([(0, command)], "codex-notifier")
        if not ref and lines and lines[0].startswith("ok "):
            self.data["errorItem"] = lines[0].split()[1]
        self._save()

    def status(self) -> Dict[str, Any]:
        with self.project.lock:
            return {**self.data, "enabled": bool(self.data.get("enabled")), "active": self._enabled()}

    def _save(self) -> None:
        self.project.store.db.put(KEY, self.data)

    def close(self) -> None:
        with self.project.lock:
            self.closed = True
            sends = list(self.sends)
        for sender in sends:
            sender.join(timeout=1)
