"""The page's JSON interface for one project (under /p/<project>/api/):

    GET  view?cursor=           the project as the page draws it; with a cursor, only what changed since
    GET  changes?cursor=&wait=  the same, as soon as something changed (or after `wait` seconds: {"same": true})
    POST commands?cursor=       {id, commands: [...]}: changes, run once per id; the answer brings what changed
    (a file is sent as an agent sends one: POST /api/file, in agent_routes)
    GET  words?f=   POST words?f=&again=1&more=1     a voice note's words (POST waits for them)
    GET  activity?n=&before=    the change log, newest first
    GET  picture-sizes          each picture's width and height
    POST page-log               the page's own records, into the log
    POST move-input, move-item  work that belongs in another project
"""

from __future__ import annotations

import logging
import os
import re
import time
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from ..agent_text.render import log_entries
from ..infra import gemini
from ..domain.vocab import MAX_FILE
from ..infra.audio import audio_type
from ..page_api import views
from ..page_api.sync import Cursor
from ..services.project import Project
from ..services.voice_jobs import answer as voice_answer
from . import old_page_poll
from .agent_routes import presence, scope_of
from .messages import NOT_FOUND, Request, Response, as_json, text

if TYPE_CHECKING:
    from .app import AppContext


def _view(ctx: "AppContext", req: Request, p: Project, since: Optional[Cursor]) -> Dict[str, Any]:
    """The project for the page (all of it, or what changed since the cursor), with its own facts."""
    ws = ctx.workspace
    with p.lock:
        at = (p.news.rev, p.agents.version)
        out = ctx.pages(p).feed.view(at, p.news.boot, lambda: views.entities(p.state, p.agents, p.held), since)
        pres = presence(p)
        out["project"] = views.project_view(p.state, p.agents, slug=p.slug, title=p.title, organizer_on=p.organizing.on,
                                            organizer_busy=p.organizing.busy, organizer_model=gemini.MODEL,
                                            presence=pres["agents"], work=pres["work"], db_path=p.store.path)
    key = ws.key.value
    out["project"].update(base=f"{req.host()}{req.prefix}/p/{p.slug}", key=key,
                          remote=f"{ws.public}/k/{key}/p/{p.slug}" if ws.public else "")
    out["server"] = {"page": ctx.page.version(), "update": ctx.status.update_ready()}
    return out


def _changed(p: Project, since: Optional[Cursor]) -> bool:
    return since is None or since.boot != p.news.boot or since.rev != p.news.rev or since.agents != p.agents.version


def get(ctx: "AppContext", req: Request, p: Project, sub: str) -> Optional[Response]:
    if sub == old_page_poll.PATH:  # F581 transition: delete with old_page_poll
        return old_page_poll.answer(req)
    if sub == "/api/view":
        return as_json(_view(ctx, req, p, Cursor.parse(req.arg("cursor"))))
    if sub == "/api/changes":  # a long wait for news: a page in the background asks with wait=0 and lets go
        since = Cursor.parse(req.arg("cursor"))
        wait = max(0, min(25, int(req.arg("wait", "25") or 25)))
        news = p.news.wait_for(lambda: _changed(p, since), timeout=wait)
        if not news:
            return as_json({"cursor": req.arg("cursor"), "same": True,
                            "server": {"page": ctx.page.version(), "update": ctx.status.update_ready()}})
        return as_json(_view(ctx, req, p, since))
    if sub == "/api/activity":
        n, before = min(int(req.arg("n", "300") or 300), 2000), int(req.arg("before", "0") or 0)
        with p.lock:
            return as_json(log_entries(p.state, n, before)[::-1])
    if sub == "/api/picture-sizes":
        return as_json({name: list(wh) for name, wh in ctx.pictures.of_folder(p.files.folder).items()})
    if sub == "/api/words":  # a voice note's words, without waiting
        fid = os.path.basename(req.arg("f"))
        with p.lock:
            job = p.voice.job(fid) if fid else None
        if not job:
            return as_json({"ok": False, "f": fid, "error": f"no words for {fid} yet"}, 404)
        return as_json(voice_answer(fid, job))
    return None


def post(ctx: "AppContext", req: Request, p: Project, sub: str) -> Response:
    if sub == "/api/commands":
        return _commands(ctx, req, p)
    if sub == "/api/words":
        return _words(req, p)
    if sub == "/api/page-log":
        _page_log(ctx, req, p)
        return as_json({"ok": True})
    if sub == "/api/move-input":
        d = req.json_body(10_000)
        return as_json(ctx.workspace.moves.input(p, ctx.workspace.projects.get(str(d.get("to") or "")), d.get("id")))
    if sub == "/api/move-item":
        cid = req.arg("id")[:64]
        ws, kept = ctx.workspace, ctx.pages(p).once.moves
        with ws.moves.one_at_a_time:  # a move sent again after a lost answer is done once
            done = kept.get(cid)
            if done is None:
                d = req.json_body(10_000)
                done = (ws.moves.item(p, ws.projects.get(str(d.get("to") or "")), d.get("ref"), d.get("under")), 200)
                kept.put(cid, done)
        return as_json(done[0], done[1])
    return text(404, NOT_FOUND)


def _commands(ctx: "AppContext", req: Request, p: Project) -> Response:
    """Changes from the page, by you: run once per id (one sent again after a lost answer gets the first answer)."""
    body = req.json_body(MAX_FILE)
    cid = str(body.get("id") or "")[:64]
    commands: List[Any] = body.get("commands") or []
    t0 = time.monotonic()
    kept = ctx.pages(p).once.changes
    with p.lock:
        ctx.status.note_lock_wait(req, int((time.monotonic() - t0) * 1000))
        done = kept.get(cid)
        if done is None:
            lines, _ = p.run([(0, c) for c in commands if isinstance(c, dict)], "you")
            code = 400 if any(x.startswith("err") for x in lines) or len(lines) != len(commands) else 200
            done = ({"ok": code == 200, "results": lines}, code)
            kept.put(cid, done)
        answer, code = done
    out: Dict[str, Any] = dict(answer)
    if code == 200 and "cursor" in req.query:  # what changed comes with the answer: one trip, not two
        out["changes"] = _view(ctx, req, p, Cursor.parse(req.arg("cursor")))
    return as_json(out, code)


def _words(req: Request, p: Project) -> Response:
    """A voice note's words: waits for them a while; again=1 tries a failed one once more."""
    fid = os.path.basename(req.arg("f"))
    path, mime = p.file_path(fid), audio_type(fid)
    with p.lock:
        job = p.voice.jobs.get(fid)
    if fid and mime and os.path.isfile(path) and (not job or (job.done and job.err and req.query.get("again"))):
        with open(path, "rb") as fh:
            p.voice.start(fid, fh.read(), mime, scope_of(p, req))
    more = bool(req.query.get("more"))
    with p.lock:
        job = p.voice.jobs.get(fid)
        if job:  # more=1: waits for the fuller words of a note whose strong model ran out of time
            j = job
            p.news.wait_for(lambda: j.done and not (more and j.res.get("more")), timeout=45)
    return as_json(voice_answer(fid, job))


def _page_log(ctx: "AppContext", req: Request, p: Project) -> None:
    """The page's own records (what you did, slow or failed saves, errors), into the log."""
    data = req.json_body(MAX_FILE)
    for e in (data.get("list") or [])[:500]:
        if not isinstance(e, dict):
            continue
        kind = str(e.pop("kind", "") or "action")[:40]
        level = {"error": logging.ERROR, "warn": logging.WARNING}.get(str(e.pop("level", "")), logging.INFO)
        where = re.search(r"/([A-Z]\d+)\b", str(e.get("where", "")))
        ctx.log.log(level, f"page {kind} {str(e.get('msg') or e.get('where') or '')[:160]}", extra={"f": {
            **e, "source": "page", "kind": kind, "project": p.slug, "tab": req.header("X-Taska-Tab") or None, "who": "you",
            "item": where.group(1) if where else None, "via": req.via()}})
