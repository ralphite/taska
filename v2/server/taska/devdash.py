"""F448: the dashboard for making Taska: what you did in it, from the log (T453), worked out each time it is asked for.

Only counts and times: never the words of a draft, a message or an input. Shown at /dev/dashboard, on this computer
only (web.py). Below the numbers, the analyses agents wrote: Markdown files in <data folder>/dev/analyses, newest
first (a file is named by its date, 2026-10-22-what-it-is-about.md, and its first line is its title). Above them, the
panels agents and scripts keep up to date (Markdown files in <data folder>/dev/panels, each rewritten in place, e.g.
how the Storybook server is doing), and what each item cost to make: the cost line agents end a done message with (I447).
"""

from __future__ import annotations

import json
import os
import re
import sqlite3
import statistics
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, List, Optional, Tuple

# what the page's actions are, in plain words
NAME = {
    "open": "Open an item", "send": "Send", "voice start": "Start a voice note", "new-input": "New input",
    "voice stop and send": "Send a voice note", "view": "Look at an image", "key Escape": "Esc",
    "doc-open": "Open a document", "v-close": "Close an image", "status": "Change a status",
    "doc-tick": "Tick a choice in a document", "docs-go": "Go to another document", "back": "Back",
    "psec": "Open a Settings section", "doc-pick": "Pick a paragraph to comment on",
    "set-filter": "Change a view or filter", "vc": "Voice comment on a document", "voice stop": "Voice note into the box",
    "choice": "Pick an answer", "more-msg": "Show a whole message", "projects": "Projects", "choice-send": "Send an answer",
    "row-act": "A button on a row", "tab": "Items, Inputs or Rules", "key ⌘r": "Reload the page",
    "log-open": "Open the activity log", "close": "Close", "doc-thread": "Open comments", "item-menu": "Item menu",
    "swipe": "Swipe (phone)", "goto": "Go to a linked item", "input-append": "Add to an input", "archive": "Archive",
    "rec-cancel": "Discard a recording", "doc-close": "Close a document", "input-more": "An input's menu",
}
NOISE = {"net", "error", "draft", "draft-cleared"}  # what the page says about itself, not what you did
SAME = {"mic", "rec-send", "rec-stop"}  # the microphone's buttons: the voice note's own start and stop count them
VOICE_END = {"voice stop and send": "sent as it was", "voice stop": "words into the box", "rec-cancel": "discarded",
             "voice cancel": "discarded"}


def _when(t: str) -> datetime:
    return datetime.fromisoformat(t.replace("Z", "+00:00")).astimezone()


def summary(db_path: Optional[str], days: Optional[int],
            item: Callable[[str, int], Optional[Tuple[str, str]]]) -> Dict[str, Any]:
    """What you did since the start of the day `days` days ago (0: today; None: all the log has), as the dashboard
    shows it. `item(project, n)` -> (code, title) for an item opened, if it still exists."""
    now = datetime.now().astimezone()
    start = None if days is None else (now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days))
    since = start.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S") if start else ""
    rows: List[Tuple[str, str, str, str, Optional[int], str]] = []
    if db_path and os.path.exists(db_path):
        db = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True, timeout=5)
        try:
            rows = db.execute("SELECT t, kind, project, tab, ms, data FROM logs WHERE source = 'page' AND t >= ?"
                              " ORDER BY t", (since,)).fetchall()
        finally:
            db.close()
    page: List[Dict[str, Any]] = []
    for t, kind, project, tab, ms, data in rows:
        try:
            d = json.loads(data or "{}")
        except ValueError:
            d = {}
        page.append({"t": _when(t), "kind": kind or "", "project": project or "", "tab": tab or "", "ms": ms,
                     "via": d.get("via") or "", "why": d.get("why") or "", "url": d.get("url") or "",
                     "msg": d.get("msg") or "", "d": d.get("d") if isinstance(d.get("d"), dict) else {}})
    acts = [r for r in page if r["kind"] not in NOISE and r["kind"] not in SAME]
    # by hour for a day, else by day
    hourly = days == 0
    fmt = "%H:00" if hourly else "%m-%d"
    counts = Counter(r["t"].strftime(fmt) for r in acts)
    span: List[List[Any]] = []
    if acts:
        step = timedelta(hours=1) if hourly else timedelta(days=1)
        k = (start or acts[0]["t"]).replace(minute=0, second=0, microsecond=0)
        if not hourly:
            k = k.replace(hour=0)
        while k <= now:
            span.append([k.strftime(fmt), counts.get(k.strftime(fmt), 0)])
            k += step
    # the items opened most
    opened = Counter((r["project"], r["d"].get("n")) for r in acts if r["kind"] == "open" and r["d"].get("n"))
    items = []
    for (p, n), k in opened.most_common(10):
        try:
            got = item(p, int(n))
        except (TypeError, ValueError):
            got = None
        items.append({"project": p, "code": got[0] if got else f"#{n}", "title": got[1] if got else "", "n": k})
    # voice notes: from start to how each ended, in each tab
    ends: "Counter[str]" = Counter()
    lens: List[float] = []
    started: Dict[str, datetime] = {}
    for r in page:
        if r["kind"] == "voice start":
            started[r["tab"]] = r["t"]
        elif r["kind"] in VOICE_END:
            ends[VOICE_END[r["kind"]]] += 1
            s = started.pop(r["tab"], None)
            if s:
                lens.append((r["t"] - s).total_seconds())
    # what was slow or went wrong
    slow = [r for r in page if r["kind"] == "net" and r["why"] == "slow" and r["ms"]]
    where: "Counter[str]" = Counter()
    for r in slow:
        parts = r["url"].split("?")[0].split("/")
        where["/".join("*" if i == 2 and parts[1:2] == ["p"] else x for i, x in enumerate(parts))] += 1
    by_via: Dict[str, List[int]] = defaultdict(list)
    for r in slow:
        by_via["phone" if r["via"] == "tunnel" else "this computer"].append(int(r["ms"]))
    return {
        "days": days,
        "from": acts[0]["t"].strftime("%m-%d %H:%M") if acts else "",
        "to": acts[-1]["t"].strftime("%m-%d %H:%M") if acts else "",
        "actions": len(acts),
        "tabs": len({r["tab"] for r in acts if r["tab"]}),
        "top": [[NAME.get(k, k), n] for k, n in Counter(r["kind"] for r in acts).most_common(12)],
        "span": span,
        "hourly": hourly,
        "via": [["phone" if k == "tunnel" else "this computer", n]
                for k, n in Counter(r["via"] for r in acts if r["via"]).most_common()],
        "projects": Counter(r["project"] for r in acts if r["project"]).most_common(8),
        "items": items,
        "opens": sum(opened.values()),
        "opened": len(opened),
        "voice": {"n": sum(1 for r in page if r["kind"] == "voice start"), "ends": ends.most_common(),
                  "median": round(statistics.median(lens)) if lens else 0, "minutes": round(sum(lens) / 60)},
        "errors": Counter(r["msg"].split(" (")[0] for r in page if r["kind"] == "error" and r["msg"]).most_common(6),
        "slow": {"n": len(slow), "timeouts": sum(1 for r in page if r["kind"] == "net" and r["why"] == "timeout"),
                 "median": round(statistics.median([int(r["ms"]) for r in slow])) if slow else 0,
                 "via": [[k, len(v), round(statistics.median(v))] for k, v in by_via.items()],
                 "where": where.most_common(6)},
        "reloads": sum(1 for r in acts if r["kind"] in ("key ⌘r", "key ⌘⇧r")),
        "updates": sum(1 for r in page if r["kind"] == "error" and r["msg"] == "Taska has an update"),
    }


def analyses(root: str) -> List[Dict[str, str]]:
    """The analyses agents wrote for the dashboard, newest first: each one's date, title and Markdown."""
    folder = os.path.join(root, "dev", "analyses")
    out: List[Dict[str, str]] = []
    if not os.path.isdir(folder):
        return out
    for name in sorted(os.listdir(folder), reverse=True):
        if not name.endswith(".md"):
            continue
        try:
            with open(os.path.join(folder, name), encoding="utf-8") as f:
                md = f.read()
        except OSError:
            continue
        first, _, rest = md.lstrip().partition("\n")
        out.append({"name": name, "date": name[:10], "title": first.lstrip("# ").strip() or name, "md": rest.strip()})
    return out


# I447: the line an agent ends a done message with: "<cost>: 9 min · 66,321 token (cache 8,163,512) · 34 steps", in Chinese
COST = re.compile("\u6210\u672c\uff1a\\s*(\\d+)\\s*\u5206\u949f")
TOKENS = re.compile("([\\d,]+)\\s*token")
CACHE = re.compile("\u8bfb\u7f13\u5b58\\s*([\\d,]+)")
STEPS = re.compile("(\\d+)\\s*\u6b65")


def _num(m: Optional["re.Match[str]"]) -> int:
    return int(m.group(1).replace(",", "")) if m else 0


def costs(stores: Dict[str, Any], days: Optional[int]) -> Dict[str, Any]:
    """What each item cost to make (I447), from the cost lines in the agents' messages since the start of the day `days`
    days ago (None: all): per item its rounds, minutes, fresh and cache-read tokens and steps, the latest first."""
    now = datetime.now().astimezone()
    start = None if days is None else now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days)
    per: Dict[Tuple[str, int], Dict[str, Any]] = {}
    for p, s in stores.items():
        for n, it in list(s.items.items()):
            for x in it.get("thread", []):
                text = x.get("text") or ""
                if x.get("by") in ("you", "org") or "\u6210\u672c\uff1a" not in text:
                    continue
                m = COST.search(text)
                if not m:
                    continue
                t = _when(x["t"])
                if start and t < start:
                    continue
                line = text[m.start():].split("\n", 1)[0]
                r = per.setdefault((p, n), {"project": p, "code": s.code(n), "title": str(it.get("title", ""))[:80],
                                            "rounds": 0, "minutes": 0, "tokens": 0, "cache": 0, "steps": 0, "t": t})
                r["rounds"] += 1
                r["minutes"] += int(m.group(1))
                r["tokens"] += _num(TOKENS.search(line))
                r["cache"] += _num(CACHE.search(line))
                r["steps"] += _num(STEPS.search(line))
                r["t"] = max(r["t"], t)
    rows = sorted(per.values(), key=lambda r: r["t"], reverse=True)
    mins = [r["minutes"] for r in rows]
    toks = [r["tokens"] for r in rows]
    for r in rows:
        r["t"] = r["t"].strftime("%m-%d %H:%M")
    return {"items": rows, "minutes": sum(mins), "tokens": sum(toks), "cache": sum(r["cache"] for r in rows),
            "median_minutes": round(statistics.median(mins)) if mins else 0,
            "median_tokens": round(statistics.median(toks)) if toks else 0}


def panels(root: str) -> List[Dict[str, str]]:
    """The panels agents and scripts keep up to date in <data folder>/dev/panels: each Markdown file is one, its first
    line its title, in the order of their names; `updated` is when the file was last written."""
    folder = os.path.join(root, "dev", "panels")
    out: List[Dict[str, str]] = []
    if not os.path.isdir(folder):
        return out
    for name in sorted(os.listdir(folder)):
        path = os.path.join(folder, name)
        if not name.endswith(".md"):
            continue
        try:
            with open(path, encoding="utf-8") as f:
                md = f.read()
            when = datetime.fromtimestamp(os.path.getmtime(path)).astimezone().strftime("%m-%d %H:%M")
        except OSError:
            continue
        first, _, rest = md.lstrip().partition("\n")
        out.append({"name": name, "updated": when, "title": first.lstrip("# ").strip() or name, "md": rest.strip()})
    return out


def item_of(stores: Dict[str, Any]) -> Callable[[str, int], Optional[Tuple[str, str]]]:
    """(code, title) of item n in a project, from the projects Taska has open."""
    def get(project: str, n: int) -> Optional[Tuple[str, str]]:
        s = stores.get(project)
        it = s.items.get(n) if s is not None else None
        return (s.code(n), str(it.get("title", ""))[:80]) if s is not None and it else None
    return get
