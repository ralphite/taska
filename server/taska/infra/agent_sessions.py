"""Agent sessions on this machine by their own id (T711 #10568): one reader per kind of agent app, each giving the same
small record. An agent tells Taska its session's id with &sid= on its calls; both apps put it in the environment of
the commands they run ($CLAUDE_CODE_SESSION_ID, $CODEX_THREAD_ID), so `&sid=$CLAUDE_CODE_SESSION_ID$CODEX_THREAD_ID`
is the whole report. Standard library only.

Claude Code: each running session keeps ~/.claude/sessions/<pid>.json (the folder: TASKA_CLAUDE_SESSIONS), with its
`sessionId`, title (`name`), folder (`cwd`), `status` ("busy", "idle", or "waiting" while it waits on the user) and,
while it waits, `waitingFor` (a permission, a plan to approve, a question). A file whose process is gone is left over.

Codex: each thread logs to ~/.codex/sessions/YYYY/MM/DD/rollout-*-<id>.jsonl (the folder ~/.codex: TASKA_CODEX_HOME);
its last turn event says busy (task_started), idle (task_complete) or waiting (an approval or input request), and
~/.codex/session_index.jsonl has its title (one a manager started has none: its first instruction stands for it).
Codex writes nothing to the log while it waits for an approval: its PermissionRequest hook (tools/codex_waiting_hook.py)
leaves ~/.taska/agent-waits/<thread>.json (the folder: TASKA_AGENT_WAITS), and the thread waits while nothing it logged
is newer.

Antigravity: each conversation is ~/.gemini/antigravity/conversations/<id>.db (the folder ~/.gemini/antigravity:
TASKA_ANTIGRAVITY_HOME), its steps with their status (the app's CortexStepStatus: 9 waiting on the user, as a command to
run waits for its approval; 1, 2, 8, 11 pending, running, generating, queued), its workspace in the metadata blob, and
agyhub_summaries_proto.pb has its title.
"""

from __future__ import annotations

import glob
import json
import os
import re
import sqlite3
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Callable, Dict, Iterator, List, Optional

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

def _desktop_folder() -> str:
    return os.environ.get("TASKA_CLAUDE_DESKTOP") or os.path.expanduser("~/Library/Application Support/Claude/claude-code-sessions")


def claude_desktop(sid: str) -> Optional[Dict[str, object]]:
    """I833: the Claude desktop app's own record of the session whose id is `sid` (its `cliSessionId`): the id another
    session sends it a message by (local_...), its title, and whether it is archived; None when the app has none."""
    if not SID.fullmatch(sid or ""):
        return None
    for path in glob.glob(os.path.join(_desktop_folder(), "*", "*", "local_*.json")):
        try:
            with open(path, encoding="utf-8") as f:
                d = json.load(f)
        except (OSError, ValueError):
            continue
        if isinstance(d, dict) and d.get("cliSessionId") == sid:
            return {"id": str(d.get("sessionId") or os.path.basename(path)[:-5]), "title": str(d.get("title") or ""),
                    "archived": bool(d.get("isArchived"))}
    return None


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


def _claude_session(d: dict) -> Session:
    waits = d.get("waitingFor")
    waits = waits if isinstance(waits, str) else ""
    status = str(d.get("status") or "")
    if not _alive(d["pid"]):
        status = "exited"
    elif waits:
        status = "waiting"
    since = d.get("statusUpdatedAt")
    return Session("claude-code", str(d.get("sessionId") or ""), str(d.get("name") or ""), str(d.get("cwd") or ""),
                   status, waits, int(since) if isinstance(since, (int, float)) else 0)


def claude_code(sid: str) -> Optional[Session]:
    for d in _claude_files():
        if d.get("sessionId") == sid:
            return _claude_session(d)
    return None


def running(window: float = 86400) -> List[Session]:
    """The agent sessions on this machine, whoever started them (I810: a manager's worker that never calls Taska is
    among them, by the title its manager gave it): every Claude Code session running, and every Codex thread that
    wrote in the last day (`window` seconds; Codex keeps no list of the ones running), and every Antigravity
    conversation that changed in it."""
    out = [_claude_session(d) for d in _claude_files()]
    cut = time.time() - window
    for path in glob.glob(os.path.join(_codex_home(), "sessions", "*", "*", "*", "rollout-*.jsonl")):
        try:
            if os.path.getmtime(path) < cut:
                continue
        except OSError:
            continue
        m = re.search(r"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$", path)
        s = codex(m.group(1)) if m else None
        if s:
            out.append(s)
    titles = None
    for path in glob.glob(os.path.join(_ag_home(), "conversations", "*.db")):
        try:
            if os.path.getmtime(path) < cut:
                continue
        except OSError:
            continue
        titles = _ag_titles() if titles is None else titles
        s = antigravity(os.path.basename(path)[:-3], titles)
        if s:
            out.append(s)
    return [s for s in out if s.status != "exited" and SID.fullmatch(s.id)]


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
    status, waits, since, later, last = "idle", "", 0, False, 0
    for line in _lines_from_end(files[0]):
        try:
            e = json.loads(line)
        except ValueError:
            continue
        p = e.get("payload") if isinstance(e, dict) else None
        last = last or (_ms(e.get("timestamp")) if isinstance(e, dict) else 0)
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
    mark = _codex_wait(sid)
    if mark and mark[0] > last:  # asked for an approval after the last thing it logged: still waiting
        status, waits, since = "waiting", mark[1], mark[0]
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
            if not name:  # I810: a thread its manager started has no title: its first instruction says what it is
                for line in f:
                    if '"user_message"' not in line:
                        continue
                    e = json.loads(line)
                    p = e.get("payload") if isinstance(e, dict) else None
                    if isinstance(p, dict) and p.get("type") == "user_message":
                        name = str(p.get("message") or "").strip().split("\n")[0][:120]
                        break
    except (OSError, ValueError, AttributeError):
        pass
    return Session("codex", sid, name, cwd, status, waits, since)


def _codex_wait(sid: str) -> Optional[tuple]:
    """(when, what) Codex last asked this thread's approval, from its PermissionRequest hook."""
    folder = os.environ.get("TASKA_AGENT_WAITS") or os.path.expanduser("~/.taska/agent-waits")
    try:
        with open(os.path.join(folder, f"{sid}.json"), encoding="utf-8") as f:
            d = json.load(f)
        return int(d["t"]), str(d.get("for") or "approval")
    except (OSError, ValueError, KeyError, TypeError):
        return None


# -- Antigravity ----------------------------------------------------------------

AG_WAITING, AG_BUSY = 9, {1, 2, 8, 11}


def _ag_home() -> str:
    return os.environ.get("TASKA_ANTIGRAVITY_HOME") or os.path.expanduser("~/.gemini/antigravity")


def _pb(data: bytes) -> Iterator[tuple]:
    """A protobuf message's (field, value) pairs: bytes for a length-delimited field, an int for a varint."""
    i, n = 0, len(data)

    def varint() -> int:
        nonlocal i
        v, shift = 0, 0
        while i < n:
            b = data[i]
            i += 1
            v |= (b & 0x7F) << shift
            if b < 0x80:
                return v
            shift += 7
        raise ValueError("cut off")

    while i < n:
        key = varint()
        field, kind = key >> 3, key & 7
        if kind == 0:
            yield field, varint()
        elif kind == 2:
            ln = varint()
            yield field, data[i:i + ln]
            i += ln
        elif kind == 1:
            i += 8
        elif kind == 5:
            i += 4
        else:
            raise ValueError("unknown wire type")


def _ag_titles() -> Dict[str, str]:
    out: Dict[str, str] = {}
    try:
        with open(os.path.join(_ag_home(), "agyhub_summaries_proto.pb"), "rb") as f:
            for field, entry in _pb(f.read()):
                if field != 1 or not isinstance(entry, bytes):
                    continue
                cid, title = "", ""
                for k, v in _pb(entry):
                    if k == 1 and isinstance(v, bytes):
                        cid = v.decode("utf-8", "replace")
                    elif k == 2 and isinstance(v, bytes):
                        title = next((t.decode("utf-8", "replace") for j, t in _pb(v) if j == 1 and isinstance(t, bytes)), "")
                if cid:
                    out[cid] = title
    except (OSError, ValueError):
        pass
    return out


def antigravity(sid: str, titles: Optional[Dict[str, str]] = None) -> Optional[Session]:
    if not SID.fullmatch(sid):
        return None
    path = os.path.join(_ag_home(), "conversations", f"{sid}.db")
    if not os.path.exists(path):
        return None
    status, cwd = "idle", ""
    try:
        db = sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=1)
        try:
            row = db.execute("select status from steps order by idx desc limit 1").fetchone()
            waiting = db.execute("select 1 from steps where status = ? limit 1", (AG_WAITING,)).fetchone()
            blob = db.execute("select data from trajectory_metadata_blob limit 1").fetchone()
        finally:
            db.close()
        if waiting:
            status = "waiting"
        elif row and row[0] in AG_BUSY:
            status = "busy"
        for field, v in _pb(blob[0] if blob and isinstance(blob[0], bytes) else b""):
            if field == 1 and isinstance(v, bytes):
                uri = next((u for j, u in _pb(v) if j == 1 and isinstance(u, bytes)), b"").decode("utf-8", "replace")
                cwd = uri[len("file://"):] if uri.startswith("file://") else ""
                break
    except (sqlite3.Error, ValueError):
        return None
    name = (titles if titles is not None else _ag_titles()).get(sid, "")
    since = int(os.path.getmtime(path) * 1000)
    return Session("antigravity", sid, name, cwd, status, "approve a command" if status == "waiting" else "", since)


# -- by id --------------------------------------------------------------------

KINDS: Dict[str, Callable[[str], Optional[Session]]] = {"claude-code": claude_code, "codex": codex,
                                                        "antigravity": antigravity}


def lookup(sid: str) -> Optional[Session]:
    """The session with this id, whichever app runs it (ids are UUIDs: one app has it)."""
    if not SID.fullmatch(sid or ""):
        return None
    for read in KINDS.values():
        s = read(sid)
        if s:
            return s
    return None
