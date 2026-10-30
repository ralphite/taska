"""Common idle-work requests are blocked without rejecting real work or fixes."""

import json
import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "server"))
from taska.domain.agent_work_policy import blocked_tool_call


class WorkPolicy(unittest.TestCase):
    def test_message_checks_are_blocked_at_every_schedule_frequency(self):
        for rule in ("FREQ=MINUTELY", "FREQ=HOURLY", "FREQ=DAILY"):
            for tool in ("mcp__codex_app__automation_update", "mcp__scheduled_tasks__create_scheduled_task", "CronCreate"):
                with self.subTest(rule=rule, tool=tool):
                    self.assertIsNotNone(blocked_tool_call(tool, {"mode": "create", "status": "ACTIVE",
                                         "rrule": rule, "prompt": "Check for new work in Taska /next; end if empty."}))
        for prompt in ("Check messages in another project and stop if empty.",
                       "\u68c0\u67e5\u662f\u5426\u6709\u65b0\u6d88\u606f\uff0c\u6ca1\u6709\u5c31\u7ed3\u675f\u3002"):
            self.assertIsNotNone(blocked_tool_call("ScheduleWakeup", {"prompt": prompt}))

    def test_pausing_and_substantive_scheduled_work_remain_allowed(self):
        self.assertIsNone(blocked_tool_call("automation_update", {"mode": "update", "status": "PAUSED",
                          "prompt": "Check messages"}))
        self.assertIsNone(blocked_tool_call("automation_update", {"mode": "create", "status": "ACTIVE",
                          "prompt": "Generate the daily sales report. Never poll messages."}))

    def test_normal_reads_are_allowed_but_waiting_and_loops_are_blocked(self):
        read = "curl -s 'http://127.0.0.1:7340/p/demo/next?by=codex'"
        self.assertIsNone(blocked_tool_call("Bash", {"command": read}))
        for command in (read.replace("by=codex", "wait=540"), "while true; do " + read + "; sleep 1; done"):
            self.assertIsNotNone(blocked_tool_call("Bash", {"command": command}))
        self.assertIsNone(blocked_tool_call("Bash", {"command": "cat <<'EOF'\nwhile true; do " + read + "; done\nEOF"}))

    def test_real_hook_process_returns_a_deny_decision_without_a_model(self):
        request = {"hook_event_name": "PreToolUse", "tool_name": "Bash",
                   "tool_input": {"command": "curl http://localhost:7340/p/demo/next?wait=540"}}
        run = subprocess.run([sys.executable, str(ROOT / "tools/agent_work_guard.py")], input=json.dumps(request),
                             text=True, capture_output=True, check=True)
        self.assertEqual(json.loads(run.stdout)["hookSpecificOutput"]["permissionDecision"], "deny")

    def test_install_preserves_other_settings_and_does_not_duplicate_hooks(self):
        spec = importlib.util.spec_from_file_location("install_guard", ROOT / "tools/install_agent_guard.py")
        assert spec and spec.loader
        installer = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(installer)
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            path = home / ".codex/hooks.json"
            path.parent.mkdir()
            original = {"description": "keep", "hooks": {"PreToolUse": [{"hooks": [{"command": "existing"}]}]}}
            path.write_text(json.dumps(original))
            self.assertEqual(len(installer.install(home)), 1)
            self.assertEqual(installer.install(home), [])
            installed = json.loads(path.read_text())
            self.assertEqual(installed["description"], "keep")
            self.assertEqual(installed["hooks"]["PreToolUse"][0], original["hooks"]["PreToolUse"][0])
            self.assertEqual(len(installed["hooks"]["PreToolUse"]), 2)


    def test_install_leaves_claude_code_unguarded_and_removes_an_earlier_install(self):
        spec = importlib.util.spec_from_file_location("install_guard", ROOT / "tools/install_agent_guard.py")
        assert spec and spec.loader
        installer = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(installer)
        command = "python3 " + str((ROOT / "tools/agent_work_guard.py").resolve())
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            path = home / ".claude/settings.json"
            path.parent.mkdir()
            other = {"matcher": "Bash", "hooks": [{"type": "command", "command": "existing"}]}
            path.write_text(json.dumps({"model": "keep", "hooks": {"PreToolUse": [
                other, {"matcher": "*", "hooks": [{"type": "command", "command": command}]}]}}))
            self.assertEqual(installer.install(home), [str(path)])
            self.assertEqual(json.loads(path.read_text()), {"model": "keep", "hooks": {"PreToolUse": [other]}})
            self.assertEqual(installer.install(home), [])

if __name__ == "__main__":
    unittest.main()
