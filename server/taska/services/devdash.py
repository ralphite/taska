"""The dashboard for making Taska: what you did in it, from the log, worked out each time it is asked for.

Only counts and times: never the words of a draft, a message or an input. Shown at /dev/dashboard, on this computer
only. Below the numbers, the analyses agents wrote: Markdown files in <data folder>/dev/analyses, newest first (a file
is named by its date, 2026-10-22-what-it-is-about.md, and its first line is its title). Above them, the panels agents
and scripts keep up to date (Markdown files in <data folder>/dev/panels, each rewritten in place), and what each item
cost to make: the cost line agents end a done message with, and how long each round of work on an item took (F576).
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

from ..domain import events as ev
from ..domain.model import Item as ItemRow
from ..domain.state import ProjectState
from .project import Project

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

Item = Callable[[str, int], Optional[Tuple[str, str]]]


def _when(t: str) -> datetime:
    return datetime.fromisoformat(t.replace("Z", "+00:00")).astimezone()


def _start(days: Optional[int]) -> Optional[datetime]:
    now = datetime.now().astimezone()
    return None if days is None else now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days)


def _page_rows(db_path: Optional[str], since: str) -> List[Dict[str, Any]]:
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
    return page


def summary(db_path: Optional[str], days: Optional[int], item: Item) -> Dict[str, Any]:
    """What you did since the start of the day `days` days ago (0: today; None: all the log has), as the dashboard
    shows it. `item(project, n)` -> (code, title) for an item opened, if it still exists."""
    now = datetime.now().astimezone()
    start = _start(days)
    page = _page_rows(db_path, start.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S") if start else "")
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


def _markdown_files(folder: str, reverse: bool) -> List[Tuple[str, str, str, str]]:
    """(name, its first line without "# ", the rest, when it was written) of each Markdown file there."""
    out: List[Tuple[str, str, str, str]] = []
    if not os.path.isdir(folder):
        return out
    for name in sorted(os.listdir(folder), reverse=reverse):
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
        out.append((name, first.lstrip("# ").strip() or name, rest.strip(), when))
    return out


def analyses(root: str) -> List[Dict[str, str]]:
    """The analyses agents wrote for the dashboard, newest first: each one's date, title and Markdown."""
    return [{"name": n, "date": n[:10], "title": t, "md": md} for n, t, md, _ in _markdown_files(os.path.join(root, "dev", "analyses"), True)]


def panels(root: str) -> List[Dict[str, str]]:
    """The panels agents and scripts keep up to date in <data folder>/dev/panels, in the order of their names;
    `updated` is when the file was last written."""
    return [{"name": n, "updated": w, "title": t, "md": md} for n, t, md, w in _markdown_files(os.path.join(root, "dev", "panels"), False)]


# the line an agent ends a done message with: "<cost>: 9 min · 66,321 token (cache 8,163,512) · 34 steps", in Chinese
COST = re.compile("\u6210\u672c\uff1a\\s*(\\d+)\\s*\u5206\u949f")
TOKENS = re.compile("([\\d,]+)\\s*token")
CACHE = re.compile("\u8bfb\u7f13\u5b58\\s*([\\d,]+)")
STEPS = re.compile("(\\d+)\\s*\u6b65")


def _num(m: Optional["re.Match[str]"]) -> int:
    return int(m.group(1).replace(",", "")) if m else 0


def costs(projects: Dict[str, Project], days: Optional[int]) -> Dict[str, Any]:
    """What each item cost to make, from the cost lines in the agents' messages since the start of the day `days` days
    ago (None: all): per item its rounds, minutes, fresh and cache-read tokens and steps, the latest first."""
    start = _start(days)
    per: Dict[Tuple[str, int], Dict[str, Any]] = {}
    for slug, p in list(projects.items()):
        with p.lock:
            st = p.state
            for n, it in list(st.items.items()):
                for x in it.thread:
                    if x.by in ("you", "org") or "\u6210\u672c\uff1a" not in (x.text or ""):
                        continue
                    m = COST.search(x.text)
                    if not m:
                        continue
                    t = _when(x.t)
                    if start and t < start:
                        continue
                    line = x.text[m.start():].split("\n", 1)[0]
                    r = per.setdefault((slug, n), {"project": slug, "code": st.code(n), "title": it.title[:80],
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


def _round_tokens(it: ItemRow, a: datetime, b: datetime) -> Optional[int]:
    """The tokens the cost lines of a round say: an agent's messages on the item from its start until a little after it
    was handed over (the done message with the cost line comes with it or just after). None: no cost line."""
    got: Optional[int] = None
    for x in it.thread:
        if x.by in ("you", "org") or "\u6210\u672c\uff1a" not in (x.text or ""):
            continue
        t = _when(x.t)
        if a <= t <= b + timedelta(minutes=15):
            m = COST.search(x.text)
            k = TOKENS.search(x.text[m.start():].split("\n", 1)[0]) if m else None
            if k:  # a cost line that gives no tokens says nothing about them
                got = (got or 0) + _num(k)
    return got


def rounds(slug: str, st: ProjectState) -> List[Dict[str, Any]]:
    """Each round of work on an item (F576): from when it was started (doing) until it was handed to you (review) or
    done, its minutes, and the tokens its agent's cost line gives for it (None: no cost line). A round put back (open)
    before it was handed over does not count; a deleted or merged item's rounds neither."""
    out: List[Dict[str, Any]] = []
    began: Dict[int, str] = {}
    for e in st.events:
        if isinstance(e, ev.ItemAdded):
            if e.status == "doing":
                began[e.n] = e.t
            continue
        if not isinstance(e, ev.FieldsSet) or "status" not in e.f:
            continue
        now = e.f["status"]
        if now == "doing":
            began.setdefault(e.n, e.t)
            continue
        t0 = began.pop(e.n, None)
        it = st.items.get(e.n)
        if t0 is None or now not in ("review", "done") or it is None or not it.live:
            continue
        a, b = _when(t0), _when(e.t)
        out.append({"project": slug, "code": st.code(e.n), "title": it.title[:80], "end": b.isoformat(),
                    "at": b.strftime("%m-%d %H:%M"), "minutes": max(0, round((b - a).total_seconds() / 60)),
                    "tokens": _round_tokens(it, a, b)})
    return out


def all_rounds(projects: Dict[str, Project]) -> List[Dict[str, Any]]:
    """Every project's rounds of work, the latest first."""
    out: List[Dict[str, Any]] = []
    for slug, p in list(projects.items()):
        with p.lock:
            out.extend(rounds(slug, p.state))
    return sorted(out, key=lambda r: r["end"], reverse=True)


def item_of(projects: Dict[str, Project]) -> Item:
    """(code, title) of item n in a project, from the projects Taska has open."""
    def get(slug: str, n: int) -> Optional[Tuple[str, str]]:
        p = projects.get(slug)
        if p is None:
            return None
        with p.lock:
            it = p.state.items.get(n)
            return (p.state.code(n), it.title[:80]) if it else None
    return get


def dashboard(root: str, projects: Dict[str, Project], db_path: Optional[str], days: Optional[int]) -> Dict[str, Any]:
    return dict(summary(db_path, days, item_of(projects)), costs=costs(projects, days), rounds=all_rounds(projects), panels=panels(root), analyses=analyses(root))
