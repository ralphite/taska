"""What two Taska data folders hold differently after the same steps: every project's database, row by row.

Times written during the run differ by the moment each server wrote them, so a time at or after the run's start is
read as "<now>"; everything else must be equal. Two folders whose databases have different tables cannot be compared
row by row: that is said, and the agent answers (compared elsewhere) are the measure then.

    python3 app/parity/dbdiff.py A B SINCE_EPOCH_SECONDS        prints JSON: {"same": bool, "notes": [...], "diffs": [...]}
"""

from __future__ import annotations

import datetime as dt
import json
import os
import re
import sqlite3
import sys
import urllib.parse
from typing import Any, Dict, List

ISO = re.compile(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:[+-]\d\d:\d\d|Z)?")


# keys the page makes up at random (an input's once-only key, so a resend is not taken twice): their value differs by
# nature, only whether there is one counts
RANDOM_KEYS = {"q"}


def norm(x: Any, since: float) -> Any:
    if isinstance(x, dict):
        return {k: ("<random>" if k in RANDOM_KEYS and isinstance(v, str) and re.fullmatch(r"[a-z0-9]{8,}", v) else norm(v, since))
                for k, v in x.items()}
    if isinstance(x, list):
        return [norm(v, since) for v in x]
    if isinstance(x, (int, float)) and not isinstance(x, bool):
        if 1e12 < x < 1e13 and x >= since * 1000 - 5000:
            return "<now-ms>"
        if 1e9 < x < 1e10 and x >= since - 5:
            return "<now-s>"
        return x
    if isinstance(x, str):
        if x[:1] in "{[":
            try:
                return norm(json.loads(x), since)
            except ValueError:
                pass

        def t(m: "re.Match[str]") -> str:
            try:
                v = dt.datetime.fromisoformat(m.group(0).replace("Z", "+00:00"))
                if v.tzinfo is None:
                    v = v.astimezone()
                return "<now>" if v.timestamp() >= since - 5 else m.group(0)
            except ValueError:
                return m.group(0)

        return ISO.sub(t, x)
    return x


def dump(path: str, since: float) -> Dict[str, List[Any]]:
    con = sqlite3.connect("file:" + urllib.parse.quote(path) + "?mode=ro", uri=True)
    try:
        out: Dict[str, List[Any]] = {}
        for (name,) in con.execute("select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name"):
            rows = con.execute(f'select * from "{name}" order by 1').fetchall()
            out[name] = [norm(list(r), since) for r in rows]
        return out
    finally:
        con.close()


def dbs(root: str) -> List[str]:
    found = []
    for dp, ds, fs in os.walk(root):
        ds[:] = [d for d in ds if d != "taska-files"]
        found += [os.path.relpath(os.path.join(dp, f), root) for f in fs if f.endswith(".db") and f != "logs.db"]
    return sorted(found)


def main() -> None:
    a, b, since = sys.argv[1], sys.argv[2], float(sys.argv[3])
    notes: List[str] = []
    diffs: List[Dict[str, Any]] = []
    la, lb = dbs(a), dbs(b)
    if la != lb:
        diffs.append({"what": "database files", "a": la, "b": lb})
    for rel in sorted(set(la) & set(lb)):
        da, db = dump(os.path.join(a, rel), since), dump(os.path.join(b, rel), since)
        if sorted(da) != sorted(db):
            notes.append(f"{rel}: tables differ ({sorted(da)} / {sorted(db)}); not compared row by row")
            continue
        for tbl in sorted(da):
            ra, rb = da[tbl], db[tbl]
            if ra == rb:
                continue
            sa = {json.dumps(r, ensure_ascii=False, sort_keys=True) for r in ra}
            sb = {json.dumps(r, ensure_ascii=False, sort_keys=True) for r in rb}
            diffs.append({"what": f"{rel} {tbl}", "only_a": sorted(sa - sb)[:20], "only_b": sorted(sb - sa)[:20],
                          "order": not (sa - sb or sb - sa)})
    fa = {os.path.relpath(os.path.join(dp, f), a) for dp, _, fs in os.walk(a) for f in fs if "taska-files" in dp}
    fb = {os.path.relpath(os.path.join(dp, f), b) for dp, _, fs in os.walk(b) for f in fs if "taska-files" in dp}
    if fa != fb:
        diffs.append({"what": "files", "only_a": sorted(fa - fb)[:20], "only_b": sorted(fb - fa)[:20]})
    print(json.dumps({"same": not diffs, "notes": notes, "diffs": diffs}, ensure_ascii=False))


if __name__ == "__main__":
    main()
