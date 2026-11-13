"""The page's API contract, from the real server (refactor 3): one real answer per call the page makes, recorded on a
fresh, empty Taska (never real data), and what each command handler reads. Written into web/src/api/samples.gen.ts:

- `SAMPLES`, `satisfies` the page's types (api/taska.ts `Answers`): the type check fails when the server sends a field
  the page's types do not have, or leaves out one they require;
- web/scripts/check-api.mjs fails when a type has a field no sample shows (a field the server stopped sending);
- `SERVER_READS`, each command op the server handles (`@handles`) with the fields its handler reads: the page's
  `Command` union (model/commands.ts) must have the same ops with the same fields (model/commands.test.ts).

tests/test_api_contract.py records the answers again and fails when their shapes, or the ops, differ from the file.
Regenerate after changing what the server sends, what a handler reads, or what this records:

    python3 tools/api_samples.py

The server runs as it does for you, with only what lies outside Taska fixed (as tools/demo_server.py): a fixed
clock start, a voice note's words, the organizer's answer; nothing reaches Gemini or any other service.
"""

from __future__ import annotations

import ast
import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional, Set, Tuple

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "web", "src", "api", "samples.gen.ts")
COMMANDS = os.path.join(ROOT, "server", "taska", "commands")
KEYS = ("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_APPLICATION_CREDENTIALS")
START = 1793984400  # 2026-11-06 09:00 PST: the clock's start, so the samples read alike each time
WORDS = "Sort the export by date, please."
PLAN = "new task P2 now Sort the export by date\n"
# a 1x1 PNG, for a picture's size
PNG = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cf"
                    "c0f01f0005000201a5b1d0b40000000049454e44ae426082")

SEED = """new bug P1 now Export ignores the active filter
  The export should keep the filter I set.
new task P2 later parent=$ Read the filter from the address
new feature P2 now Export to Excel
B1 doing
B1 progress Reproduced it: the export reads the list before the filter
B1 ask Which format should the export use?
  - ( ) CSV
  - ( ) Excel
B1 doc Plan
  # Plan

  First read the filter, then write the rows.

  ```mermaid
  graph TD; A-->
  ```
D1 reply ¶1 Checked the plan.
F3 doc Page
  <html><head><title>Mock</title></head><body><h1>Mock</h1><p>The export page.</p></body></html>
rules propose Keep the filter in every export
  add ## Exports
    - Keep the filter in every export.
"""


# -- what each command handler reads ---------------------------------------------------------------------------

_READS = ("get", "text", "number", "on", "has")


def server_reads() -> Dict[str, List[str]]:
    """Each op the server handles -> the fields of the command its handler reads (following the module's helpers
    that are given the command, `a`); every command also takes `src` (commands/run.py)."""
    funcs: Dict[str, ast.FunctionDef] = {}
    handlers: Dict[str, ast.FunctionDef] = {}
    for name in sorted(os.listdir(COMMANDS)):
        if not name.endswith(".py"):
            continue
        with open(os.path.join(COMMANDS, name), encoding="utf-8") as fh:
            tree = ast.parse(fh.read())
        for node in tree.body:
            if not isinstance(node, ast.FunctionDef):
                continue
            funcs.setdefault(node.name, node)
            for dec in node.decorator_list:
                if isinstance(dec, ast.Call) and getattr(dec.func, "id", "") == "handles":
                    for arg in dec.args:
                        handlers[arg.value] = node  # type: ignore[attr-defined]

    def reads(fn: ast.FunctionDef, seen: Set[str]) -> Set[str]:
        if fn.name in seen:
            return set()
        seen.add(fn.name)
        out: Set[str] = set()
        for node in ast.walk(fn):
            if not isinstance(node, ast.Call):
                continue
            f = node.func
            if isinstance(f, ast.Attribute) and isinstance(f.value, ast.Name) and f.value.id == "a":
                if f.attr in _READS:
                    if node.args and isinstance(node.args[0], ast.Constant):
                        out.add(str(node.args[0].value))
                    elif f.attr == "on":
                        out.add("on")
                elif f.attr == "thread":
                    out.add("th")
            elif isinstance(f, ast.Name) and f.id in funcs and any(isinstance(x, ast.Name) and x.id == "a" for x in node.args):
                out |= reads(funcs[f.id], seen)
        return out

    return {op: sorted(reads(fn, set()) | {"src"}) for op, fn in sorted(handlers.items())}


# -- the server, with what lies outside Taska fixed --------------------------------------------------------------

def serve(root: str, port: int) -> None:
    """Taska on `root` (a fresh folder) with a fixed clock start, fixed voice words and organizer answer."""
    for k in KEYS:
        os.environ.pop(k, None)
    real = time.time
    off = START - real()
    time.time = lambda: real() + off  # type: ignore[assignment]
    from datetime import datetime

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
        raise gemini.Failed(None, f"the samples reach no service ({url.split('?')[0]})")

    gemini.https_post = no_network  # type: ignore[assignment]
    organizer.first_plan = lambda parts, think: PLAN  # type: ignore[assignment]

    def transcriber_for(_p: Any, _workspace: Any) -> Any:
        def run(_data: bytes, _mime: str, _scope: Optional[int], _path: Optional[str], first: Any) -> Dict[str, Any]:
            first(WORDS)
            step = {"step": "pro", "model": "fixed", "text": WORDS, "secs": 0.1, "chosen": True}
            return {"tr": WORDS, "tr_by": "pro", "times": {"pro": 0.1}, "heard": WORDS, "steps": [step],
                    "doubts": [{"was": "date", "alt": "data", "why": "sounds alike", "show": ["date", "data"]}]}
        return run

    voice.transcriber_for = transcriber_for  # type: ignore[assignment]
    cli.serve(root, "127.0.0.1", port, True, "", "", "WARNING")


class SampleServer:
    """`with SampleServer() as base:` the fixed server on a free port and a fresh folder, stopped after."""

    def __enter__(self) -> str:
        s = socket.socket()
        s.bind(("127.0.0.1", 0))
        self.port = s.getsockname()[1]
        s.close()
        self.tmp = tempfile.TemporaryDirectory(prefix="taska-samples-")
        self.root = os.path.join(self.tmp.name, "data")
        env = {k: v for k, v in os.environ.items() if k not in KEYS and k != "PYTHONPATH"}
        self.log = open(os.path.join(self.tmp.name, "server.log"), "wb")
        self.proc = subprocess.Popen([sys.executable, os.path.abspath(__file__), "--serve", self.root, str(self.port)],
                                     cwd=ROOT, env=env, stdout=self.log, stderr=subprocess.STDOUT)
        base = f"http://127.0.0.1:{self.port}"
        for _ in range(200):
            if self.proc.poll() is not None:
                break
            try:
                urllib.request.urlopen(base + "/health", timeout=2).read()
                return base
            except OSError:
                time.sleep(0.05)
        self.__exit__()
        raise RuntimeError("the samples' server did not start")

    def __exit__(self, *_: Any) -> None:
        if self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(10)
            except subprocess.TimeoutExpired:
                self.proc.kill()
                self.proc.wait()
        self.log.close()
        self.tmp.cleanup()


# -- the answers --------------------------------------------------------------------------------------------------

class Calls:
    def __init__(self, base: str):
        self.base = base

    def raw(self, path: str, body: Any = None, kind: str = "application/json", headers: Optional[Dict[str, str]] = None) -> Tuple[int, bytes]:
        data = body if isinstance(body, bytes) or body is None else json.dumps(body).encode()
        req = urllib.request.Request(self.base + path, data=data, headers={"Content-Type": kind, **(headers or {})})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            return e.code, e.read()

    def json(self, path: str, body: Any = None, kind: str = "application/json", headers: Optional[Dict[str, str]] = None) -> Any:
        status, data = self.raw(path, body, kind, headers)
        if status != 200:
            raise RuntimeError(f"{path}: {status} {data[:300]!r}")
        return json.loads(data)


def _settle(c: Calls, p: str) -> Dict[str, Any]:
    """The project's view once the organizer and the voice notes are done."""
    for _ in range(200):
        view = c.json(p + "view")
        if not view["project"]["organizer"]["busy"] and all(i.get("org") or i.get("kind") or i["acked"] for i in view["inputs"]) \
                and all(v["state"] != "wait" for v in view.get("voices", [])):
            return view
        time.sleep(0.05)
    raise RuntimeError("the organizer did not finish")


def record(base: str) -> Dict[str, Any]:
    """One answer per call the page makes (api/taska.ts), named as its method."""
    c = Calls(base)
    out: Dict[str, Any] = {}
    out["createProject"] = c.json("/api/projects", {"title": "Shop"})
    slug = out["createProject"]["name"]
    other = c.json("/api/projects", {"title": "Garden"})["name"]
    p = f"/p/{slug}/api/"
    agent = lambda words, session="sample": c.raw(f"/p/{slug}/do?by=claude-code&session={session}", words.encode(), "text/plain")  # noqa: E731
    # a worker (F768): started by the session "sample", known by its app's id
    c.raw(f"/p/{slug}/do?by=claude-code&session=helper&parent=sample&sid=aaaaaaaa-1111-2222-3333-444444444444",
          b"T2 progress Looking at the address.\n", "text/plain")
    agent(SEED)
    # a web page too big for the view (B756: its sound written into it): its text comes by itself (api/doc)
    agent("T2 html\n  <html><head><title>Lecture</title></head><body><audio src='data:audio/mp3;base64," + "A" * 1_000_000 + "'></audio></body></html>\n")
    out["upload"] = c.json(p + "file?name=note.webm&transcribe=1&scope=B1", b"\x1aE\xdf\xa3 not really audio", "audio/webm")
    voice = out["upload"]
    # its final words, so the answer's shape never depends on whether the first words came early (B735: `more` is
    # sent only while a note is worked out)
    out["words"] = c.json(p + f"words?f={voice['f']}&more=1", b"")
    picture = c.json(p + "file?name=shot.png", PNG, "image/png")
    shot = c.json(p + "file?name=shot2.png", PNG, "image/png")
    logo = c.json(p + "file?name=logo.png", PNG, "image/png")
    agent(f"project icon {logo['f']}\n")  # the project's picture (F743): its rows and facts carry it
    agent(f"B1 say files={shot['f']} @helper the export as it is now\n"
          f"new task P1 now Pick the columns\nT4 ask files={shot['f']} Which columns?\n  - [ ] Date\n  - [ ] Total\n")
    c.raw(f"/p/{slug}/B1?by=claude-code&session=sample")  # an agent reads it: Read by
    page = lambda rid, *cmds: c.json(p + "commands", {"id": rid, "commands": list(cmds)})  # noqa: E731
    page("s1", {"op": "input", "text": "And the sort, please.", "scope": "B1", "q": "page-1"},
         {"op": "input", "text": "", "files": [voice], "words": {voice["f"]: WORDS}, "q": "page-2"},
         {"op": "input", "text": "Look at this", "files": [picture], "q": "page-3"},
         {"op": "input", "text": "Never mind", "kind": "cancelled", "q": "page-4"},
         {"op": "rules", "md": "## Commits\n\n- In English.", "why": "Commits"})
    page("s2", {"op": "set", "ref": "F3", "f": {"status": "open", "later_until": "2026-12-01", "rank": -5}},
         {"op": "dc", "d": 1, "para": 1, "text": "Read it from the address.", "files": [picture]},
         {"op": "dc", "d": 1, "key": "doc", "text": "Looks right.", "files": [picture]},
         {"op": "input", "text": "One more thing", "q": "page-5"})
    view = _settle(c, p)
    r = {i["q"]: i["id"] for i in view["inputs"] if i.get("q")}
    told = next(x["id"] for it in view["items"] if it["code"] == "B1" for x in it["thread"] if x["kind"] == "progress")
    # questions in a row, one of them answered (B749): the answer names it (`of`), the other still waits
    agent(f"T4 ask files={shot['f']} Anything else?\n")
    first = next(x for it in _settle(c, p)["items"] if it["code"] == "T4" for x in it["thread"] if x["kind"] == "ask")
    page("s2b", {"op": "input", "text": "- Which columns? → ✓ Date", "scope": "T4", "kind": "answer", "of": [first["id"]], "q": "page-6"})
    made = page("s3", {"op": "amend", "id": r["page-1"], "mode": "append", "text": "By date."},
                {"op": "delete", "id": r["page-5"]},
                {"op": "filing-undo", "id": r["page-3"]},
                {"op": "hide", "ref": "B1", "id": told, "on": True},
                {"op": "new", "title": "Old idea", "type": "idea"})
    view = _settle(c, p)
    agent("B1 progress Sorting by date too.\n")  # someone wrote after it: editing it leaves a note (change)
    r1 = next(i for i in view["inputs"] if i["id"] == r["page-1"])
    page("s4", {"op": "amend", "id": r1["id"], "mode": "edit", "v": r1["v"], "text": r1["text"] + " Newest first."},
         {"op": "idel", "ref": made["results"][-1].split()[1]})
    _settle(c, p)
    out["view"] = c.json(p + "view")
    cursor = out["view"]["cursor"]
    out["changes"] = c.json(p + f"changes?cursor={cursor}&wait=0")
    out["commands"] = c.json(p + f"commands?cursor={cursor}", {"id": "s5", "commands": [{"op": "set", "ref": "B1", "f": {"pri": "P0"}}]})
    out["moveInput"] = c.json(p + "move-input", {"id": r["page-2"], "to": other})
    out["moveItem"] = c.json(p + "move-item?id=s6", {"to": other, "ref": "F3"})
    out["activity"] = c.json(p + "activity?n=100")
    out["pictureSizes"] = c.json(p + "picture-sizes")
    out["diagramFailed"] = c.json(p + "diagram-failed", {"d": 1, "v": 1, "key": "x", "error": "Parse error"})
    out["pageLog"] = c.json(p + "page-log", {"list": [{"kind": "action", "msg": "sample"}]})
    out["projects"] = c.json("/api/projects")
    out["needs"] = c.json("/api/needs")
    out["find"] = c.json("/api/find?q=export&here=" + slug)
    gone = c.json("/api/projects", {"title": "Old"})["name"]
    out["renameProject"] = c.json("/api/projects/rename", {"name": gone, "title": "Older"})
    out["deleteProject"] = c.json("/api/projects/delete", {"name": gone})
    out["deletedProjects"] = c.json("/api/projects/deleted")
    out["restoreProject"] = c.json("/api/projects/restore", {"name": gone})
    c.json("/api/projects/delete", {"name": gone})
    out["purgeProject"] = c.json("/api/projects/purge", {"name": gone})
    out["orderProjects"] = c.json("/api/projects/order", {"names": [other, slug]})
    view_row = {"name": "Bugs now", "type": "bug", "when": "now", "status": "", "pri": "", "sort": ""}
    out["setViews"] = c.json("/api/views", {"views": [view_row]})
    out["views"] = c.json("/api/views")
    out["setCorrection"] = c.json("/api/corrections", {"wrong": "data", "right": "date"})
    c.json("/api/corrections", {"right": "Taska"})
    out["corrections"] = c.json("/api/corrections")
    out["setVoicePrefs"] = c.json("/api/voiceprefs", {"text": "Write it down as said."})
    out["voicePrefs"] = c.json("/api/voiceprefs")
    out["setTidy"] = c.json("/api/voicetidy", {"on": True})
    out["pushKey"] = c.json("/api/push?endpoint=")
    out["setPush"] = c.json("/api/push", {"endpoint": "https://push.invalid/x", "off": True})
    out["devDashboard"] = c.json("/dev/api/dashboard?days=7")
    out["setGemini"] = c.json("/api/gemini", {"key": ""})  # F765: forgetting a key that is not set restarts nothing
    out["newKey"] = c.json("/api/key", b"")
    key = out["newKey"]["key"]
    out["login"] = c.json("/api/login", {"key": key}, headers={"X-Forwarded-For": "203.0.113.9"})
    out["restart"] = c.json("/api/restart", {})  # the last: it stops the server
    return out


# -- shapes: what the staleness check compares ---------------------------------------------------------------------

def shape(value: Any, path: str = "", out: Optional[Set[str]] = None) -> Set[str]:
    """Every path in the value with its JSON type ("view.items[].n number"): what stays the same from one recording to
    the next, whatever the times, ids and keys."""
    out = set() if out is None else out
    if isinstance(value, dict):
        out.add(f"{path} object")
        for k, v in value.items():
            shape(v, f"{path}.{k}" if path else k, out)
    elif isinstance(value, list):
        out.add(f"{path} array")
        for v in value:
            shape(v, path + "[]", out)
    else:
        kind = "null" if value is None else "boolean" if isinstance(value, bool) else \
            "number" if isinstance(value, (int, float)) else "string"
        out.add(f"{path} {kind}")
    return out


def normalized(samples: Dict[str, Any]) -> Dict[str, Any]:
    """The samples with the names that change from one recording to the next put to fixed ones."""
    out = dict(samples)
    out["pictureSizes"] = {"shot.png": v for v in samples["pictureSizes"].values()}
    return out


def render(samples: Dict[str, Any], reads: Dict[str, List[str]], root: str = "", port: int = 0) -> str:
    text = json.dumps(normalized(samples), ensure_ascii=True, indent=1)
    if root:
        text = text.replace(root, "/tmp/taska-sample")
    if port:
        text = text.replace(f":{port}", ":7340")
    return (
        "// Generated by tools/api_samples.py from a fresh Taska: do not edit. One real answer per call the page makes,\n"
        "// `satisfies` the page's types (api/taska.ts Answers), and what each command handler reads (model/commands.ts).\n\n"
        "import type { Answers } from './taska'\n\n"
        f"export const SAMPLES = {text} satisfies {{ [K in keyof Answers]: Answers[K] }}\n\n"
        f"export const SERVER_READS = {json.dumps(reads, indent=1)} as const\n"
    )


_SAMPLES = re.compile(r"export const SAMPLES = (\{.*?\n\}) satisfies", re.S)
_READS_JSON = re.compile(r"export const SERVER_READS = (\{.*?\n\}) as const", re.S)


def written(path: str = OUT) -> Tuple[Dict[str, Any], Dict[str, List[str]]]:
    """The samples and the reads in the file as it is."""
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    a, b = _SAMPLES.search(text), _READS_JSON.search(text)
    if not a or not b:
        raise ValueError(f"{path}: not written by tools/api_samples.py")
    return json.loads(a.group(1)), json.loads(b.group(1))


def main() -> None:
    if sys.argv[1:2] == ["--serve"]:
        serve(sys.argv[2], int(sys.argv[3]))
        return
    server = SampleServer()
    base = server.__enter__()
    try:
        samples = record(base)
        text = render(samples, server_reads(), server.root, server.port)
    finally:
        server.__exit__()
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(text)
    print("wrote", os.path.relpath(OUT, ROOT))


if __name__ == "__main__":
    main()
