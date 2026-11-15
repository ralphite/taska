"""The voice notes whose words fell back since the last run, filed as one bug in Taska (B788, Yadong r1339).

A note's words fall back without a sign on the page: the strong model failing its first try (its next try or the
speech model's words take its place), or tidying giving no words in time (the words as said stay, fillers and all).
Taska logs each (kind "voicefallback" in logs.db); the nightly checks run this, and what came since the last run is
filed as an open P1 bug, once.

    python3 tools/voice_fallbacks.py <logs.db> <taska url> <state file>
"""

from __future__ import annotations

import json
import os
import sqlite3
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import List, Tuple

Row = Tuple[str, str, str, str]  # when, project, file, why


def since_last(db: str, after: str) -> List[Row]:
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    try:
        rows = con.execute("SELECT t, project, data FROM logs WHERE kind = 'voicefallback' AND t > ? ORDER BY t", (after,)).fetchall()
    finally:
        con.close()
    out: List[Row] = []
    for t, project, data in rows:
        d = json.loads(data or "{}")
        out.append((t, project or "", str(d.get("f") or ""), str(d.get("why") or "")))
    return out


def bug(rows: List[Row], day: str) -> str:
    """The bug's lines for /do: its title, then what fell back, each on its line."""
    lines = [f"new bug P1 now Voice notes fell back {len(rows)} time{'s' if len(rows) != 1 else ''} ({day})",
             "  The words of these voice notes fell back without a sign on the page (B788): the strong model's first try",
             "  failed, or tidying gave no words in time and the words as said stayed. What fell back, and why:", "  "]
    for t, project, f, why in rows[:40]:
        local = datetime.fromisoformat(t).astimezone().strftime("%m-%d %H:%M")
        lines.append(f"  - {local} {project} {f}: {why}")
    if len(rows) > 40:
        lines.append(f"  - and {len(rows) - 40} more")
    lines.append("  ")
    lines.append("  Found by the nightly checks (tools/voice_fallbacks.py).")
    return "\n".join(lines) + "\n"


def post(url: str, path: str, body: bytes, kind: str = "text/plain") -> str:
    req = urllib.request.Request(url.rstrip("/") + path, data=body, method="POST", headers={"Content-Type": kind})
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.read().decode()


def main(db: str, url: str, state: str) -> int:
    after = open(state).read().strip() if os.path.exists(state) else (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    rows = since_last(db, after) if os.path.exists(db) else []
    if not rows:
        print("no voice note fell back")
        return 0
    said = post(url, "/p/taska/do?by=nightly&session=checks", bug(rows, datetime.now().strftime("%m-%d")).encode())
    code = next((w.split()[1] for w in said.splitlines() if w.startswith("ok ") and " new" in w), None)
    if not code:
        print(f"not filed: {said.splitlines()[0] if said else 'no answer'}")
        return 1
    # filed as an open bug, as the page approves one (Yadong r1339: "file a bug")
    post(url, "/p/taska/api/commands", json.dumps({"id": f"voice-fallbacks-{rows[-1][0]}", "commands": [
        {"op": "set", "ref": code, "f": {"status": "open"}}]}).encode(), "application/json")
    with open(state, "w") as fh:
        fh.write(rows[-1][0])
    print(f"{len(rows)} fell back, filed {code}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(*sys.argv[1:]))
