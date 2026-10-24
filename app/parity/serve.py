"""The parity page: the reports of the comparison runs, the tool's own check, and old and new side by side.

    python3 app/parity/serve.py [--port 7355]          http://127.0.0.1:7355/

Standard library only. It only reads app/parity/out (the runs) and serves the viewer; it starts nothing.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, List

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
VIEWER = os.path.join(HERE, "viewer")
TW = os.path.join(HERE, "node_modules", "@tailwindcss", "browser", "dist", "index.global.js")


def runs() -> List[Dict[str, Any]]:
    out = []
    for d in sorted(os.listdir(OUT)) if os.path.isdir(OUT) else []:
        f = os.path.join(OUT, d, "report.json")
        if not os.path.isfile(f):
            continue
        try:
            with open(f, encoding="utf-8") as fh:
                r = json.load(fh)
        except (OSError, ValueError):
            continue
        results = r.get("results", [])
        bad = [x for x in results if x.get("error") or not (x.get("data") or {}).get("same", True)
               or (x.get("speed") or {}).get("slow") or any(not s.get("same") for s in x.get("steps", []))]
        out.append({"id": r.get("run", d), "a": r.get("a"), "b": r.get("b"), "started": r.get("started"),
                    "finished": r.get("finished"), "results": len(results), "bad": len(bad),
                    "steps": sum(len(x.get("steps", [])) for x in results)})
    return sorted(out, key=lambda x: x.get("started") or "", reverse=True)


class H(BaseHTTPRequestHandler):
    def log_message(self, *a: Any) -> None:
        pass

    def send_file(self, path: str, ctype: str = "") -> None:
        real = os.path.realpath(path)
        if not (real.startswith(os.path.realpath(HERE) + os.sep) and os.path.isfile(real)):
            return self.send_text(404, "not found")
        with open(real, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype or mimetypes.guess_type(real)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(data)

    def send_text(self, code: int, text: str, ctype: str = "text/plain; charset=utf-8") -> None:
        data = text.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:
        p = urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)
        if p == "/health":
            return self.send_text(200, "ok\n")
        if p == "/api/runs":
            return self.send_text(200, json.dumps(runs(), ensure_ascii=False), "application/json")
        if p == "/api/selftest":
            f = os.path.join(OUT, "selftest", "summary.json")
            return self.send_file(f, "application/json") if os.path.isfile(f) else self.send_text(200, "{}", "application/json")
        if p == "/api/findings":
            return self.send_file(os.path.join(HERE, "findings.md"), "text/plain; charset=utf-8")
        if p == "/tw.js":
            return self.send_file(TW, "text/javascript")
        if p.startswith("/out/"):
            return self.send_file(os.path.join(OUT, p[len("/out/"):]))
        if p in ("/", "/index.html"):
            return self.send_file(os.path.join(VIEWER, "index.html"), "text/html; charset=utf-8")
        return self.send_file(os.path.join(VIEWER, p.lstrip("/")))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=7355)
    a = ap.parse_args()
    srv = ThreadingHTTPServer(("127.0.0.1", a.port), H)
    print(f"parity page: http://127.0.0.1:{a.port}/", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
