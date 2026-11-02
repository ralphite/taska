"""Pure checks for known idle-work triggers, shared by audits and tool hooks.

This is a guardrail for recognizable requests, not a sandbox or a proof of an
arbitrary program's behavior. Delivery deduplication belongs to the event outbox.
"""

from __future__ import annotations

import re
from typing import Any, Mapping, Optional

IDLE_REASON = ("No idle model wakeups: use a real new-work event, not a scheduled "
               "message check or polling loop. With no work, end the turn.")
_CHECK = re.compile(
    r"/next\b|(?:check|poll|look|watch|monitor).{0,60}(?:new work|messages|queue|updates)|"
    r"(?:new work|messages|queue).{0,40}(?:check|poll)|"
    r"(?:\u67e5\u770b|\u68c0\u67e5|\u67e5\u8be2|\u8f6e\u8be2|\u76d1\u63a7).{0,30}"
    r"(?:\u6d88\u606f|\u961f\u5217|\u65b0\u4efb\u52a1|\u6709\u6ca1\u6709\u6d3b|\u65b0\u5de5\u4f5c)", re.I)
_NEGATIVE = re.compile(r"^\s*(?:[-*]\s*)?(?:never|do not|don't|no\b|\u4e0d\u8981|\u7981\u6b62|\u4e0d\u8bb8)", re.I)
_SCHEDULE = re.compile(r"automation_update|schedule.*(?:create|update|wakeup)|(?:create|update).*schedule|croncreate", re.I)


def idle_check_prompt(prompt: str) -> bool:
    """Recognize message/work checks without classifying explicit prohibitions."""
    parts = re.split(r"[\n;.!\u3002\uff1b]+", prompt)
    return any(_CHECK.search(part) for part in parts if not _NEGATIVE.search(part))


def _shell_commands(command: str) -> str:
    # Here-doc contents are data for the command, often source or test fixtures.
    # Do not block an editor merely for documenting a forbidden command.
    result = []
    delimiter = ""
    for line in command.splitlines():
        if delimiter:
            if line.strip() == delimiter:
                delimiter = ""
            continue
        result.append(line)
        match = re.search(r"<<-?\s*['\"]?([A-Za-z_][A-Za-z_0-9]*)", line)
        if match:
            delimiter = match[1]
    return "\n".join(result)


def blocked_tool_call(tool: str, args: Mapping[str, Any]) -> Optional[str]:
    """Block known idle scheduling/polling; allow ordinary work and disabling."""
    if _SCHEDULE.search(tool):
        if args.get("mode") in ("view", "delete") or args.get("status") == "PAUSED" or args.get("enabled") is False:
            return None
        prompt = str(args.get("prompt") or args.get("description") or "")
        if idle_check_prompt(prompt):
            return IDLE_REASON
        if (args.get("status") == "ACTIVE" or args.get("enabled") is True) and not prompt:
            return "Include the scheduled work's prompt so the no-idle-work policy can be checked."
    if tool.lower() in ("bash", "exec_command", "shell", "shell_command"):
        command = _shell_commands(str(args.get("command") or args.get("cmd") or ""))
        reads = re.search(r"\b(?:curl|wget)\b", command) and re.search(r"/next(?:[?\s'\"]|$)", command)
        waits = re.search(r"[?&]wait=(?!0(?:[&\s'\"]|$))[^&\s'\"]+", command)
        repeats = re.search(r"\b(?:while|until|for|watch)\b", command)
        # the one wait allowed: in the background, Taska holding the request until there is work (no model runs
        # while it waits; the session resumes when it ends with work)
        if reads and waits and args.get("run_in_background") is True:
            return None
        if reads and (waits or repeats):
            return IDLE_REASON
    return None
