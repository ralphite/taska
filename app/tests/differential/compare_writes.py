"""The agent interface's writes, the same on two running Taskas on copies of the same data: a file sent, every kind of
command (and wrong ones), taking work with /next, and the reads after them, compared word for word (paths of the
two data folders made the same).

    python3 app/tests/differential/compare_writes.py http://127.0.0.1:7352 /data/old http://127.0.0.1:7351 /data/new

It writes: run it on copies only.
"""

from __future__ import annotations

import difflib
import json
import sys
import urllib.error
import urllib.request
from typing import List, Optional, Tuple

PNG = bytes.fromhex("89504e470d0a1a0a0000000d4948445200000001000000010806000000"
                    "1f15c4890000000d49444154789c63000100000500010d0a2db40000000049454e44ae426082")


def call(base: str, path: str, body: Optional[bytes] = None, kind: str = "text/plain; charset=utf-8") -> Tuple[int, str]:
    req = urllib.request.Request(base + path, data=body, method="POST" if body is not None else "GET",
                                 headers={"Content-Type": kind} if body is not None else {})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read().decode("utf-8")
    except urllib.error.HTTPError as ex:
        return ex.code, ex.read().decode("utf-8")


def steps(fid: str) -> List[Tuple[str, str, Optional[bytes], str]]:
    """(what it is, path, body, content type); "{fid}" is the file sent first."""
    w = "/p/write-check"
    do = lambda by, text: (f"{w}/do?by={by}", text.encode("utf-8"), "text/plain; charset=utf-8")  # noqa: E731
    out = [
        ("a new project", "/api/projects", json.dumps({"title": "Write check"}).encode(), "application/json"),
        ("an agent's first read", f"{w}/agent?by=claude-code", None, ""),
        ("work, when there is none", f"{w}/next?by=claude-code", None, ""),
        ("new items, fields, talk", *do("claude-code", f"""new bug P1 now Export ignores the active filter
  The CSV has every row.
new task later parent=$ Keep the filter in the file name
1 doing
1 say files={fid} The screenshot ![shot]({fid})
1 ask Which format?
  - ( ) CSV
  - ( ) Excel
2 propose Put the filter in the name
1 doc Plan
  # Plan
  First paragraph.

  Second paragraph.
D1 reply ¶1 Looks good
1 title Export ignores the filter
1 next Write the fix
""")),
        ("the item's card", f"{w}/1?by=codex", None, ""),
        ("work for another agent", f"{w}/next?by=codex", None, ""),
        ("wrong commands", *do("codex", f"""nonsense here
99 say hi
1 say files=f999-nope.png nope
1 P7 later
ack r404
1 merge 1
""")),
        ("a message to another session", *do("codex", "1 say @worker-b take the tests\n")),
        ("merge, done, archive", *do("claude-code", "2 merge 1\n1 done Fixed it\n  With the filter kept.\n1 archive\n")),
        ("a rule", *do("claude-code", "new rule Commit messages are in English\n")),
        ("the lists after", f"{w}/items?status=all&archived=all", None, ""),
        ("the log after", f"{w}/log?n=100", None, ""),
        ("the document", f"{w}/D1", None, ""),
        ("the rules", f"{w}/rules", None, ""),
        ("work after", f"{w}/next?by=claude-code", None, ""),
    ]
    return out


def main() -> None:
    a, a_root, b, b_root = sys.argv[1:5]
    bad = 0
    sent = []
    for base, root in ((a, a_root), (b, b_root)):
        call(base, "/api/projects", json.dumps({"title": "Write check"}).encode(), "application/json")
        status, answer = call(base, "/p/write-check/api/file?name=a.png", PNG, "image/png")
        sent.append((status, answer))
    if sent[0] != sent[1]:
        bad += 1
        print(f"== a file sent: {sent[0]} vs {sent[1]}")
    fid = json.loads(sent[0][1]).get("f", "")
    for what, path, body, kind in steps(fid)[1:]:
        sa, ta = call(a, path, body, kind)
        sb, tb = call(b, path, body, kind)
        ta, tb = ta.replace(a_root, "<root>").replace(a, "<base>"), tb.replace(b_root, "<root>").replace(b, "<base>")
        if (sa, ta) != (sb, tb):
            bad += 1
            print(f"== {what} ({path}): {sa} vs {sb}")
            print("\n".join(list(difflib.unified_diff(ta.splitlines(), tb.splitlines(), "old", "new", lineterm="", n=1))[:40]))
    print(f"{len(steps(fid))} writes and reads, {bad} different")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
