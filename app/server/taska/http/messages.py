"""Requests and answers as plain values, so routes are functions from one to the other and can be tested alone."""

from __future__ import annotations

import gzip
import hashlib
import ipaddress
import json
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Protocol
from urllib.parse import parse_qs, unquote, urlsplit

Query = Dict[str, List[str]]
ZIPPED = ("text/html", "application/json", "text/plain", "text/javascript", "text/css", "image/svg+xml",
          "application/manifest+json")


class Headers(Protocol):
    """A request's headers: looked up by name, any case."""

    def get(self, name: str, /) -> Optional[str]: ...


class TooLarge(Exception):
    """A body over the size a route takes."""


@dataclass
class Request:
    method: str
    raw_path: str  # as sent: path and query, %-encoded
    headers: Headers
    client_ip: str
    read_body: Callable[[int], bytes] = field(repr=False, default=lambda limit: b"")
    prefix: str = ""  # "/k/<key>" when the key came in the path (answers name addresses with it)

    def __post_init__(self) -> None:
        self._body: Optional[bytes] = None

    def header(self, name: str) -> str:
        return self.headers.get(name) or ""

    @property
    def target(self) -> str:
        """The path and query with UTF-8 read back (curl sends raw UTF-8, which the server reads as latin-1)."""
        return self.raw_path.encode("latin-1", "replace").decode("utf-8", "replace")

    @property
    def path(self) -> str:
        return unquote(urlsplit(self.target).path)

    @property
    def query(self) -> Query:
        return parse_qs(urlsplit(self.target).query)

    def arg(self, name: str, default: str = "") -> str:
        return (self.query.get(name) or [default])[0]

    def body(self, limit: int) -> bytes:
        if self._body is None:
            self._body = self.read_body(limit)
        return self._body

    def json_body(self, limit: int) -> Any:
        return json.loads(self.body(limit) or b"{}")

    def host(self) -> str:
        """The address the caller used: behind a tunnel, the public https one."""
        h = self.header("X-Forwarded-Host") or self.header("Host") or "localhost"
        proto = self.header("X-Forwarded-Proto") or "http"
        return f"{proto.split(',')[0].strip()}://{h.split(',')[0].strip()}"

    @property
    def forwarded(self) -> bool:
        return bool(self.header("X-Forwarded-For") or self.header("X-Forwarded-Host"))

    def trusted(self) -> bool:
        """This machine or its local network. Anything forwarded by a tunnel is not."""
        if self.forwarded:
            return False
        ip: Any = ipaddress.ip_address(self.client_ip)
        ip = getattr(ip, "ipv4_mapped", None) or ip
        return bool(ip.is_loopback or ip.is_private or ip.is_link_local)

    def on_this_machine(self) -> bool:
        return self.client_ip in ("127.0.0.1", "::1") and not self.forwarded

    def wants_page(self) -> bool:
        """A person's browser opening an address, as opposed to an agent's curl: the same /p/x/B03 shows the page
        to one and the item's text to the other."""
        accept, ua = self.header("Accept"), self.header("User-Agent")
        return self.header("Sec-Fetch-Mode") == "navigate" or ("text/html" in accept and "Mozilla" in ua)

    def session(self) -> str:
        """The session an agent names (session=..., or the X-Taska-Session header)."""
        return self.arg("session") or self.header("X-Taska-Session")

    def via(self) -> str:
        return "tunnel" if self.header("X-Forwarded-Host") else "local"


@dataclass
class Response:
    status: int
    body: bytes = b""
    content_type: str = "text/plain; charset=utf-8"
    headers: Dict[str, str] = field(default_factory=dict)
    cache: Optional[str] = None  # None: no-store (an HTML page: no-cache with an ETag)
    after: Optional[Callable[[], None]] = None  # work to do once the answer is sent

    def encoded(self, req: Request) -> "Response":
        """The answer as it goes out: gzip for big text, an ETag for the page."""
        status, body, cache = self.status, self.body, self.cache
        headers: Dict[str, str] = {}
        if cache is None:
            cache = "no-store"
            if status == 200 and self.content_type.startswith("text/html") and req.method == "GET":
                tag = '"' + hashlib.md5(body).hexdigest() + '"'  # the same page for every project: not sent twice
                cache = "no-cache"
                headers["ETag"] = tag
                if req.header("If-None-Match") == tag:
                    status, body = 304, b""
        if len(body) > 2048 and "gzip" in req.header("Accept-Encoding") and self.content_type.split(";")[0] in ZIPPED:
            body = gzip.compress(body, compresslevel=5)
            headers["Content-Encoding"] = "gzip"
            headers["Vary"] = "Accept-Encoding"
        out = {"Content-Type": self.content_type, "Content-Length": str(len(body)), "Cache-Control": cache}
        if "ETag" in headers:
            out["ETag"] = headers.pop("ETag")
        out.update(headers)
        out["X-Content-Type-Options"] = "nosniff"
        out.update(self.headers)
        return Response(status, body, self.content_type, out, cache, self.after)


def text(status: int, body: str, content_type: str = "text/plain; charset=utf-8", **kw: Any) -> Response:
    return Response(status, body.encode("utf-8"), content_type, **kw)


def as_json(obj: Any, status: int = 200, headers: Optional[Dict[str, str]] = None) -> Response:
    return Response(status, json.dumps(obj, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8",
                    headers=dict(headers or {}))


def redirect(to: str, headers: Optional[Dict[str, str]] = None, status: int = 302) -> Response:
    return Response(status, b"", headers=dict(headers or {}, Location=to))


NOT_FOUND = "not found\n"
