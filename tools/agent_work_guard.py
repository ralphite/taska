"""No-model PreToolUse guard for Codex and Claude Code. Input/output are JSON.

Install in each harness's global hook configuration. Other runtimes and hosted
tools need their own enforcement; this hook is not an OS-wide execution policy.
"""

from __future__ import annotations

import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "server"))
from taska.domain.agent_work_policy import blocked_tool_call


def main() -> int:
    request = json.load(sys.stdin)
    if request.get("hook_event_name") != "PreToolUse":
        return 0
    args = request.get("tool_input", {})
    if not isinstance(args, dict):
        return 0
    reason = blocked_tool_call(str(request.get("tool_name", "")), args)
    if reason:
        print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse",
                         "permissionDecision": "deny", "permissionDecisionReason": reason}}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
