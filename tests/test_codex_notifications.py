"""Only real user updates send a small signal; native Codex owns queuing."""

from __future__ import annotations

import os
import shutil
import sys
import tempfile
import time
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "server"))

from support import ProjectCase
from taska.domain import events as ev
from taska.domain.model import FileRef
from taska.infra.codex_queue import DeliveryError
from taska.services.codex_notifications import CodexNotifications, KEY, MESSAGE
from taska.services.project import Project
from taska.services.voice_jobs import Job

TARGET = "11111111-1111-4111-8111-111111111111"
OTHER = "22222222-2222-4222-8222-222222222222"


class Transport:
    def __init__(self):
        self.messages = []
        self.wakes = []
        self.error = None
        self.attempts = 0

    def enqueue(self, target, text):
        self.attempts += 1
        if self.error:
            raise self.error
        self.messages.append((target, text))
        return "native-receipt"

    def wake(self, target):
        self.wakes.append(target)


class Notifications(ProjectCase):
    def setUp(self):
        super().setUp()
        self.transport = Transport()
        self.p.codex_notifications = self.n = CodexNotifications(self.p, self.transport)

    def event(self, by="you", text="new work"):
        e = ev.InputAdded(by=by, id="r" + str(self.p.store.count + 1), text=text)
        self.p.emit(e)
        return e

    def settle(self):
        with self.p.lock:
            sends = list(self.n.sends)
        for sender in sends:
            sender.join(timeout=2)
            self.assertFalse(sender.is_alive())

    def test_binding_and_restart_do_not_send_old_work_or_create_idle_workers(self):
        self.event()
        self.n.bind(TARGET)
        self.assertEqual(self.n.sends, set())
        self.p.close()
        self.p = Project(self.tmp.name, "demo")
        self.n = self.p.codex_notifications
        self.assertTrue(self.n.status()["active"])
        self.assertEqual(self.n.sends, set())
        self.assertEqual(self.transport.messages, [])

    def test_committed_update_sends_only_the_approved_message(self):
        self.n.bind(TARGET)
        self.event(text="private task content")
        self.settle()
        self.assertEqual(self.transport.messages, [(TARGET, MESSAGE)])
        self.assertEqual(MESSAGE, "Taska \u6709\u65b0\u6d88\u606f\uff0c\u8bf7\u8bfb\u53d6\u5e76\u5904\u7406\u3002")
        self.assertEqual(self.transport.wakes, [TARGET])
        self.assertNotIn("deliveries", self.p.store.db.get(KEY))
        self.assertFalse(os.path.exists(os.path.join(self.p.folder, ".codex-inbox")))

    def test_agent_writes_cannot_trigger_a_notification_loop(self):
        self.n.bind(TARGET)
        for author in ("codex", "claude-code", "codex-worker", "codex-notifier"):
            self.event(by=author)
        self.assertEqual(self.n.sends, set())
        self.assertEqual(self.transport.messages, [])

    def test_a_cancelled_recording_notifies_only_once_sent(self):
        self.n.bind(TARGET)
        rid = "r" + str(self.p.store.count + 1)
        self.p.emit(ev.InputAdded(by="you", id=rid, text="kept, not sent", kind="cancelled"))
        self.p.emit(ev.VoiceHeard(src=rid, f="f1", state="done", tidied="its words", by="taska"))
        self.assertEqual(self.n.sends, set())
        self.p.emit(ev.InputSent(src=rid, by="you"))
        self.settle()
        self.assertEqual(self.transport.messages, [(TARGET, MESSAGE)])

    def test_a_voice_note_notifies_once_its_words_are_final(self):
        # B761 (Yadong r1279): while its words are still being worked out (transcribing, confirming) the agent is
        # not told; it is told once they are final
        self.n.bind(TARGET)
        rid = "r" + str(self.p.store.count + 1)
        self.p.voice.jobs["f1.m4a"] = Job(t0=time.time())
        self.p.emit(ev.VoiceHeard(f="f1.m4a", state="wait", by="taska"))
        self.p.emit(ev.InputAdded(by="you", id=rid, files=[FileRef(f="f1.m4a", name="voice.m4a")]))
        self.p.emit(ev.VoiceHeard(src=rid, f="f1.m4a", state="wait", early="first words", by="taska"))
        self.assertEqual(self.n.sends, set())
        self.p.voice.jobs["f1.m4a"].done = True
        self.p.emit(ev.VoiceHeard(src=rid, f="f1.m4a", state="done", tidied="final words", by="taska"))
        self.settle()
        self.assertEqual(self.transport.messages, [(TARGET, MESSAGE)])

    def test_repeated_real_signals_and_same_text_are_allowed(self):
        self.n.bind(TARGET)
        event = self.event()
        self.n.on_event(event)
        self.event()
        self.settle()
        self.assertEqual(self.transport.messages, [(TARGET, MESSAGE)] * 3)
        self.assertEqual(self.transport.wakes, [TARGET] * 3)

    def test_explicit_rebinding_and_disable(self):
        self.n.bind(TARGET)
        self.n.bind(OTHER)
        self.event()
        self.settle()
        self.n.disable()
        self.event()
        self.settle()
        self.assertEqual(self.transport.messages, [(OTHER, MESSAGE)])

    def test_old_binding_is_migrated_without_replaying_the_old_ledger(self):
        self.p.store.db.put(KEY, {"enabled": True, "projectPath": self.p.folder,
                                 "threadId": TARGET, "mode": "queue-hook", "cursor": 0,
                                 "deliveries": [{"id": "old", "status": "failed"}]})
        migrated = CodexNotifications(self.p, self.transport)
        self.assertEqual(migrated.status(), {"enabled": True, "active": True,
                         "projectPath": self.p.folder, "threadId": TARGET})
        self.assertNotIn("deliveries", self.p.store.db.get(KEY))
        self.assertEqual(migrated.sends, set())
        self.assertEqual(self.transport.messages, [])

    def test_failure_is_visible_without_retrying_or_waking_models(self):
        self.n.bind(TARGET)
        self.transport.error = DeliveryError("CLI unavailable")
        self.event()
        self.settle()
        self.assertEqual(self.transport.attempts, 1)
        self.assertEqual(self.transport.wakes, [])
        self.assertEqual(self.n.status()["error"], "CLI unavailable")
        self.assertEqual(len(self.p.state.items), 1)
        self.assertEqual(self.p.state.inputs["r1"].text, "new work")
        self.assertEqual(self.n.sends, set())

    def test_copy_of_production_database_cannot_notify_real_session(self):
        self.n.bind(TARGET)
        self.p.close()
        with tempfile.TemporaryDirectory() as other:
            shutil.copyfile(os.path.join(self.tmp.name, "taska.db"), os.path.join(other, "taska.db"))
            p = Project(other, "demo")
            try:
                self.assertFalse(p.codex_notifications.status()["active"])
                self.assertEqual(p.codex_notifications.sends, set())
            finally:
                p.close()

    def test_existing_page_save_idempotency_is_unchanged(self):
        self.n.bind(TARGET)
        commands = [(0, {"op": "input", "text": "new work", "q": "save-once"})]
        self.p.run(commands, "you")
        self.p.run(commands, "you")
        self.settle()
        self.assertEqual(len(self.transport.messages), 1)


if __name__ == "__main__":
    unittest.main()
