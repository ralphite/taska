"""Saved events notify once, while idle time and agent replies cannot call Codex."""

from __future__ import annotations

import os
import sys
import tempfile
import shutil
import threading
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "server"))

from taska.domain import events as ev
from taska.infra.codex_queue import DeliveryError
from taska.services.codex_notifications import CodexNotifications, KEY
from taska.services.project import Project

TARGET = "11111111-1111-4111-8111-111111111111"


class Transport:
    def __init__(self):
        self.messages = []
        self.wakes = []
        self.sent = threading.Event()
        self.error = None
        self.taken = []
        self.claimable = True

    def enqueue(self, target, text):
        if self.error:
            raise self.error
        self.messages.append((target, text))
        return "queue-" + str(len(self.messages))

    def wake(self, target):
        self.wakes.append(target)
        self.sent.set()

    def take(self, target, queued_id):
        self.taken.append(queued_id)
        return self.claimable


class Notifications(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = Project(self.tmp.name, "demo")
        self.transport = Transport()
        self.p.codex_notifications = self.n = CodexNotifications(self.p, self.transport)

    def tearDown(self):
        self.p.close()
        self.tmp.cleanup()

    def bind(self):
        self.n.bind(TARGET, "queue")

    def test_unverified_production_transport_cannot_be_activated(self):
        notifications = CodexNotifications(self.p)
        with self.assertRaisesRegex(ValueError, "not connected"):
            notifications.bind(TARGET, "queue")
        self.assertFalse(notifications.status()["active"])
        self.p.store.db.put(KEY, {"enabled": True, "projectPath": self.p.folder,
                                 "threadId": TARGET, "cursor": 0, "deliveries": []})
        restored = CodexNotifications(self.p)
        restored.start()
        self.assertFalse(restored.status()["active"])
        self.assertIsNone(restored.worker)

    def event(self, by="you", text="new work"):
        self.p.emit(ev.InputAdded(by=by, id="r" + str(self.p.store.count + 1), text=text))

    def test_unbound_and_idle_do_not_call_codex(self):
        self.event()
        self.bind()  # does not replay old work
        self.assertFalse(self.transport.sent.wait(0.05))
        self.assertEqual(self.transport.messages, [])
        self.assertEqual(self.transport.wakes, [])

    def test_saved_user_event_wakes_immediately_and_ack_is_separate(self):
        self.bind()
        self.event()
        self.assertTrue(self.transport.sent.wait(1))
        d = self.n.status()["deliveries"][0]
        self.assertEqual(d["status"], "queued")
        self.assertIn(d["id"], self.transport.messages[0][1])
        self.assertEqual(d["events"][0]["seq"], 1)
        self.n.acknowledge(d["id"])
        self.assertEqual(self.n.status(d["id"])["status"], "received")
        self.transport.sent.clear()
        self.event(by="codex", text="finished")
        self.assertFalse(self.transport.sent.wait(0.05))
        self.assertEqual(len(self.transport.messages), 1)

    def test_repeated_signal_does_not_enqueue_twice(self):
        self.bind()
        self.event()
        self.assertTrue(self.transport.sent.wait(1))
        self.transport.sent.clear()
        self.n.retry()
        self.assertFalse(self.transport.sent.wait(0.05))
        self.assertEqual(len(self.transport.messages), 1)
        self.assertEqual(len(self.transport.wakes), 1)

    def test_hook_claims_exact_queued_message_once_then_acknowledges_separately(self):
        self.n.bind(TARGET, "queue-hook")
        self.event()
        self.assertTrue(self.transport.sent.wait(1))
        d = self.n.status()["deliveries"][0]
        self.assertTrue(self.n._inbox_file(d["id"]).exists())
        self.assertEqual(self.n.take_for_hook(d["id"], "another-session"), {})
        message = self.n.take_for_hook(d["id"], TARGET)["message"]
        self.assertIn(d["id"], message)
        self.assertEqual(self.transport.taken, [d["queueId"]])
        self.assertEqual(self.n.status(d["id"])["status"], "context")
        self.assertFalse(self.n._inbox_file(d["id"]).exists())
        self.assertEqual(self.n.take_for_hook(d["id"], TARGET), {})
        self.n.acknowledge(d["id"])
        self.assertEqual(self.n.status(d["id"])["status"], "received")

    def test_native_queue_consumption_prevents_duplicate_hook_delivery(self):
        self.n.bind(TARGET, "queue-hook")
        self.event()
        self.assertTrue(self.transport.sent.wait(1))
        d = self.n.status()["deliveries"][0]
        self.transport.claimable = False
        self.assertEqual(self.n.take_for_hook(d["id"], TARGET), {})
        self.assertEqual(self.n.status(d["id"])["status"], "native")
        self.assertFalse(self.n._inbox_file(d["id"]).exists())

    def test_final_send_gate_rejects_empty_and_agent_only_batches(self):
        self.n.data = {"enabled": True, "projectPath": self.p.folder, "threadId": TARGET,
                       "cursor": 0, "deliveries": []}
        self.event(by="claude-code")
        event = self.p.state.events[-1]
        for rows in ([], [{"seq": event.seq, **event.to_row()}], [{"seq": 9999}]):
            self.n.data["deliveries"] = [{"id": "invalid", "status": "pending", "events": rows}]
            self.n._deliver("invalid")
            self.assertEqual(self.n.status("invalid")["status"], "rejected")
        self.assertEqual(self.transport.messages, [])
        self.assertEqual(self.transport.wakes, [])

    def test_duplicate_saved_event_cannot_send_under_a_new_notification_id(self):
        self.n.data = {"enabled": True, "projectPath": self.p.folder, "threadId": TARGET,
                       "cursor": 0, "deliveries": []}
        self.event()
        notification = self.n._prepare()[0]
        self.n._deliver(notification)
        original = self.n.status(notification)
        self.n.data["deliveries"].append({"id": "duplicate", "status": "pending", "events": original["events"]})
        self.n._deliver("duplicate")
        self.assertEqual(self.n.status("duplicate")["status"], "rejected")
        self.assertEqual(len(self.transport.messages), 1)

    def test_restart_recovers_saved_event_before_signal(self):
        self.bind()
        self.n.close()
        self.event()
        self.p.close()
        with patch("taska.services.project.CodexNotifications.start"):
            self.p = Project(self.tmp.name, "demo")
        self.p.codex_notifications = self.n = CodexNotifications(self.p, self.transport)
        self.n.start()
        self.assertTrue(self.transport.sent.wait(1))
        self.assertEqual(len(self.transport.messages), 1)

    def test_restart_keeps_uncertain_send_without_resubmission(self):
        self.bind()
        self.n.close()
        self.event()
        with self.p.lock:
            self.n.data["deliveries"] = [{"id": "ambiguous", "status": "sending", "events": []}]
            self.n.data["cursor"] = self.p.store.count
            self.p.store.db.put(KEY, self.n.data)
        self.p.codex_notifications = self.n = CodexNotifications(self.p, self.transport)
        self.n.start()
        self.assertFalse(self.transport.sent.wait(0.05))
        self.assertEqual(self.n.status("ambiguous")["status"], "uncertain")
        self.assertEqual(self.transport.messages, [])

    def test_failed_wake_retry_reuses_queue_receipt(self):
        self.n.data = {"enabled": True, "projectPath": self.p.folder, "threadId": TARGET, "cursor": 0, "deliveries": []}
        self.event()
        notification = self.n._prepare()[0]
        with patch.object(self.transport, "wake", side_effect=DeliveryError("app unavailable")):
            self.n._deliver(notification)
        self.assertEqual(self.n.status(notification)["status"], "failed")
        self.assertTrue(self.n.data.get("errorItem"))
        self.assertEqual(len(self.p.state.items), 1)
        self.n._deliver(notification)
        self.assertEqual(len(self.transport.messages), 1)
        self.assertEqual(self.transport.wakes, [TARGET])
        self.assertEqual(self.n.status(notification)["status"], "queued")

    def test_timeout_after_enqueue_is_not_blindly_retried(self):
        self.n.data = {"enabled": True, "projectPath": self.p.folder, "threadId": TARGET, "cursor": 0, "deliveries": []}
        self.event()
        notification = self.n._prepare()[0]
        self.transport.error = DeliveryError("lost receipt", uncertain=True)
        self.n._deliver(notification)
        self.assertEqual(self.n.status(notification)["status"], "uncertain")
        self.assertEqual(self.n._prepare(), [])
        self.assertTrue(self.n.data.get("errorItem"))

    def test_active_agent_presence_does_not_suppress_saved_events(self):
        self.bind()
        self.p.agents.saw("codex", waiting=1, session=TARGET)
        self.event()
        self.assertTrue(self.transport.sent.wait(1))

    def test_copy_of_production_database_cannot_notify_real_session(self):
        self.bind()
        self.p.close()
        with tempfile.TemporaryDirectory() as other:
            shutil.copyfile(os.path.join(self.tmp.name, "taska.db"), os.path.join(other, "taska.db"))
            p = Project(other, "demo")
            try:
                self.assertFalse(p.codex_notifications.status()["active"])
                self.assertIsNone(p.codex_notifications.worker)
            finally:
                p.close()

    def test_repeated_page_input_is_one_saved_event_and_one_delivery(self):
        self.bind()
        commands = [(0, {"op": "input", "text": "new work", "q": "save-once"})]
        self.p.run(commands, "you")
        self.assertTrue(self.transport.sent.wait(1))
        self.transport.sent.clear()
        self.p.run(commands, "you")
        self.assertFalse(self.transport.sent.wait(0.05))
        self.assertEqual(len(self.transport.messages), 1)


if __name__ == "__main__":
    unittest.main()
