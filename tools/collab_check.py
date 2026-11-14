#!/usr/bin/env python3
"""Agents working together, checked with real agents on the real Taska (I769 r1307; docs/collaboration.md).

    python3 tools/collab_check.py [--base http://127.0.0.1:7340] [--keep]

Makes a throwaway project on that Taska with a few items you approved, then runs real agent sessions on it, each a
fresh headless session of its app (Claude Code: `claude -p`, Codex: `codex exec`) told only what a user would tell
it; after each step it reads Taska itself and checks what came of it:

  1. alpha takes the next item: it holds it.
  2. beta, told to work on alpha's item, is refused by Taska and leaves it; its /next named alpha as here.
  3. beta, told the user wants it to take over, takes it with `take`; the item says so to alpha.
  4. alpha, writing on it again, is told to stop, and says it will.
  5. a manager hands an item to its worker (parent=manager): the worker is not refused; Agents shows it under its
     manager.
  6. Codex, connecting, is told who else is here.

The project is deleted for good at the end (--keep keeps it to look at). Costs a few agent turns (Sonnet for
Claude Code). Prints each step's verdict; exits 1 when one failed.
"""

from __future__ import annotations

import argparse
import json
import os
import shlex
import subprocess
import sys
import time
import urllib.request
from typing import Callable, List, Tuple

CLAUDE = ["claude", "-p", "--model", "sonnet", "--allowedTools", "Bash(curl:*)", "--max-turns", "12", "--output-format", "text"]
STOP = ("stop", "\u505c")  # an agent may answer in Chinese ("stop")
# the Codex that comes with the ChatGPT app is kept up to date with it; a `codex` installed apart may be too old for
# the model it is set to
APP_CODEX = "/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex"
CODEX = [APP_CODEX if os.path.exists(APP_CODEX) else "codex", "exec", "-s", "workspace-write", "-c", "sandbox_workspace_write.network_access=true", "--skip-git-repo-check"]


def http(method: str, url: str, body: object = None) -> str:
    data = None if body is None else (body.encode() if isinstance(body, str) else json.dumps(body).encode())
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"Content-Type": "text/plain" if isinstance(body, str) else "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode()


def agent(cmd: List[str], prompt: str, cwd: str) -> str:
    env = {k: v for k, v in os.environ.items() if k not in ("CLAUDE_CODE_SESSION_ID", "CODEX_THREAD_ID")}
    p = subprocess.run(cmd + [prompt], cwd=cwd, env=env, stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=600)
    return (p.stdout or "") + (("\n[stderr] " + p.stderr[-800:]) if p.returncode else "")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:7340")
    ap.add_argument("--keep", action="store_true")
    a = ap.parse_args()
    root = a.base.rstrip("/")
    slug = json.loads(http("POST", f"{root}/api/projects", {"title": f"Collab check {time.strftime('%H%M%S')}"}))["name"]
    base = f"{root}/p/{slug}"
    work = os.path.join("/tmp", f"taska-collab-{slug}")
    os.makedirs(work, exist_ok=True)
    print(f"project {slug}: {base}", flush=True)
    http("POST", f"{base}/do?by=you", "new task P1 now Pick the export format\nnew task P1 now Sort the list by date\n"
                                       "new task P2 now Write the changelog\n")
    item = lambda code: http("GET", f"{base}/{code}?ui=1")  # noqa: E731

    def sessions() -> dict:
        """Each agent session as the page's Agents shows it: its parent and the item it holds (n)."""
        view = json.loads(http("GET", f"{base}/api/view?ui=1"))["project"]["agents"]
        return {s["name"]: s for ag in view for s in ag.get("sessions", [])}

    on = lambda ses: (sessions().get(ses, {}).get("on") or {}).get("n")  # noqa: E731
    results: List[Tuple[str, bool, str]] = []

    def step(name: str, run: Callable[[], str], ok: Callable[[str], bool]) -> None:
        out = run()
        good = False
        try:
            good = ok(out)
        except Exception as ex:  # a check that cannot read its answer is a failure, said
            out += f"\n[check] {ex!r}"
        results.append((name, good, out))
        print(f"{'PASS' if good else 'FAIL'}  {name}", flush=True)
        if not good:
            print("   " + out[-1500:].replace("\n", "\n   "), flush=True)

    url = lambda ses, extra="": f'"{base}/{{path}}?by=claude-code&session={ses}{extra}"'  # noqa: E731

    def claude(ses: str, task: str, extra: str = "") -> str:
        u = url(ses, extra)
        return agent(CLAUDE, (
            f"You are the agent session '{ses}' on a Taska project. Taska's interface: GET {u.format(path='next')} "
            f"says what to do; POST commands to {u.format(path='do')} with curl --data-binary (one per line, e.g. "
            f"`T1 doing`, `T1 progress <text>`). Always keep `by=claude-code&session={ses}{extra}` in the URLs. Do only "
            f"this, then stop and say in one or two sentences what Taska told you and what you did: {task}"), work)

    step("1 alpha takes the next item and holds it",
         lambda: claude("alpha", "get your next item from /next and mark that item doing."),
         lambda out: on("alpha") == 1 and " doing " in item("T1").split("\n")[0])
    step("2 beta is refused alpha's item, leaves it, and was told alpha is here",
         lambda: claude("beta", "call /next once, then work on T1: send `T1 doing`. Follow what Taska answers."),
         lambda out: on("alpha") == 1 and on("beta") != 1 and "alpha" in out.lower())
    step("3 beta takes T1 over because the user asked; T1 says so to alpha",
         lambda: claude("beta", "the user asks you to take over T1 from the session that holds it. Do it the way "
                                "Taska's guide says (GET .../agent tells; the command is `T1 take`)."),
         lambda out: on("beta") == 1 and "@alpha T1 is taken over from you" in item("T1"))
    step("4 alpha, writing on T1 again, is told to stop and says it stops",
         lambda: claude("alpha", "write `T1 progress still on the export format` and do what Taska's answer says."),
         lambda out: any(w in out.lower() for w in STOP) and "@alpha T1 is taken over" in item("T1"))
    step("5 a manager's worker takes the item its manager got, unrefused, shown under its manager",
         lambda: claude("manager", "call /next and mark the item it gives you doing; then hand it to your worker: "
                                   "`<that item> say @worker-1 please do this one`.") + "\n----\n" +
         claude("worker-1", "call /next; your manager wrote to you on an item: mark that item doing and write a "
                            "progress line on it.", "&parent=manager"),
         lambda out: sessions().get("worker-1", {}).get("parent") == "manager" and on("worker-1") is not None
         and on("worker-1") == (sessions().get("manager", {}).get("on") or {}).get("n", on("worker-1")))
    step("6 Codex, connecting, is told who else is here",
         lambda: agent(CODEX, (
             f"Run exactly: curl -s \"{base}/next?by=codex&session=main\" and print its output verbatim, nothing else."), work),
         lambda out: "other agent sessions here" in out)

    if not a.keep:
        http("POST", f"{root}/api/projects/delete", {"name": slug})
        http("POST", f"{root}/api/projects/purge", {"name": slug})
        print(f"project {slug} deleted", flush=True)
    failed = [n for n, good, _ in results if not good]
    print(f"\n{len(results) - len(failed)} of {len(results)} passed" + (f"; failed: {', '.join(failed)}" if failed else ""))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
