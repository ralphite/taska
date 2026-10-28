"""The HTTP server (the standard library's, one thread per request): it turns each request into a `Request`, asks
the application for the answer and writes it. A request whose handling breaks gets no answer (the connection
closes), and the error goes to the log."""

from __future__ import annotations

import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Tuple

from ..domain.vocab import Refused
from ..infra.logs import log
from .app import AppContext, dispatch
from .messages import Request, Response


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "Taska"

    @property
    def app(self) -> AppContext:
        assert isinstance(self.server, Server)
        return self.server.app

    def log_message(self, format: str, *args: Any) -> None:
        pass

    def _read_body(self, limit: int) -> bytes:
        if "chunked" in (self.headers.get("Transfer-Encoding") or "").lower():
            data = b""
            while True:
                size = int(self.rfile.readline().split(b";")[0].strip() or b"0", 16)
                if size == 0:
                    self.rfile.readline()
                    break
                data += self.rfile.read(size)
                self.rfile.readline()
                if len(data) > limit:
                    raise Refused("body too large")
            return data
        n = int(self.headers.get("Content-Length") or 0)
        if n > limit:
            raise Refused("body too large")
        return self.rfile.read(n)

    def _answer(self) -> None:
        t0 = time.monotonic()
        req = Request(method=self.command, raw_path=self.path, headers=self.headers, client_ip=self.client_address[0],
                      read_body=self._read_body)
        self.app.status.reset_lock_wait()
        status = 0
        try:
            answer = dispatch(self.app, req)
            if answer is None:
                self.close_connection = True
                return
            out = answer.encoded(req)
            status = out.status
            self._write(out, req.method)
            if answer.after:
                answer.after()
        finally:
            self.app.note_request(req, status, int((time.monotonic() - t0) * 1000))

    def _write(self, out: Response, method: str) -> None:
        try:
            self.send_response(out.status)
            for k, v in out.headers.items():
                self.send_header(k, v)
            self.end_headers()
            if method != "HEAD":
                self.wfile.write(out.body)
        except (BrokenPipeError, ConnectionResetError):  # the caller left before the answer; what was done stays done
            self.close_connection = True

    def do_GET(self) -> None:
        self._answer()

    def do_HEAD(self) -> None:
        self._answer()

    def do_POST(self) -> None:
        self._answer()


class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, addr: Tuple[str, int], app: AppContext):
        super().__init__(addr, Handler)
        self.app = app

    def handle_error(self, request: Any, client_address: Any) -> None:
        """A browser that went away first is not an error; anything else is, with its traceback."""
        ex = sys.exc_info()[1]
        if isinstance(ex, (ConnectionResetError, BrokenPipeError, ConnectionAbortedError, TimeoutError)):
            return
        log.error(f"request from {client_address[0]} failed", exc_info=True, extra={"f": {"source": "server", "kind": "error"}})

    def drain(self, wait: float = 60) -> None:
        """Stop taking requests, then give the work at hand up to `wait` seconds: requests being answered and voice
        notes being worked out. A restart must not cut a transcription."""
        self.socket.close()
        end = time.time() + wait
        status = self.app.status

        def transcribing() -> int:
            return sum(p.voice.busy() for p in list(self.app.workspace.projects.values()))

        if status.busy or transcribing():
            print(f"taska: stopping after the work at hand: {status.busy} request(s), {transcribing()} transcription(s)", flush=True)
        with status.idle:
            while (status.busy or transcribing()) and time.time() < end:
                status.idle.wait(min(0.25, max(0.01, end - time.time())))
