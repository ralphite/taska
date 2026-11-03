"""A registered manager session is denied blocking tools and project edits; other sessions are untouched."""

import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "tools" / (name + ".py"))
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


guard = load("manager_guard")
installer = load("install_manager_guard")
MANAGER, WORKER = "manager-1", "worker-1"


class Guard(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.home = Path(self.directory.name).resolve()
        self.project = self.home / "dev/app"
        self.project.mkdir(parents=True)
        (self.home / ".claude").mkdir()
        (self.home / ".codex").mkdir()
        installer.add(self.home, MANAGER, "claude")
        installer.add(self.home, MANAGER, "codex")
        self.transcript = self.home / ".claude/projects/-dev-app" / (MANAGER + ".jsonl")
        self.temp = self.home / "tmp"  # the test home itself lives in the real temp folder

    def tearDown(self):
        self.directory.cleanup()

    def decide(self, tool, args=None, session=MANAGER, harness="claude"):
        request = {"hook_event_name": "PreToolUse", "session_id": session, "cwd": str(self.project),
                   "transcript_path": str(self.transcript), "tool_name": tool, "tool_input": args or {}}
        return guard.decide(request, self.home, harness, [str(self.temp)])

    def test_tools_that_can_prompt_or_wait_are_denied_for_the_manager(self):
        for tool in ("mcp__Claude_Browser__navigate", "mcp__claude-in-chrome__computer",
                     "mcp__computer-use__app_click", "mcp__Claude_Code_iOS_Simulator__control", "AskUserQuestion"):
            with self.subTest(tool=tool):
                reason = self.decide(tool)
                self.assertIn("task session", reason)
                self.assertIsNone(self.decide(tool, session=WORKER))
        self.assertIn("ask", self.decide("AskUserQuestion"))

    def test_taska_and_messages_stay_allowed(self):
        for tool, args in (("Bash", {"command": "curl -s http://127.0.0.1:7340/p/app/next?by=claude-code"}),
                           ("Read", {"file_path": str(self.project / "main.py")}),
                           ("mcp__ccd_session_mgmt__send_message", {"text": "Do B03"})):
            self.assertIsNone(self.decide(tool, args))

    def test_edits_only_in_memory_and_temp_folders(self):
        memory = self.transcript.parent / "memory/notes.md"
        scratch = self.temp / "scratch/plan.txt"
        self.assertIsNone(self.decide("Write", {"file_path": str(memory)}))
        self.assertIsNone(self.decide("Edit", {"file_path": str(scratch)}))
        self.assertIsNone(guard.decide({"hook_event_name": "PreToolUse", "session_id": MANAGER, "tool_name": "Write",
                                        "tool_input": {"file_path": "/tmp/brief.txt"}}, self.home))
        for path in (str(self.project / "main.py"), "main.py", str(memory.parent / "../escape.md"),
                     str(self.home / ".claude/projects/-other/memory/notes.md")):
            with self.subTest(path=path):
                self.assertIn("task session", self.decide("Edit", {"file_path": path}))
                self.assertIsNone(self.decide("Edit", {"file_path": path}, session=WORKER))
        self.assertIsNotNone(self.decide("NotebookEdit", {"notebook_path": str(self.project / "a.ipynb")}))

    def test_codex_patches_are_checked_by_the_files_they_touch(self):
        patch = "*** Begin Patch\n*** Update File: {}\n@@\n-a\n+b\n*** End Patch\n"
        inside = str(self.home / ".codex/memories/notes.md")
        self.assertIsNone(self.decide("apply_patch", {"command": patch.format(inside)}, harness="codex"))
        self.assertIsNotNone(self.decide("apply_patch", {"command": patch.format("src/a.py")}, harness="codex"))
        self.assertIsNotNone(self.decide("mcp__Claude_Browser__navigate", harness="codex"))
        self.assertIsNone(self.decide("apply_patch", {"command": patch.format("src/a.py")}, session=WORKER,
                                      harness="codex"))

    def test_real_hook_process_denies_a_browser_call_and_passes_other_sessions(self):
        env = dict(os.environ, HOME=str(self.home))
        command = installer.hook_command("claude").split()
        for session, denied in ((MANAGER, True), (WORKER, False)):
            request = {"hook_event_name": "PreToolUse", "session_id": session, "cwd": str(self.project),
                       "tool_name": "mcp__Claude_Browser__navigate", "tool_input": {"url": "http://localhost"}}
            run = subprocess.run([sys.executable] + command[1:], input=json.dumps(request), text=True,
                                 capture_output=True, check=True, env=env, timeout=10)
            if denied:
                self.assertEqual(json.loads(run.stdout)["hookSpecificOutput"]["permissionDecision"], "deny")
            else:
                self.assertEqual(run.stdout, "")


class Installer(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.home = Path(self.directory.name)

    def tearDown(self):
        self.directory.cleanup()

    def test_claude_install_replaces_the_hand_made_hook_and_keeps_other_settings(self):
        path = self.home / ".claude/settings.json"
        path.parent.mkdir()
        other = {"matcher": "Bash", "hooks": [{"type": "command", "command": "existing"}]}
        old = {"matcher": "*", "hooks": [{"type": "command", "command": "python3 ~/.claude/hooks/manager-guard.py",
                                          "timeout": 5}]}
        path.write_text(json.dumps({"theme": "dark", "hooks": {"PreToolUse": [other, old],
                                                               "Stop": [{"hooks": []}]}}))
        (self.home / ".claude/hooks").mkdir()
        (self.home / ".claude/hooks/manager-sessions.txt").write_text("# managers\nkept-id\n")
        self.assertEqual(installer.install(self.home), [str(path)])
        self.assertEqual(installer.install(self.home), [])
        data = json.loads(path.read_text())
        self.assertEqual(data["theme"], "dark")
        self.assertEqual(data["hooks"]["Stop"], [{"hooks": []}])
        self.assertEqual(data["hooks"]["PreToolUse"][0], other)
        self.assertEqual(data["hooks"]["PreToolUse"][1]["hooks"],
                         [{"type": "command", "command": installer.hook_command("claude"), "timeout": 5}])
        self.assertEqual(len(data["hooks"]["PreToolUse"]), 2)
        self.assertEqual(guard.read_sessions(self.home / ".claude/hooks/manager-sessions.txt"), ["kept-id"])
        self.assertTrue(list(path.parent.glob("settings.json.before-manager-guard-*")))

    def test_codex_install_keeps_the_no_idle_hook_and_empty_groups(self):
        path = self.home / ".codex/hooks.json"
        path.parent.mkdir()
        original = {"description": "keep", "hooks": {"PreToolUse": [
            {"matcher": "*", "hooks": []},
            {"matcher": "*", "hooks": [{"type": "command", "command": "python3 tools/agent_work_guard.py"}]}]}}
        path.write_text(json.dumps(original))
        changed = installer.install(self.home, "codex")
        self.assertIn(str(path), changed)
        self.assertEqual(installer.install(self.home, "codex"), [])
        groups = json.loads(path.read_text())["hooks"]["PreToolUse"]
        self.assertEqual(groups[:2], original["hooks"]["PreToolUse"])
        self.assertEqual(groups[2]["hooks"][0]["command"], installer.hook_command("codex"))
        self.assertFalse((self.home / ".claude/settings.json").exists())

    def test_add_and_remove_session_ids_are_idempotent(self):
        (self.home / ".claude").mkdir()
        sessions = self.home / ".claude/hooks/manager-sessions.txt"
        self.assertIn(str(sessions), installer.add(self.home, "a"))
        self.assertEqual(installer.add(self.home, "a"), [])
        installer.add(self.home, "b")
        self.assertEqual(guard.read_sessions(sessions), ["a", "b"])
        self.assertEqual(installer.remove(self.home, "a"), [str(sessions)])
        self.assertEqual(installer.remove(self.home, "a"), [])
        self.assertEqual(guard.read_sessions(sessions), ["b"])
        with self.assertRaises(ValueError):
            installer.add(self.home, "two words")

    def test_missing_harness_is_reported_not_created(self):
        with self.assertRaises(FileNotFoundError):
            installer.install(self.home, "codex")
        self.assertFalse((self.home / ".codex").exists())

    def test_cli_add_defaults_to_this_sessions_id(self):
        (self.home / ".claude").mkdir()
        env = dict(os.environ, CLAUDE_CODE_SESSION_ID="from-env")
        subprocess.run([sys.executable, str(ROOT / "tools/install_manager_guard.py"), "add", "--home",
                        str(self.home)], check=True, capture_output=True, env=env, timeout=10)
        self.assertEqual(guard.read_sessions(self.home / ".claude/hooks/manager-sessions.txt"), ["from-env"])


if __name__ == "__main__":
    unittest.main()
