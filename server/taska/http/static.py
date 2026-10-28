"""The page's own files: the built page (index.html, assets/, the service worker, icons) and the manifest. They hold
no data, so they need no key.

The built files come from $TASKA_WEB_DIST, web/dist next to the source, or taska/web_dist in the release archive.
"""

from __future__ import annotations

import hashlib
import importlib.resources
import json
import mimetypes
import os
import re
from typing import Optional, Tuple

HERE = os.path.dirname(os.path.abspath(__file__))
MANIFEST = json.dumps({"name": "Taska", "short_name": "Taska", "start_url": "/", "scope": "/", "display": "standalone",
                       "background_color": "#ffffff", "theme_color": "#ffffff",
                       "icons": [{"src": f"/icon-{n}.png", "sizes": f"{n}x{n}", "type": "image/png", "purpose": "any"}
                                 for n in (192, 512)]})
ROOT_FILES = {"/sw.js", "/icon-180.png", "/icon-192.png", "/icon-512.png", "/favicon.ico"}
_ASSET = re.compile(r"/assets/[\w.\-]+")
_MAIN_SCRIPT = re.compile(rb"/assets/(index-[\w-]+\.js)")


class PageFiles:
    def __init__(self, folder: Optional[str] = None):
        env = os.environ.get("TASKA_WEB_DIST")
        dev = os.path.normpath(os.path.join(HERE, "..", "..", "..", "web", "dist"))
        self.folder = folder or (env if env and os.path.isfile(os.path.join(env, "index.html")) else dev)
        self.bundled = not folder and self.folder == dev and not os.path.isfile(os.path.join(dev, "index.html"))

    def read(self, rel: str) -> Optional[bytes]:
        if rel.startswith(("/", "\\")) or ".." in rel.split("/") or "\\" in rel:
            return None
        try:
            if self.bundled:
                resource = importlib.resources.files("taska").joinpath("web_dist")
                for part in rel.split("/"):
                    resource = resource.joinpath(part)
                return resource.read_bytes()
            with open(os.path.join(self.folder, *rel.split("/")), "rb") as f:
                return f.read()
        except (OSError, ValueError):
            return None

    def index(self) -> Optional[bytes]:
        return self.read("index.html")

    def version(self) -> str:
        """What open pages compare to tell that Taska was updated: the name of the page's main script."""
        html = self.index() or b""
        m = _MAIN_SCRIPT.search(html)
        return m.group(1).decode() if m else hashlib.sha1(html).hexdigest()[:10]

    @staticmethod
    def public(path: str) -> bool:
        """A path the page needs before it has the key: its files, and nothing with data in it."""
        return path in ROOT_FILES or path == "/manifest.webmanifest" or path.startswith("/assets/") or path == "/login.html"

    def file(self, path: str) -> Optional[Tuple[bytes, str, str]]:
        """(data, content type, cache control) for one of the page's files, or None."""
        if path == "/manifest.webmanifest":
            return MANIFEST.encode(), "application/manifest+json", "no-cache"
        if path not in ROOT_FILES and not (path.startswith("/assets/") and _ASSET.fullmatch(path)):
            return None
        name = path[1:]
        data = self.read(name)
        if data is None:
            return None
        ctype = mimetypes.guess_type(name)[0] or "application/octet-stream"
        if name.endswith((".js", ".mjs")):
            ctype = "text/javascript"
        if ctype.startswith("text/") or ctype in ("image/svg+xml",):
            ctype += "; charset=utf-8"
        cache = "public, max-age=31536000, immutable" if path.startswith("/assets/") else "no-cache"
        return data, ctype, cache
