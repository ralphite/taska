"""Codex's PermissionRequest hook (T810 r1373): Codex asks you to approve something. Its rollout log does not say so
(Codex 0.147 writes nothing while it waits), so this hook leaves a mark Taska reads: ~/.taska/agent-waits/<thread>.json
with when and what. Anything Codex writes to the thread after it means it was answered. It decides nothing (no output),
never fails Codex (every error is swallowed), and uses no model.

Installed by tools/install_codex_waiting_hook.py.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time


def folder() -> str:
    return os.environ.get("TASKA_AGENT_WAITS") or os.path.expanduser("~/.taska/agent-waits")


def what(request: dict) -> str:
    tool = str(request.get("tool_name") or "")
    args = request.get("tool_input")
    cmd = args.get("command") if isinstance(args, dict) else None
    if isinstance(cmd, list):
        cmd = " ".join(str(c) for c in cmd)
    said = f"approve {tool}" if tool else "approve"
    return f"{said}: {cmd}"[:200] if cmd else said


def main() -> int:
    try:
        request = json.load(sys.stdin)
        sid = str(request.get("session_id") or "")
        if not re.fullmatch(r"[A-Za-z0-9-]{8,64}", sid):
            return 0
        os.makedirs(folder(), exist_ok=True)
        tmp = os.path.join(folder(), f".{sid}.tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump({"t": int(time.time() * 1000), "for": what(request)}, f)
        os.replace(tmp, os.path.join(folder(), f"{sid}.json"))
    except Exception:  # noqa: BLE001 - a hook must never get in Codex's way
        pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
