"""Install the manager-never-blocks PreToolUse hook and register manager sessions, for Claude Code or Codex.

  install            add the hook to ~/.claude/settings.json (or ~/.codex/hooks.json), or update an older one
  add [SESSION]      install, then register a manager session (default: this session's id from the environment)
  remove [SESSION]   unregister a manager session; the hook stays and leaves every other session alone

Every command is idempotent. Other settings and hooks are kept, a changed settings file is saved beside itself
first, and no service, model or recurring task is started. Only registered sessions are guarded.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shlex
import sys
from typing import List

sys.path.insert(0, str(Path(__file__).resolve().parent))
from manager_guard import read_sessions, sessions_file  # noqa: E402

SESSION_ENV = {"claude": "CLAUDE_CODE_SESSION_ID", "codex": "CODEX_THREAD_ID"}
MARKERS = ("manager_guard.py", "manager-guard.py")  # this hook, and the hand-made one it replaces


def config_file(home: Path, harness: str) -> Path:
    return home / ".codex/hooks.json" if harness == "codex" else home / ".claude/settings.json"


def hook_command(harness: str) -> str:
    script = Path(__file__).resolve().with_name("manager_guard.py")
    return "python3 " + shlex.quote(str(script)) + " --harness " + harness


def _write_json(path: Path, previous: str, data: dict) -> None:
    if path.exists():
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        path.with_name(path.name + ".before-manager-guard-" + stamp).write_text(previous)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    temporary.replace(path)


def _write_sessions(path: Path, ids: List[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text("# Session ids of manager sessions, one per line (install_manager_guard.py add/remove)\n"
                         + "".join(i + "\n" for i in ids))
    temporary.replace(path)


def install(home: Path, harness: str = "claude") -> List[str]:
    path = config_file(home, harness)
    if not path.parent.is_dir():
        raise FileNotFoundError(f"{path.parent} does not exist: is {harness} installed for this user?")
    command = hook_command(harness)
    previous = path.read_text() if path.exists() else "{}"
    data = json.loads(previous)
    groups = data.setdefault("hooks", {}).setdefault("PreToolUse", [])
    found = False
    for group in groups:
        kept = []
        for hook in group.get("hooks", []):
            if any(marker in str(hook.get("command", "")) for marker in MARKERS):
                if found:
                    continue  # a duplicate
                found = True
                hook = dict(hook, type="command", command=command, timeout=hook.get("timeout", 5))
            kept.append(hook)
        if "hooks" in group:
            group["hooks"] = kept
    if not found:
        groups.append({"matcher": "*", "hooks": [{"type": "command", "command": command, "timeout": 5}]})
    changed = []
    if data != json.loads(previous):
        _write_json(path, previous, data)
        changed.append(str(path))
    sessions = sessions_file(home, harness)
    if not sessions.exists():
        _write_sessions(sessions, [])
        changed.append(str(sessions))
    return changed


def add(home: Path, session: str, harness: str = "claude") -> List[str]:
    if not session or any(c.isspace() for c in session) or session.startswith("#"):
        raise ValueError(f"not a session id: {session!r}")
    changed = install(home, harness)
    path = sessions_file(home, harness)
    ids = read_sessions(path)
    if session not in ids:
        _write_sessions(path, ids + [session])
        changed.append(str(path))
    return sorted(set(changed))


def remove(home: Path, session: str, harness: str = "claude") -> List[str]:
    path = sessions_file(home, harness)
    ids = read_sessions(path)
    if session not in ids:
        return []
    _write_sessions(path, [i for i in ids if i != session])
    return [str(path)]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("action", choices=("install", "add", "remove"))
    parser.add_argument("session", nargs="?", help="session id (add/remove; default: this session's)")
    parser.add_argument("--harness", choices=("claude", "codex"), default="claude")
    parser.add_argument("--home", type=Path, default=Path.home())
    options = parser.parse_args()
    session = options.session or os.environ.get(SESSION_ENV[options.harness], "")
    try:
        if options.action == "install":
            changed = install(options.home, options.harness)
        elif not session:
            parser.error(f"no session id given and {SESSION_ENV[options.harness]} is not set")
        else:
            changed = (add if options.action == "add" else remove)(options.home, session, options.harness)
    except (FileNotFoundError, ValueError) as error:
        parser.error(str(error))
    for item in changed:
        print(item)
    if options.action != "install" and session:
        print(f"{options.action}: {session}")
