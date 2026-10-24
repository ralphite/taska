"""Every agent-facing read of every project, from two running Taskas on copies of the same data, compared word for
word (paths of the two data folders made the same). Reads carry ?ui=1, so they change nothing.

    python3 app/tests/differential/compare_reads.py http://127.0.0.1:7352 /data/old http://127.0.0.1:7351 /data/new
"""

from __future__ import annotations

import difflib
import json
import sys
import urllib.parse
import urllib.request
from typing import List, Tuple


def get(base: str, path: str) -> Tuple[int, str]:
    sep = "&" if "?" in path else "?"
    try:
        with urllib.request.urlopen(base + path + sep + "ui=1", timeout=60) as r:
            return r.status, r.read().decode("utf-8")
    except urllib.error.HTTPError as ex:
        return ex.code, ex.read().decode("utf-8")


def paths(base: str) -> List[str]:
    projects = json.loads(get(base, "/api/projects")[1])
    out: List[str] = ["/health", "/skill", "/api/needs"]
    for p in projects:
        name = p["name"]
        pre = f"/p/{name}"
        out += [f"{pre}/agent", f"{pre}/rules", f"{pre}/inbox", f"{pre}/next", f"{pre}/connect", f"{pre}/log?n=100000",
                f"{pre}/items?status=all&archived=all&limit=100000", f"{pre}/items", f"{pre}/archive?limit=100000",
                f"{pre}/items?wait=1", f"{pre}/items?reply=1", f"{pre}/items?type=rule&status=all"]
        listing = get(base, f"{pre}/items?status=all&archived=all&limit=100000&type=")[1].splitlines()[1:]
        rules = get(base, f"{pre}/items?status=all&archived=all&limit=100000&type=rule")[1].splitlines()[1:]
        for line in listing + rules:
            code = line.split(" ", 1)[0]
            if code and code[0].isalpha():
                out.append(f"{pre}/{code}")
        state = json.loads(get(base, f"{pre}/api/state")[1])
        out += [f"{pre}/D{d['d']}" for d in state["docs"]]
        out += [f"{pre}/{i['id']}" for i in state["inputs"]]
    return out


def main() -> None:
    a, a_root, b, b_root = sys.argv[1:5]
    todo = paths(a)
    bad = 0
    for path in todo:
        sa, ta = get(a, path)
        sb, tb = get(b, path)
        ta, tb = ta.replace(a_root, "<root>"), tb.replace(b_root, "<root>")
        ta, tb = ta.replace(a, "<base>"), tb.replace(b, "<base>")
        if (sa, ta) != (sb, tb):
            bad += 1
            if bad <= 15:
                print(f"== {path}: {sa} vs {sb}")
                print("\n".join(list(difflib.unified_diff(ta.splitlines(), tb.splitlines(), "old", "new", lineterm="", n=1))[:40]))
    print(f"{len(todo)} reads, {bad} different")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
