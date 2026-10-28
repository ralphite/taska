"""Who may come in. This machine and its network come straight in; through a tunnel or from the internet the key is
needed: a cookie (browsers), or /k/<key>/ in front of the path (agents, and the link that opens Taska on a phone).
Other websites' scripts and forms are refused; opening Taska from another page is just a visit.
"""

from __future__ import annotations

import hmac
import json
import re
import time
from typing import Callable, Union
from urllib.parse import parse_qs, quote

from ..domain.text import plain_key
from .messages import Request, Response, as_json, redirect, text

_KEY_PATH = re.compile(r"/k/([A-Za-z0-9-]+)(/.*)?")
LOGIN_PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark"><title>Taska</title></head><body>
<form method="post" action="/login"><h1>Taska</h1><p>{wrong}Enter the key. On your computer it is in Taska's menu under <b>Use on your phone</b>.</p>
<input type="hidden" name="next" value="{next}"><input name="key" required autofocus autocapitalize="none" autocorrect="off" autocomplete="off" placeholder="xxxx-xxxx">
<button>Open Taska</button></form></body></html>
"""


def login_page(next_: str, wrong: str) -> Response:
    html = LOGIN_PAGE.replace("{next}", quote(next_, safe="/?=&-_.")).replace("{wrong}", wrong)
    return text(401, html, "text/html; charset=utf-8", cache="no-store")


class Access:
    def __init__(self, key: Callable[[], str], is_public: Callable[[str], bool]):
        self._key = key
        self._public = is_public

    def cookie(self, req: Request) -> dict:
        secure = "; Secure" if req.host().startswith("https:") else ""
        return {"Set-Cookie": f"taska_key={self._key()}; Path=/; Max-Age=34560000; HttpOnly; SameSite=Lax{secure}"}

    def _right(self, given: str) -> bool:
        return hmac.compare_digest(plain_key(given), plain_key(self._key()))

    def check(self, req: Request) -> Union[Request, Response]:
        """The request to answer (with the key taken out of its path), or the answer that turns it away."""
        visit = req.method in ("GET", "HEAD") and req.header("Sec-Fetch-Mode") == "navigate" \
            and req.headers.get("Sec-Fetch-Dest") in ("document", None)
        if req.header("Sec-Fetch-Site") == "cross-site" and not visit:
            return text(403, "cross-site request refused\n")
        req.prefix = ""
        if req.trusted():
            return req
        bare = req.raw_path.split("?")[0]
        if req.method in ("GET", "HEAD") and self._public(bare):  # the page's own files hold no data
            return req
        m = _KEY_PATH.fullmatch(bare)
        if m:
            given = m.group(1)
            req.raw_path = (m.group(2) or "/") + (req.raw_path[len(m.group(0)):] or "")
        else:
            given = next((c.split("=", 1)[1] for c in req.header("Cookie").split("; ") if c.startswith("taska_key=")), "")
        if not self._right(given):
            path = req.raw_path
            if req.method == "POST" and path == "/login":
                return self.login(req)
            if req.method == "POST" and path == "/api/login":
                return self.api_login(req)
            if "/api/" in path.split("?")[0]:  # the page's own requests: it shows its sign-in, it keeps its place
                return Response(401, (json.dumps({"error": "key", "login": True}) + "\n").encode(), "application/json")
            if req.header("Sec-Fetch-Mode") == "navigate" or "text/html" in req.header("Accept"):
                return login_page(path, "")
            return text(401, "Taska: this address needs the key. Ask the user for Taska's connect command (it carries the key).\n")
        req.prefix = f"/k/{self._key()}"
        if m and req.method == "GET" and req.header("Sec-Fetch-Mode") == "navigate":
            return redirect(req.raw_path, self.cookie(req))  # the phone link: remember the key, drop it from the address
        return req

    def login(self, req: Request) -> Response:
        form = parse_qs(req.body(10_000).decode("utf-8", "replace"))
        nxt = (form.get("next") or ["/"])[0]
        nxt = nxt if nxt.startswith("/") and not nxt.startswith("//") else "/"
        if self._right((form.get("key") or [""])[0]):
            return Response(303, b"", headers=dict(self.cookie(req), Location=nxt))
        time.sleep(1)  # slows guessing
        return login_page(nxt, "That key is not right. ")

    def api_login(self, req: Request) -> Response:
        try:
            key = str(json.loads(req.body(10_000) or b"{}").get("key") or "")
        except ValueError:
            key = ""
        if self._right(key):
            return Response(200, (json.dumps({"ok": True}) + "\n").encode(), "application/json", headers=self.cookie(req))
        time.sleep(1)
        return Response(401, (json.dumps({"ok": False, "error": "That key is not right."}) + "\n").encode(), "application/json")


def key_answer(req: Request, access: Access, key: str) -> Response:
    """A new key: this device keeps working (it gets the cookie when it came from outside)."""
    return as_json({"ok": True, "key": key}, headers={} if req.trusted() else access.cookie(req))
