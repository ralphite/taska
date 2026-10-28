"""Consume Taska-pushed pointers at normal Codex boundaries, with no idle polling.

An empty inbox performs no HTTP request and produces no model context. Taska
claims the exact native queue entry before returning a message, so either the
hook or the native queued turn delivers it, never both.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import sys
import urllib.request
import uuid


def receive(root: Path, event: dict) -> dict:
    kind = event.get("hook_event_name")
    if kind not in ("PreToolUse", "PostToolUse", "Stop"):
        return {}
    try:
        session = str(uuid.UUID(event.get("session_id", "")))
    except (ValueError, AttributeError, TypeError):
        return {}
    message = None
    for pointer in sorted(root.glob("*/.codex-inbox/" + session + "/*.json")):
        record = json.loads(pointer.read_text())
        project = record.get("project", "")
        if not re.fullmatch(r"[A-Za-z0-9_.-]+", project):
            raise ValueError("Invalid Taska project")
        notification = str(uuid.UUID(record["id"]))
        request = urllib.request.Request(
            "http://127.0.0.1:7340/p/" + project + "/api/codex-notifications",
            data=json.dumps({"hook": notification, "sessionId": session}).encode(),
            headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(request, timeout=35) as response:
            message = json.load(response).get("message")
        if message:
            # Emit each claimed update before attempting another fallible claim.
            break
    if not message:
        return {}
    content = message
    if kind == "Stop":
        return {"decision": "block", "reason": content}
    return {"hookSpecificOutput": {"hookEventName": kind, "additionalContext": content}}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.home() / ".taska")
    args = parser.parse_args()
    print(json.dumps(receive(args.root, json.load(sys.stdin))))
