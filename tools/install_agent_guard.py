"""Install the no-idle-work command hook for local Codex only.

Claude Code keeps its Taska long-poll wait (/next?wait), which wakes the model only when work arrives, so the
guard is not installed there and an earlier install is removed. Preserve other settings and hooks; save the
previous file beside each change. No service, model or recurring task is started.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import shlex


def _write(path: Path, previous: str, data: dict) -> None:
    if path.exists():
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        path.with_name(path.name + ".before-agent-work-guard-" + stamp).write_text(previous)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    temporary.replace(path)


def install(home: Path) -> list:
    command = "python3 " + shlex.quote(str(Path(__file__).resolve().with_name("agent_work_guard.py")))
    changed = []
    path = home / ".codex/hooks.json"
    if path.parent.is_dir():
        previous = path.read_text() if path.exists() else "{}"
        data = json.loads(previous)
        entries = data.setdefault("hooks", {}).setdefault("PreToolUse", [])
        if not any(h.get("command") == command for entry in entries for h in entry.get("hooks", [])):
            entries.append({"matcher": "*", "hooks": [{"type": "command", "command": command, "timeout": 5}]})
            _write(path, previous, data)
            changed.append(str(path))
    # Claude Code is out of scope: remove an entry an earlier version installed.
    path = home / ".claude/settings.json"
    if path.exists():
        previous = path.read_text()
        data = json.loads(previous)
        entries = data.get("hooks", {}).get("PreToolUse", [])
        kept = [e for e in entries if not any(h.get("command") == command for h in e.get("hooks", []))]
        if len(kept) != len(entries):
            if kept:
                data["hooks"]["PreToolUse"] = kept
            else:
                del data["hooks"]["PreToolUse"]
                if not data["hooks"]:
                    del data["hooks"]
            _write(path, previous, data)
            changed.append(str(path))
    return changed

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--home", type=Path, default=Path.home())
    for path in install(parser.parse_args().home):
        print(path)
