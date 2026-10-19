"""Behaviour capture for Taska's HTTP interface (the agent API and the page's JSON API).

A scenario is a list of requests. `run_scenario` starts a Taska server on a fresh data root in a temporary
folder, sends the requests in order and returns every answer, normalized so that answers from two different
servers (the old one-file taska.py and v2) can be compared: times, paths of the temporary folder, revision
counters and random keys are replaced by placeholders.

The answers of the old app are kept as golden files (tests/golden/<scenario>.json); v2 must give the same.
Nothing here touches ~/.taska: every server gets its own empty folder.
"""

from __future__ import annotations

import http.client
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from typing import Any, Callable, Dict, List, Optional, Tuple

HERE = os.path.dirname(os.path.abspath(__file__))
V2 = os.path.dirname(HERE)
KEY_VARS = ("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY")

Step = Dict[str, Any]
Answer = Dict[str, Any]


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


def server_cmd(kind: str, port: int, root: str) -> List[str]:
    """kind: "v2", or a path to an old taska.py."""
    if kind == "v2":
        return [sys.executable, "-m", "taska", "--port", str(port), "--root", root, "--organizer", "off"]
    return [sys.executable, kind, "--port", str(port), "--root", root, "--organizer", "off"]


class Server:
    def __init__(self, kind: str, root: Optional[str] = None, prepare: Optional[Callable[[str], None]] = None):
        self.kind = kind
        self.tmp = tempfile.mkdtemp(prefix="taska-capture-")
        self.root = root or os.path.join(self.tmp, "data")
        os.makedirs(self.root, exist_ok=True)
        if prepare:
            prepare(self.root)
        self.port = free_port()
        env = {k: v for k, v in os.environ.items() if k not in KEY_VARS}
        env["PYTHONPATH"] = os.path.join(V2, "server")
        env["TZ"] = "America/Los_Angeles"
        self.log = open(os.path.join(self.tmp, "server.log"), "w")
        self.proc = subprocess.Popen(server_cmd(kind, self.port, self.root), env=env, stdout=self.log, stderr=subprocess.STDOUT,
                                     cwd=self.tmp)
        self.base = f"http://127.0.0.1:{self.port}"
        for _ in range(200):
            try:
                with urllib.request.urlopen(self.base + "/health", timeout=1) as r:
                    if r.status == 200:
                        return
            except (OSError, urllib.error.URLError):
                time.sleep(0.05)
        raise RuntimeError(f"server {kind} did not start: " + open(os.path.join(self.tmp, "server.log")).read())

    def call(self, method: str, path: str, body: Any = None, headers: Optional[Dict[str, str]] = None) -> Tuple[int, str, str]:
        data: Optional[bytes] = None
        h = dict(headers or {})
        if isinstance(body, (dict, list)):
            data = json.dumps(body).encode()
            h.setdefault("Content-Type", "application/json")
        elif isinstance(body, str):
            data = body.encode()
        elif isinstance(body, bytes):
            data = body
        if method == "POST" and data is None:
            data = b""
        req = urllib.request.Request(self.base + path, data=data, method=method, headers=h)
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.status, r.headers.get("Content-Type", ""), r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as ex:
            return ex.code, ex.headers.get("Content-Type", ""), ex.read().decode("utf-8", "replace")

    def stop(self) -> None:
        self.proc.terminate()
        try:
            self.proc.wait(10)
        except subprocess.TimeoutExpired:
            self.proc.kill()
        self.log.close()
        shutil.rmtree(self.tmp, ignore_errors=True)


ISO = re.compile(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:[+-]\d\d:\d\d|Z)?")
HM = re.compile(r"\b\d\d-\d\d \d\d:\d\d\b")
TIME_KEYS = {"t", "t0", "t1", "at", "edited", "updated", "deleted_at"}
VOLATILE = {"rev": "<rev>", "boot": "<boot>", "pv": "<pv>", "ver": "<ver>", "key": "<key>", "ms": "<ms>"}


def norm_text(s: str, root: str) -> str:
    for r in sorted({root, os.path.realpath(root), "~" + root[len(os.path.expanduser("~")):] if root.startswith(os.path.expanduser("~")) else root},
                    key=len, reverse=True):
        s = s.replace(r, "<ROOT>")
    s = re.sub(r"/k/[a-z0-9]{4}-[a-z0-9]{4}", "/k/<key>", s)
    s = re.sub(r"\btaska_key=[a-z0-9-]+", "taska_key=<key>", s)
    s = ISO.sub("<iso>", s)
    s = HM.sub("<hm>", s)
    s = re.sub(r"\brev \d+", "rev <rev>", s)
    s = re.sub(r"127\.0\.0\.1:\d+", "<host>", s)
    s = re.sub(r"\bp-[abcdefghjkmnpqrstuvwxyz23456789]{4}\b", "p-<rand>", s)  # a project named without a-z or 0-9
    return s


def norm_json(x: Any, root: str, key: str = "") -> Any:
    if isinstance(x, dict):
        out = {}
        for k, v in x.items():
            if k in VOLATILE and not isinstance(v, (dict, list)):
                out[k] = VOLATILE[k]
            elif k == "file" and isinstance(v, str) and v.endswith((".jsonl", ".db")):
                out[k] = "<store>"
            elif (k == "t" and key == "agents" or key == "read") and isinstance(v, (int, float)):
                out[k] = "<ms>"
            else:
                out[k] = norm_json(v, root, k)
        return out
    if isinstance(x, list):
        return [norm_json(v, root, key) for v in x]
    if isinstance(x, str):
        return norm_text(x, root)
    if isinstance(x, (int, float)) and key in ("t", "read") and x > 1e12:
        return "<ms>"
    return x


def answer(srv: Server, step: Step) -> Answer:
    name = step.get("name") or f"{step.get('m', 'GET')} {step['p']}"
    try:
        code, ctype, body = srv.call(step.get("m", "GET"), step["p"], step.get("body"), step.get("h"))
    except (OSError, http.client.HTTPException) as ex:  # the server dropped the connection: a crash in the handler
        return {"name": name, "status": 0, "text": f"no answer: {type(ex).__name__}"}
    out: Answer = {"name": name, "status": code}
    if "json" in ctype:
        try:
            out["json"] = norm_json(json.loads(body), srv.root)
        except ValueError:
            out["text"] = norm_text(body, srv.root)
    elif "html" in ctype:
        out["html"] = True  # pages differ by design; only that a page is sent counts
    else:
        out["text"] = norm_text(body, srv.root)
    for k in step.get("drop", ()):  # parts of a JSON answer that differ by design
        out.get("json", {}).pop(k, None)
    if step.get("pick") and isinstance(out.get("json"), dict):
        out["json"] = out["json"].get(step["pick"])
    return out


def run_scenario(kind: str, steps: List[Step], prepare: Optional[Callable[[str], None]] = None) -> List[Answer]:
    srv = Server(kind, prepare=prepare)
    try:
        out: List[Answer] = []
        for st in steps:
            if st.get("sleep"):
                time.sleep(st["sleep"])
                continue
            out.append(answer(srv, st))
        return out
    finally:
        srv.stop()
