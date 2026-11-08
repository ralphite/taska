"""Agent sessions on this machine by their own id (T711 #10568): one reader per kind of agent app, each giving the same
small record. An agent tells Taska its session's id with &sid= on its calls; both apps put it in the environment of
the commands they run ($CLAUDE_CODE_SESSION_ID, $CODEX_THREAD_ID), so `&sid=$CLAUDE_CODE_SESSION_ID$CODEX_THREAD_ID`
is the whole report. Standard library only.

Claude Code: each running session keeps ~/.claude/sessions/<pid>.json (the folder: TASKA_CLAUDE_SESSIONS), with its
`sessionId`, title (`name`), folder (`cwd`), `status` ("busy", "idle", or "waiting" while it waits on the user) and,
while it waits, `waitingFor` (a permission, a plan to approve, a question). A file whose process is gone is left over.

Codex: each thread logs to ~/.codex/sessions/YYYY/MM/DD/rollout-*-<id>.jsonl (the folder ~/.codex: TASKA_CODEX_HOME);
its last turn event says busy (task_started), idle (task_complete) or waiting (an approval or input request), and
~/.codex/session_index.jsonl has its title.
"""

from __future__ import annotations

import glob
import json
import os
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Callable, Dict, Iterator, Optional

SID = re.compile(r"[A-Za-z0-9-]{8,64}")  # a session id as an agent may report it (also safe in a file pattern)


@dataclass(frozen=True)
class Session:
    agent: str  # the app's name in Taska: "claude-code", "codex"
    id: str
    name: str  # its title, as the app shows it ('' when it has none)
    cwd: str
    status: str  # "busy", "idle", "waiting" (on the user) or "exited"
    waiting_for: str = ""  # what it waits on ('' when the app does not say)
    since: int = 0  # when it came to this status, in ms (0: not known)


# -- Claude Code ------------------------------------------------------------------

def _claude_folder() -> str:
    return os.environ.get("TASKA_CLAUDE_SESSIONS") or os.path.expanduser("~/.claude/sessions")


def _alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except PermissionError:
        return True
    except OSError:
        return False
    return True


def _claude_files() -> Iterator[dict]:
    folder = _claude_folder()
    try:
        names = sorted(n for n in os.listdir(folder) if n.endswith(".json"))
    except OSError:
        return
    for n in names:
        try:
            with open(os.path.join(folder, n), encoding="utf-8") as f:
                d = json.load(f)
        except (OSError, ValueError):
            continue
        if isinstance(d, dict) and isinstance(d.get("pid"), int):
            yield d


def claude_code(sid: str) -> Optional[Session]:
    for d in _claude_files():
        if d.get("sessionId") != sid:
            continue
        waits = d.get("waitingFor")
        waits = waits if isinstance(waits, str) else ""
        status = str(d.get("status") or "")
        if not _alive(d["pid"]):
            status = "exited"
        elif waits:
            status = "waiting"
        since = d.get("statusUpdatedAt")
        return Session("claude-code", sid, str(d.get("name") or ""), str(d.get("cwd") or ""), status, waits,
                       int(since) if isinstance(since, (int, float)) else 0)
    return None


# -- Codex --------------------------------------------------------------------------

def _codex_home() -> str:
    return os.environ.get("TASKA_CODEX_HOME") or os.path.expanduser("~/.codex")


def _lines_from_end(path: str, block: int = 65536) -> Iterator[bytes]:
    """A file's lines, last first (a thread's log grows to hundreds of MB: only its end is read)."""
    with open(path, "rb") as f:
        f.seek(0, os.SEEK_END)
        at, rest = f.tell(), b""
        while at > 0:
            step = min(block, at)
            at -= step
            f.seek(at)
            chunk = f.read(step) + rest
            lines = chunk.split(b"\n")
            rest = lines.pop(0)
            for line in reversed(lines):
                yield line
        yield rest


def _ms(stamp: object) -> int:
    try:
        return int(datetime.fromisoformat(str(stamp).replace("Z", "+00:00")).timestamp() * 1000)
    except ValueError:
        return 0


def codex(sid: str) -> Optional[Session]:
    if not SID.fullmatch(sid):
        return None
    home = _codex_home()
    files = glob.glob(os.path.join(home, "sessions", "*", "*", "*", f"rollout-*-{sid}.jsonl"))
    if not files:
        return None
    status, waits, since, later = "idle", "", 0, False
    for line in _lines_from_end(files[0]):
        try:
            e = json.loads(line)
        except ValueError:
            continue
        p = e.get("payload") if isinstance(e, dict) else None
        t = str(p.get("type") or "") if isinstance(p, dict) else ""
        if t in ("task_complete", "turn_aborted"):
            status = "idle"
        elif t == "task_started":
            status = "busy"
        elif t.endswith("approval_request") or t in ("request_user_input", "elicitation_request"):
            status = "busy" if later else "waiting"  # something happened after it: it was answered
            waits = "" if later else t.replace("_", " ")
        else:
            later = later or e.get("type") == "response_item"
            continue
        since = _ms(e.get("timestamp"))
        break
    name, cwd = "", ""
    try:
        with open(os.path.join(home, "session_index.jsonl"), encoding="utf-8") as f:
            for line in f:
                if sid in line:
                    d = json.loads(line)
                    if isinstance(d, dict) and d.get("id") == sid:
                        name = str(d.get("thread_name") or "")
    except (OSError, ValueError):
        pass
    try:
        with open(files[0], encoding="utf-8") as f:
            meta = json.loads(f.readline())
        cwd = str((meta.get("payload") or {}).get("cwd") or "")
    except (OSError, ValueError, AttributeError):
        pass
    return Session("codex", sid, name, cwd, status, waits, since)


# -- by id --------------------------------------------------------------------

KINDS: Dict[str, Callable[[str], Optional[Session]]] = {"claude-code": claude_code, "codex": codex}


def lookup(sid: str) -> Optional[Session]:
    """The session with this id, whichever app runs it (ids are UUIDs: one app has it)."""
    if not SID.fullmatch(sid or ""):
        return None
    for read in KINDS.values():
        s = read(sid)
        if s:
            return s
    return None
