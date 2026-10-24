"""Taska: one task list for you and your coding agents.

    python3 -m taska                         http://127.0.0.1:7340, data in ~/.taska (one folder per project)
    python3 -m taska --port 7351 --root ~/taska-data
    python3 -m taska install-skill           teach Claude Code, Codex and Antigravity how to use Taska
    curl -s localhost:7340/p/<project>/agent     what a coding agent reads first

Standard library only. With GEMINI_API_KEY set, the organizer turns what you say into item changes and voice notes
are transcribed; without it, the inbox waits for a coding agent.
"""

from __future__ import annotations

import argparse
import os
import signal
import sys
import threading
import time
from typing import List, Optional

from .domain.vocab import PROJECT_NAME

MODEL = os.environ.get("TASKA_MODEL", "gemini-flash-latest")
KEY_VARS = ("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY")


def api_key() -> Optional[str]:
    for v in KEY_VARS:
        if os.environ.get(v):
            return os.environ[v]
    return None


def old_projects(root: str) -> List[str]:
    """Projects of the one-file Taska (taska.jsonl) that have no database yet."""
    root = os.path.abspath(os.path.expanduser(root))
    if not os.path.isdir(root):
        return []
    return [n for n in sorted(os.listdir(root)) if PROJECT_NAME.fullmatch(n)
            and os.path.isfile(os.path.join(root, n, "taska.jsonl")) and not os.path.isfile(os.path.join(root, n, "taska.db"))]


def main(argv: Optional[List[str]] = None) -> None:
    ap = argparse.ArgumentParser(prog="taska", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", nargs="?", default="serve", choices=("serve", "install-skill", "import"),
                    help="install-skill: teach Claude Code, Codex and Antigravity how to use Taska")
    ap.add_argument("--port", type=int, default=7340)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--root", default="~/.taska", help="data folder, one subfolder per project (default ~/.taska)")
    ap.add_argument("--organizer", choices=("auto", "off"), default="auto", help="auto = use Gemini when a key is set")
    ap.add_argument("--public", default="", help="the tunnel's public address, e.g. https://xxxx-7340.usw2.devtunnels.ms")
    ap.add_argument("--from", dest="src", default="~/.taska", help="import: the old data folder (only read)")
    ap.add_argument("--to", dest="dst", default="", help="import: the new data folder")
    ap.add_argument("--in-place", action="store_true", help="import: write taska.db next to each taska.jsonl")
    ap.add_argument("--force", action="store_true", help="import: make databases that exist already again")
    ap.add_argument("--log-db", default=None, help="the log also goes into this SQLite file (default: logs.db in the data folder; '' for none)")
    ap.add_argument("--log-level", default="INFO", help="what the terminal shows (DEBUG shows every request)")
    args = ap.parse_args(argv)
    if args.command == "install-skill":
        from .agent_api.skill import install_skill
        print("Installed the Taska skill:")
        install_skill()
        return
    if args.command == "import":
        sys.exit("taska import: the one-file Taska's data was imported on 2026-10-19; this version reads taska.db only")
    old = old_projects(args.root)
    if old:
        sys.exit(f"taska: {os.path.expanduser(args.root)} holds projects of the one-file Taska ({', '.join(old)}) that "
                 "are not imported yet.")
    serve(args.root, args.host, args.port, args.organizer == "auto" and bool(api_key()), args.public,
          os.path.join(os.path.expanduser(args.root), "logs.db") if args.log_db is None else args.log_db, args.log_level)


def serve(root: str, host: str, port: int, organizer: bool, public: str, log_db: Optional[str], log_level: str) -> None:
    from .infra import logs
    from .services.workspace import Workspace
    from .services.organizer import Organizers
    from .services.push import Push
    from .http.app import AppContext
    from .http.server import Server
    from .http.static import PageFiles
    from .services.voice import transcriber_for

    logs.setup(log_db, log_level)
    organizers = Organizers(enabled=organizer)

    def opened(p: "object") -> None:
        from .services.project import Project
        assert isinstance(p, Project)
        p.organizer_on = organizer
        p.voice.set_transcriber(transcriber_for(p, lambda: ws))
        p.voice.resume()  # before the organizer: an input waiting for its words is held for them again
        organizers.start(p)

    ws = Workspace(root, public, on_open=opened, voice_fix=logs.voice_fix)
    push = Push(ws.root)
    stop = threading.Event()

    def restart() -> None:
        threading.Timer(0.3, lambda: os.kill(os.getpid(), signal.SIGTERM)).start()

    ctx = AppContext(ws, PageFiles(), push, restart)
    try:
        srv = Server((host, port), ctx)
    except OSError as ex:
        sys.exit(f"taska: cannot listen on {host}:{port}: {ex}")
    print(f"Taska  http://{host}:{port}/  started {time.strftime('%Y-%m-%d %H:%M:%S')}\n  data       {ws.root}  "
          f"({', '.join(sorted(ws.projects))})\n  organizer  "
          + (f"Gemini {MODEL}" if organizer else "off (set GEMINI_API_KEY to turn it on)")
          + "\n  key        in " + os.path.join(ws.root, "key") + "  (needed from outside this machine and its network)",
          flush=True)

    def pushes() -> None:  # every 15 s, what newly needs you goes to the phones that asked
        while not stop.wait(15):
            try:
                push.check(ws.needs) if push.subs else push.forget()
            except Exception as ex:  # a push must never stop Taska
                print(f"taska: push: {ex}", file=sys.stderr)

    threading.Thread(target=pushes, daemon=True).start()
    # a restart or a deploy (SIGTERM): stop taking requests and finish the ones at work first
    signal.signal(signal.SIGTERM, lambda *_: threading.Thread(target=srv.shutdown, daemon=True).start())
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    stop.set()
    srv.drain()
    ws.close()
