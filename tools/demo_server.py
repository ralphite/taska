"""The real Taska for recording a Demo (T589): a copy of the demo projects, served by the real server, with only
what lies outside Taska fixed, so every recording gives the same answers and costs nothing:

- the clock starts at the demo data's time (story.json "now") and runs on from there;
- a voice note's words are the demo's fixed words (no speech model);
- the organizer's question to the model is answered by the demo's own plan (no model), and it organizes only what is
  said during the demo;
- an agent's replies are the demo's own (--replies): once the organizer has handled each thing said in the demo, the
  next reply is sent a moment later as the agent sends it (POST /do);
- nothing reaches Gemini or any other service (a request to one fails).

    python3 tools/demo_server.py --root <copy> --port <port> --words <file> --plan <file> [--replies <file>]
                                 [--think-ms 1500]

The root must be a copy (tools/copy_data.py), never ~/.taska. web/scripts/record-demo.mjs starts it.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import threading
import time
import urllib.request
from datetime import datetime
from typing import Any, Dict, List, Optional

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEYS = ("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_APPLICATION_CREDENTIALS")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", required=True)
    ap.add_argument("--port", type=int, required=True)
    ap.add_argument("--words", required=True, help="a file: what the microphone's recording says")
    ap.add_argument("--plan", required=True, help="a file: the organizer's answer, in the agents' command language")
    ap.add_argument("--replies", help="a file: the agent's replies, a JSON list of {by, session, do, ms}; {input} in"
                    " `do` is the id of what was said")
    ap.add_argument("--think-ms", type=int, default=1500, help="how long the organizer seems to think")
    args = ap.parse_args()
    root = os.path.abspath(os.path.expanduser(args.root))
    if root == os.path.abspath(os.path.expanduser("~/.taska")):
        raise SystemExit("demo_server: never on the live data; give it a copy")
    for k in KEYS:
        os.environ.pop(k, None)
    with open(os.path.join(root, "story.json"), encoding="utf-8") as fh:
        now = json.load(fh)["now"] / 1000
    with open(args.words, encoding="utf-8") as fh:
        words = fh.read().strip()
    with open(args.plan, encoding="utf-8") as fh:
        plan = fh.read()

    # the clock: the demo data's time, running on (before Taska is imported: modules that keep time.time get this one)
    real = time.time
    off = now - real()
    time.time = lambda: real() + off  # type: ignore[assignment]

    class Clock(datetime):
        @classmethod
        def now(cls, tz: Any = None) -> "datetime":  # type: ignore[override]
            return datetime.fromtimestamp(time.time(), tz)

    sys.path.insert(0, os.path.join(ROOT, "server"))
    from taska import cli
    from taska.infra import gemini
    from taska.services import organizer, project, settings, voice, voice_jobs

    for m in (project, settings, voice_jobs):
        m.datetime = Clock  # type: ignore[attr-defined]

    def no_network(url: str, *_a: Any, **_k: Any) -> Dict[str, Any]:
        raise gemini.Failed(None, f"a demo reaches no service ({url.split('?')[0]})")

    gemini.https_post = no_network  # type: ignore[assignment]

    def think(parts: List[Dict[str, Any]], _think: int) -> str:
        time.sleep(args.think_ms / 1000)
        return plan

    organizer.first_plan = think  # type: ignore[assignment]

    # only what is said in the demo is organized: an input of the demo data still waiting stays as it is (the inputs
    # there when the project's organizer starts, before anything is said)
    start, due = organizer.Organizer.__init__, organizer.Organizer.due

    def demo_start(self: Any, p: Any, *a: Any, **k: Any) -> None:
        start(self, p, *a, **k)
        self.before = set(p.state.inputs)

    def demo_due(self: Any, inp: Any) -> bool:
        return inp.id not in self.before and due(self, inp)

    organizer.Organizer.__init__ = demo_start  # type: ignore[method-assign]
    organizer.Organizer.due = demo_due  # type: ignore[assignment]

    # an agent's replies: one each time the organizer has handled the next thing said, through the agents' own door
    replies: List[Dict[str, Any]] = []
    if args.replies:
        with open(args.replies, encoding="utf-8") as fh:
            replies = json.load(fh)
    organize = organizer.Organizer.organize
    taking = threading.Lock()

    def reply(slug: str, rid: str, r: Dict[str, Any]) -> None:
        time.sleep(r.get("ms", 2500) / 1000)
        url = f"http://127.0.0.1:{args.port}/p/{slug}/do?by={r['by']}&session={r.get('session', '')}"
        body = r["do"].replace("{input}", rid).encode("utf-8")
        with urllib.request.urlopen(urllib.request.Request(url, data=body, method="POST")) as answer:
            answer.read()

    def demo_organize(self: Any, rid: str) -> None:
        organize(self, rid)
        with taking:
            r = replies.pop(0) if replies else None
        if r:
            reply(self.p.slug, rid, r)

    organizer.Organizer.organize = demo_organize  # type: ignore[assignment]

    def transcriber_for(_p: Any, _workspace: Any) -> Any:
        def run(_data: bytes, _mime: str, _scope: Optional[int], _path: Optional[str], first: Any) -> Dict[str, Any]:
            time.sleep(0.6)
            first(words)
            time.sleep(0.6)
            return {"tr": words, "tr_by": "pro", "times": {}, "steps": []}
        return run

    voice.transcriber_for = transcriber_for  # type: ignore[assignment]
    cli.serve(root, "127.0.0.1", args.port, True, "", "", "WARNING")


if __name__ == "__main__":
    main()
