#!/usr/bin/env python3
"""Storybook's watchdog and health log (B517). Run by the LaunchAgent com.taska.storybook-watchdog (KeepAlive).

Once a minute it opens Storybook (http://127.0.0.1:6007/ and /index.json, as an open page does) and writes one JSON
line to .logs/storybook-health.jsonl, which the Dashboard (F448) reads:

  {"t": "2026-10-22T23:50:00", "up": true, "page_ms": 12, "index": "ok", "index_ms": 40, "pid": 123,
   "uptime_s": 5400, "load": 12.3, "started": false, "restart": null}

  up        the page answered (200) within 20 s
  page_ms   how long the page took (null when it did not answer)
  index     ok | error (the story list fails to load) | timeout (no answer in 60 s) | down (no answer at all)
  index_ms  how long the story list took (null without an answer)
  pid       the Storybook process; uptime_s how long it has run
  load      the computer's load average over the last minute
  started   the process is new since the line before (a restart, by anyone)
  restart   why the watchdog restarted Storybook this minute (null when it did not)

From the last 24 hours of that log it rewrites the Dashboard's panel ~/.taska/dev/panels/storybook.md each minute
(whether it opens now, how long it has run, the share of minutes it answered, how fast, restarts).

It restarts Storybook only when it is stuck, never on a slow minute:
  - the page has not answered for 5 minutes in a row, or
  - the story list has failed for 5 minutes naming files that no longer exist (the index kept files that moved).
  - the page has been blank for 5 minutes: the addon files it names answer 404 (B612: their cache was cleared under
    a running Storybook).
Not more than once in 15 minutes. A restart goes through storybook-restart.sh, which logs it in
.logs/storybook-restarts.log. Nothing else restarts Storybook: agents never do (rule R489).
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
WEB = TOOLS.parent / "web"
LOGS = TOOLS.parent.parent / ".logs"
HEALTH = LOGS / "storybook-health.jsonl"
RESTARTS = LOGS / "storybook-restarts.log"  # written by storybook-restart.sh
PANEL = Path.home() / ".taska/dev/panels/storybook.md"  # the Dashboard (/dev/dashboard) shows it at the top
BASE = "http://127.0.0.1:6007"
LABEL = "com.taska.storybook-app"  # the page's Storybook on 6007 since 10-24 (T518 #7555)

PAGE_TIMEOUT = 20  # seconds the page has to answer
INDEX_TIMEOUT = 60
STUCK_MINUTES = 5  # minutes in a row without an answer before a restart
QUIET_AFTER_RESTART = 15 * 60  # seconds before the watchdog may restart again
KEEP_LINES = 30 * 24 * 60  # the health log keeps 30 days


def get(path: str, timeout: float) -> Tuple[Optional[int], Optional[int], str]:
    """(status, ms, body) of one request; status None when there was no answer in time."""
    t = time.monotonic()
    try:
        with urllib.request.urlopen(BASE + path, timeout=timeout) as r:
            body = r.read().decode("utf-8", "replace")
            return r.status, int((time.monotonic() - t) * 1000), body
    except urllib.error.HTTPError as e:
        return e.code, int((time.monotonic() - t) * 1000), e.read().decode("utf-8", "replace")
    except Exception:  # refused, reset or timed out: no answer
        return None, None, ""


def process() -> Tuple[Optional[int], Optional[int]]:
    """(pid, seconds running) of Storybook's process, from launchd."""
    try:
        out = subprocess.run(["launchctl", "list", LABEL], capture_output=True, text=True, timeout=10).stdout
        m = re.search(r'"PID" = (\d+);', out)
        if not m:
            return None, None
        pid = int(m.group(1))
        etime = subprocess.run(["ps", "-o", "etime=", "-p", str(pid)], capture_output=True, text=True, timeout=10)
        return pid, seconds(etime.stdout.strip())
    except Exception:
        return None, None


def seconds(etime: str) -> Optional[int]:
    """ps's elapsed time ([[dd-]hh:]mm:ss) in seconds."""
    m = re.fullmatch(r"(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)", etime)
    if not m:
        return None
    d, h, mi, s = (int(x) if x else 0 for x in m.groups())
    return ((d * 24 + h) * 60 + mi) * 60 + s


def gone_files(error: str) -> List[str]:
    """The files a failing story list names that are no longer there."""
    named = re.findall(r"(\./src/[^\s:]+\.(?:tsx|ts|mdx))", error)
    return [f for f in dict.fromkeys(named) if not (WEB / f).exists()]


def restart(why: str) -> None:
    subprocess.run(["/bin/zsh", str(TOOLS.parent.parent / "app" / "tools" / "storybook-restart.sh"), "watchdog", why], timeout=60)


def trim() -> None:
    try:
        lines = HEALTH.read_text().splitlines(keepends=True)
    except FileNotFoundError:
        return
    if len(lines) > KEEP_LINES:
        tmp = HEALTH.with_suffix(".tmp")
        tmp.write_text("".join(lines[-KEEP_LINES:]))
        tmp.replace(HEALTH)


def ms(v: float) -> str:
    return f"{v / 1000:.1f} \u79d2" if v >= 1000 else f"{int(v)} \u6beb\u79d2"


def panel_text(lines: List[Dict[str, Any]], restarts: List[str]) -> str:
    """The Dashboard's Storybook panel (Markdown, first line the title): the last 24 hours in a few lines."""
    out = ["Storybook \u670d\u52a1"]
    if not lines:
        return "\n".join(out + ["\u8fd8\u6ca1\u6709\u8bb0\u5f55\u3002"]) + "\n"
    last = lines[-1]
    up = sum(1 for x in lines if x.get("up"))
    times = sorted(x["page_ms"] for x in lines if x.get("page_ms") is not None)
    slow = sum(1 for x in lines if x.get("up") and (x.get("page_ms") or 0) > 2000)
    started = sum(1 for x in lines if x.get("started"))
    hours = len(lines) / 60
    up_s = last.get("uptime_s")
    now = "\u80fd\u6253\u5f00" if last.get("up") else "**\u6253\u4e0d\u5f00**"
    if last.get("up") and last.get("index") != "ok":
        failed = "\u51fa\u9519" if last.get("index") == "error" else "\u6ca1\u56de\u5e94"
        now += "\uff0c\u4f46\u6545\u4e8b\u5217\u8868" + failed
    out.append(
        f"- \u73b0\u5728\uff1a{now}\uff08{last['t'][11:16]}\uff09"
        + (f"\uff0c\u5df2\u8fde\u7eed\u8fd0\u884c {up_s // 3600} \u5c0f\u65f6 {up_s % 3600 // 60} \u5206" if up_s is not None else "")
    )
    out.append(f"- \u6700\u8fd1 {hours:.0f} \u5c0f\u65f6\uff1a{100 * up / len(lines):.1f}% \u7684\u5206\u949f\u80fd\u6253\u5f00\uff08\u6bcf\u5206\u949f\u67e5\u4e00\u6b21\uff0c\u5171 {len(lines)} \u6b21\uff09")
    if times:
        p95 = times[min(len(times) - 1, int(len(times) * 0.95))]
        out.append(f"- \u9996\u9875\u54cd\u5e94\uff1a\u4e00\u822c {ms(times[len(times) // 2])}\uff0c\u6700\u6162 5% \u8d85\u8fc7 {ms(p95)}\uff1b\u8d85\u8fc7 2 \u79d2\u7684\u6709 {slow} \u6b21")
    out.append(f"- \u91cd\u542f\uff1a{started} \u6b21" + ("" if not restarts else f"\uff1b\u6700\u8fd1\u4e00\u6b21 {restarts[-1][:160]}"))
    out.append("")
    out.append("agent \u4e0d\u8bb8\u91cd\u542f\u5b83\uff1b5 \u5206\u949f\u6253\u4e0d\u5f00\u65f6\u770b\u95e8\u72d7\u81ea\u52a8\u91cd\u542f\uff0c\u5e76\u8bb0\u4e0b\u65f6\u95f4\u548c\u539f\u56e0\uff08B517\uff09\u3002")
    return "\n".join(out) + "\n"


def write_panel() -> None:
    try:
        tail = HEALTH.read_text().splitlines()[-24 * 60 :]
        lines = [json.loads(x) for x in tail if x.strip()]
        try:
            restarts = RESTARTS.read_text().splitlines()[-1:]
        except FileNotFoundError:
            restarts = []
        PANEL.parent.mkdir(parents=True, exist_ok=True)
        tmp = PANEL.with_suffix(".tmp")
        tmp.write_text(panel_text(lines, restarts))
        tmp.replace(PANEL)
    except Exception as e:  # the panel is a view: the watchdog keeps watching without it
        print(f"panel: {e}", flush=True)


def main() -> None:
    LOGS.mkdir(parents=True, exist_ok=True)
    trim()
    down_since: Optional[float] = None  # first minute in the current run without a page answer
    stale_since: Optional[float] = None  # first minute in the current run of a story list naming gone files
    blank_since: Optional[float] = None  # first minute in the current run of a page whose addon files are gone (B612)
    last_restart = 0.0
    last_pid: Optional[int] = None
    n = 0
    while True:
        now = time.time()
        status, page_ms, html = get("/", PAGE_TIMEOUT)
        up = status == 200
        # B612: the page answers but draws nothing when the addon files it names are gone (their cache was cleared
        # under a running Storybook)
        missing = [a for a in sorted(set(re.findall(r"\./(sb-addons/[^'\"]+\.js)", html or "")))[:4] if get("/" + a, PAGE_TIMEOUT)[0] == 404] if up else []
        istatus, index_ms, body = get("/index.json", INDEX_TIMEOUT) if up else (None, None, "")
        index = "ok" if istatus == 200 else "error" if istatus else "timeout" if up else "down"
        pid, uptime = process()
        line: Dict[str, Any] = {
            "t": time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(now)),
            "up": up,
            "page_ms": page_ms if up else None,
            "index": index,
            "index_ms": index_ms if istatus else None,
            "pid": pid,
            "uptime_s": uptime,
            "load": round(os.getloadavg()[0], 1),
            "started": last_pid is not None and pid is not None and pid != last_pid,
            "restart": None,
        }
        down_since = None if up else (down_since or now)
        gone = gone_files(body) if index == "error" else []
        stale_since = (stale_since or now) if gone else None
        blank_since = (blank_since or now) if missing else None
        why = ""
        if down_since and now - down_since >= (STUCK_MINUTES - 0.5) * 60:
            why = f"the page has not answered since {time.strftime('%H:%M', time.localtime(down_since))}"
        elif stale_since and now - stale_since >= (STUCK_MINUTES - 0.5) * 60:
            why = f"the story list fails on files that are gone ({', '.join(gone[:3])})"
        elif blank_since and now - blank_since >= (STUCK_MINUTES - 0.5) * 60:
            why = f"the page is blank: its addon files are gone ({', '.join(missing[:2])})"
        if why and now - last_restart >= QUIET_AFTER_RESTART:
            line["restart"] = why
            restart(why)
            last_restart = now
            down_since = stale_since = None
        with HEALTH.open("a") as f:
            f.write(json.dumps(line) + "\n")
        write_panel()
        last_pid = pid if pid is not None else last_pid
        n += 1
        if n % 1440 == 0:
            trim()
        time.sleep(max(1.0, 60 - (time.time() - now)))


if __name__ == "__main__":
    main()
