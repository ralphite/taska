"""B627 (Yadong's choice): a recording for a new input cancelled with Esc is kept in the inputs as cancelled, to listen
to and send later. Until it is sent it is no one's work: not in /inbox, not in /next, not for the organizer. Sending it
makes it an ordinary new input; only a cancelled input can be sent."""

from __future__ import annotations

import json
import time
import unittest
import urllib.error
import urllib.request

from support import ServerCase
from taska.domain import rules  # noqa: E402
from taska.domain.projection.core import replay  # noqa: E402

T = "2026-11-02T10:00:%02d-07:00"


class CancelledRecordingInTheState(unittest.TestCase):
    """The organizer takes its work from rules.pending: a cancelled input is not in it until it is sent."""

    def test_the_organizer_gets_it_only_once_sent(self) -> None:
        log = [{"k": "in", "id": "r1", "by": "you", "text": "Fix the sort", "scope": None, "files": [], "kind": "cancelled", "t": T % 1}]
        state = replay(log, lambda seq, why: None)
        self.assertEqual(state.inputs["r1"].kind, "cancelled")
        self.assertEqual(rules.pending(state), [])
        state = replay(log + [{"k": "send", "src": "r1", "by": "you", "t": T % 9}], lambda seq, why: None)
        self.assertIsNone(state.inputs["r1"].kind)
        self.assertEqual([i.id for i in rules.pending(state)], ["r1"])


class CancelledRecordingThroughTheServer(ServerCase):
    def page(self, *commands: dict) -> dict:
        body = json.dumps({"id": f"t-{time.time()}", "commands": list(commands)}).encode()
        req = urllib.request.Request(self.p + "/api/commands", data=body, headers={"Content-Type": "application/json"})
        try:
            return json.loads(urllib.request.urlopen(req, timeout=10).read())
        except urllib.error.HTTPError as ex:
            return json.loads(ex.read())

    def get(self, path: str) -> str:
        return urllib.request.urlopen(self.p + path + "?by=claude-code", timeout=10).read().decode()

    def test_kept_out_of_the_work_until_sent(self) -> None:
        said = self.page({"op": "input", "text": "Cancelled words about the export", "kind": "cancelled"})
        self.assertTrue(said["ok"], said)
        rid = said["results"][0].split()[1]
        self.assertNotIn(rid, self.get("/inbox"))
        self.assertNotIn(rid, self.get("/next"))
        sent = self.page({"op": "send", "id": rid})
        self.assertTrue(sent["ok"], sent)
        self.assertIn(rid, self.get("/inbox"))
        self.assertIn(rid, self.get("/next"))
        self.assertFalse(self.page({"op": "send", "id": rid})["ok"])  # sent once only

    def test_send_is_refused_on_an_ordinary_input(self) -> None:
        rid = self.page({"op": "input", "text": "An ordinary input"})["results"][0].split()[1]
        refused = self.page({"op": "send", "id": rid})
        self.assertFalse(refused["ok"])
        self.assertIn("sent already", refused["results"][0])

    def test_a_reply_cannot_be_kept_as_cancelled(self) -> None:
        code = urllib.request.urlopen(urllib.request.Request(self.p + "/do?by=claude-code", data=b"new task P2 now Sort\n"),
                                      timeout=10).read().decode().split()[1]
        self.assertFalse(self.page({"op": "input", "text": "words", "scope": code, "kind": "cancelled"})["ok"])


if __name__ == "__main__":
    unittest.main()
