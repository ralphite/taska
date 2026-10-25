"""Wake a project's coding agent when Yadong writes to it and no agent is around (T325).

Codex ends its turn when it thinks it is done, and its waiting command ends with it; nothing can wake it from inside.
So this runs beside Taska (LaunchAgent com.taska.waker): once a minute it asks every project, without counting as an
agent, whether there is something new from Yadong for its agent (new input or a reply). If there is, and no named
agent has been seen there for a while, it finds the agent session that last worked on that project (Codex or
Claude Code, from their own session files) and sends it one message from the command line, so it picks the work up.

Nothing here calls a model: asking Taska costs nothing; only a wake-up starts the agent, which then spends its tokens.
A wake-up that does not take (the agent exits with an error) is said in Taska at once, under T325, never left silent
(R594). A Codex chat of the ChatGPT app is never resumed (the command line cannot write to it while the app has it):
Codex is woken on the command line, in its own session (T596).

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
OFF = os.path.expanduser("~/.taska/.waker-off")  # T461: projects never woken for, one name per line
CODEX = os.environ.get("CODEX_BIN", "/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex")
CLAUDE = os.environ.get("CLAUDE_BIN", os.path.expanduser("~/.local/bin/claude"))
NAMED = ("claude-code", "codex", "antigravity")  # unnamed visitors ("agent", "probe") are scripts, not agents
AROUND_S = 10 * 60  # a named agent seen this recently is around: leave it be
AGAIN_S = 30 * 60  # the same news is woken for again at most this often
TIMES = 2  # and at most this many times in all: a third would only spend tokens again (R594); Taska is told instead
RECENT_S = 7 * 24 * 3600  # sessions older than this are not woken
TOLD_S = 12 * 3600  # a wake-up that failed is said in Taska at most this often for the same project and session
# the wake-ups on their way: project -> (the agent's process, its log, "agent session")
RUNNING: Dict[str, Tuple[subprocess.Popen, str, str]] = {}


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


def originator(path: str) -> str:
    """Who started a Codex session: "codex_exec" (the command line) or "Codex Desktop" (the ChatGPT app)."""
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            return str(json.loads(f.readline()).get("payload", {}).get("originator", ""))
    except (OSError, ValueError):
        return ""


def session_for(project: str, now: float) -> Optional[Tuple[str, str, str, str]]:
    """The newest Codex or Claude Code session that works on this project: (agent, id, cwd, file).
    agent is "" when that session is running right now (its file is being written): never a second writer.
    A session of the ChatGPT app cannot be written to from the command line while the app has it open (it "already
    has an active writer"), so Codex runs on the command line instead (T596, Yadong's choice): the newest command-line
    session of the project, or, when it has only the app's, a new one in the app session's folder ("codex-new")."""
    app: Optional[Tuple[str, str]] = None
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
            cwd = str(meta.get("cwd", os.path.expanduser("~")))
            if meta.get("originator") == "Codex Desktop":
                app = app or (cwd, path)
                continue
            return agent, str(meta.get("id", "")), cwd, path
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
    return ("codex-new", "", app[0], app[1]) if app else None


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
    elif agent == "codex-new":
        # the project's first command-line session, with the access its app session had; later ones resume it
        cmd = [CODEX, "exec", "--skip-git-repo-check", prompt.replace("by=codex-new", "by=codex")]
        if contains(path, b'"danger-full-access"'):
            cmd.insert(2, "--dangerously-bypass-approvals-and-sandbox")
    else:
        cmd = [CLAUDE, "-p", "--resume", sid, prompt]
        if contains(path, b'"permissionMode":"bypassPermissions"'):
            cmd.append("--dangerously-skip-permissions")
    if dry:
        return "would run: " + " ".join(cmd[:-1]) + " <message>"
    os.makedirs(LOGS, exist_ok=True)
    log = open(os.path.join(LOGS, f"{project}-{time.strftime('%Y%m%d-%H%M%S')}.log"), "w")
    proc = subprocess.Popen(cmd, cwd=cwd if os.path.isdir(cwd) else None, stdout=log, stderr=subprocess.STDOUT,
                            stdin=subprocess.DEVNULL, start_new_session=True)
    RUNNING[project] = (proc, log.name, f"{agent} {sid}")
    return f"woke {agent} {sid}"


def why(log: str) -> str:
    """The error the woken agent gave, in one line."""
    try:
        with open(log, encoding="utf-8", errors="replace") as f:
            lines = [l.strip() for l in f if l.strip()]
    except OSError:
        return ""
    errors = [l for l in lines if "error" in l.lower()]
    return ((errors or lines or [""])[-1])[:300]


def failed(state: Dict[str, Any], now: float) -> None:
    """Each wake-up that ended with an error: said in Taska (once per project and session in TOLD_S)."""
    told = state.setdefault("told", {})
    for project, (proc, log, who) in list(RUNNING.items()):
        code = proc.poll()
        if code is None:
            continue
        del RUNNING[project]
        if code == 0:
            continue
        print(f"[waker] {time.strftime('%Y-%m-%d %H:%M:%S')} {project}: {who} did not wake (exit {code})", flush=True)
        key = f"{project} {who}"
        if now - told.get(key, 0) < TOLD_S:
            continue
        told[key] = now
        text = (f"new bug P1 now parent=T325 \u53eb\u9192\u5668\u53eb\u4e0d\u9192 {project} \u7684 agent\uff08{who}\uff09\n"
                f"  {time.strftime('%m-%d %H:%M')} {project} \u6709 Yadong \u7684\u65b0\u8bdd\uff0c\u53eb\u9192\u5668\u53bb\u53eb {who}\uff0c\u5b83\u6ca1\u8d77\u6765\uff1a\n"
                f"  `{why(log)}`\n"
                "  \u5e38\u89c1\u539f\u56e0\uff1a\u8fd9\u4e2a\u5bf9\u8bdd\u6b63\u5f00\u5728 ChatGPT / Claude \u5e94\u7528\u91cc\uff0c\u547d\u4ee4\u884c\u63a5\u4e0d\u8fdb\u53bb\u3002"
                f"\u65e5\u5fd7\uff1a{log}\n")
        tell(text)


def tell(text: str) -> None:
    """Say something to Yadong in Taska (the taska project), as the waker."""
    try:
        req = urllib.request.Request(f"{URL}/p/taska/do?by=waker", data=text.encode("utf-8"), method="POST")
        urllib.request.urlopen(req, timeout=10).read()
    except OSError as ex:
        print(f"[waker] {time.strftime('%Y-%m-%d %H:%M:%S')} could not say so in Taska: {ex}", flush=True)


def off() -> set:
    try:
        with open(OFF, encoding="utf-8") as f:
            return {line.strip() for line in f if line.strip()}
    except OSError:
        return set()


def round_(state: Dict[str, Any], dry: bool) -> None:
    now = time.time()
    failed(state, now)
    skip = off()
    for p in json.loads(get("/api/projects")):
        name = p["name"]
        if name in skip:
            continue
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
        same = last.get("what") == what
        if same and now - last.get("t", 0) < AGAIN_S:
            continue
        if same and last.get("n", 1) >= TIMES:
            if not last.get("told"):
                last["told"] = True
                tell(f"new bug P1 now parent=T325 \u53eb\u4e86 {TIMES} \u6b21\uff0c{name} \u7684 agent \u8fd8\u6ca1\u5904\u7406\u8fd9\u6761\u65b0\u8bdd\n"
                     f"  {time.strftime('%m-%d %H:%M')} \u53eb\u9192\u5668\u4e0d\u518d\u53eb\u4e86\uff08\u518d\u53eb\u53ea\u4f1a\u767d\u82b1 token\uff0cR594\uff09\u3002\u6ca1\u5904\u7406\u7684\uff1a\n"
                     + "".join(f"  > {l}\n" for l in what.splitlines()[:6]))
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
        state[name] = {"what": what, "t": now, "n": (last.get("n", 1) + 1) if same else 1}


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
