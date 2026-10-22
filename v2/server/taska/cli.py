"""Taska: one task list for you and your coding agents.

    python3 taska.pyz                       http://127.0.0.1:7340, data in ~/.taska (one folder per project)
    python3 taska.pyz --port 7341 --root ~/taska-v2-data
    python3 taska.pyz import --from ~/.taska --to ~/taska-v2-data      the old one-file Taska's data, as a copy
    python3 taska.pyz install-skill         teach Claude Code, Codex and Antigravity how to use Taska
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

from . import importer
from .core import MODEL, NAME
from .gemini import api_key
from .guide import install_skill


def old_projects(root: str) -> List[str]:
    """Projects of the one-file Taska (taska.jsonl) that have no v2 database yet."""
    root = os.path.abspath(os.path.expanduser(root))
    if not os.path.isdir(root):
        return []
    return [n for n in sorted(os.listdir(root)) if NAME.fullmatch(n) and os.path.isfile(os.path.join(root, n, "taska.jsonl"))
            and not os.path.isfile(os.path.join(root, n, "taska.db"))]


def main(argv: Optional[List[str]] = None) -> None:
    argv = sys.argv[1:] if argv is None else argv
    if argv[:1] == ["logs"]:  # T453: read the log table
        from . import logs
        logs.main(argv[1:])
        return
    ap = argparse.ArgumentParser(prog="taska", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", nargs="?", default="serve", choices=("serve", "install-skill", "import", "logs"),
                    help="install-skill: teach Claude Code, Codex and Antigravity how to use Taska; import: bring in the old data;"
                         " logs: read the log table (taska logs -h)")
    ap.add_argument("--port", type=int, default=7340)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--root", default="~/.taska", help="data folder, one subfolder per project (default ~/.taska)")
    ap.add_argument("--organizer", choices=("auto", "off"), default="auto", help="auto = use Gemini when a key is set")
    ap.add_argument("--public", default="", help="the tunnel's public address, e.g. https://xxxx-7340.usw2.devtunnels.ms")
    ap.add_argument("--from", dest="src", default="~/.taska", help="import: the old data folder (only read)")
    ap.add_argument("--to", dest="dst", default="", help="import: the new data folder")
    ap.add_argument("--in-place", action="store_true", help="import: write taska.db next to each taska.jsonl (switch day)")
    ap.add_argument("--force", action="store_true", help="import: make databases that exist already again")
    args = ap.parse_args(argv)
    if args.command == "install-skill":
        print("Installed the Taska skill:")
        install_skill()
        return
    if args.command == "import":
        if not args.dst and not args.in_place:
            sys.exit("taska import: say where the copy goes (--to <folder>), or --in-place on switch day")
        importer.run(args.src, args.dst, in_place=args.in_place, force=args.force)
        return
    old = old_projects(args.root)
    if old:
        root = os.path.expanduser(args.root)
        sys.exit(f"taska: {root} holds projects of the one-file Taska ({', '.join(old)}) that are not imported yet.\n"
                 f"  Try v2 on a copy:   python3 -m taska import --from {args.root} --to ~/taska-v2-data  then  --root ~/taska-v2-data\n"
                 f"  Switch for good:    python3 -m taska import --from {args.root} --in-place  (the old files stay as they are)")
    from .hub import Hub
    from .web import Server

    hub = Hub(args.root, args.organizer == "auto" and bool(api_key()), args.public)
    try:
        srv = Server((args.host, args.port), hub)
    except OSError as ex:
        sys.exit(f"taska: cannot listen on {args.host}:{args.port}: {ex}")
    print(f"Taska  http://{args.host}:{args.port}/  started {time.strftime('%Y-%m-%d %H:%M:%S')}\n  data       {hub.root}  ({', '.join(sorted(hub.projects))})\n  organizer  "
          + (f"Gemini {MODEL}" if hub.organizer else "off (set GEMINI_API_KEY to turn it on)")
          + "\n  key        in " + os.path.join(hub.root, "key") + "  (needed from outside this machine and its network)", flush=True)

    def pushes() -> None:  # F195: every 15 s, what newly needs you goes to the phones that asked
        while True:
            time.sleep(15)
            try:
                if hub.push.subs:
                    hub.push.check(hub.needs())
                else:
                    hub.push.seen = None
            except Exception as ex:  # a push must never stop Taska
                print(f"taska: push: {ex}", file=sys.stderr)

    threading.Thread(target=pushes, daemon=True).start()
    # SIGTERM (a restart, a deploy): stop taking requests and finish the ones at work first (T101)
    signal.signal(signal.SIGTERM, lambda *_: threading.Thread(target=srv.shutdown, daemon=True).start())
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    srv.drain()
    hub.close()
