"""A normal hook only consumes pushed work, one durable claim per output."""

import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location(
    "codex_delivery_hook", Path(__file__).resolve().parents[1] / "tools/codex_delivery_hook.py")
assert spec and spec.loader
hook = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hook)
SESSION = "11111111-1111-4111-8111-111111111111"


class DeliveryHook(unittest.TestCase):
    def test_empty_inbox_does_not_make_requests_or_continue_model(self):
        with tempfile.TemporaryDirectory() as root, patch.object(hook.urllib.request, "urlopen") as request:
            for event in ("PreToolUse", "PostToolUse", "Stop"):
                self.assertEqual({}, hook.receive(Path(root), {
                    "session_id": SESSION, "hook_event_name": event}))
            request.assert_not_called()

    def test_claimed_message_is_emitted_before_another_request_can_fail(self):
        with tempfile.TemporaryDirectory() as root:
            folder = Path(root) / "demo" / ".codex-inbox" / SESSION
            folder.mkdir(parents=True)
            for number in (1, 2):
                notification = "00000000-0000-4000-8000-" + str(number).zfill(12)
                (folder / (notification + ".json")).write_text(json.dumps({"project": "demo", "id": notification}))
            for event in ("PostToolUse", "Stop"):
                with patch.object(hook.urllib.request, "urlopen", side_effect=[
                    io.BytesIO(b'{"message":"saved update"}'), TimeoutError("second request")
                ]) as request:
                    result = hook.receive(Path(root), {"session_id": SESSION, "hook_event_name": event})
                    request.assert_called_once()
                    if event == "Stop":
                        self.assertEqual({"decision": "block", "reason": "saved update"}, result)
                    else:
                        self.assertEqual("saved update", result["hookSpecificOutput"]["additionalContext"])


if __name__ == "__main__":
    unittest.main()
