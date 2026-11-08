"""Agent sessions on this machine that wait on the user (T711): one reader per kind of agent app, each giving the
same small record. Only Claude Code for now; another app is another reader in READERS.

Claude Code: each running session keeps ~/.claude/sessions/<pid>.json (the folder: TASKA_CLAUDE_SESSIONS), with its
title (`name`), its folder (`cwd`), `status` ("busy", "idle", or "waiting" while it waits on the user) and, while it
waits, `waitingFor` (what it asks: a permission, a plan to approve, a question). A file whose process is gone is
left over and not counted.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Callable, List, Optional, Sequence


@dataclass(frozen=True)
class Blocked:
    agent: str  # the agent's name in Taska ("claude-code")
    name: str  # the session's title, as the app shows it
    cwd: str
    waiting_for: str  # what it waits on ('' when the app does not say)
    since: int  # when it started waiting, in ms (0: not known)


def _alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    except OSError:
        return False
    return True


def claude_code(folder: Optional[str] = None) -> List[Blocked]:
    folder = folder or os.environ.get("TASKA_CLAUDE_SESSIONS") or os.path.expanduser("~/.claude/sessions")
    try:
        names = sorted(n for n in os.listdir(folder) if n.endswith(".json"))
    except OSError:
        return []
    out: List[Blocked] = []
    for n in names:
        try:
            with open(os.path.join(folder, n), encoding="utf-8") as f:
                d = json.load(f)
        except (OSError, ValueError):
            continue
        if not isinstance(d, dict) or not isinstance(d.get("pid"), int):
            continue
        waits = d.get("waitingFor")
        if d.get("status") != "waiting" and not (isinstance(waits, str) and waits):
            continue
        if not _alive(d["pid"]):
            continue
        since = d.get("statusUpdatedAt")
        out.append(Blocked(agent="claude-code", name=str(d.get("name") or ""), cwd=str(d.get("cwd") or ""),
                           waiting_for=waits if isinstance(waits, str) else "",
                           since=int(since) if isinstance(since, (int, float)) else 0))
    return out


READERS: Sequence[Callable[[], List[Blocked]]] = (claude_code,)


def blocked_sessions() -> List[Blocked]:
    """Every agent session on this machine that waits on the user now."""
    return [b for read in READERS for b in read()]
