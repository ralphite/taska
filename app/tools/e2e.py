"""Yadong's requirements as browser checks (app/web/e2e, T475, D45), run on a Taska of their own.

Every spec file says what it guards on a line of its own:

    // guards: src/features/list/ src/model/items.ts server/

(paths under app/web; a path ending in / guards a whole folder; "server/..." is under app/server). A check that guards
one of Yadong's requirements starts its title with the requirement's input codes ("r494 r308: ..."); when it fails,
it says which requirement, in his words.

    python3 app/tools/e2e.py                     the checks guarding what changed since the last ship (ship.sh)
    python3 app/tools/e2e.py --all               every check (the nightly run), one spec file at a time
    python3 app/tools/e2e.py --shipped           note HEAD as shipped (ship.sh does, once a ship went through)
    python3 app/tools/e2e.py e2e/req/needs.spec.ts [-- playwright args]       these files only
    python3 app/tools/e2e.py --against <old server folder> ...                the same checks on the old version

Each run starts the Taska on a fresh, empty data folder and a free port (no key, no organizer), so the checks never
touch ~/.taska or the live Taska, and each check makes its own project. Before each spec file it waits for the
machine's page budget (machine-guard wait --pages 1): one page at a time, and a long run gives the machine back
between files.
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from typing import Dict, List, Optional, Set

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(APP)
WEB = os.path.join(APP, "web")
SPECS = os.path.join(WEB, "e2e")
SHIPPED = "refs/taska/shipped-app"  # a local ref, never pushed: the commit the last ship put live
# a change to one of these can break any page: every check runs
CORE = ("src/main.tsx", "src/pages/App.tsx", "src/index.css", "src/app/createApp.ts", "package.json",
        "package-lock.json", "vite.config.ts", "playwright.config.ts", "e2e/seed.ts")
GUARD = os.path.expanduser("~/.local/bin/machine-guard")
KEYS = ("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_APPLICATION_CREDENTIALS")


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True).stdout


def changed() -> Optional[Set[str]]:
    """What changed since the last ship (committed or not), as paths under app/web or "server/..."; None: no ship
    noted yet, so everything counts as changed."""
    base = git("rev-parse", "--verify", "--quiet", SHIPPED).strip()
    if not base:
        return None
    files = set(git("diff", "--name-only", base, "HEAD").split()) | set(git("diff", "--name-only", "HEAD").split())
    out: Set[str] = set()
    for f in files:
        if f.startswith("app/web/"):
            out.add(f[len("app/web/"):])
        elif f.startswith("app/server/"):
            out.add("server/" + f[len("app/server/"):])
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


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class Taska:
    """A Taska of its own: the rewrite (or the old version, given its server folder) on an empty data folder."""

    def __init__(self, old: Optional[str]) -> None:
        self.root = tempfile.mkdtemp(prefix="taska-e2e-")
        self.port = free_port()
        self.base = f"http://127.0.0.1:{self.port}"
        env = {k: v for k, v in os.environ.items() if k not in KEYS}
        env["TZ"] = "America/Los_Angeles"
        if old:
            env["TASKA_WEB_DIST"] = os.path.join(old, "..", "web", "dist")
        self.log = open(os.path.join(self.root, "server.log"), "w")
        self.proc = subprocess.Popen([sys.executable, "-m", "taska", "serve", "--host", "127.0.0.1", "--port",
                                      str(self.port), "--root", os.path.join(self.root, "data"), "--organizer", "off",
                                      "--log-db", ""], cwd=old or os.path.join(APP, "server"), env=env,
                                     stdout=self.log, stderr=subprocess.STDOUT)
        for _ in range(150):
            try:
                urllib.request.urlopen(self.base + "/health", timeout=2)
                return
            except Exception:
                time.sleep(0.2)
        self.stop()
        raise SystemExit("e2e: the Taska for the checks did not start")

    def stop(self) -> None:
        self.proc.terminate()
        try:
            self.proc.wait(10)
        except subprocess.TimeoutExpired:
            self.proc.kill()
        self.log.close()
        shutil.rmtree(self.root, ignore_errors=True)


def wait_for_a_page() -> None:
    """The machine's page budget (5 pages for every agent together): one, waited for as long as it takes."""
    if not os.path.exists(GUARD):
        return
    while subprocess.run([GUARD, "wait", "--pages", "1", "--timeout", "3600"], stdout=subprocess.DEVNULL,
                         stderr=subprocess.DEVNULL).returncode != 0:
        pass


def words(code: str) -> str:
    """Yadong's words for an input code, from the Taska the change goes to (only for the message: none if away)."""
    url = os.environ.get("TASKA_URL", "http://127.0.0.1:7340")
    try:
        with urllib.request.urlopen(f"{url}/p/taska/{code}", timeout=3) as r:
            lines = r.read().decode("utf-8", "replace").splitlines()
        said = [x.strip() for x in lines[1:] if x.strip() and not re.match(r"(https?://\S+|files:|organizer:)", x.strip())]
        text = " ".join(said)
        return text if len(text) <= 160 else text[:159] + "…"
    except Exception:
        return ""


def failed_checks(out: str) -> List[tuple]:
    found = []
    for line in out.splitlines():
        m = re.search(r"✘\s+\d+\s+\[(\w+)\]\s+›\s+(\S+)\s+›\s+(.*?)(?:\s+\(\d|$)", line)
        if m:
            found.append((m.group(1), m.group(2), m.group(3)))
    return found


def report(failed: List[tuple]) -> None:
    """The failed checks, each with the requirement it guards in Yadong's words."""
    print("e2e: these checks failed:")
    for proj, spec, title in failed:
        print(f"  [{proj}] {spec}: {title}")
        for code in re.findall(r"\b(r\d+)\b", title.split(":")[0]):
            w = words(code)
            print(f"    {code}: {w}" if w else f"    {code}")
    print("e2e: fix it, or ask Yadong first if the change really means to undo one of his requirements")


def run(specs: List[str], old: Optional[str], rest: List[str]) -> int:
    """Each spec file on a Taska of its own, one after another, each when the machine has a page for it."""
    bad: List[tuple] = []
    broken: List[str] = []
    passed = 0
    for spec in specs:
        wait_for_a_page()
        t0 = time.monotonic()
        t = Taska(old)
        out_dir = os.path.join(WEB, "test-results", f"run-{os.getpid()}")
        try:
            env = {k: v for k, v in os.environ.items() if k not in KEYS}
            env["TASKA_URL"] = t.base
            r = subprocess.run(["npx", "playwright", "test", "--output=" + out_dir, *rest, spec], cwd=WEB, env=env,
                               capture_output=True, text=True)
        finally:
            t.stop()
        out = r.stdout + r.stderr
        passed += sum(int(n) for n in re.findall(r"(\d+) passed", out)[-1:])
        f = failed_checks(out)
        took = int(time.monotonic() - t0)
        print(f"e2e: {spec}: " + (f"{len(f)} failed" if f else "failed to run" if r.returncode else "passed") + f" ({took} s)",
              flush=True)
        if r.returncode:
            print(out[-4000:])
            bad += f
            if not f:
                broken.append(spec)
    if not bad and not broken:
        shutil.rmtree(os.path.join(WEB, "test-results", f"run-{os.getpid()}"), ignore_errors=True)
        print(f"e2e: {passed} passed")
        return 0
    if bad:
        report(bad)
    if broken:
        print("e2e: did not run: " + " ".join(broken))
    return 1


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--shipped", action="store_true")
    ap.add_argument("--against", help="the old version's server folder: the same checks on it")
    ap.add_argument("specs", nargs="*")
    argv = sys.argv[1:]
    cut = argv.index("--") if "--" in argv else len(argv)
    a, rest = ap.parse_args(argv[:cut]), argv[cut + 1:]
    if a.shipped:
        return subprocess.run(["git", "update-ref", SHIPPED, "HEAD"], cwd=ROOT).returncode
    specs = [os.path.relpath(os.path.abspath(s), WEB) if os.path.exists(s) else s for s in a.specs]
    specs = specs or (sorted(guards()) if a.all else pick(changed()))
    if not specs:
        print("e2e: no check guards what changed")
        return 0
    print(f"e2e: {len(specs)} check files: {' '.join(s[len('e2e/'):] for s in specs)}", flush=True)
    return run(specs, os.path.abspath(a.against) if a.against else None, rest)


if __name__ == "__main__":
    sys.exit(main())
