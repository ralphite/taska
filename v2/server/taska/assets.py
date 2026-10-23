"""The page's own files: the built React app (index.html, assets/, the service worker, icons), the manifest, the
key page. They hold no data, so they need no key (F192).

Where the built files come from, first found:
  1. $TASKA_WEB_DIST, a folder (development);
  2. taska/web_dist inside the package (the released taska.pyz carries it);
  3. v2/web/dist next to the source (after `npm run build` in v2/web).
"""

from __future__ import annotations

import hashlib
import json
import mimetypes
import os
import re
import threading
from importlib import resources
from typing import Any, Dict, Optional, Tuple

HERE = os.path.dirname(os.path.abspath(__file__))
MANIFEST = json.dumps({"name": "Taska", "short_name": "Taska", "start_url": "/", "scope": "/", "display": "standalone",
                       "background_color": "#ffffff", "theme_color": "#ffffff",
                       "icons": [{"src": f"/icon-{n}.png", "sizes": f"{n}x{n}", "type": "image/png", "purpose": "any"} for n in (192, 512)]})
ROOT_FILES = {"/sw.js", "/icon-180.png", "/icon-192.png", "/icon-512.png", "/favicon.ico"}
FALLBACK_LOGIN = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark"><title>Taska</title></head><body>
<form method="post" action="/login"><h1>Taska</h1><p>{wrong}Enter the key. On your computer it is in Taska's menu under <b>Use on your phone</b>.</p>
<input type="hidden" name="next" value="{next}"><input name="key" required autofocus autocapitalize="none" autocorrect="off" autocomplete="off" placeholder="xxxx-xxxx">
<button>Open Taska</button></form></body></html>
"""

_lock = threading.Lock()
_cache: Dict[str, Optional[bytes]] = {}


class Dist:
    """A folder of built files, on disk or inside the zip."""

    def __init__(self) -> None:
        self.base: Any = None
        self.packed = False
        env = os.environ.get("TASKA_WEB_DIST")
        if env and os.path.isfile(os.path.join(env, "index.html")):
            self.base = env
            return
        try:
            packed = resources.files("taska").joinpath("web_dist")
            if packed.joinpath("index.html").is_file():
                self.base, self.packed = packed, not os.path.isdir(os.path.join(HERE, "web_dist"))
                if not self.packed:
                    self.base = os.path.join(HERE, "web_dist")
                return
        except (ModuleNotFoundError, FileNotFoundError, NotADirectoryError):
            pass
        dev = os.path.normpath(os.path.join(HERE, "..", "..", "web", "dist"))
        if os.path.isfile(os.path.join(dev, "index.html")):
            self.base = dev

    def read(self, rel: str) -> Optional[bytes]:
        if self.base is None or ".." in rel.split("/"):
            return None
        if isinstance(self.base, str):
            path = os.path.join(self.base, *rel.split("/"))
            try:
                with open(path, "rb") as f:
                    return f.read()
            except (OSError, ValueError):
                return None
        with _lock:  # inside the zip: read once
            if rel not in _cache:
                node = self.base
                for part in rel.split("/"):
                    node = node.joinpath(part)
                _cache[rel] = node.read_bytes() if node.is_file() else None
            return _cache[rel]


DIST = Dist()


def index() -> Optional[bytes]:
    return DIST.read("index.html")


def version() -> str:
    """What open pages compare, to tell that Taska was updated (they offer a reload; they never reload by themselves):
    the name of the page's main script, which the page knows of itself too, so a page kept from before (the service
    worker's copy) can tell it is old (T427)."""
    html = index() or b""
    m = re.search(rb"/assets/(index-[\w-]+\.js)", html)
    return m.group(1).decode() if m else hashlib.sha1(html).hexdigest()[:10]


def public(path: str) -> bool:
    """A path the page needs before it has the key: its files, and nothing with data in it."""
    return path in ROOT_FILES or path == "/manifest.webmanifest" or path.startswith("/assets/") or path == "/login.html"


def static(path: str) -> Optional[Tuple[bytes, str, str]]:
    """(data, content type, cache control) for one of the page's files, or None."""
    if path == "/manifest.webmanifest":
        return MANIFEST.encode(), "application/manifest+json", "no-cache"
    # T456 (r678, r679): Storybook is a server of its own (v2/tools/storybook-service.sh), not part of Taska
    if path not in ROOT_FILES and not (path.startswith("/assets/") and re.fullmatch(r"/assets/[\w.\-]+", path)):
        return None
    name = path[1:]
    data = DIST.read(name)
    if data is None:
        return None
    ctype = mimetypes.guess_type(name)[0] or "application/octet-stream"
    if name.endswith((".js", ".mjs")):
        ctype = "text/javascript"
    if ctype.startswith("text/") or ctype in ("image/svg+xml",):
        ctype += "; charset=utf-8"
    cache = "public, max-age=31536000, immutable" if path.startswith("/assets/") else "no-cache"
    return data, ctype, cache


def login(next_: str, wrong: str) -> str:
    """The page that asks for the key (from outside this machine and its network)."""
    raw = DIST.read("login.html")
    html = raw.decode("utf-8") if raw else FALLBACK_LOGIN
    return html.replace("{next}", next_).replace("{wrong}", wrong)
