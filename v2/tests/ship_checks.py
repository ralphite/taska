"""The browser checks a ship runs first (T475, D45): only the ones guarding what changed since the last ship.

Every spec file in v2/web/e2e says what it guards on a line of its own:

    // guards: src/components/List.tsx src/lib/rows.ts

(paths under v2/web; a path ending in / guards a whole folder; "server/" means the Python server). A check that
guards one of Yadong's requirements starts its title with the requirement's input codes ("r494 r308: ..."); when
it fails, the ship stops and says which requirement the change breaks, in his words.

    python3 v2/tests/ship_checks.py            the checks guarding what changed since the last ship
    python3 v2/tests/ship_checks.py --all      every check (the nightly run)
    python3 v2/tests/ship_checks.py --shipped  note HEAD as shipped (ship.sh does, once a ship went through)
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.request
from typing import Dict, List, Optional, Set

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WEB = os.path.join(ROOT, "v2", "web")
SPECS = os.path.join(WEB, "e2e")
SHIPPED = "refs/taska/shipped"  # a local ref, never pushed: the commit the last ship put live
# a change to one of these can break any page: every check runs
CORE = ("src/main.tsx", "src/App.tsx", "src/index.css", "src/lib/state.ts", "src/lib/types.ts", "package.json",
        "package-lock.json", "vite.config.ts", "playwright.config.ts", "e2e/seed.ts")


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True).stdout


def changed() -> Optional[Set[str]]:
    """What changed since the last ship (committed or not), as paths under v2/web or "server/..."; None: no ship
    noted yet, so everything counts as changed."""
    base = git("rev-parse", "--verify", "--quiet", SHIPPED).strip()
    if not base:
        return None
    files = set(git("diff", "--name-only", base, "HEAD").split()) | set(git("diff", "--name-only", "HEAD").split())
    out: Set[str] = set()
    for f in files:
        if f.startswith("v2/web/"):
            out.add(f[len("v2/web/"):])
        elif f.startswith("v2/server/"):
            out.add("server/" + f[len("v2/server/"):])
    return out


def guards() -> Dict[str, List[str]]:
    """Each spec file and what it guards."""
    out: Dict[str, List[str]] = {}
    for d, _, names in os.walk(SPECS):
        for n in sorted(names):
            if not n.endswith(".spec.ts"):
                continue
            path = os.path.join(d, n)
            with open(path, encoding="utf-8") as fh:
                m = re.search(r"^// guards: (.+)$", fh.read(), re.M)
            out[os.path.relpath(path, WEB)] = m.group(1).split() if m else ["src/"]  # no line: guards the page
    return out


def pick(files: Optional[Set[str]]) -> List[str]:
    specs = guards()
    if files is None or any(f in CORE for f in files):
        return sorted(specs)
    return sorted(spec for spec, gs in specs.items()
                  if spec in files or any(f == g or (g.endswith("/") and f.startswith(g)) for f in files for g in gs))


def words(code: str) -> str:
    """Yadong's words for an input code, from the Taska this ship goes to (only for the message: none if away)."""
    url = os.environ.get("TASKA_URL", "http://127.0.0.1:7340")
    try:
        with urllib.request.urlopen(f"{url}/p/taska/{code}", timeout=3) as r:
            lines = r.read().decode("utf-8", "replace").splitlines()
        said = [x.strip() for x in lines[1:] if x.strip() and not re.match(r"(https?://\S+|files:|organizer:)", x.strip())]
        text = " ".join(said)
        return text if len(text) <= 160 else text[:159] + "…"
    except Exception:
        return ""


def report(out: str) -> None:
    """The failed checks, each with the requirement it guards in Yadong's words."""
    failed = []
    for line in out.splitlines():
        m = re.search(r"✘\s+\d+\s+\[(\w+)\]\s+›\s+(\S+)\s+›\s+(.*?)(?:\s+\(\d|$)", line)
        if m:
            failed.append((m.group(1), m.group(2), m.group(3)))
    if not failed:
        print("ship: the checks failed (see above)")
        return
    print("ship: stopped. This change breaks:")
    for proj, spec, title in failed:
        print(f"  [{proj}] {spec}: {title}")
        for code in re.findall(r"\b(r\d+)\b", title.split(":")[0]):
            w = words(code)
            print(f"    {code}: {w}" if w else f"    {code}")
    print("ship: fix it, or ask Yadong first if the change really means to undo one of his requirements")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--shipped", action="store_true")
    a = ap.parse_args()
    if a.shipped:
        return subprocess.run(["git", "update-ref", SHIPPED, "HEAD"], cwd=ROOT).returncode
    specs = sorted(guards()) if a.all else pick(changed())
    if not specs:
        print("ship: no check guards what changed")
        return 0
    print(f"ship: {len(specs)} check files guard what changed: {' '.join(s[len('e2e/'):] for s in specs)}")
    run = subprocess.run([sys.executable, os.path.join(ROOT, "v2", "tests", "run_e2e.py"), "--", *specs], cwd=ROOT, capture_output=True, text=True)
    out = run.stdout + run.stderr
    if run.returncode:
        print(out[-6000:])
        report(out)
        return 1
    print("ship: " + (re.findall(r"(\d+ passed[^\n]*)", out) or ["checks passed"])[-1])
    return 0


if __name__ == "__main__":
    sys.exit(main())
