"""Wake a project's coding agent when Yadong writes to it and no agent is around (T325).

Codex ends its turn when it thinks it is done, and its waiting command ends with it; nothing can wake it from inside.
So this runs beside Taska (LaunchAgent com.taska.waker): once a minute it asks every project, without counting as an
agent, whether there is something new from Yadong for its agent (new input or a reply). If there is, and no named
agent has been seen there for a while, it finds the agent session that last worked on that project (Codex or
Claude Code, from their own session files) and sends it one message from the command line, so it picks the work up.

Nothing here calls a model: asking Taska costs nothing; only a wake-up starts the agent, which then spends its tokens.

    python3 v2/tools/waker.py            run forever
    python3 v2/tools/waker.py --once     one round, for a test (add --dry to only say what it would do)
"""

from __future__ import annotations

import glob
import json
import os
import re
import subprocess
import sys
import time
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

URL = os.environ.get("TASKA_URL", "http://127.0.0.1:7340")
STATE = os.path.expanduser("~/.taska/.waker.json")
LOGS = os.path.expanduser("~/.taska/.waker-logs")
CODEX = os.environ.get("CODEX_BIN", "/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex")
CLAUDE = os.environ.get("CLAUDE_BIN", os.path.expanduser("~/.local/bin/claude"))
NAMED = ("claude-code", "codex", "antigravity")  # unnamed visitors ("agent", "probe") are scripts, not agents
AROUND_S = 10 * 60  # a named agent seen this recently is around: leave it be
AGAIN_S = 30 * 60  # the same news is woken for again at most this often
RECENT_S = 7 * 24 * 3600  # sessions older than this are not woken


def get(path: str, timeout: float = 10) -> str:
    with urllib.request.urlopen(URL + path, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def news(project: str) -> Optional[str]:
    """What is new from Yadong for this project's agent, or None. ui=1: asking does not count as an agent visiting."""
    text = get(f"/p/{project}/next?ui=1")
    lines = text.splitlines()
    for i, l in enumerate(lines):
        if l.startswith("first handle the inbox"):  # the inputs follow, up to a blank line
            block = lines[i + 1:]
            return "\n".join(block[:block.index("")] if "" in block else block)[:600] or "inbox"
    for l in lines:
        if l.startswith("resume "):
            return l
    return None


def around(agents: List[Dict[str, Any]], now: float) -> bool:
    for a in agents:
        if a.get("name") in NAMED and (a.get("waiting") or now - a.get("t", 0) / 1000 < AROUND_S):
            return True
    return False


def contains(path: str, needle: bytes) -> bool:
    try:
        with open(path, "rb") as f:
            tail = b""
            while True:
                chunk = f.read(1 << 20)
                if not chunk:
                    return False
                if needle in tail + chunk:
                    return True
                tail = chunk[-len(needle):]
    except OSError:
        return False


NEXT = re.compile(rb"curl [^\n]{0,300}?/p/([A-Za-z0-9_.-]+)/next")
_last: Dict[str, Tuple[float, Optional[str]]] = {}


def last_project(path: str, mtime: float) -> Optional[str]:
    """The project whose /next this session asked for last (a real curl call, not a mention): the one it works on."""
    if path in _last and _last[path][0] == mtime:
        return _last[path][1]
    found: Optional[str] = None
    step, end = 8 << 20, os.path.getsize(path)
    with open(path, "rb") as f:
        while end > 0 and found is None:
            start = max(0, end - step)
            f.seek(start)
            hits = list(NEXT.finditer(f.read(end - start + 400)))
            if hits:
                found = hits[-1].group(1).decode()
            end = start
    _last[path] = (mtime, found)
    return found


def session_for(project: str, now: float) -> Optional[Tuple[str, str, str, str]]:
    """The newest Codex or Claude Code session that works on this project: (agent, id, cwd, file).
    agent is "" when that session is running right now (its file is being written): never a second writer."""
    found: List[Tuple[float, str, str]] = []
    for path in glob.glob(os.path.expanduser("~/.codex/sessions/*/*/*/*.jsonl")):
        found.append((os.path.getmtime(path), "codex", path))
    for path in glob.glob(os.path.expanduser("~/.claude/projects/*/*.jsonl")):
        found.append((os.path.getmtime(path), "claude-code", path))
    for mtime, agent, path in sorted(found, reverse=True):
        if now - mtime > RECENT_S:
            break
        try:
            if last_project(path, mtime) != project:
                continue
        except OSError:
            continue
        if now - mtime < AROUND_S:
            return "", "", "", path
        if agent == "codex":
            with open(path, encoding="utf-8", errors="replace") as f:
                meta = json.loads(f.readline()).get("payload", {})
            return agent, str(meta.get("id", "")), str(meta.get("cwd", os.path.expanduser("~"))), path
        sid = os.path.splitext(os.path.basename(path))[0]
        cwd = os.path.expanduser("~")
        with open(path, encoding="utf-8", errors="replace") as f:
            for line in f:
                if '"cwd"' in line:
                    try:
                        cwd = json.loads(line).get("cwd") or cwd
                        break
                    except ValueError:
                        pass
        return agent, sid, cwd, path
    return None


def wake(project: str, agent: str, sid: str, cwd: str, path: str, what: str, dry: bool) -> str:
    base = f"{URL}/p/{project}"
    prompt = (f"Taska ({project}) has something new from Yadong for you:\n{what}\n\n"
              f"GET {base}/next?by={agent} and do it as the Taska skill says; keep going while there is work. "
              "When nothing is left, end your turn: do not wait for more work with /next?wait. "
              "Taska wakes you again when Yadong writes.")
    if agent == "codex":
        cmd = [CODEX, "exec", "resume", "--skip-git-repo-check", sid, prompt]
        if contains(path, b'"danger-full-access"'):  # it ran with full access: it goes on the same way
            cmd.insert(3, "--dangerously-bypass-approvals-and-sandbox")
    else:
        cmd = [CLAUDE, "-p", "--resume", sid, prompt]
        if contains(path, b'"permissionMode":"bypassPermissions"'):
            cmd.append("--dangerously-skip-permissions")
    if dry:
        return "would run: " + " ".join(cmd[:-1]) + " <message>"
    os.makedirs(LOGS, exist_ok=True)
    log = open(os.path.join(LOGS, f"{project}-{time.strftime('%Y%m%d-%H%M%S')}.log"), "w")
    subprocess.Popen(cmd, cwd=cwd if os.path.isdir(cwd) else None, stdout=log, stderr=subprocess.STDOUT,
                     stdin=subprocess.DEVNULL, start_new_session=True)
    return f"woke {agent} {sid}"


def round_(state: Dict[str, Any], dry: bool) -> None:
    now = time.time()
    for p in json.loads(get("/api/projects")):
        name = p["name"]
        try:
            what = news(name)
        except OSError:
            continue
        if not what:
            state.pop(name, None)
            continue
        if around(p.get("agents") or [], now):
            continue
        last = state.get(name) or {}
        if last.get("what") == what and now - last.get("t", 0) < AGAIN_S:
            continue
        found = session_for(name, now)
        if not found:
            print(f"[waker] {time.strftime('%Y-%m-%d %H:%M:%S')} {name}: news, but no agent session has worked on it", flush=True)
            state[name] = {"what": what, "t": now}
            continue
        if not found[0]:
            continue  # its session is working right now and will see the news itself
        said = wake(name, *found, what=what, dry=dry)
        print(f"[waker] {time.strftime('%Y-%m-%d %H:%M:%S')} {name}: {said}", flush=True)
        state[name] = {"what": what, "t": now}


def main() -> None:
    once, dry = "--once" in sys.argv, "--dry" in sys.argv
    try:
        with open(STATE, encoding="utf-8") as f:
            state: Dict[str, Any] = json.load(f)
    except (OSError, ValueError):
        state = {}
    while True:
        try:
            round_(state, dry)
            if not dry:
                with open(STATE, "w", encoding="utf-8") as f:
                    json.dump(state, f)
        except Exception as ex:  # Taska restarting, a file in the middle of being written: the next round tries again
            print(f"[waker] {time.strftime('%Y-%m-%d %H:%M:%S')} round failed: {ex}", flush=True)
        if once:
            return
        time.sleep(60)


if __name__ == "__main__":
    main()
