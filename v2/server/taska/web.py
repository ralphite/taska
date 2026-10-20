"""The HTTP server: the agent interface (plain text), the page's JSON API, the files, and the page itself.

The same address answers a person and an agent differently (T102): /p/x/B03 opens the page in a browser and gives
the item's card to curl. Requests from this machine and its network come straight in; through a tunnel they need
the key (a cookie, or /k/<key>/ in front of the path).
"""

from __future__ import annotations

import contextlib
import gzip
import hashlib
import hmac
import ipaddress
import json
import mimetypes
import os
import signal
import re
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import TYPE_CHECKING, Any, Callable, Dict, Generator, List, Optional, Tuple
from urllib.parse import SplitResult, parse_qs, quote, unquote, urlsplit

from . import assets, views
from .core import MAX_FILE, MAX_TEXT, PEOPLE, Err, plain_key
from .dsl import parse_dsl
from .guide import AGENT, CONNECT, GRAMMAR, SKILL
from .voice import voice_answer, voice_mime

if TYPE_CHECKING:
    from .hub import Hub
    from .store import Store

ITEM_PATH = re.compile(r"/([A-Za-z]?\d+)")
VIEW_PATH = re.compile(r"/(inputs|archive|rules|new-rule|new|settings|agents|connect|phone|notifications|spellings|log|deleted|docs|about|projects|organizer|[A-Za-z]\d+)")  # the page's views (T102, B162)
Query = Dict[str, List[str]]


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "Taska"
    prefix = ""

    @property
    def srv(self) -> "Server":
        assert isinstance(self.server, Server)
        return self.server

    @property
    def hub(self) -> "Hub":
        return self.srv.hub

    def log_message(self, format: str, *args: Any) -> None:
        pass

    def send(self, code: int, body: Any, ctype: str = "text/plain; charset=utf-8", extra: Optional[Dict[str, str]] = None,
             cache: Optional[str] = None) -> None:
        if isinstance(body, str):
            body = body.encode("utf-8")
        tag: Optional[str] = None
        if cache is None:
            cache = "no-store"
            if code == 200 and ctype.startswith("text/html") and self.command == "GET":  # B292: the page is the same for every project: asked again, it is not sent again
                tag = '"' + hashlib.md5(body).hexdigest() + '"'
                cache = "no-cache"
                if self.headers.get("If-None-Match") == tag:
                    code, body = 304, b""
        zipped = len(body) > 2048 and "gzip" in (self.headers.get("Accept-Encoding") or "") and ctype.split(";")[0] in (
            "text/html", "application/json", "text/plain", "text/javascript", "text/css", "image/svg+xml", "application/manifest+json")
        if zipped:  # B292: a project's state is 1-2 MB of text: a third of it over the tunnel
            body = gzip.compress(body, compresslevel=5)
        try:
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", cache)
            if tag:
                self.send_header("ETag", tag)
            if zipped:
                self.send_header("Content-Encoding", "gzip")
                self.send_header("Vary", "Accept-Encoding")
            self.send_header("X-Content-Type-Options", "nosniff")
            for k, v in (extra or {}).items():
                self.send_header(k, v)
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):  # the caller left before the answer; what was done stays done
            self.close_connection = True

    def json(self, obj: Any, code: int = 200) -> None:
        self.send(code, json.dumps(obj, ensure_ascii=False), "application/json; charset=utf-8")

    def redirect(self, to: str, extra: Optional[Dict[str, str]] = None) -> None:
        self.send(302, "", extra=dict(extra or {}, Location=to))

    def guard(self) -> bool:
        """This machine and its network come straight in. Through a tunnel or from the internet you need the key:
        a cookie (browsers), or /k/<key>/ in front of the path (agents, and the link that opens Taska on a phone)."""
        # Other websites' scripts and forms are refused. Opening Taska from another page (Local Hub at
        # localhost:7331 is another site to 127.0.0.1:7340) is just a visit, so a plain page load is fine.
        visit = self.command in ("GET", "HEAD") and self.headers.get("Sec-Fetch-Mode") == "navigate" \
            and self.headers.get("Sec-Fetch-Dest") in ("document", None)
        if self.headers.get("Sec-Fetch-Site") == "cross-site" and not visit:
            self.send(403, "cross-site request refused\n")
            return False
        self.prefix = ""
        if self.trusted():
            return True
        if self.command in ("GET", "HEAD") and assets.public(self.path.split("?")[0]):  # F192: the page's own files hold no data
            return True
        m = re.fullmatch(r"/k/([A-Za-z0-9-]+)(/.*)?", self.path.split("?")[0])
        if m:
            given, self.path = m.group(1), (m.group(2) or "/") + (self.path[len(m.group(0)):] or "")
        else:
            given = next((c.split("=", 1)[1] for c in (self.headers.get("Cookie") or "").split("; ") if c.startswith("taska_key=")), "")
        if not hmac.compare_digest(plain_key(given), plain_key(self.hub.key)):
            if self.command == "POST" and self.path == "/login":
                return self.login()
            if "navigate" == self.headers.get("Sec-Fetch-Mode") or "text/html" in (self.headers.get("Accept") or ""):
                self.send(401, assets.login(quote(self.path, safe="/?=&-_."), ""), "text/html; charset=utf-8", cache="no-store")
            else:
                self.send(401, "Taska: this address needs the key. Ask the user for Taska's connect command (it carries the key).\n")
            return False
        self.prefix = f"/k/{self.hub.key}"
        if m and self.command == "GET" and self.headers.get("Sec-Fetch-Mode") == "navigate":
            self.redirect(self.path, self.cookie())  # the phone link: remember the key, then drop it from the address bar
            return False
        return True

    def trusted(self) -> bool:
        """This machine or its local network (F27). Anything forwarded by a tunnel is not."""
        if self.headers.get("X-Forwarded-For") or self.headers.get("X-Forwarded-Host"):
            return False
        ip: Any = ipaddress.ip_address(self.client_address[0])
        ip = getattr(ip, "ipv4_mapped", None) or ip
        return bool(ip.is_loopback or ip.is_private or ip.is_link_local)

    def cookie(self) -> Dict[str, str]:
        secure = "; Secure" if self.host().startswith("https:") else ""
        return {"Set-Cookie": f"taska_key={self.hub.key}; Path=/; Max-Age=34560000; HttpOnly; SameSite=Lax{secure}"}

    def login(self) -> bool:
        form = parse_qs(self.body(10_000).decode("utf-8", "replace"))
        nxt = (form.get("next") or ["/"])[0]
        nxt = nxt if nxt.startswith("/") and not nxt.startswith("//") else "/"
        if hmac.compare_digest(plain_key((form.get("key") or [""])[0]), plain_key(self.hub.key)):
            self.send(303, "", extra=dict(self.cookie(), Location=nxt))
        else:
            time.sleep(1)  # slows guessing; the key has ~79 bits anyway
            self.send(401, assets.login(quote(nxt, safe="/?=&-_."), "That key is not right. "), "text/html; charset=utf-8", cache="no-store")
        return False

    def body(self, limit: int) -> bytes:
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
                    raise Err("body too large")
            return data
        n = int(self.headers.get("Content-Length") or 0)
        if n > limit:
            raise Err("body too large")
        return self.rfile.read(n)

    def url(self) -> SplitResult:
        # http.server decodes the request line as latin-1; curl sends raw UTF-8 (e.g. ?q= with Chinese words)
        return urlsplit(self.path.encode("latin-1", "replace").decode("utf-8", "replace"))

    def host(self) -> str:
        """The address the caller used. Behind a tunnel (VS Code, Cloudflare...) that is the public https one."""
        h = self.headers.get("X-Forwarded-Host") or self.headers.get("Host") or "localhost"
        proto = self.headers.get("X-Forwarded-Proto") or "http"
        return f"{proto.split(',')[0].strip()}://{h.split(',')[0].strip()}"

    def local(self) -> bool:
        """A caller on this machine, not one coming in through a tunnel."""
        return (self.client_address[0] in ("127.0.0.1", "::1") and not self.headers.get("X-Forwarded-For")
                and not self.headers.get("X-Forwarded-Host"))

    def project(self, p: str) -> Tuple["Store", str, str]:
        """/p/<name>/x is that project. Bare paths (/next, /B03 ...) work while there is only one project."""
        hub = self.hub
        m = re.fullmatch(r"/p/([a-z0-9][a-z0-9-]*)(/.*)?", p)
        if m:
            s = hub.projects.get(m.group(1))
            if not s and os.path.isdir(os.path.join(hub.trash, m.group(1))):  # F173: agents asking for work hear why there is none
                raise Err(f"project {m.group(1)} was deleted: there is no work here. The user can restore it in Taska (Settings › Projects).")
            if not s:
                raise Err(f"no project {m.group(1)}. Projects: {', '.join(sorted(hub.projects))}")
            return s, m.group(2) or "", f"{self.host()}{self.prefix}/p/{s.name}"
        if len(hub.projects) == 1:
            s = next(iter(hub.projects.values()))
            return s, p, f"{self.host()}{self.prefix}/p/{s.name}"
        raise Err("which project? Use one of: " + "  ".join(f"{self.host()}/p/{n}" for n in sorted(hub.projects)))

    def scope_of(self, s: "Store", q: Query) -> Optional[int]:
        """The item a voice note is about (?scope=B03): its words are spelled like that item's."""
        try:
            return s.item(q["scope"][0], follow=False)["n"] if q.get("scope") else None
        except Err:
            return None

    def fileref(self, s: "Store") -> Callable[[str], str]:
        """Files as local paths for an agent on this machine, as URLs for one elsewhere."""
        if self.local():
            return lambda fid: os.path.join(s.fdir, fid)
        base = f"{self.host()}{self.prefix}/p/{s.name}/f/"
        return lambda fid: base + quote(fid)

    def page(self) -> None:
        """The page itself (the built React app): one HTML file for every view of every project."""
        html = assets.index()
        if html is None:
            return self.send(503, "Taska: the page is not built. Run `npm run build` in v2/web (or use the released taska.pyz).\n")
        self.send(200, html, "text/html; charset=utf-8", extra={"X-Taska-Page": "1"})  # T293: the service worker may keep it

    def do_HEAD(self) -> None:
        self.do_GET()

    # F334: a request that takes more than a second is told in the log (what waits on purpose is left out: the long
    # polls, an agent's /next?wait, a voice note's words), with how long it waited for the project's lock, if it did
    WAITS = re.compile(r"/api/(poll|transcript)|[?&]wait=")

    def do_GET(self) -> None:
        self.timed(self._get)

    def do_POST(self) -> None:
        self.timed(self._post)

    def timed(self, fn: Callable[[], None]) -> None:
        t0, self.lock_ms = time.monotonic(), 0
        try:
            fn()
        finally:
            ms = int((time.monotonic() - t0) * 1000)
            path = re.sub(r"/k/[^/?]+", "/k/…", re.sub(r"([?&]key=)[^&]*", r"\1…", self.path))
            if ms > 1000 and not self.WAITS.search(path):
                lock = f", {self.lock_ms} ms of it waiting for the project" if self.lock_ms > 100 else ""
                print(f"[slow] {time.strftime('%Y-%m-%d %H:%M:%S')} {self.command} {path[:160]} {ms} ms{lock}", file=sys.stderr, flush=True)

    def _get(self) -> None:
        if not self.guard():
            return
        u = self.url()
        q, p = parse_qs(u.query), unquote(u.path)
        hub = self.hub
        try:
            if p == "/":  # the front door (Local Hub links here): every project
                return self.page()
            static = assets.static(p)  # the page's scripts, styles, icons, service worker, manifest
            if static is not None:
                data, ctype, cache = static
                return self.send(200, data, ctype, cache=cache)
            if p == "/health":
                return self.json({"status": "ok", "app": "taska", "projects": len(hub.projects)})
            if p == "/api/idle":  # R328: how long since you last did something here, for a deploy to wait for
                return self.json({"idle": int(time.time() - self.srv.last_user), "update": self.srv.update_ready()})
            if p == "/skill":
                return self.send(200, SKILL, "text/markdown; charset=utf-8")
            if p == "/api/projects":
                return self.json(hub.summary())
            if p == "/api/needs":  # F193: what needs you, in every project
                return self.json(hub.needs())
            if p == "/api/search":  # F196: the same words in the other projects
                return self.json(hub.search((q.get("q") or [""])[0], (q.get("skip") or [""])[0]))
            if p == "/api/projects/deleted":  # F173: what Settings > Projects can restore
                return self.json(hub.deleted())
            if p == "/api/corrections":
                return self.json(hub.corrections())
            if p == "/api/views":  # F320
                return self.json(hub.get_views())
            if p == "/api/voiceprefs":  # F183
                return self.json(dict(hub.voice_prefs(), tidy=hub.tidy_on()))
            if p == "/api/push":  # F195: the key a phone subscribes with, and whether this subscription is on
                return self.json({"key": hub.push.public, "on": hub.push.has((q.get("endpoint") or [""])[0])})
            gone = re.fullmatch(r"/p/([a-z0-9][a-z0-9-]*)(/.*)?", p)
            if gone and gone.group(1) not in hub.projects and "text/html" in (self.headers.get("Accept") or ""):  # B287: a person opening a project that is gone lands on the home page, which says so
                return self.redirect("/?gone=" + gone.group(1) if os.path.isdir(os.path.join(hub.trash, gone.group(1))) else "/")
            s, sub, base = self.project(p)
            if sub == "":
                return self.redirect(p + "/")
            self.get(s, sub, q, base)
        except Err as ex:
            self.send(404, f"{ex}\n")

    def wants_page(self) -> bool:
        """A person's browser opening an address, as opposed to an agent's curl (T102): the same /p/x/B03 shows the
        page to one and the item's text to the other."""
        accept, ua = self.headers.get("Accept") or "", self.headers.get("User-Agent") or ""
        return self.headers.get("Sec-Fetch-Mode") == "navigate" or ("text/html" in accept and "Mozilla" in ua)

    def get(self, s: "Store", p: str, q: Query, base: str) -> None:
        ref = self.fileref(s)
        hub = self.hub
        if p != "/" and VIEW_PATH.fullmatch(p) and self.wants_page():  # a view of the page: the page opens there
            return self.page()
        by = (q.get("by") or ["agent"])[0]
        if (p in ("/agent", "/next", "/rules", "/inbox", "/items", "/log") or ITEM_PATH.fullmatch(p)) and "ui" not in q:  # ui=1: the page itself, not an agent
            s.saw(by, 1 if p == "/next" and q.get("wait") else 0)
        if p == "/":
            self.page()
        elif p == "/agent":
            with s.lock:
                n = len(s.rules())
            self.send(200, AGENT.format(base=base, grammar=GRAMMAR, mode=s.mode(),
                                        rules=f"{n} project rule{'s' if n != 1 else ''}, read GET /rules" if n else "no project rules yet"))
        elif p == "/next":
            wait = max(0, min(int((q.get("wait") or ["0"])[0] or 0), 540))
            end = time.time() + wait
            given: List[int] = []
            try:
                with s.cond:  # ?wait=N: while keep-going is on and there is nothing to do, hold until work arrives
                    who = (q.get("by") or [None])[0] if "ui" not in q else None  # each agent gets an item no other one is on (F194)
                    text, work = s.next_text(ref, who, given)
                    while not work and s.cfg["auto"] and not s.gone and time.time() < end:  # a deleted project lets its agents go (F173)
                        s.cond.wait(timeout=end - time.time())
                        given = []
                        text, work = s.next_text(ref, who, given)
            finally:
                if q.get("wait"):
                    s.saw(by, -1)
            if "ui" not in q:
                s.read_next(by)
                if given:  # F220: the item it was given, it has read
                    s.read_item(given[-1], by)
            self.send(200, text)
        elif p == "/rules":
            with s.lock:
                self.send(200, s.rules_text())
        elif p == "/connect":
            self.send(200, CONNECT.format(name=s.name, base=base, host=self.host() + self.prefix))
        elif p in ("/inbox", "/inputs"):  # /inputs: the same address as the page's Inputs view
            with s.lock:
                self.send(200, views.inbox(s, ref))
        elif p == "/archive":
            with s.lock:
                self.send(200, views.listing(s, {"archived": ["1"], **q}))
        elif p == "/items":
            with s.lock:
                self.send(200, views.listing(s, q))
        elif p == "/log":
            with s.lock:
                self.send(200, views.log(s, int((q.get("n") or ["30"])[0])))
        elif p == "/api/state":
            since, sboot = int((q.get("since") or ["0"])[0] or 0), (q.get("boot") or [""])[0]
            self.json(dict(s.state_since(since, sboot), project=s.name, title=s.title, base=base, key=hub.key,
                           remote=f"{hub.public}/k/{hub.key}/p/{s.name}" if hub.public else ""))
        elif p == "/api/poll":
            rev, boot, pv = int((q.get("rev") or ["0"])[0]), (q.get("boot") or [""])[0], int((q.get("pv") or ["-1"])[0])
            wait = max(0, min(25, int((q.get("wait") or ["25"])[0] or 25)))  # T293: a tab in the background asks and lets go
            with s.cond:
                s.cond.wait_for(lambda: s.rev != rev or bool(boot and boot != s.boot) or (pv >= 0 and pv != s.pv), timeout=wait)
                self.json({"rev": s.rev, "boot": s.boot, "pv": s.pv, "ver": assets.version(), "update": self.srv.update_ready()})
        elif p.startswith("/f/"):
            self.serve_file(s, os.path.basename(p[3:]))
        elif p == "/api/transcript":  # a voice note's words again, by file id, without waiting: POST waits for them (T101)
            fid = os.path.basename((q.get("f") or [""])[0])
            job = s.trs.get(fid) or (s.saved_job(fid) if fid else None)
            if not job:
                return self.json({"ok": False, "f": fid, "error": f"no words for {fid} yet: POST /api/transcript?f={fid} works them out"}, 404)
            self.json(voice_answer(fid, job))
        elif ITEM_PATH.fullmatch(p):
            ref_ = p[1:]
            it = None
            with s.lock:
                if ref_[0] in "dD":
                    self.send(200, views.doc_text(s, s.doc(ref_)))
                elif ref_[0] in "rR":
                    inp = s.inputs.get("r" + ref_[1:].lstrip("0"))
                    if not inp:
                        raise Err(f"{ref_} not found")
                    self.send(200, views.input_card(s, inp, ref) + "\n")
                else:
                    it = s.item(ref_, follow=False)
                    self.send(200, s.card(it, ref))
            if it is not None and "ui" not in q:  # F220: an agent read the item, and so your words on it
                s.read_item(it["n"], by)
        else:
            self.send(404, "not found\n")

    def serve_file(self, s: "Store", name: str) -> None:
        path = os.path.join(s.fdir, name)
        if not name or not os.path.isfile(path):
            return self.send(404, "not found\n")
        mime = mimetypes.guess_type(name)[0] or "application/octet-stream"
        if mime.startswith("text/") or mime in ("application/json", "application/javascript"):
            mime += "; charset=utf-8"  # T244: Chinese in a .txt reads right
        with open(path, "rb") as f:
            data = f.read()
        self.send(200, data, mime, {"Content-Security-Policy": "sandbox", "Content-Disposition": f"inline; filename*=UTF-8''{quote(name)}"})

    def _post(self) -> None:
        path = self.path.split("?")[0]
        if "/api/" in path and not path.endswith(("/api/netlog", "/api/miclog", "/api/restart", "/api/poll")):
            self.srv.saw_user()  # R328: the page did something for you (agents write with /do)
        if path == "/api/restart":  # R328: you said to restart now: answer, then stop the way a deploy does
            if not self.guard():
                return
            self.json({"ok": True})
            threading.Timer(0.3, lambda: os.kill(os.getpid(), signal.SIGTERM)).start()
            return
        with self.srv.working():  # a stop waits for it (T101)
            self.handle_post()

    def handle_post(self) -> None:
        if not self.guard():
            return
        u = self.url()
        q, p = parse_qs(u.query), unquote(u.path)
        hub = self.hub
        try:
            if p.startswith("/api/projects"):  # F173: new, rename, delete, restore, delete forever. name = the address
                d = json.loads(self.body(10_000) or b"{}")
                if p == "/api/projects":  # {title} (or {name}, as before): any name; the address is made from it
                    s = hub.add(d.get("title") or d.get("name", ""))
                    return self.json({"ok": True, "name": s.name, "title": s.title})
                if p == "/api/projects/rename":
                    s, was = hub.rename(d.get("name"), d.get("title"))
                    return self.json({"ok": True, "name": s.name, "title": s.title, "was": was})
                if p == "/api/projects/delete":
                    s = hub.delete(d.get("name"))
                    return self.json({"ok": True, "name": s.name, "title": s.title})
                if p == "/api/projects/restore":
                    s = hub.restore(d.get("name"))
                    return self.json({"ok": True, "name": s.name, "title": s.title})
                if p == "/api/projects/purge":
                    hub.purge(d.get("name"))
                    return self.json({"ok": True, "name": d.get("name")})
                if p == "/api/projects/order":  # F253: {names: [...]} as you dragged them
                    hub.set_order(d.get("names"))
                    return self.json({"ok": True})
                return self.send(404, "not found\n")
            if p == "/api/views":  # F320: {views: [...]} the whole list, as you left it
                d = json.loads(self.body(20_000) or b"{}")
                return self.json({"ok": True, "views": hub.set_views(d.get("views"))})
            if p == "/api/corrections":  # {wrong, right} remembers a spelling fix for every project; {wrong} forgets it
                d = json.loads(self.body(10_000) or b"{}")
                if "wrong" not in d:  # T256: {right} adds a word to hear right, {right, forget: true} forgets it
                    hub.word(d.get("right"), bool(d.get("forget")))
                else:
                    hub.correct(d.get("wrong"), d.get("right") if "right" in d else None)
                return self.json({"ok": True, "corrections": hub.corrections()})
            if p == "/api/push":  # F195: {sub, quiet} turns pushes on for a phone; {endpoint, off: true} turns them off
                d = json.loads(self.body(10_000) or b"{}")
                if d.get("off"):
                    hub.push.unsubscribe(str(d.get("endpoint", "")))
                else:
                    hub.push.subscribe(d.get("sub"), d.get("quiet", True))
                return self.json({"ok": True})
            if p == "/api/voicetidy":  # T256: {on}
                hub.set_tidy(bool(json.loads(self.body(1000) or b"{}").get("on")))
                return self.json({"ok": True, "tidy": hub.tidy_on()})
            if p == "/api/voiceprefs":  # F183: {text} for every project's transcription; "" = the default again
                d = json.loads(self.body(20_000) or b"{}")
                hub.set_voice_prefs(d.get("text", ""))
                return self.json({"ok": True, **hub.voice_prefs(), "tidy": hub.tidy_on()})  # T243: the page keeps knowing the tidy switch
            if p == "/api/key":  # a new key; this device keeps working, every other one needs the new link
                hub.new_key()
                return self.send(200, json.dumps({"ok": True, "key": hub.key}), "application/json; charset=utf-8",
                                 {} if self.trusted() else self.cookie())
            s, sub, _base = self.project(p)
            self.post(s, sub, q)
        except (Err, ValueError, KeyError) as ex:
            self.json({"ok": False, "error": str(ex)}, 400)

    def post(self, s: "Store", p: str, q: Query) -> None:
        hub = self.hub
        if p == "/do":
            text = self.body(1_000_000).decode("utf-8", "replace")
            by = (q.get("by") or ["agent"])[0][:20]
            if by not in PEOPLE:
                s.saw(by)
            lines, _ = s.run_all(parse_dsl(text), by)
            tail = "GET /next to continue" if s.cfg["auto"] else "stop after the current item"
            with s.lock:
                news = s.news_for(by) if by not in PEOPLE else []
            note = (f"\n{len(news)} new input{'s' if len(news) != 1 else ''} since your last /next: {' '.join(news)}."
                    " Finish the step you are on, then GET /next.") if news else ""
            self.send(200, "\n".join(lines) + f"\nrev {s.rev} · {s.mode()}: {tail}{note}\n")
        elif p == "/api/op":
            data = json.loads(self.body(1_000_000) or b"{}")
            ops = [(0, x) for x in (data if isinstance(data, list) else [data])]  # pyright: ignore[reportUnknownVariableType]
            cid = (q.get("cid") or [""])[0][:64]  # B326: the page's id for this save; sent again after a lost answer, it is done once
            t_lock = time.monotonic()
            with s.lock:
                self.lock_ms = int((time.monotonic() - t_lock) * 1000)  # F334
                if cid and cid in s.op_done:
                    answer, code = s.op_done[cid]
                else:
                    lines, _ = s.run_all(ops, "you")
                    code = 400 if any(x.startswith("err") for x in lines) else 200
                    answer = {"ok": code == 200, "res": lines, "rev": s.rev}
                    if cid:
                        s.op_done[cid] = (answer, code)
                        while len(s.op_done) > 500:
                            s.op_done.pop(next(iter(s.op_done)))
            self.json(dict(answer, rev=s.rev), code)
        elif p == "/api/file":
            data = self.body(MAX_FILE)
            mime = (self.headers.get("Content-Type") or "application/octet-stream").split(";")[0]
            f = s.save_file((q.get("name") or ["file"])[0], mime, data)
            if q.get("transcribe") and mime.startswith("audio/"):  # the words come later: ask /api/transcript (B165)
                s.transcribe_later(f["f"], data, self.headers.get("Content-Type") or mime, self.scope_of(s, q))
                f["pending"] = True
            self.json(f)
        elif p == "/api/transcript":  # a voice note's words: waits for them a while, starts again after a restart (B165);
            fid = os.path.basename((q.get("f") or [""])[0])  # again=1 tries a failed one once more (T101)
            path, mime = s.local(fid), voice_mime(fid)
            job = s.trs.get(fid)
            if fid and mime and os.path.isfile(path) and (not job or (job["done"] and job["err"] and q.get("again"))):
                with open(path, "rb") as fh:
                    s.transcribe_later(fid, fh.read(), mime, self.scope_of(s, q))
            with s.cond:
                job = s.trs.get(fid)
                if job:  # more=1: waits for the fuller words of a note whose strong model ran out of time
                    j = job
                    s.cond.wait_for(lambda: j["done"] and not (q.get("more") and (j.get("res") or {}).get("more")), timeout=45)
            self.json(voice_answer(fid, job))
        elif p == "/api/undo":
            rid = (json.loads(self.body(10_000) or b"{}")).get("id")
            with s.cond:
                inp = s.inputs.get(rid)
                if not inp or inp.get("deleted") or not inp["org"] or inp["org"].get("undone"):
                    raise Err(f"nothing to undo for {rid}")
                f = s.filings().get(rid)
                if f and not f["can"]:  # T113 A4: only the organizer's own work, as it left it
                    raise Err(f"{f['why']}: undo that by hand")
                s.emit({"k": "undo", "src": rid, "by": "you"})
            self.json({"ok": True})
        elif p == "/api/redo":  # the filing "Undo organizing" took back comes back (T113 A4), while nothing changed since
            rid = (json.loads(self.body(10_000) or b"{}")).get("id")
            with s.cond:
                why = s.redo_blocked(rid)
                if why:
                    raise Err(why)
                s.emit({"k": "redo", "src": rid, "by": "you"})
            self.json({"ok": True})
        elif p == "/api/revert":  # put back one of your changes (F80)
            seq = int((json.loads(self.body(10_000) or b"{}")).get("seq") or 0)
            with s.cond:
                u = next((u for u in s.undoable(50) if u["seq"] == seq), None)
                if not u:
                    raise Err("that change can't be undone any more: it was undone already, or changed again since")
                lines, _ = s.run_all([(0, {"op": "set", "ref": s.code(u["n"]), "f": u["was"], "undo_of": seq})], "you")
            self.json({"ok": lines[0].startswith("ok"), "res": lines})
        elif p == "/api/miclog":  # B288: why the microphone did not start on a device, for the agent to read in the log
            data = json.loads(self.body(4_000) or b"{}")
            via = "tunnel" if self.headers.get("X-Forwarded-Host") else "local"
            print(f"[miclog] {time.strftime('%Y-%m-%d %H:%M:%S')} {s.name} via {via}: " + json.dumps({k: str(data.get(k, ""))[:300] for k in ("name", "message", "where", "standalone", "secure", "ua")}, ensure_ascii=False), file=sys.stderr, flush=True)
            self.json({"ok": True})
        elif p == "/api/netlog":  # B326: a save that did not go through, as the page saw it, for the agent to count in the log
            data = json.loads(self.body(20_000) or b"{}")
            via = "tunnel" if self.headers.get("X-Forwarded-Host") else "local"
            for e in (data.get("list") or [])[:30]:
                print(f"[netlog] {str(e.get('t', ''))[:19]} {s.name} via {via}: " + json.dumps({k: str(e.get(k, ""))[:200] for k in ("why", "url", "ms", "status", "msg", "where") if k in e}, ensure_ascii=False), file=sys.stderr, flush=True)
            self.json({"ok": True})
        elif p == "/api/move":  # an input sent to the wrong project goes to another one (F79)
            data = json.loads(self.body(10_000) or b"{}")
            rid, t = data.get("id"), hub.projects.get(str(data.get("to") or ""))
            if not t or t is s:
                raise Err("choose another project")
            with s.cond:
                inp = s.inputs.get(rid)
                if not inp:
                    raise Err(f"unknown input {rid}")
                if inp.get("moved") or inp.get("moving"):
                    raise Err(f"{rid} was moved already")
                if inp.get("deleted"):
                    raise Err(f"{rid} is deleted; restore it first")
                if s.org_busy == rid:
                    raise Err(f"{rid} is being organized right now; try again in a moment")
                inp["moving"] = True
                blobs: List[Tuple[Dict[str, Any], bytes]] = []
                for f in inp["files"]:
                    with open(os.path.join(s.fdir, f["f"]), "rb") as fh:
                        blobs.append((f, fh.read()))
            try:
                files: List[Dict[str, Any]] = []
                for f, blob in blobs:  # the files are copied: the other project keeps its own
                    files.append(t.save_file(f.get("name"), f.get("mime"), blob))
                    if f.get("tr"):
                        files[-1]["tr"] = f["tr"]
                        continue
                    with s.cond:  # words still being worked out here go to the copy too, and hold it there (T101)
                        job = s.trs.get(f["f"])
                        if job:
                            s.fwd.setdefault(f["f"], []).append((t, files[-1]["f"]))
                    if job:
                        with t.cond:
                            t.trs[files[-1]["f"]] = job
                        t.hold_timer(job)
                lines, _ = t.run_all([(0, {"op": "input", "text": inp["text"], "files": files})], "you")
                if not lines[0].startswith("ok"):
                    raise Err(lines[0])
                new = lines[0].split()[-1]
                with s.cond:
                    made = [x for x in s.events if x.get("src") == rid and x.get("by") == "org" and x["k"] in ("add", "set", "say", "merge")]
                    if made and inp["org"] and not inp["org"].get("undone"):  # what the organizer made of it here is undone
                        s.emit({"k": "undo", "src": rid, "by": "you"})
                    s.emit({"k": "moved", "src": rid, "to": t.name, "as": new, "by": "you"})
            finally:
                inp.pop("moving", None)
            self.json({"ok": True, "to": t.name, "as": new})
        elif p == "/api/move-item":  # T257 #6: an item goes to another project: made there with its words and talk, done here
            data = json.loads(self.body(10_000) or b"{}")
            t = hub.projects.get(str(data.get("to") or ""))
            if not t or t is s:
                raise Err("choose another project")
            here = s.cfg.get("name") or s.name
            with s.cond:
                root = s.item(data.get("ref"), follow=False)
                if root.get("deleted") or root["merged_into"]:
                    raise Err(f"{s.code(root['n'])} cannot be moved")
                # B336: its subitems go along, all of them, under it as they were (parents before their children)
                tree: List[Tuple[Dict[str, Any], Optional[int]]] = []
                todo: List[Tuple[Dict[str, Any], Optional[int]]] = [(root, None)]
                while todo:
                    it, par = todo.pop(0)
                    tree.append((it, par))
                    todo += [(k, it["n"]) for k in sorted(s.items.values(), key=lambda k: k["n"])
                             if k.get("parent") == it["n"] and not k.get("deleted") and not k["merged_into"]]
                plan = []
                docs: List[Tuple[int, int, str, str]] = []
                for it, par in tree:
                    ref = s.code(it["n"])
                    talk = "\n\n".join(f"{x['by']} ({x['t'][:16].replace('T', ' ')}): {x['text']}" for x in it["thread"] if x.get("text") and not x.get("hidden"))
                    body = it["body"] + (f"\n\n---\nTalk in {here} {ref}:\n\n{talk}" if talk else "")
                    plan.append((it["n"], par, ref, it["status"], bool(it["archived"]), {
                        "title": it["title"], "body": body[:MAX_TEXT], "type": it["type"], "pri": it["pri"], "when": it["when"], "next": it["next"]}))
                    # T338: its documents go along too; their comments are written under them, as its talk is
                    for d in sorted((d for d in s.docs.values() if d["n"] == it["n"] and not d.get("deleted")), key=lambda d: d["d"]):
                        notes = "\n\n".join(f"- {c['by']} ({c['t'][:16].replace('T', ' ')})" + (f" on \u201c{c['quote'][:200]}\u201d" if c.get("quote") else "") + f": {c['text']}"
                                             for c in d["comments"] if c.get("text") and not c.get("deleted"))
                        md = d["md"] + (f"\n\n---\nComments in {here} D{d['d']}:\n\n{notes}" if notes else "")
                        docs.append((it["n"], d["d"], d.get("title") or "", md[:MAX_TEXT]))
            under = None
            if data.get("under"):  # T338: put it under an item there
                with t.cond:
                    under = t.code(t.item(data.get("under"), follow=False)["n"])
            new_as: Dict[int, str] = {}
            for n, par, ref, status, archived, fields in plan:
                op: Dict[str, Any] = {"op": "new", **fields, "status": status}
                if par is not None:
                    op["parent"] = new_as[par]
                elif under:
                    op["parent"] = under
                lines, _ = t.run_all([(0, op)], "you")
                if not lines[0].startswith("ok"):
                    raise Err(f"{ref}: {lines[0]}")
                new_as[n] = lines[0].split()[1]
                if archived:
                    t.run_all([(0, {"op": "set", "ref": new_as[n], "f": {"archived": True}})], "you")
            for n, d, title, md in docs:
                t.run_all([(0, {"op": "doc", "ref": new_as[n], "title": title, "md": md})], "you")
            for n, _, ref, _, _, _ in plan:
                s.run_all([(0, {"op": "say", "ref": ref, "kind": "progress", "text": f"Moved to {t.cfg.get('name') or t.name} as {new_as[n]}"}),
                           (1, {"op": "set", "ref": ref, "f": {"status": "dropped", "archived": True}})], "you")  # run_all takes the lock itself
            extra = {k: v for k, v in (("with", len(plan) - 1), ("docs", len(docs))) if v}  # as before when nothing went along
            self.json({"ok": True, "as": new_as[plan[0][0]], **extra})
        elif p == "/api/organize":
            rid = (json.loads(self.body(10_000) or b"{}")).get("id")
            with s.cond:
                if rid not in s.inputs:
                    raise Err(f"unknown input {rid}")
                if s.inputs[rid].get("deleted"):
                    raise Err(f"{rid} is deleted; restore it first")
                s.emit({"k": "org", "src": rid, "retry": True, "by": "you"})
            self.json({"ok": True})
        else:
            self.send(404, "not found\n")


class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def handle_error(self, request: Any, client_address: Any) -> None:
        """T335: a browser that went away first (a closed tab, a dropped connection) is not an error; anything else is,
        with its traceback, so the log keeps only what is worth looking at."""
        ex = sys.exc_info()[1]
        if isinstance(ex, (ConnectionResetError, BrokenPipeError, ConnectionAbortedError, TimeoutError)):
            return
        print(f"[error] {time.strftime('%Y-%m-%d %H:%M:%S')} request from {client_address[0]}", file=sys.stderr, flush=True)
        super().handle_error(request, client_address)

    def __init__(self, addr: Tuple[str, int], hub: "Hub"):
        super().__init__(addr, Handler)
        self.hub = hub
        self.busy = 0
        self.idle = threading.Condition()
        self.started = time.time()
        self.seen_file = os.path.join(hub.root, ".last-user")
        try:  # R328: the last time the page changed something for you; kept over a restart
            self.last_user = os.path.getmtime(self.seen_file)
        except OSError:
            self.last_user = 0.0

    def saw_user(self) -> None:
        self.last_user = time.time()
        try:
            with open(self.seen_file, "a"):
                os.utime(self.seen_file, None)
        except OSError:
            pass

    def update_ready(self) -> bool:
        """R328: new code is waiting for a restart: a deploy wrote <root>/.update-ready after this server started."""
        try:
            return os.path.getmtime(os.path.join(self.hub.root, ".update-ready")) > self.started
        except OSError:
            return False

    @contextlib.contextmanager
    def working(self) -> Generator[None, None, None]:
        """A request doing work (any POST: an upload, a transcription, a change), as opposed to one waiting for news."""
        with self.idle:
            self.busy += 1
        try:
            yield
        finally:
            with self.idle:
                self.busy -= 1
                self.idle.notify_all()

    def drain(self, wait: float = 60) -> None:
        """Stop taking requests, then give the work at hand up to `wait` seconds to finish: requests being answered and
        voice notes being transcribed in the background. A restart (launchctl kickstart -k sends SIGTERM first) must
        not cut a transcription (T101)."""
        self.socket.close()
        end = time.time() + wait

        def jobs() -> int:
            return sum(1 for s in list(self.hub.projects.values()) for j in list(s.trs.values()) if not j["done"])

        if self.busy or jobs():
            print(f"taska: stopping after the work at hand: {self.busy} request(s), {jobs()} transcription(s)", flush=True)
        with self.idle:
            while (self.busy or jobs()) and time.time() < end:
                self.idle.wait(min(0.25, max(0.01, end - time.time())))

