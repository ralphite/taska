"""Install the local Codex delivery hook; preserve other hooks and Claude settings.

This installs definitions only. Use Codex's supported hook review to trust new
definitions. No process, model, timer or task is started by this installer.
"""

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import shlex


def install(home: Path) -> bool:
    path = home / ".codex/hooks.json"
    previous = path.read_text() if path.exists() else "{}"
    data = json.loads(previous)
    command = "python3 " + shlex.quote(str(Path(__file__).resolve().with_name("codex_delivery_hook.py")))
    changed = False
    for kind in ("PreToolUse", "PostToolUse", "Stop"):
        entries = data.setdefault("hooks", {}).setdefault(kind, [])
        if any(h.get("command") == command for entry in entries for h in entry.get("hooks", [])):
            continue
        entry = {"hooks": [{"type": "command", "command": command, "timeout": 45}]}
        if kind != "Stop":
            entry["matcher"] = "*"
        entries.append(entry)
        changed = True
    if changed:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        path.with_name(path.name + ".before-taska-delivery-" + stamp).write_text(previous)
        temporary = path.with_suffix(".json.tmp")
        temporary.write_text(json.dumps(data, indent=2) + "\n")
        temporary.replace(path)
    return changed


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--home", type=Path, default=Path.home())
    print("Updated" if install(parser.parse_args().home) else "Already installed")
