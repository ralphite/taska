"""T806 #3 (r1376): every push is logged with how it went; one the push service did not take is sent again at the next
look (to that phone only), one whose subscription is gone drops it, and a restart pushes what became new meanwhile."""

from __future__ import annotations

import os
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.services import push as push_mod  # noqa: E402
from taska.services.push import Push  # noqa: E402

A, B = "https://push.example/a", "https://push.example/b"
ASK = [{"project": "p", "code": "T1", "kind": "ask"}]
TWO = ASK + [{"project": "p", "code": "B2", "kind": "review"}]


class Delivery(unittest.TestCase):
    def setUp(self) -> None:
        self.dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)
        self.answers = {A: ["ok"], B: ["ok"]}
        self.sent: list = []
        self.logged: list = []
        logs = mock.patch.object(push_mod.log, "log", lambda level, msg, extra=None: self.logged.append((level, msg, extra["f"]["what"])))
        logs.start()
        self.addCleanup(logs.stop)

    def phone(self) -> Push:
        p = Push(self.dir.name)
        for ep in (A, B):
            p.subscribe({"endpoint": ep}, quiet=False)

        def send(sub):
            self.sent.append(sub["endpoint"])
            q = self.answers[sub["endpoint"]]
            return q.pop(0) if len(q) > 1 else q[0]

        p._send = send  # type: ignore[method-assign]
        return p

    def test_a_push_not_taken_is_sent_again_to_that_phone_only_and_logged(self) -> None:
        p = self.phone()
        p.check(lambda: [])
        self.answers[B] = ["HTTP 503", "ok"]
        self.assertEqual(p.check(lambda: ASK), 1)
        self.assertEqual(self.sent, [A, B])
        self.sent.clear()
        self.assertEqual(p.check(lambda: ASK), 1)  # nothing new: only what B still owes
        self.assertEqual(self.sent, [B])
        self.assertEqual([(lv, m) for lv, m, _ in self.logged], [(20, "push ok"), (30, "push HTTP 503"), (20, "push ok")])
        self.sent.clear()
        p.check(lambda: ASK)
        self.assertEqual(self.sent, [])

    def test_owed_only_while_it_still_needs_you(self) -> None:
        p = self.phone()
        p.check(lambda: [])
        self.answers[B] = ["HTTP 503", "ok"]
        p.check(lambda: ASK)
        self.sent.clear()
        p.check(lambda: [])  # answered meanwhile
        self.assertEqual(self.sent, [])

    def test_a_gone_subscription_is_dropped(self) -> None:
        p = self.phone()
        p.check(lambda: [])
        self.answers[B] = ["gone"]
        p.check(lambda: ASK)
        self.assertEqual([x["endpoint"] for x in p.subs], [A])

    def test_a_restart_pushes_what_became_new_meanwhile(self) -> None:
        p = self.phone()
        p.check(lambda: ASK)  # the first look: nothing new yet
        self.assertEqual(self.sent, [])
        again = self.phone()  # Taska restarted
        again.check(lambda: TWO)
        self.assertEqual(self.sent, [A, B])
        self.assertEqual(self.logged[0][2], ["p B2 review"])  # only what is new


if __name__ == "__main__":
    unittest.main()
