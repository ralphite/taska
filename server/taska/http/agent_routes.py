"""The agent interface: plain text in, plain text out. /agent, /next, /do, /items, /rules, /inbox, /log, /connect,
an item's card (/B03), an input (/r12), a document (/D1); and a file sent (POST /api/file, its answer in JSON, which
the page uses too). Every word of these answers is part of the interface."""

from __future__ import annotations

import os
import re
import time
from typing import Callable, List, Optional
from urllib.parse import quote

from ..agent_text import log as change_log
from ..agent_text import render
from ..agent_text.guide_text import CONNECT
from ..agent_text.language import parse
from ..agent_text.work import Asker, Work, next_work
from ..domain import rules
from ..domain.rules import item_at
from ..domain.vocab import MAX_FILE, PEOPLE, Refused
from ..infra.agent_sessions import SID, lookup
from ..infra.audio import leveled
from ..services.project import Project
from ..services.waker import SCRIPT
from .messages import NOT_FOUND, Request, Response, as_json, text

ITEM_PATH = re.compile(r"/([A-Za-z]?\d+)")
BYTE_RANGE = re.compile(r"bytes=(\d*)-(\d*)$")
AGENT_READS = ("/agent", "/next", "/rules", "/inbox", "/items", "/log")


def file_ref(req: Request, p: Project) -> Callable[[str], str]:
    """Files as paths for an agent on this machine, as addresses for one elsewhere."""
    if req.on_this_machine():
        return p.file_path
    base = f"{req.host()}{req.prefix}/p/{p.slug}/f/"
    return lambda fid: base + quote(fid)


def asker(p: Project, who: Optional[str], session: str) -> Asker:
    return Asker(who=who, session=session, holder=lambda it: p.agents.holder(p.state, it),
                 calls=lambda: p.agents.calls_for(p.state, who, session))


def work_for(p: Project, req: Request, who: Optional[str], session: str) -> Work:
    """What to do now for this agent session (under the lock); the queue item it takes is held for it."""
    w = next_work(p.reading(file_ref(req, p)), p.slug, p.gone, asker(p, who, session))
    if w.claim:
        p.state.claim(w.claim[0], w.claim[1], time.time())
    return w


def see_blocked(p: Project) -> None:
    """Which of this project's agent sessions wait on the user now (T711): each looked up by the id its agent gave,
    out of the lock (a few small reads)."""
    with p.lock:
        sids = p.agents.sids()
    found = {sid: s for sid, s in ((sid, lookup(sid)) for sid in sids) if s}
    with p.lock:
        p.agents.see_blocked(found)


def presence(p: Project) -> dict:
    """What the page shows about agents: who came when, who waits now (for work, or on the user), and whether work
    waits for them."""
    see_blocked(p)
    with p.lock:
        work = next_work(p.reading(), p.slug, p.gone, Asker()).has_work
        return {"agents": p.agents.presence(), "work": work}


def get(req: Request, p: Project, sub: str, base: str) -> Optional[Response]:
    """An agent's read, or None when the path is not one."""
    q = req.query
    by = req.arg("by", "agent")
    agent_call = (sub in AGENT_READS or ITEM_PATH.fullmatch(sub)) and "ui" not in q
    if agent_call:
        with p.lock:
            p.agents.saw(by, 1 if sub == "/next" and q.get("wait") else 0, req.session(), req.arg("sid"))
    if sub == "/agent":
        with p.lock:
            head = render.rules_head(p.state)
            if agent_call:
                p.agents.read_guide(by, req.session(), render.guide_version())
        return text(200, render.guide(base, head))
    if sub == "/next":
        return _next(req, p, by)
    if sub == "/waker":  # B762: the Antigravity session's waker, started in its own terminal
        return text(200, SCRIPT.replace("{base}", base).replace("{slug}", p.slug), "text/x-shellscript; charset=utf-8")
    if sub == "/wake":
        return _wake(req, p)
    if sub == "/rules":
        with p.lock:
            return text(200, render.rules_text(p.state))
    if sub == "/connect":
        return text(200, CONNECT.format(name=p.slug, base=base, host=req.host() + req.prefix))
    if sub in ("/inbox", "/inputs"):
        with p.lock:
            return text(200, render.inbox(p.reading(file_ref(req, p))))
    if sub == "/archive":
        with p.lock:
            return text(200, render.listing(p.state, {"archived": ["1"], **q}))
    if sub == "/items":
        with p.lock:
            return text(200, render.listing(p.state, q))
    if sub == "/log":
        with p.lock:
            return text(200, change_log.text(p.state, int(req.arg("n", "30"))))
    if ITEM_PATH.fullmatch(sub):
        return _card(req, p, sub[1:], by)
    return None


REPLACED = ("replaced: another Antigravity session runs this project now (since {t}). Stop here: end your turn, do not "
            "call /next again or start a wait, and tell the user in one line that this session was replaced.\n")


def _next(req: Request, p: Project, by: str) -> Response:
    q = req.query
    wait = max(0, min(int(req.arg("wait", "0") or 0), 540))
    end = time.time() + wait
    given: Optional[int] = None
    session = req.session()
    sid = req.arg("sid") if by == "antigravity" and "ui" not in q else ""
    if sid:  # F755: one Antigravity session runs a project; a newer one takes over (lead=1), the one before stops
        with p.lock:
            if q.get("lead"):
                p.agents.take_lead(sid, time.strftime("%m-%d %H:%M"))
            since = p.agents.replaced(sid)
        if since:
            if q.get("wait"):
                with p.lock:
                    p.agents.saw(by, -1)
            return text(200, REPLACED.format(t=since))
    try:
        with p.lock:  # ?wait=N: while there is nothing to do, hold until work arrives
            who = req.arg("by") or None if "ui" not in q else None
            # what each session held before this ask: a wait is not woken by the item it already holds and works on
            # (B741: a manager whose own doing item came back at once re-asked every 20 s); a plain /next still gets it
            held = {n: c.who for n, c in p.state.claims.items()}

            def nothing_new(w: Work) -> bool:
                if not w.has_work:
                    return True
                if not wait or not w.claim:
                    return False
                n, me = w.claim
                it = p.state.items.get(n)
                return bool(it and it.status == "doing" and held.get(n) == me)

            w = work_for(p, req, who, session)
            while nothing_new(w) and not p.gone and time.time() < end:  # a deleted project lets its agents go
                p.news.wait(timeout=end - time.time())
                if sid and p.agents.replaced(sid):  # taken over while it waited: told at once
                    return text(200, REPLACED.format(t=p.agents.replaced(sid)))  # (the wait is let go below)
                w = work_for(p, req, who, session)
            given = w.given
            if sid:  # the waker wakes it only when it is idle (B762)
                p.waker.next_read(sid, w.has_work)
            if given is not None and who:  # the card it was given holds what other sessions wrote there
                p.agents.heard_item(p.state, given, who, session)
    finally:
        if q.get("wait"):
            with p.lock:
                p.agents.saw(by, -1)
    out = w.text
    if "ui" not in q:
        with p.lock:
            p.agents.read_next(by)
            if given is not None:
                p.agents.read_item(given, by, p.state)
            news = p.agents.rule_news(p.state, by, session)  # the rules changed since it last heard: said first
            news += p.agents.guide_news(by, session, render.guide_version())  # and so did the guide (F743)
        if news:
            lines = out.split("\n")
            at = next((i + 1 for i, x in enumerate(lines) if "Project rules" in x), 1)
            out = "\n".join(lines[:at] + news + lines[at:])
    return text(200, out)


def _wake(req: Request, p: Project) -> Response:
    """GET /wake?sid=&wait=: the waker's wait (B762). "wake" when the session has work and may be woken (idle, or
    silent since it was woken), "stop" when the project is gone, "replaced" when another session runs it, else
    "nothing to do now" when the time is up. It takes no item and marks nothing read: the session does, on /next."""
    sid = req.arg("sid")
    if not SID.fullmatch(sid):
        raise Refused("sid: the Antigravity session id")
    end = time.time() + max(0, min(int(req.arg("wait", "0") or 0), 540))
    with p.lock:
        p.waker.holding(sid, 1)
        p.agents.saw("antigravity", 1, sid=sid)
    try:
        with p.lock:
            def ready() -> bool:
                return bool(p.gone or p.agents.replaced(sid) or (
                    p.waker.due(sid) and next_work(p.reading(), p.slug, p.gone, asker(p, "antigravity", "")).has_work))

            ok = p.news.wait_for(ready, timeout=max(0.0, end - time.time()))
            if p.gone:
                return text(200, "stop: the project was deleted\n")
            since = p.agents.replaced(sid)
            if since:
                return text(200, REPLACED.format(t=since))
            if ok:
                p.waker.woken(sid)
                return text(200, "wake\n")
            return text(200, "nothing to do now\n")
    finally:
        with p.lock:
            p.waker.holding(sid, -1)
            p.agents.saw("antigravity", -1)


def _card(req: Request, p: Project, ref: str, by: str) -> Response:
    q = req.query
    item_n: Optional[int] = None
    with p.lock:
        st = p.state
        if ref[0] in "dD":
            return text(200, render.doc_text(p.reading(), rules.doc_at(st, ref)))
        if ref[0] in "rR":
            inp = st.inputs.get("r" + ref[1:].lstrip("0"))
            if not inp:
                raise Refused(f"{ref} not found")
            return text(200, render.input_card(p.reading(file_ref(req, p)), inp) + "\n")
        it = rules.item_at(st, ref, follow=False)
        answer = text(200, render.card(p.reading(file_ref(req, p)), it))
        if "ui" not in q:
            p.agents.heard_item(st, it.n, by, req.session())
            item_n = it.n
    if item_n is not None:  # an agent read the item, and so your words on it
        with p.lock:
            p.agents.read_item(item_n, by, p.state)
    return answer


def do(req: Request, p: Project) -> Response:
    """POST /do: commands, one per line; the answer has one line per command."""
    body = req.body(MAX_FILE).decode("utf-8", "replace")
    by = req.arg("by", "agent")[:20]
    agent = by not in PEOPLE
    session = req.session() if agent else ""
    with p.lock:
        if agent:
            p.agents.saw(by, 0, session, req.arg("sid"))
        calls: List[str] = p.agents.call_news(p.state, by, session) if agent else []  # what others wrote before
    lines, _ = p.run(parse(body), by, session=session)
    with p.lock:
        news = p.agents.news_for(by, rules.for_agent(p.state, p.organizing.on, p.held_fn)) if agent else []
        rule_lines = p.agents.rule_news(p.state, by, session) if agent else []
        rule_lines += p.agents.guide_news(by, session, render.guide_version()) if agent else []
        calls += p.agents.call_news(p.state, by, session) if agent else []
        rev = p.news.rev
    note = (f"\n{len(news)} new input{'s' if len(news) != 1 else ''} since your last /next: {' '.join(news)}."
            " Finish the step you are on, then GET /next.") if news else ""
    note += "".join("\n" + r for r in rule_lines + calls)
    return text(200, "\n".join(lines) + f"\nrev {rev}: GET /next to continue{note}\n")


def serve_file(p: Project, name: str, byte_range: str = "") -> Response:
    """A project's file. A file never changes under its name: the browser keeps it. `byte_range` (the Range header):
    one part of it, as a video player asks for its parts (the iPhone's plays only a file served this way, F747)."""
    import mimetypes
    name = os.path.basename(name)
    path = p.file_path(name)
    if not name or not os.path.isfile(path):
        return text(404, NOT_FOUND)
    mime = mimetypes.guess_type(name)[0] or "application/octet-stream"
    if mime.startswith("text/") or mime in ("application/json", "application/javascript"):
        mime += "; charset=utf-8"
    headers = {"Content-Security-Policy": "sandbox", "Content-Disposition": f"inline; filename*=UTF-8''{quote(name)}",
               "Accept-Ranges": "bytes"}
    cache = "private, max-age=31536000, immutable"
    size = os.path.getsize(path)
    part = BYTE_RANGE.match(byte_range.strip())
    if part and (part.group(1) or part.group(2)):
        a, b = part.groups()
        start, end = (int(a), min(int(b), size - 1) if b else size - 1) if a else (max(0, size - int(b)), size - 1)
        if start > end:
            return Response(416, b"", mime, headers={**headers, "Content-Range": f"bytes */{size}"}, cache=cache)
        with open(path, "rb") as f:
            f.seek(start)
            data = f.read(end - start + 1)
        return Response(206, data, mime, headers={**headers, "Content-Range": f"bytes {start}-{end}/{size}"}, cache=cache)
    with open(path, "rb") as f:
        data = f.read()
    return Response(200, data, mime, headers=headers, cache=cache)


def scope_of(p: Project, req: Request) -> Optional[int]:
    """The item a voice note is about (?scope=): its words are spelled like that item's."""
    try:
        return item_at(p.state, req.arg("scope"), follow=False).n if req.query.get("scope") else None
    except Refused:
        return None


def upload(req: Request, p: Project) -> Response:
    """POST /api/file?name=: a file, kept under a new name ("f"), which `say files=` and the rest then name.
    With transcribe=1 a voice note is brought to the loudness of speech and its words are worked out meanwhile."""
    data = req.body(MAX_FILE)
    mime = (req.header("Content-Type") or "application/octet-stream").split(";")[0]
    voice = bool(req.query.get("transcribe")) and mime.startswith("audio/")
    if voice:
        data = leveled(data, mime) or data
    f = p.files.save(req.arg("name", "file"), mime, data)
    out = {"f": f.f, "name": f.name, "mime": f.mime, "size": f.size}
    if voice:  # its words come later: the page asks for them
        p.voice.start(f.f, data, req.header("Content-Type") or mime, scope_of(p, req))
        out["pending"] = True
    return as_json(out)
