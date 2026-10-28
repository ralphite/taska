"""The HTTP application: from a request to an answer. It puts the routes in front of the workspace: who may come
in, which project an address names, and the routes for agents, the page and the workspace.

The same address answers a person and an agent differently: /p/x/B03 opens the page in a browser and gives the item's
card to curl.
"""

from __future__ import annotations

import logging
import os
import re
import threading
import time
import weakref
from typing import Callable, Optional, Tuple

from ..domain.vocab import Refused
from ..infra.images import PictureSizes
from ..infra.logs import log
from ..page_api.once import PageOnce
from ..page_api.sync import Feed
from ..services.project import Project
from ..services.push import Push
from ..services.workspace import Workspace
from . import agent_routes, page_routes, workspace_routes
from .access import Access
from .messages import NOT_FOUND, Request, Response, TooLarge, as_json, redirect, text
from .static import PageFiles

PROJECT_PATH = re.compile(r"/p/([a-z0-9][a-z0-9-]*)(/.*)?")
# the page's views: a browser opening one gets the page there
VIEW_PATH = re.compile(r"/(inputs|archive|rules|new|settings|agents|connect|phone|notifications|spellings|log|deleted|"
                       r"docs|about|projects|organizer|[A-Za-z]\d+)")
SLOW_IS_FINE = re.compile(r"/api/(changes|words)|[?&]wait=")  # what waits on purpose


class Status:
    """What the server knows about itself: when you last did something here, and whether new code waits."""

    def __init__(self, root: str):
        self.started = time.time()
        self._seen_file = os.path.join(root, ".last-user")
        self._ready_file = os.path.join(root, ".update-ready")
        try:
            self.last_user = os.path.getmtime(self._seen_file)
        except OSError:
            self.last_user = 0.0
        self.busy = 0
        self.idle = threading.Condition()
        self._local = threading.local()

    def saw_user(self) -> None:
        self.last_user = time.time()
        try:
            with open(self._seen_file, "a"):
                os.utime(self._seen_file, None)
        except OSError:
            pass

    def update_ready(self) -> bool:
        """New code waits for a restart: a deploy wrote .update-ready after this server started."""
        try:
            return os.path.getmtime(self._ready_file) > self.started
        except OSError:
            return False

    def note_lock_wait(self, req: Request, ms: int) -> None:
        self._local.lock_ms = ms

    def lock_wait(self) -> int:
        return int(getattr(self._local, "lock_ms", 0))

    def reset_lock_wait(self) -> None:
        self._local.lock_ms = 0


class ProjectPages:
    """A project's page side: what its pages were last sent, and the answers to changes they sent."""

    def __init__(self) -> None:
        self.feed = Feed()
        self.once = PageOnce()


class AppContext:
    """What the routes share."""

    def __init__(self, workspace: Workspace, page: PageFiles, push: Push, restart: Callable[[], None]):
        self.workspace = workspace
        self.page = page
        self.push = push
        self.restart = restart
        self.access = Access(lambda: workspace.key.value, page.public)
        self.status = Status(workspace.root)
        self.pictures = PictureSizes()
        self.log = log
        self._pages: "weakref.WeakKeyDictionary[Project, ProjectPages]" = weakref.WeakKeyDictionary()
        self._pages_lock = threading.Lock()

    def pages(self, p: Project) -> "ProjectPages":
        """What the page side keeps for a project while it is open."""
        with self._pages_lock:
            got = self._pages.get(p)
            if got is None:
                got = self._pages[p] = ProjectPages()
            return got

    def page_answer(self) -> Response:
        html = self.page.index()
        if html is None:
            return text(503, "Taska: the page is not built. Run `npm run build` in web.\n")
        return Response(200, html, "text/html; charset=utf-8", headers={"X-Taska-Page": "1"})

    def project_of(self, req: Request, path: str) -> Tuple[Project, str, str]:
        """/p/<name>/x is that project. Bare paths (/next, /B03 ...) work while there is only one project."""
        ws = self.workspace
        m = PROJECT_PATH.fullmatch(path)
        if m:
            p = ws.projects.get(m.group(1))
            if not p and ws.was_deleted(m.group(1)):  # agents asking for work hear why there is none
                raise Refused(f"project {m.group(1)} was deleted: there is no work here. The user can restore it in "
                              "Taska (Settings › Projects).")
            if not p:
                raise Refused(f"no project {m.group(1)}. Projects: {', '.join(sorted(ws.projects))}")
            return p, m.group(2) or "", f"{req.host()}{req.prefix}/p/{p.slug}"
        if len(ws.projects) == 1:
            p = next(iter(ws.projects.values()))
            return p, path, f"{req.host()}{req.prefix}/p/{p.slug}"
        raise Refused("which project? Use one of: " + "  ".join(f"{req.host()}/p/{n}" for n in sorted(ws.projects)))

    # -- GET --------------------------------------------------------------------------

    def get(self, req: Request) -> Response:
        path = req.path
        try:
            if path == "/":  # the front door: every project
                return self.page_answer()
            static = self.page.file(path)
            if static is not None:
                data, ctype, cache = static
                return Response(200, data, ctype, cache=cache)
            hub = workspace_routes.get(self, req, path)
            if hub is not None:
                return hub
            gone = PROJECT_PATH.fullmatch(path)
            if gone and gone.group(1) not in self.workspace.projects and "text/html" in req.header("Accept"):
                # a person opening a project that is gone lands on the home page, which says so
                return redirect(("/?gone=" if self.workspace.was_deleted(gone.group(1)) else "/?none=") + gone.group(1))
            p, sub, base = self.project_of(req, path)
            if sub == "":
                return redirect(path + "/")
            return self._project_get(req, p, sub, base)
        except Refused as ex:
            return text(404, f"{ex}\n")

    def _project_get(self, req: Request, p: Project, sub: str, base: str) -> Response:
        if sub != "/" and VIEW_PATH.fullmatch(sub) and req.wants_page():
            return self.page_answer()
        if sub == "/":
            return self.page_answer()
        answer = agent_routes.get(req, p, sub, base)
        if answer is not None:
            return answer
        answer = page_routes.get(self, req, p, sub)
        if answer is not None:
            return answer
        if sub.startswith("/f/"):
            return agent_routes.serve_file(p, sub[3:])
        return text(404, NOT_FOUND)

    # -- POST --------------------------------------------------------------------------

    def post(self, req: Request) -> Response:
        path = req.path
        try:
            hub = workspace_routes.post(self, req, path)
            if hub is not None:
                return hub
            p, sub, _ = self.project_of(req, path)
            if sub == "/do":
                return agent_routes.do(req, p)
            if sub == "/api/file":
                return agent_routes.upload(req, p)
            return page_routes.post(self, req, p, sub)
        except (Refused, ValueError, KeyError, TooLarge) as ex:
            return as_json({"ok": False, "error": str(ex) if not isinstance(ex, TooLarge) else "body too large"}, 400)

    # -- the request log ------------------------------------------------------------------

    def note_request(self, req: Request, status: int, ms: int) -> None:
        """What is worth reading later: an agent's calls, and whatever failed or was slow."""
        path = re.sub(r"/k/[^/?]+", "/k/…", re.sub(r"([?&]key=)[^&]*", r"\1…", req.raw_path))
        bare = path.split("?")[0]
        if self.page.public(bare) and bare != "/login.html":
            return
        from urllib.parse import parse_qs, urlsplit
        q = parse_qs(urlsplit(path).query)
        by = (q.get("by") or [""])[0][:20]
        slow = ms > 1000 and not SLOW_IS_FINE.search(path)
        failed = status >= 400 and not bare.startswith("/.well-known/")
        if not (by or slow or failed):
            return
        m = re.search(r"/p/([^/?]+)", bare)
        lock_ms = self.status.lock_wait()
        lock = f", {lock_ms} ms of it waiting for the project" if lock_ms > 100 else ""
        session = (q.get("session") or [""])[0] or req.header("X-Taska-Session")
        self.log.log(logging.WARNING if failed or slow else logging.INFO,
                     f"{req.method} {path[:160]} {status} {ms} ms{lock}", extra={"f": {
                         "source": "server", "kind": "request", "project": m.group(1) if m else None,
                         "tab": req.header("X-Taska-Tab") or None,
                         "who": by or ("you" if req.header("X-Taska-Tab") else None),
                         "ses": session, "ms": ms, "status": status or None, "via": req.via()}})


def dispatch(ctx: AppContext, req: Request) -> Optional[Response]:
    """The answer to a request (None: close the connection without one, as for a request that broke)."""
    bare = req.raw_path.split("?")[0]
    if req.method == "POST" and "/api/" in bare and not bare.endswith(("/api/page-log", "/api/restart")):
        ctx.status.saw_user()  # the page did something for you (agents write with /do)
    checked = ctx.access.check(req)
    if isinstance(checked, Response):
        return checked
    if req.method == "POST" and bare == "/api/restart":  # you said to restart now: answer, then stop as a deploy does
        return Response(200, b'{"ok": true}', "application/json; charset=utf-8", after=ctx.restart)
    if req.method in ("GET", "HEAD"):
        return ctx.get(req)
    if req.method == "POST":
        with ctx.status.idle:
            ctx.status.busy += 1
        try:
            return ctx.post(req)
        finally:
            with ctx.status.idle:
                ctx.status.busy -= 1
                ctx.status.idle.notify_all()
    return text(501, "Unsupported method\n")
