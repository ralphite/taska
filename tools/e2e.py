"""Yadong's requirements as browser checks (web/e2e, T475, D45), run on a Taska of their own.

Every spec file says what it guards on a line of its own:

    // guards: src/features/list/ src/model/items.ts server/

(paths under web; a path ending in / guards a whole folder; "server/..." is under server). A check that guards
one of Yadong's requirements starts its title with the requirement's input codes ("r494 r308: ..."); when it fails,
it says which requirement, in his words.

    python3 tools/e2e.py                     the checks guarding what changed since --shipped
    python3 tools/e2e.py --all               every check
    python3 tools/e2e.py --gate              the checks guarding what changed; a known issue (web/e2e/known.txt)
                                             failing does not fail it (what tools/ship.sh runs)
    python3 tools/e2e.py --shipped           note HEAD as shipped after a verified deployment
    python3 tools/e2e.py e2e/req/needs.spec.ts [-- playwright args]       these files only
    --jobs N                                 how many run at once (default: TASKA_E2E_JOBS, else 6)

Each spec file runs once per layout (the phone, the desktop), each run on a Taska of its own: a fresh, empty data
folder and a free port (no key, no organizer), so the checks never touch ~/.taska or the live Taska, and nothing one
run makes is seen by another (some checks count every project the Taska has). Several runs go at once, the longest
first; inside a run the checks go one after another.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, "web")
SPECS = os.path.join(WEB, "e2e")
SHIPPED = "refs/taska/shipped"  # a local ref, never pushed: the commit the last ship put live
# a change to one of these can break any page: every check runs
CORE = ("src/main.tsx", "src/pages/App.tsx", "src/index.css", "src/app/createApp.ts", "package.json",
        "package-lock.json", "vite.config.ts", "playwright.config.ts", "e2e/seed.ts")
KEYS = ("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_APPLICATION_CREDENTIALS")
LAYOUTS = ("phone", "desktop")  # the projects of web/playwright.config.ts
KNOWN = os.path.join(SPECS, "known.txt")  # the checks of docs/known-issues.md: they fail without stopping a ship
JOBS = 6  # runs at once: each a Taska, a Playwright and a Chromium; 6 held steady on the 10-core Mac under other load


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True).stdout


def changed() -> Optional[Set[str]]:
    """What changed since the last ship (committed or not), as paths under web or "server/..."; None: no ship
    noted yet, so everything counts as changed."""
    base = git("rev-parse", "--verify", "--quiet", SHIPPED).strip()
    if not base:
        return None
    files = set(git("diff", "--name-only", base, "HEAD").split()) | set(git("diff", "--name-only", "HEAD").split())
    out: Set[str] = set()
    for f in files:
        if f.startswith("web/"):
            out.add(f[len("web/"):])
        elif f.startswith("server/"):
            out.add("server/" + f[len("server/"):])
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


_STARTING = threading.Lock()  # one Taska starts at a time: a free port is free only until someone listens on it


class Taska:
    """An isolated Taska server on an empty data folder and a free port."""

    def __init__(self) -> None:
        self.root = tempfile.mkdtemp(prefix="taska-e2e-")
        env = {k: v for k, v in os.environ.items() if k not in KEYS}
        env["TZ"] = "America/Los_Angeles"
        self.log = open(os.path.join(self.root, "server.log"), "w")
        with _STARTING:
            self.port = free_port()
            self.base = f"http://127.0.0.1:{self.port}"
            self.proc = subprocess.Popen([sys.executable, "-m", "taska", "serve", "--host", "127.0.0.1", "--port",
                                          str(self.port), "--root", os.path.join(self.root, "data"), "--organizer",
                                          "off", "--log-db", ""], cwd=os.path.join(ROOT, "server"), env=env,
                                         stdout=self.log, stderr=subprocess.STDOUT)
            for _ in range(150):
                if self.proc.poll() is not None:
                    break
                try:
                    urllib.request.urlopen(self.base + "/health", timeout=2)
                    return
                except Exception:
                    time.sleep(0.1)
        self.stop()
        raise RuntimeError("the Taska for the checks did not start")

    def stop(self) -> None:
        self.proc.terminate()
        try:
            self.proc.wait(10)
        except subprocess.TimeoutExpired:
            self.proc.kill()
        self.log.close()
        shutil.rmtree(self.root, ignore_errors=True)


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


@dataclass
class Failed:
    layout: str
    spec: str
    title: str


@dataclass
class Outcome:
    passed: int = 0
    failed: List[Failed] = field(default_factory=list)
    broken: str = ""  # it did not run: why


def results(path: str) -> Outcome:
    """What Playwright's JSON report says: how many checks passed, and the ones that failed."""
    out = Outcome()
    try:
        with open(path, encoding="utf-8") as fh:
            rep = json.load(fh)
    except (OSError, ValueError):
        out.broken = "no report"
        return out

    def walk(suite: dict) -> None:
        for spec in suite.get("specs") or []:
            for t in spec.get("tests") or []:
                if t.get("status") in ("expected", "flaky"):
                    out.passed += 1
                elif t.get("status") == "unexpected":
                    out.failed.append(Failed(t.get("projectName", ""), "e2e/" + spec.get("file", ""), spec.get("title", "")))
        for s in suite.get("suites") or []:
            walk(s)

    for s in rep.get("suites") or []:
        walk(s)
    errors = rep.get("errors") or []
    if errors and not out.failed:
        text = re.sub(r"\x1b\[[0-9;]*m", "", str(errors[0].get("message") or errors[0])).strip()
        out.broken = (text.splitlines() or ["an error"])[0][:300]
    return out


def known() -> List[Tuple[str, str, str]]:
    """The checks of the known issues (web/e2e/known.txt): (spec file, layout or *, the start of its title)."""
    out = []
    try:
        with open(KNOWN, encoding="utf-8") as fh:
            for line in fh:
                m = re.match(r"(\S+\.spec\.ts) \[(\w+|\*)\] (.+)$", line.strip())
                if m and not line.startswith("#"):
                    out.append((m.group(1), m.group(2), m.group(3)))
    except OSError:
        pass
    return out


def is_known(f: Failed, ks: List[Tuple[str, str, str]]) -> bool:
    return any(f.spec == spec and lay in ("*", f.layout) and f.title.startswith(start) for spec, lay, start in ks)


def report(failed: List[Failed]) -> None:
    """The failed checks, each with the requirement it guards in Yadong's words."""
    print("e2e: these checks failed:")
    for f in failed:
        print(f"  [{f.layout}] {f.spec}: {f.title}")
        for code in re.findall(r"\b(r\d+)\b", f.title.split(":")[0]):
            w = words(code)
            print(f"    {code}: {w}" if w else f"    {code}")
    print("e2e: fix it, or ask Yadong first if the change really means to undo one of his requirements")


def jobs(specs: List[str], rest: List[str]) -> List[Tuple[str, Optional[str]]]:
    """Each spec file once per layout (unless the arguments choose one), the longest first (a file is about as long
    as its checks take), so the last to finish are short."""
    lays: List[Optional[str]] = [None] if any(a.startswith("--project") for a in rest) else list(LAYOUTS)
    size = {s: os.path.getsize(os.path.join(WEB, s)) if os.path.isfile(os.path.join(WEB, s)) else 0 for s in specs}
    return [(s, lay) for s in sorted(specs, key=lambda s: -size[s]) for lay in lays]


def one(spec: str, layout: Optional[str], rest: List[str], run_dir: str) -> Tuple[Outcome, str, int]:
    """One spec file in one layout on a Taska of its own -> what came of it, its output, how long it took (s)."""
    t0 = time.monotonic()
    out_dir = os.path.join(run_dir, re.sub(r"[^A-Za-z0-9_.-]", "-", spec) + (f"-{layout}" if layout else ""))
    os.makedirs(out_dir, exist_ok=True)
    report_file = os.path.join(out_dir, "report.json")
    try:
        t = Taska()
    except RuntimeError as ex:
        return Outcome(broken=str(ex)), "", int(time.monotonic() - t0)
    try:
        env = {k: v for k, v in os.environ.items() if k not in KEYS}
        env.update(TASKA_URL=t.base, PLAYWRIGHT_JSON_OUTPUT_FILE=report_file)
        r = subprocess.run(["npx", "playwright", "test", "--reporter=list,json", "--output=" + out_dir,
                            *([f"--project={layout}"] if layout else []), *rest, spec],
                           cwd=WEB, env=env, capture_output=True, text=True)
    finally:
        t.stop()
    got = results(report_file)
    if r.returncode and not got.failed and not got.broken:
        got.broken = f"Playwright ended with {r.returncode}"
    return got, r.stdout + r.stderr, int(time.monotonic() - t0)


def run(specs: List[str], rest: List[str], n_jobs: int, gate: bool) -> int:
    """Every spec file in every layout, each on a Taska of its own, n_jobs at once. With gate, a known issue failing
    is said, and does not fail the run."""
    t0 = time.monotonic()
    run_dir = os.path.join(WEB, "test-results", f"run-{os.getpid()}")
    todo = jobs(specs, rest)
    failed: List[Failed] = []
    broken: List[str] = []
    passed = 0
    said = threading.Lock()

    def go(job: Tuple[str, Optional[str]]) -> None:
        nonlocal passed
        spec, layout = job
        got, out, took = one(spec, layout, rest, run_dir)
        where = spec + (f" [{layout}]" if layout else "")
        with said:
            passed += got.passed
            failed.extend(got.failed)
            print(f"e2e: {where}: " + (f"{len(got.failed)} failed" if got.failed else
                                       f"did not run ({got.broken})" if got.broken else "passed") + f" ({took} s)",
                  flush=True)
            if got.failed or got.broken:
                print(out[-4000:], flush=True)
                if not got.failed:
                    broken.append(where)

    with ThreadPoolExecutor(max_workers=max(1, n_jobs)) as pool:
        list(pool.map(go, todo))
    took = int(time.monotonic() - t0)
    ks = known() if gate else []
    new = [f for f in failed if not is_known(f, ks)]
    old = [f for f in failed if is_known(f, ks)]
    if old:
        print("e2e: known issues still failing (docs/known-issues.md): " +
              "; ".join(f"[{f.layout}] {f.spec}: {f.title[:60]}" for f in old))
    if not new and not broken:
        if not failed:
            shutil.rmtree(run_dir, ignore_errors=True)
        print(f"e2e: {passed} passed{f', {len(old)} known issues' if old else ''} ({len(todo)} runs, {n_jobs} at once, "
              f"{took} s)")
        return 0
    if new:
        report(new)
    if broken:
        print("e2e: did not run: " + "; ".join(broken))
    print(f"e2e: {passed} passed, {len(new)} failed{f', {len(old)} known issues' if old else ''} ({took} s)")
    return 1


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--gate", action="store_true")
    ap.add_argument("--shipped", action="store_true")
    ap.add_argument("--jobs", type=int, default=int(os.environ.get("TASKA_E2E_JOBS") or JOBS))
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
    return run(specs, rest, a.jobs, a.gate)


if __name__ == "__main__":
    sys.exit(main())
