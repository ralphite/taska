#!/usr/bin/env python3
"""The phone link's watchdog (r803). Run by the LaunchAgent com.taska.tunnel-watchdog (KeepAlive).

The phone opens Taska through a dev tunnel (com.taska.tunnel, `devtunnel host taska-ralphite`). On 10-23 the tunnel
lost its relay at 04:17, failed to refresh its token and hung for hours with its process still running: the link
gave no answer and nobody knew. This watchdog keeps the link working and says so when it can't.

Once a minute it opens the public address of port 7340 from the outside, the way a phone does, and writes one JSON
line to .logs/tunnel-health.jsonl:

  {"t": "2026-10-23T12:00:00", "up": true, "ms": 180, "status": 401, "restart": null}

  up      Taska answered through the tunnel (200, or its own 401 asking for the key) within 20 s
  status  the HTTP status (null without an answer); a 502/504 or no answer means the tunnel is down
  restart why the watchdog restarted the tunnel this minute (null when it did not)

When the link has not answered for 3 minutes in a row it restarts the tunnel host (launchctl kickstart -k), not more
than once in 10 minutes. When it is still down after two restarts, or devtunnel is no longer logged in, it opens a
P0 bug in Taska and blocks on it: a block is what Taska pushes to the phone (F195), and the push does not go through
the tunnel. When the link answers again it says so on that bug. It also keeps the Dashboard panel
~/.taska/dev/panels/tunnel.md (now, the last 24 hours, restarts).
"""

import json
import os
import re
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

TOOLS = Path(__file__).resolve().parent
LOGS = TOOLS.parent.parent / ".logs"
HEALTH = LOGS / "tunnel-health.jsonl"
STATE = LOGS / "tunnel-watchdog.json"  # the bug it opened for the current outage, kept across its own restarts
PANEL = Path.home() / ".taska/dev/panels/tunnel.md"
DEVTUNNEL = "/opt/homebrew/bin/devtunnel"
TUNNEL = "taska-ralphite"
LABEL = "com.taska.tunnel"
PORT = 7340
TASKA = "http://127.0.0.1:7340/p/taska"

TIMEOUT = 20  # seconds the link has to answer
DOWN_MINUTES = 3  # minutes in a row without an answer before a restart
QUIET_AFTER_RESTART = 10 * 60
TELL_AFTER_RESTARTS = 2  # restarts in one outage before Yadong is told
KEEP_LINES = 30 * 24 * 60


def run(*args: str, timeout: float = 60) -> str:
    try:
        return subprocess.run(list(args), capture_output=True, text=True, timeout=timeout).stdout
    except Exception:
        return ""


def address() -> Optional[str]:
    """The public address of Taska's port, from the tunnel's own description."""
    m = re.search(r"^\s*%d\s+https?\s+(https://\S+?)/?\s" % PORT, run(DEVTUNNEL, "show", TUNNEL) + " ", re.M)
    return m.group(1) if m else None


def probe(url: str) -> Tuple[Optional[int], Optional[int]]:
    """(status, ms) of one outside request; Taska's own answer, never the tunnel's warning page."""
    req = urllib.request.Request(url + "/", headers={"X-Tunnel-Skip-AntiPhishing-Page": "true"})
    t = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            r.read(200)
            return r.status, int((time.monotonic() - t) * 1000)
    except urllib.error.HTTPError as e:
        body = e.read(200).decode("utf-8", "replace")
        # Taska's 401 asks for the key: the tunnel works. A 401 or 5xx from the tunnel itself does not say "Taska".
        ok = e.code == 401 and body.startswith("Taska")
        return (e.code if ok else -e.code), int((time.monotonic() - t) * 1000)
    except Exception:
        return None, None


def logged_in() -> bool:
    return "Logged in as" in run(DEVTUNNEL, "user", "show", timeout=30)


def restart() -> None:
    run("launchctl", "kickstart", "-k", "gui/%d/%s" % (os.getuid(), LABEL), timeout=30)


def taska(text: str) -> str:
    """Write to Taska as the watchdog (its own session name, so its lines are easy to tell apart)."""
    try:
        req = urllib.request.Request(TASKA + "/do?by=claude-code&session=tunnel-watchdog", data=text.encode())
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.read().decode("utf-8", "replace")
    except Exception as e:
        print(f"taska: {e}", flush=True)
        return ""


def load_state() -> Dict[str, Any]:
    try:
        return json.loads(STATE.read_text())
    except Exception:
        return {}


def save_state(s: Dict[str, Any]) -> None:
    STATE.write_text(json.dumps(s))


# What Yadong reads (Chinese, escaped: no Chinese in code, R066)
TITLE = "\u624b\u673a\u94fe\u63a5\u6253\u4e0d\u5f00\uff08\u96a7\u9053\u65ad\u4e86\uff09"  # the phone link does not open
NEEDS_LOGIN = (
    "\u770b\u95e8\u72d7\u53d1\u73b0 devtunnel \u6ca1\u6709\u767b\u5f55\u4e86\uff0c\u91cd\u542f\u4e5f\u8fde\u4e0d\u4e0a\u3002"
    "\u8bf7 Yadong \u5728\u7ec8\u7aef\u8fd0\u884c\uff1adevtunnel user login -g\uff0c\u767b\u5f55\u540e\u770b\u95e8\u72d7\u4f1a\u81ea\u5df1\u91cd\u542f\u96a7\u9053\u3002"
)  # devtunnel is logged out; please run `devtunnel user login -g`; the watchdog restarts the tunnel itself after
STILL_DOWN = (
    "\u770b\u95e8\u72d7\u5df2\u7ecf\u91cd\u542f\u96a7\u9053 %d \u6b21\uff0c\u624b\u673a\u94fe\u63a5\u8fd8\u662f\u6253\u4e0d\u5f00\uff08%s \u8d77\uff09\u3002"
    "\u65e5\u5fd7\uff1a.logs/tunnel.log\u3001.logs/tunnel-error.log\u3002agent \u4f1a\u63a5\u7740\u67e5\u3002"
)  # restarted N times, still down since HH:MM; logs; an agent will look
BACK = "\u624b\u673a\u94fe\u63a5\u53c8\u80fd\u6253\u5f00\u4e86\uff08%s\uff09\u3002"  # the phone link works again (HH:MM)


def tell(state: Dict[str, Any], why: str) -> None:
    """Open the outage's bug once and block on it (the block is pushed to the phone)."""
    if state.get("code"):
        return
    out = taska("new bug P0 now %s\n  %s\n" % (TITLE, why))
    m = re.search(r"^ok ([A-Z]\d+) new", out, re.M)
    if m:
        state["code"] = m.group(1)
        taska("%s block %s\n" % (m.group(1), why))
        save_state(state)


def panel_text(lines: List[Dict[str, Any]], url: Optional[str]) -> str:
    out = ["\u624b\u673a\u94fe\u63a5\uff08\u96a7\u9053\uff09"]  # the phone link (tunnel)
    if not lines:
        return "\n".join(out + ["\u8fd8\u6ca1\u6709\u8bb0\u5f55\u3002"]) + "\n"
    last = lines[-1]
    up = sum(1 for x in lines if x.get("up"))
    now = "\u80fd\u6253\u5f00" if last.get("up") else "**\u6253\u4e0d\u5f00**"  # opens / does NOT open
    out.append("- \u73b0\u5728\uff1a%s\uff08%s\uff09" % (now, last["t"][11:16]))
    span = "%d \u5c0f\u65f6" % (len(lines) // 60) if len(lines) >= 60 else "%d \u5206\u949f" % len(lines)  # hours / minutes
    out.append("- \u6700\u8fd1 %s\uff1a%.1f%% \u7684\u5206\u949f\u80fd\u6253\u5f00" % (span, 100 * up / len(lines)))
    restarts = [x for x in lines if x.get("restart")]
    out.append("- \u81ea\u52a8\u91cd\u542f\uff1a%d \u6b21" % len(restarts) + ("\uff0c\u6700\u8fd1 %s" % restarts[-1]["t"][11:16] if restarts else ""))
    if url:
        out.append("- \u5730\u5740\uff1a%s" % url)
    return "\n".join(out) + "\n"


def write_panel(url: Optional[str]) -> None:
    try:
        lines = [json.loads(x) for x in HEALTH.read_text().splitlines()[-24 * 60 :] if x.strip()]
        PANEL.parent.mkdir(parents=True, exist_ok=True)
        tmp = PANEL.with_suffix(".tmp")
        tmp.write_text(panel_text(lines, url))
        tmp.replace(PANEL)
    except Exception as e:
        print(f"panel: {e}", flush=True)


def trim() -> None:
    try:
        lines = HEALTH.read_text().splitlines(keepends=True)
    except FileNotFoundError:
        return
    if len(lines) > KEEP_LINES:
        tmp = HEALTH.with_suffix(".tmp")
        tmp.write_text("".join(lines[-KEEP_LINES:]))
        tmp.replace(HEALTH)


def main() -> None:
    LOGS.mkdir(parents=True, exist_ok=True)
    trim()
    state = load_state()
    url = address()
    down_since: Optional[float] = None
    last_restart = 0.0
    restarts = 0  # in the current outage
    n = 0
    while True:
        now = time.time()
        if not url:
            url = address()
        status, ms = probe(url) if url else (None, None)
        up = status is not None and status > 0
        line: Dict[str, Any] = {
            "t": time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(now)),
            "up": up,
            "ms": ms if up else None,
            "status": status,
            "restart": None,
        }
        if up:
            if state.get("code"):
                taska("%s say %s\n" % (state["code"], BACK % time.strftime("%H:%M")))
                taska("%s withdraw %s\n" % (state["code"], BACK % time.strftime("%H:%M")))
                state = {}
                save_state(state)
            down_since, restarts = None, 0
        else:
            down_since = down_since or now
            since = time.strftime("%H:%M", time.localtime(down_since))
            if now - down_since >= (DOWN_MINUTES - 0.5) * 60 and now - last_restart >= QUIET_AFTER_RESTART:
                if not logged_in():
                    tell(state, NEEDS_LOGIN)
                else:
                    line["restart"] = "no answer since %s" % since
                    restart()
                    last_restart, restarts = now, restarts + 1
                    url = None  # read the address again after the restart
                    if restarts > TELL_AFTER_RESTARTS:
                        tell(state, STILL_DOWN % (restarts - 1, since))
        with HEALTH.open("a") as f:
            f.write(json.dumps(line) + "\n")
        write_panel(url)
        n += 1
        if n % 1440 == 0:
            trim()
        time.sleep(max(1.0, 60 - (time.time() - now)))


if __name__ == "__main__":
    main()
