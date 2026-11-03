"""PreToolUse guard that keeps a manager session from blocking. Input/output are JSON; no model is called.

A manager only reads and writes Taska, messages task sessions and checks what they hand back. For the sessions
listed in the harness's manager-sessions.txt, this denies at once, without a prompt, the calls that can show a
question or wait on the user (browser, computer and simulator tools, chat questions) and edits outside the
manager's memory and temp folders. Every other session passes untouched. Installed by install_manager_guard.py.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import sys
import tempfile
from typing import Iterable, List, Optional

BLOCKING_PREFIXES = ("mcp__Claude_Browser__", "mcp__claude-in-chrome__", "mcp__computer-use__",
                     "mcp__Claude_Code_iOS_Simulator__", "mcp__remote-devices__")
BLOCKING_TOOLS = {"AskUserQuestion", "request_user_input"}  # Claude Code's and Codex's chat questions
EDIT_TOOLS = {"Edit", "Write", "MultiEdit", "NotebookEdit", "apply_patch"}
_PATCH_PATH = re.compile(r"^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$", re.M)


def sessions_file(home: Path, harness: str) -> Path:
    return home / (".codex" if harness == "codex" else ".claude") / "hooks" / "manager-sessions.txt"


def read_sessions(path: Path) -> List[str]:
    if not path.exists():
        return []
    lines = (line.strip() for line in path.read_text().splitlines())
    return [line for line in lines if line and not line.startswith("#")]


TEMP_DIRS = (tempfile.gettempdir(), "/tmp", "/private/tmp")


def _writable(request: dict, home: Path, harness: str, temp_dirs: Iterable[str]) -> List[Path]:
    places = [Path(place) for place in temp_dirs]
    if harness == "codex":
        places.append(home / ".codex" / "memories")
    elif request.get("transcript_path"):
        # Claude Code keeps a session's memory beside its transcript: ~/.claude/projects/<project>/memory/
        places.append(Path(str(request["transcript_path"])).parent / "memory")
    return [place.resolve() for place in places]


def _edited_paths(tool: str, args: dict, cwd: Path) -> Iterable[Path]:
    if tool == "apply_patch":
        text = "\n".join(value for value in args.values() if isinstance(value, str))
        names = [name.strip() for name in _PATCH_PATH.findall(text)]
    else:
        names = [str(args.get("file_path") or args.get("notebook_path") or "")]
    for name in names:
        yield (cwd / Path(name).expanduser()).resolve() if name else cwd.resolve()


def decide(request: dict, home: Path, harness: str = "claude",
           temp_dirs: Iterable[str] = TEMP_DIRS) -> Optional[str]:
    """The reason to deny this call, or None to let it run."""
    if request.get("hook_event_name") != "PreToolUse":
        return None
    if str(request.get("session_id", "")) not in read_sessions(sessions_file(home, harness)):
        return None
    tool = str(request.get("tool_name", ""))
    args = request.get("tool_input") if isinstance(request.get("tool_input"), dict) else {}
    if tool in BLOCKING_TOOLS or tool.startswith(BLOCKING_PREFIXES):
        return (f"A manager never blocks: {tool} can show a prompt or wait on the user. Hand this to the task "
                "session that owns the item (a question for the user goes on the item with `ask`), then continue.")
    if tool in EDIT_TOOLS:
        cwd = Path(str(request.get("cwd") or home))
        writable = _writable(request, home, harness, temp_dirs)
        paths = list(_edited_paths(tool, args, cwd))
        outside = [p for p in paths if not any(p == w or w in p.parents for w in writable)]
        if outside or not paths:
            target = str(outside[0]) if outside else "these files"
            return (f"A manager does no project work: hand the edit of {target} to the task session that owns "
                    "the item, then continue. Only the manager's memory and temp folders are writable here.")
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--harness", choices=("claude", "codex"), default="claude")
    harness = parser.parse_args().harness
    try:
        request = json.load(sys.stdin)
    except ValueError:
        return 0
    reason = decide(request, Path.home(), harness) if isinstance(request, dict) else None
    if reason:
        print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse",
                         "permissionDecision": "deny", "permissionDecisionReason": reason}}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
