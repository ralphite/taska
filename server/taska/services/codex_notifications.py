"""Durable, event-triggered notifications for one explicitly bound project.

The project journal is the outbox source. Its cursor and delivery receipts live
in kv, so a crash between saving an event and signalling the worker loses no
updates. The worker sleeps on an Event without a timer. Agent writes never
notify the agent again. Unknown enqueue outcomes are never blindly retried.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path
import threading
import time
import uuid
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from ..domain import events as ev
from ..domain.vocab import Refused
from ..infra.codex_queue import CodexQueue, DeliveryError, thread_id

if TYPE_CHECKING:
    from .project import Project

KEY = "codex_notifications_v1"


class CodexNotifications:
    def __init__(self, project: "Project", transport: Optional[CodexQueue] = None):
        self.project = project
        self.transport = transport or CodexQueue()
        self.changed = threading.Event()
        self.stopped = threading.Event()
        self.worker: Optional[threading.Thread] = None
        self._recover = False
        self.data: Dict[str, Any] = project.store.db.get(KEY) or {}
        # A crash after enqueue but before the receipt is saved is ambiguous.
        for d in self.data.get("deliveries", []):
            if d["status"] in ("sending", "claiming"):
                d.update(status="uncertain", error="Interrupted during enqueue; reconcile before resending")

    def start(self) -> None:
        if not self._enabled() or self.stopped.is_set():
            return
        if self.worker is None:
            self._recover = True
            self.worker = threading.Thread(target=self._run, name="codex-events-" + self.project.slug, daemon=True)
            self.worker.start()
        self.changed.set()  # one recovery attempt on start, never a periodic check

    def bind(self, target: str, mode: str, pilot: bool = False) -> Dict[str, Any]:
        if isinstance(self.transport, CodexQueue) and not (mode == "queue-hook" and pilot):
            raise ValueError("Automatic desktop message delivery is not connected; queue-only delivery is not enabled")
        if mode not in ("queue", "queue-hook"):
            raise ValueError("this transport supports queue delivery, not steering an active turn")
        target = thread_id(target)
        with self.project.lock:
            if self.data.get("threadId") and self.data["threadId"] != target:
                raise ValueError("this pilot is already bound to another Codex session")
            if not self.data:
                self.data = {"threadId": target, "mode": mode, "cursor": self.project.store.count, "deliveries": []}
            self.data["mode"] = mode
            self.data["projectPath"] = self.project.folder
            self.data["enabled"] = True
            self._save()
            self.start()
            return self.status()

    def disable(self) -> Dict[str, Any]:
        with self.project.lock:
            if self.data:
                self.data["enabled"] = False
                self._save()
            return self.status()

    def on_event(self, event: ev.Event) -> None:
        if self._enabled() and self.eligible(event):
            self.changed.set()

    def _enabled(self) -> bool:
        # Queue-only delivery cannot reach an active turn. An old binding must
        # not bypass the explicit queue-hook activation gate on boot.
        if isinstance(self.transport, CodexQueue) and self.data.get("mode") != "queue-hook":
            return False
        # A QA/backup copy of a bound database must never message a real session.
        return bool(self.data.get("enabled") and self.data.get("projectPath") == self.project.folder)

    def eligible(self, event: ev.Event) -> bool:
        if event.by == "you":
            return True
        if isinstance(event, ev.WordsIn):
            inp = self.project.state.inputs.get(event.src or "")
            return inp is not None and inp.by == "you"
        return False

    def status(self, notification: str = "") -> Dict[str, Any]:
        with self.project.lock:
            if notification:
                for d in self.data.get("deliveries", []):
                    if d["id"] == notification:
                        return copy.deepcopy(d)
                raise Refused("unknown notification")
            result = copy.deepcopy(self.data or {"enabled": False, "deliveries": []})
            result["active"] = self._enabled()
            return result

    def _inbox_file(self, notification: str) -> Path:
        return Path(self.project.folder) / ".codex-inbox" / self.data["threadId"] / (notification + ".json")

    def _publish_hook(self, d: Dict[str, Any]) -> None:
        if self.data.get("mode") != "queue-hook":
            return
        path = self._inbox_file(d["id"])
        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        temporary = path.with_suffix(".tmp")
        temporary.write_text(json.dumps({"project": self.project.slug, "id": d["id"]}))
        temporary.chmod(0o600)
        temporary.replace(path)

    def take_for_hook(self, notification: str, session: str) -> Dict[str, str]:
        """A normal Codex hook consumes a pushed pointer, never a timed check."""
        with self.project.lock:
            if not self._enabled() or session != self.data.get("threadId") or self.data.get("mode") != "queue-hook":
                return {}
            d = next((d for d in self.data["deliveries"] if d["id"] == notification), None)
            if not d or d["status"] not in ("queued", "failed") or not d.get("queueId"):
                return {}
            d["status"] = "claiming"
            self._save()
        try:
            claimed = self.transport.take(session, d["queueId"])
        except Exception as ex:
            with self.project.lock:
                d.update(status="uncertain", error="Hook claim needs reconciliation: " + str(ex)[:400])
                self._save()
                self._report_failure(d)
            raise
        finally:
            self._inbox_file(notification).unlink(missing_ok=True)
        with self.project.lock:
            if d["status"] != "received":
                d["status"] = "context" if claimed else "native"
            if claimed:
                d["contextSubmittedAt"] = time.time()
            self._save()
            return {"message": self._message(d)} if claimed else {}

    def acknowledge(self, notification: str) -> Dict[str, Any]:
        with self.project.lock:
            for d in self.data.get("deliveries", []):
                if d["id"] == notification:
                    d.update(status="received", receivedAt=d.get("receivedAt") or time.time())
                    d.pop("error", None)
                    self._save()
                    self._inbox_file(notification).unlink(missing_ok=True)
                    return copy.deepcopy(d)
            raise Refused("unknown notification")

    def retry(self) -> Dict[str, Any]:
        with self.project.lock:
            self._recover = True
            self.changed.set()  # explicit retry, not a timer
        return self.status()

    def _save(self) -> None:
        self.project.store.db.put(KEY, self.data)

    def _prepare(self) -> List[str]:
        p = self.project
        with p.lock:
            if not self._enabled() or self.stopped.is_set():
                return []
            fresh = [e for e in p.state.events[self.data["cursor"]:] if self.eligible(e)]
            if fresh:
                self.data["deliveries"].append({"id": str(uuid.uuid4()), "status": "pending", "createdAt": time.time(),
                                                "events": [{"seq": e.seq, **e.to_row()} for e in fresh]})
            self.data["cursor"] = p.store.count
            self._save()
            if self._recover:
                for d in self.data["deliveries"]:
                    if d["status"] == "queued" and d.get("queueId"):
                        self._publish_hook(d)
            states = ("pending", "failed") if self._recover else ("pending",)
            self._recover = False
            return [d["id"] for d in self.data["deliveries"] if d["status"] in states]

    def _message(self, d: Dict[str, Any]) -> str:
        base = "http://127.0.0.1:7340/p/" + self.project.slug
        event_url = base + "/api/codex-notifications?id=" + d["id"]
        preview = json.dumps(d["events"], ensure_ascii=False)[:2500]
        return (f"Taska saved new updates from Yadong in {self.project.slug}. Notification {d['id']}.\n"
                f"Read the complete saved events at {event_url}.\n"
                f"Immediately acknowledge receipt: POST {base}/api/codex-notifications with JSON "
                f'{{"ack":"{d["id"]}"}}. This records receipt only, not task completion.\n'
                "Handle these new updates within the user's authorization and existing session context. "
                "Do not restart unrelated old work. Agent replies do not trigger another notification. "
                "When finished, end the turn. Never poll, wait for new work, or create a schedule.\n"
                f"Event preview (use the URL for full text and files):\n{preview}")

    def _deliver(self, notification: str) -> None:
        with self.project.lock:
            if not self._enabled() or self.stopped.is_set():
                return
            d = next(x for x in self.data["deliveries"] if x["id"] == notification)
            if d["status"] not in ("pending", "failed"):
                return  # a receipt or an ambiguous send must never start another model turn
            # Verify the persisted batch against the committed journal, at the
            # final side-effect boundary. Empty or fabricated work cannot send.
            rows = d.get("events") or []
            valid = bool(rows)
            consumed = {row["seq"] for other in self.data["deliveries"] if other is not d
                        and other["status"] in ("sending", "queued", "claiming", "context", "native", "received", "uncertain")
                        for row in other.get("events", [])}
            for row in rows:
                seq = row.get("seq")
                if not isinstance(seq, int) or not 1 <= seq <= len(self.project.state.events) or seq in consumed:
                    valid = False
                    break
                event = self.project.state.events[seq - 1]
                if not self.eligible(event) or row != {"seq": event.seq, **event.to_row()}:
                    valid = False
                    break
            if not valid:
                d.update(status="rejected", error="No unconsumed committed user event; no agent was called")
                self._save()
                return
            target = self.data["threadId"]
            enqueue = not d.get("queueId")
            if enqueue:
                d["status"] = "sending"
                self._save()
        try:
            if enqueue:
                queue_id = self.transport.enqueue(target, self._message(d))
                with self.project.lock:
                    d["queueId"] = queue_id
                    d["queuedAt"] = time.time()
                    if d["status"] != "received":
                        d["status"] = "queued"
                    self._save()
                    self._publish_hook(d)
            with self.project.lock:
                if self.stopped.is_set() or not self._enabled() or d["status"] in ("claiming", "context", "native", "received"):
                    return
            self.transport.wake(target)
            with self.project.lock:
                d["wakeRequestedAt"] = time.time()
                if d["status"] not in ("claiming", "context", "native", "received"):
                    d["status"] = "queued"
                d.pop("error", None)
                self._save()
        except Exception as ex:
            with self.project.lock:
                if d["status"] in ("claiming", "context", "native", "received"):
                    return
                uncertain = isinstance(ex, DeliveryError) and ex.uncertain
                d.update(status="uncertain" if uncertain and not d.get("queueId") else "failed", error=str(ex)[:500])
                self._save()
                print(f"taska: Codex notification {notification}: {d['error']}", flush=True)
                self._report_failure(d)

    def _report_failure(self, d: Dict[str, Any]) -> None:
        if d.get("reportedError") == d["error"]:
            return
        # Failures are visible in Taska, not only in a process log. These agent
        # events cannot trigger the notification worker again.
        body = ("\u6d88\u606f\u672a\u786e\u8ba4\u9001\u8fbe Codex\u3002\u539f\u66f4\u65b0\u5df2\u4fdd\u5b58\uff0c\u6ca1\u6709\u542f\u52a8\u5b9a\u65f6\u91cd\u8bd5\u3002\n"
                f"Notification: {d['id']}\n{d['error']}")
        ref = self.data.get("errorItem")
        command: Dict[str, Any]
        if ref:
            command = {"op": "say", "ref": ref, "text": body, "kind": "progress"}
        else:
            command = {"op": "new", "type": "bug", "pri": "P1", "when": "now",
                       "title": "Codex \u6d88\u606f\u672a\u9001\u8fbe", "body": body}
        lines, _ = self.project.run([(0, command)], "codex-notifier")
        if lines and lines[0].startswith("ok "):
            if not ref:
                self.data["errorItem"] = lines[0].split()[1]
            d["reportedError"] = d["error"]
            self._save()

    def _run(self) -> None:
        while True:
            self.changed.wait()  # no timeout: only saved events, startup or an explicit retry
            self.changed.clear()
            if self.stopped.is_set():
                return
            for notification in self._prepare():
                self._deliver(notification)

    def close(self) -> None:
        self.stopped.set()
        self.changed.set()
        if self.worker:
            self.worker.join(timeout=1)
