"""Install the no-idle-work command hook for local Codex and Claude Code.

Preserve other settings and hooks; save the previous file beside each change.
No service, model or recurring task is started.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import shlex


def install(home: Path) -> list:
    command = "python3 " + shlex.quote(str(Path(__file__).resolve().with_name("agent_work_guard.py")))
    changed = []
    for relative in (".codex/hooks.json", ".claude/settings.json"):
        path = home / relative
        if not path.parent.is_dir():
            continue
        previous = path.read_text() if path.exists() else "{}"
        data = json.loads(previous)
        entries = data.setdefault("hooks", {}).setdefault("PreToolUse", [])
        if any(h.get("command") == command for entry in entries for h in entry.get("hooks", [])):
            continue
        entries.append({"matcher": "*", "hooks": [{"type": "command", "command": command, "timeout": 5}]})
        if path.exists():
            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
            path.with_name(path.name + ".before-agent-work-guard-" + stamp).write_text(previous)
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
        temporary.replace(path)
        changed.append(str(path))
    return changed


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--home", type=Path, default=Path.home())
    for path in install(parser.parse_args().home):
        print(path)
