"""How the page's controls are used (F846, Yadong r1448): from the page's own records in the log (taps, keys, swipes,
menus, picks, drags and drops, pastes, fields typed in, the views it went to), each control with how often it was used on the phone and on the desktop, and the signs that a
use did nothing: the same control tapped again within a moment (taps that seemed to do nothing), a swipe right on a
row with no way forward. The list filters are told from the views (they are in the address). Only reads the log.

    python3 tools/ui_usage.py [--log ~/.taska/logs.db] [--since 2026-11-15] [--top 40]

The phone is told from the desktop by the way the page reached Taska: through the tunnel (the phone) or on this
computer (the desktop). A page opened on the computer through the tunnel counts as the phone.
"""

from __future__ import annotations

import argparse
import collections
import json
import os
import re
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Tuple

AGAIN_S = 1.5  # the same control tapped again this soon: the first tap seemed to do nothing


def when(t: str) -> datetime:
    d = datetime.fromisoformat(t.replace("Z", "+00:00"))
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def name(e: Dict[str, Any]) -> str:
    """A control's name with its numbers left out, so every row or item code is one control."""
    what = str(e.get("what") or "")
    if e.get("role") == "row":
        return "row (opens the item)"
    return re.sub(r"\d+", "#", what)[:50] or "(no name)"


def records(db: str, since: str) -> List[Tuple[datetime, str, Dict[str, Any]]]:
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    out = []
    for t, kind, data in con.execute("select t, kind, data from logs where source = 'page' and t >= ? order by t", (since,)):
        e = json.loads(data or "{}")
        out.append((when(str(e.get("at") or t)), kind, e))
    return sorted(out, key=lambda r: r[0])


def side(e: Dict[str, Any]) -> str:
    return "phone" if e.get("via") == "tunnel" else "desk"


def usage(rows: Iterable[Tuple[datetime, str, Dict[str, Any]]]) -> Dict[str, Any]:
    used: Dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    again: collections.Counter = collections.Counter()
    swipes: collections.Counter = collections.Counter()
    filters: collections.Counter = collections.Counter()
    last: Dict[Tuple[str, str], datetime] = {}
    for at, kind, e in rows:
        if kind in ("tap", "key"):
            n = name(e) if kind == "tap" else f"key {e.get('what')}"
            if kind == "tap" and e.get("from") == "swipe":
                n += " (under a swiped row)"
            used[n][side(e)] += 1
            k = (n, str(e.get("where")))
            if kind == "tap" and k in last and (at - last[k]).total_seconds() < AGAIN_S:
                again[n] += 1
            last[k] = at
        elif kind in ("menu", "pick", "drag", "drop", "paste", "typed"):  # F846 r1451: the other actions
            used[f"{kind}: {re.sub(r'[0-9]+', '#', str(e.get('what') or e.get('on') or e.get('into') or ''))[:40]}"][side(e)] += 1
        elif kind == "swipe":
            swipes[(str(e.get("dir")), re.sub(r"\d+", "#", str(e.get("what"))))] += 1
        elif kind == "view" and "?" in str(e.get("to") or ""):
            filters[str(e.get("to")).split("?", 1)[1]] += 1
    return {"used": used, "again": again, "swipes": swipes, "filters": filters}


def report(u: Dict[str, Any], top: int) -> str:
    used = u["used"]
    total = sum(sum(c.values()) for c in used.values()) or 1
    lines = [f"{'uses':>5} {'phone':>6} {'desk':>5} {'again':>6}  control"]
    for n, c in sorted(used.items(), key=lambda x: -sum(x[1].values()))[:top]:
        lines.append(f"{sum(c.values()):>5} {c['phone']:>6} {c['desk']:>5} {u['again'][n] or '':>6}  {n}")
    lines.append(f"\n{total} taps and keys; tapped again within {AGAIN_S} s: {sum(u['again'].values())}")
    lines.append("swipes: " + (", ".join(f"{d} {w}: {k}" for (d, w), k in u["swipes"].most_common()) or "none recorded"))
    lines.append("list filters (from the address): " + (", ".join(f"{q}: {k}" for q, k in u["filters"].most_common()) or "none"))
    return "\n".join(lines)


def main() -> None:
    a = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    a.add_argument("--log", default=os.path.expanduser("~/.taska/logs.db"))
    a.add_argument("--since", default="2026-11-15")
    a.add_argument("--top", type=int, default=40)
    o = a.parse_args()
    print(report(usage(records(o.log, o.since)), o.top))


if __name__ == "__main__":
    main()
