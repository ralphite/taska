# T457 (#6481, D68): Taska's server in the page (story-server.js runs this in Pyodide). The server's own modules are
# read from /storybook/server/taska/ as they are imported, so this is the code Taska runs; the data is the demo's copy
# in /data. Only what has no place in a page is stood in for: a request comes in as bytes, not over a socket; work
# Taska does on a thread of its own is done at once; the speech model hears what HEARD says (the microphone's sentence,
# unless a demo says otherwise); the organizer's model answers with the commands a demo gives it.
# SHIFT (seconds) and MIC are set by story-server.js before this runs.
import importlib.abc
import importlib.util
import io
import sys
import threading
import time

from pyodide.http import open_url  # type: ignore

BASE = "/storybook/server/"


class Remote(importlib.abc.MetaPathFinder, importlib.abc.Loader):
    """`import taska.x` reads /storybook/server/taska/x.py from Storybook."""

    def find_spec(self, name, path, target=None):
        if name != "taska" and not name.startswith("taska."):
            return None
        pkg = name == "taska"
        url = BASE + name.replace(".", "/") + ("/__init__.py" if pkg else ".py")
        try:
            src = open_url(url).read()
        except Exception:
            return None
        if src.lstrip().startswith("<"):  # Storybook's own page for an address it does not have
            return None
        spec = importlib.util.spec_from_loader(name, self, is_package=pkg)
        spec.src = src  # type: ignore
        spec.origin = url
        return spec

    def create_module(self, spec):
        return None

    def exec_module(self, module):
        module.__file__ = "/server/" + module.__name__.replace(".", "/") + ("/__init__.py" if module.__spec__.submodule_search_locations is not None else ".py")
        exec(compile(module.__spec__.src, module.__spec__.origin, "exec"), module.__dict__)


sys.meta_path.insert(0, Remote())

# the demo's clock: as when its data was made
_real_time = time.time
time.time = lambda: _real_time() - SHIFT  # noqa: F821
import taska.core as core  # noqa: E402
from datetime import datetime  # noqa: E402

core.now = lambda: datetime.fromtimestamp(time.time()).astimezone().isoformat(timespec="seconds")

# one thread: what Taska starts on a thread runs now; timers that only wake waiting agents are not needed
threading.Thread.start = lambda self: self.run()
threading.Timer.start = lambda self: None

from taska import organizer, voice  # noqa: E402
from taska.hub import Hub  # noqa: E402
from taska.web import Handler, Server  # noqa: E402

HEARD = {}


def _transcribe(store, data, mime, scope, path=None, later=None):
    return {"tr": MIC, "tr_by": "asr", **HEARD}  # noqa: F821


voice.transcribe = _transcribe

hub = Hub("/data", False)
srv = Server.__new__(Server)
srv.hub, srv.busy, srv.idle, srv.started = hub, 0, threading.Condition(), time.time()
srv.seen_file, srv.last_user = "/data/.last-user", 0.0


def call(method, path, ctype, body):
    """One request, as Taska's server gets it from a browser on this machine -> the answer's bytes."""
    body = bytes(body)
    head = f"{method} {path} HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: {len(body)}\r\n"
    if ctype:
        head += f"Content-Type: {ctype}\r\n"
    h = Handler.__new__(Handler)
    h.server, h.client_address = srv, ("127.0.0.1", 0)
    h.rfile, h.wfile = io.BytesIO(head.encode("latin-1") + b"\r\n" + body), io.BytesIO()
    h.close_connection = True
    h.handle_one_request()
    return h.wfile.getvalue()


def organize(project, plan):
    """The organizer files the newest input waiting for it, its model having answered with `plan`."""
    s = hub.projects[project]
    todo = [i for i in s.pending() if not i["org"]]
    if not todo:
        raise ValueError(f"no input waits for the organizer in {project}")
    organizer.gemini = lambda *a, **k: plan
    organizer.Organizer(s).process(dict(max(todo, key=lambda i: int(i["id"][1:]))))
