"""The workspace's JSON interface: the projects (list, counts, order, make, rename, delete, restore), what needs you
everywhere, search across projects (the list's, and the phone's search page), voice spellings and preferences, list views, pushes, the key, and the server's
health and idleness (deploys and tools read those)."""

from __future__ import annotations

import time
from typing import TYPE_CHECKING, Optional

from ..agent_text.guide_text import ANTIGRAVITY_AGENTS, SKILL
from ..domain.vocab import Refused
from ..infra import gemini, logs
from ..infra.logs import voice_fix
from ..page_api.find import find_view
from ..services import devdash
from .access import key_answer
from .agent_routes import presence
from .messages import NOT_FOUND, Request, Response, as_json, text

if TYPE_CHECKING:
    from .app import AppContext


def get(ctx: "AppContext", req: Request, path: str) -> Optional[Response]:
    ws = ctx.workspace
    if path == "/health":
        return as_json({"status": "ok", "app": "taska", "projects": len(ws.projects)})
    if path.startswith("/dev/"):  # for making Taska, on this computer only: never through the tunnel
        if not req.on_this_machine():
            return text(404, "Not found\n")
        if path == "/dev/dashboard":
            return ctx.page_answer()
        if path == "/dev/api/dashboard":
            days = req.arg("days", "7") or "7"
            return as_json(devdash.dashboard(ws.root, ws.projects, logs.db_path(), None if days == "all" else int(days)))
        return text(404, "Not found\n")
    if path == "/api/idle":  # how long since you last did something here, for a deploy to wait for
        return as_json({"idle": int(time.time() - ctx.status.last_user), "update": ctx.status.update_ready()})
    if path == "/skill":
        return text(200, SKILL, "text/markdown; charset=utf-8")
    if path.startswith("/antigravity-agents/") and path[20:].removesuffix(".md") in ANTIGRAVITY_AGENTS:  # F755
        return text(200, ANTIGRAVITY_AGENTS[path[20:].removesuffix(".md")], "text/markdown; charset=utf-8")
    if path == "/api/projects":
        return as_json(ws.summary(presence))
    if path == "/api/needs":
        return as_json(ws.needs())
    if path == "/api/find":  # the search (F479; Home's, ⌘K, the phone's): every project, by meaning and by the words
        return as_json(find_view(ws, req.arg("q"), req.arg("here")))
    if path == "/api/projects/deleted":
        return as_json(ws.deleted())
    if path == "/api/corrections":
        return as_json(ws.spellings.all())
    if path == "/api/views":
        return as_json(ws.views.all())
    if path == "/api/voiceprefs":
        return as_json(dict(ws.voice_prefs.get(), tidy=ws.voice_prefs.tidy()))
    if path == "/api/push":  # the key a phone subscribes with, and whether this subscription is on
        return as_json({"key": ctx.push.public, "on": ctx.push.has(req.arg("endpoint"))})
    return None


def post(ctx: "AppContext", req: Request, path: str) -> Optional[Response]:
    ws = ctx.workspace
    if path.startswith("/api/projects"):  # name = the address
        d = req.json_body(10_000)
        if path == "/api/projects":
            p = ws.add(d.get("title") or d.get("name", ""))
            return as_json({"ok": True, "name": p.slug, "title": p.title})
        if path == "/api/projects/rename":
            p, was = ws.rename(d.get("name"), d.get("title"))
            return as_json({"ok": True, "name": p.slug, "title": p.title, "was": was})
        if path == "/api/projects/delete":
            p = ws.delete(d.get("name"))
            return as_json({"ok": True, "name": p.slug, "title": p.title})
        if path == "/api/projects/restore":
            p = ws.restore(d.get("name"))
            return as_json({"ok": True, "name": p.slug, "title": p.title})
        if path == "/api/projects/purge":
            ws.purge(d.get("name"))
            return as_json({"ok": True, "name": d.get("name")})
        if path == "/api/projects/order":
            ws.set_order(d.get("names"))
            return as_json({"ok": True})
        return text(404, NOT_FOUND)
    if path == "/api/views":
        d = req.json_body(20_000)
        return as_json({"ok": True, "views": ws.views.replace(d.get("views"))})
    if path == "/api/corrections":  # {wrong, right} remembers a spelling; {wrong} forgets it; {right} a word to hear
        d = req.json_body(10_000)
        if "wrong" not in d:
            ws.spellings.word(d.get("right"), bool(d.get("forget")))
        else:
            ws.spellings.correct(d.get("wrong"), d.get("right") if "right" in d else None)
            if d.get("right") and not d.get("undo"):  # a word fixed in the box before sending
                voice_fix(" ".join(str(d["wrong"]).split()), " ".join(str(d["right"]).split()), via="draft", who="you",
                          **{k: str(d[k])[:200] for k in ("project", "item", "file") if d.get(k)})
        return as_json({"ok": True, "corrections": ws.spellings.all()})
    if path == "/api/push":  # {sub, quiet, from, to} turns pushes on for a phone; {endpoint, off: true} turns them off
        d = req.json_body(10_000)
        if d.get("off"):
            ctx.push.unsubscribe(str(d.get("endpoint", "")))
        else:
            ctx.push.subscribe(d.get("sub"), d.get("quiet", True), d.get("from"), d.get("to"))
        return as_json({"ok": True})
    if path == "/api/voicetidy":
        ws.voice_prefs.set_tidy(bool(req.json_body(1000).get("on")))
        return as_json({"ok": True, "tidy": ws.voice_prefs.tidy()})
    if path == "/api/voiceprefs":
        d = req.json_body(20_000)
        ws.voice_prefs.set(d.get("text", ""))
        return as_json({"ok": True, **ws.voice_prefs.get(), "tidy": ws.voice_prefs.tidy()})
    if path == "/api/gemini":  # F765: {key} sets the Gemini API key, {key: ""} forgets it; Taska restarts to use it
        key = str(req.json_body(2_000).get("key") or "").strip()
        if key and (len(key) > 200 or any(c.isspace() for c in key)):
            raise Refused("that does not look like an API key")
        why = gemini.check_key(key) if key else None
        if why:
            raise Refused(why)
        was = bool(gemini.api_key())
        gemini.save_key(key)
        restart = was != bool(gemini.api_key()) or bool(key)  # the organizer and voice notes start with the key
        if restart:
            ctx.restart()
        return as_json({"ok": True, **gemini.key_source(), "restart": restart})
    if path == "/api/key":  # a new key; this device keeps working, every other one needs the new link
        return key_answer(req, ctx.access, ws.key.renew())
    return None
