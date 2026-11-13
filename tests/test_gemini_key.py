"""F765 (Yadong r1285, r1288, 11-13): the Gemini API key can be set in Settings: kept by the server (only its owner can
read it) and used from then on, without an environment variable; the page only ever hears where it comes from and its
last 4 characters. A key Google refuses is not kept. Change only on Yadong's explicit word."""

from __future__ import annotations

import json
import os
import stat
import sys
import tempfile
import unittest
from types import SimpleNamespace
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.domain.vocab import Refused  # noqa: E402
from taska.http import workspace_routes  # noqa: E402
from taska.http.messages import Request  # noqa: E402
from taska.infra import gemini  # noqa: E402

KEY = "AIzaSyTestKey1234567890abcdWXYZ"


class GeminiKey(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.path = os.path.join(self.tmp.name, "gemini-key")
        gemini.use_key_file(self.path)
        self.env = mock.patch.dict(os.environ, {v: "" for v in gemini.KEY_VARS})
        self.env.start()
        self.restarts = 0
        self.ctx = SimpleNamespace(workspace=SimpleNamespace(), restart=self.count_restart)

    def tearDown(self) -> None:
        self.env.stop()
        gemini._key_file.clear()
        self.tmp.cleanup()

    def count_restart(self) -> None:
        self.restarts += 1

    def post(self, key: str) -> dict:
        body = json.dumps({"key": key}).encode()
        req = Request("POST", "/api/gemini", {"Content-Type": "application/json"}, "127.0.0.1", read_body=lambda limit: body)
        res = workspace_routes.post(self.ctx, req, "/api/gemini")  # type: ignore[arg-type]
        assert res is not None
        return json.loads(res.body)

    def test_a_key_set_here_is_kept_for_its_owner_only_and_used_before_the_environment(self) -> None:
        os.environ["GEMINI_API_KEY"] = "env-key-0000000000001111"
        with mock.patch.object(gemini, "check_key", return_value=None):
            out = self.post(KEY)
        self.assertEqual(gemini.api_key(), KEY)
        self.assertEqual(stat.S_IMODE(os.stat(self.path).st_mode), 0o600)
        self.assertEqual(out["from"], "settings")
        self.assertEqual(out["tail"], "WXYZ")
        self.assertNotIn(KEY, json.dumps(out))  # the page never gets the key
        self.assertEqual(self.restarts, 1)  # the organizer and voice notes start with it

    def test_removing_it_falls_back_to_the_environment_or_to_none(self) -> None:
        with mock.patch.object(gemini, "check_key", return_value=None):
            self.post(KEY)
        out = self.post("")
        self.assertFalse(os.path.exists(self.path))
        self.assertEqual(out["from"], "")
        self.assertIsNone(gemini.api_key())
        self.assertEqual(self.restarts, 2)
        self.post("")  # nothing set, nothing to forget: no restart
        self.assertEqual(self.restarts, 2)

    def test_a_key_google_refuses_is_not_kept(self) -> None:
        with mock.patch.object(gemini, "check_key", return_value="Google did not accept this key"):
            with self.assertRaises(Refused):
                self.post(KEY)
        self.assertFalse(os.path.exists(self.path))
        self.assertEqual(self.restarts, 0)

    def test_only_its_last_4_characters_are_shown(self) -> None:
        os.environ["GEMINI_API_KEY"] = KEY
        self.assertEqual(gemini.key_source(), {"from": "env", "tail": "WXYZ"})


if __name__ == "__main__":
    unittest.main()
