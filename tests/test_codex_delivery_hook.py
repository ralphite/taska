"""A session with a cached receiver command remains safe during retirement."""

import json
from pathlib import Path
import subprocess
import sys
import unittest


class RetiredDeliveryHook(unittest.TestCase):
    def test_cached_command_neither_claims_messages_nor_continues_a_turn(self):
        path = Path(__file__).resolve().parents[1] / "tools/codex_delivery_hook.py"
        for kind in ("PreToolUse", "PostToolUse", "Stop"):
            with self.subTest(kind=kind):
                result = subprocess.run([sys.executable, str(path)],
                                        input=json.dumps({"hook_event_name": kind}),
                                        text=True, capture_output=True, timeout=2, check=True)
                self.assertEqual(json.loads(result.stdout), {})


if __name__ == "__main__":
    unittest.main()
