"""The page's JSON (each project's state, the projects, what needs you, search) from two running Taskas on copies of
the same data, compared as data: keys present with null count as absent; numbers of the running process (rev, boot,
sv, the key, times of the files on disk) are left out.

    python3 app/tests/differential/compare_state.py http://127.0.0.1:7352 /data/old http://127.0.0.1:7351 /data/new
"""

from __future__ import annotations

import json
import sys
import urllib.request
from typing import Any, List

VOLATILE = {"rev", "boot", "sv", "key", "pv", "t_disk"}


def get(base: str, path: str) -> Any:
    sep = "&" if "?" in path else "?"
    with urllib.request.urlopen(base + path + sep + "ui=1", timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(x: Any, root: str, base: str) -> Any:
    if isinstance(x, dict):
        return {k: norm(v, root, base) for k, v in x.items() if v is not None and k not in VOLATILE}
    if isinstance(x, list):
        return [norm(v, root, base) for v in x]
    if isinstance(x, str):
        return x.replace(root, "<root>").replace(base, "<base>")
    return x


def diff(a: Any, b: Any, at: str, out: List[str]) -> None:
    if len(out) > 30:
        return
    if isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a or k not in b:
                out.append(f"{at}.{k}: {'missing in old' if k not in a else 'missing in new'} ({str(a.get(k, b.get(k)))[:80]})")
            else:
                diff(a[k], b[k], f"{at}.{k}", out)
    elif isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            out.append(f"{at}: {len(a)} vs {len(b)} entries")
        for i, (x, y) in enumerate(zip(a, b)):
            diff(x, y, f"{at}[{i}]", out)
    elif a != b:
        out.append(f"{at}: {str(a)[:100]!r} vs {str(b)[:100]!r}")


def main() -> None:
    a, a_root, b, b_root = sys.argv[1:5]
    projects = [p["name"] for p in get(a, "/api/projects")]
    reads = ["/api/projects", "/api/needs", "/api/search?q=taska", "/api/search?q=the", "/api/projects/deleted",
             "/api/corrections", "/api/views", "/api/voiceprefs"]
    reads += [f"/p/{n}/api/state" for n in projects] + [f"/p/{n}/api/log?n=2000" for n in projects]
    bad = 0
    for path in reads:
        x, y = norm(get(a, path), a_root, a), norm(get(b, path), b_root, b)
        if path == "/api/projects":
            for rows in (x, y):
                for r in rows:
                    r.pop("t", None)  # when the file changed on disk
        out: List[str] = []
        diff(x, y, path, out)
        if out:
            bad += 1
            print("\n".join(out[:30]))
    print(f"{len(reads)} JSON reads, {bad} different")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
