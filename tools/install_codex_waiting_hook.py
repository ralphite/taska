"""Install Codex's PermissionRequest hook (tools/codex_waiting_hook.py, T810 r1373) and trust it as Codex's own
/hooks review does: through `codex app-server` (hooks/list gives the hook's hash, config/batchWrite records it under
hooks.state). Run again it changes nothing.

    python3 tools/install_codex_waiting_hook.py [--home DIR] [--no-trust]
"""

from __future__ import annotations

import argparse
import json
import select
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

HOOK = Path(__file__).resolve().parent / "codex_waiting_hook.py"
EVENT = "PermissionRequest"


def command() -> str:
    return f"python3 {HOOK}"


def install(home: Path) -> List[str]:
    """The hook in ~/.codex/hooks.json (its other groups kept, each where it was); -> the files changed."""
    path = home / ".codex" / "hooks.json"
    if not path.parent.exists():
        raise FileNotFoundError(path.parent)
    data: Dict[str, Any] = json.loads(path.read_text()) if path.exists() else {"hooks": {}}
    groups = data.setdefault("hooks", {}).setdefault(EVENT, [])
    if any(h.get("command") == command() for g in groups for h in g.get("hooks", [])):
        return []
    if path.exists():
        shutil.copy2(path, path.with_name(f"hooks.json.before-waiting-hook-{time.strftime('%Y%m%dT%H%M%S')}"))
    groups.append({"matcher": "*", "hooks": [{"type": "command", "command": command(), "timeout": 5}]})
    path.write_text(json.dumps(data, indent=2) + "\n")
    return [str(path)]


class AppServer:
    def __init__(self, cwd: str) -> None:
        self.p = subprocess.Popen(["codex", "app-server", "--listen", "stdio://"], cwd=cwd, stdin=subprocess.PIPE,
                                  stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        self.n = 0
        self.call("initialize", {"clientInfo": {"name": "taska-install", "version": "1"}})
        self.send({"jsonrpc": "2.0", "method": "initialized"})

    def send(self, o: dict) -> None:
        assert self.p.stdin
        self.p.stdin.write((json.dumps(o) + "\n").encode())
        self.p.stdin.flush()

    def call(self, method: str, params: dict, wait: float = 30) -> Any:
        self.n += 1
        self.send({"jsonrpc": "2.0", "id": self.n, "method": method, "params": params})
        assert self.p.stdout
        end = time.time() + wait
        while time.time() < end:
            if select.select([self.p.stdout], [], [], 1)[0]:
                line = self.p.stdout.readline()
                if not line:
                    break
                d = json.loads(line)
                if d.get("id") == self.n:
                    if "error" in d:
                        raise RuntimeError(f"{method}: {d['error']}")
                    return d.get("result")
        raise TimeoutError(method)

    def close(self) -> None:
        self.p.terminate()


def ours(hooks: List[dict]) -> Optional[dict]:
    return next((h for h in hooks if h.get("command") == command()), None)


def trust(cwd: str) -> str:
    """The hook trusted as Codex's /hooks does; -> its trust status after."""
    s = AppServer(cwd)
    try:
        listed = s.call("hooks/list", {"cwds": [cwd]})["data"][0]["hooks"]
        h = ours(listed)
        if not h:
            return "not found"
        if h.get("trustStatus") == "trusted":
            return "trusted"
        s.call("config/batchWrite", {"edits": [{"keyPath": f'hooks.state."{h["key"]}".trusted_hash',
                                                "value": h["currentHash"], "mergeStrategy": "replace"}]})
        again = ours(s.call("hooks/list", {"cwds": [cwd]})["data"][0]["hooks"])
        return str((again or {}).get("trustStatus"))
    finally:
        s.close()


def main() -> int:
    a = argparse.ArgumentParser()
    a.add_argument("--home", default=str(Path.home()))
    a.add_argument("--no-trust", action="store_true")
    o = a.parse_args()
    for f in install(Path(o.home)):
        print("changed", f)
    if not o.no_trust:
        print("trust:", trust(str(Path(__file__).resolve().parent.parent)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
