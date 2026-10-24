"""F581 transition: delete once every page opened before the swap (2026-10-24 12:40) has reloaded.

Those pages still ask GET /p/<project>/api/poll?rev=&boot=&pv=. The answer gives back what they sent, so they see
nothing new and load nothing, and a "ver" they never had, so they offer to reload (and do so when left alone).
"""

from __future__ import annotations

from .messages import Request, Response, as_json

PATH = "/api/poll"


def _int(s: str, default: int) -> int:
    try:
        return int(s)
    except ValueError:
        return default


def answer(req: Request) -> Response:
    """At once, never a long wait: their rev, boot and pv as they sent them (as the old server read them)."""
    return as_json({"rev": _int(req.arg("rev", "0"), 0), "boot": req.arg("boot"), "pv": _int(req.arg("pv", "-1"), -1),
                    "ver": "rewrite"})
