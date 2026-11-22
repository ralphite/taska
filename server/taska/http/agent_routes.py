"""The agent interface: plain text in, plain text out. /agent, /next, /do, /tasks, /rules, /inbox, /log, /connect,
a task's card (/T03), an input (/r12), a document (/D1); and a file sent (POST /api/file, its answer in JSON, which
the page uses too). Every word of these answers is part of the interface."""

from __future__ import annotations

import os
import re
import time
from typing import Callable, List, Optional, Tuple
from urllib.parse import quote, urlsplit

from ..agent_text import log as change_log
from ..agent_text import reconnect as reconnect_text
from ..agent_text import render
from ..agent_text.guide_text import CONNECT
from ..agent_text.language import Parsed, parse
from ..agent_text.work import Asker, Work, next_work
from ..domain import events as ev, includes, rules, skills
from ..domain.offers import TIMES
from ..domain.rules import task_at
from ..domain.state import ident
from ..domain.vocab import MAX_FILE, PEOPLE, Refused
from ..infra.agent_sessions import SID, lookup
from ..infra.audio import leveled
from ..services.agents import agent_name, session_name
from ..services.project import Project
from ..services.waker import SCRIPT
from .messages import NOT_FOUND, Request, Response, as_json, text

TASK_PATH = re.compile(r"/([A-Za-z]?\d+)")
BYTE_RANGE = re.compile(r"bytes=(\d*)-(\d*)$")
AGENT_READS = ("/agent", "/next", "/rules", "/inbox", "/tasks", "/log")


OWN_WAIT = ("Your wait for work is one you wrote, not Taska's: it may pass over work for you (T869). When you wait, "
            "wait with Taska's script, as it is (Bash run_in_background): curl -s \"BASE/listen?by=claude-code\" | sh\n")


def file_ref(req: Request, p: Project) -> Callable[[str], str]:
    """Files as paths for an agent on this machine, as addresses for one elsewhere."""
    if req.on_this_machine():
        return p.file_path
    base = f"{req.host()}{req.prefix}/p/{p.slug}/f/"
    return lambda fid: base + quote(fid)


def session_of(p: Project, req: Request, by: str) -> str:
    """The session a call is from, by its name (T862): the one it gives; else, from its id alone (a Claude Code
    session's wait gives only sid=), the name that id gave before, the app's title for it, or the id's start. Two
    sessions that give no name are two sessions, not one "claude-code": what one is on is not the other's, and words
    one writes there do not wake the other."""
    given, sid = req.session(), req.arg("sid")
    if given or not SID.fullmatch(sid or ""):
        return given
    with p.lock:
        named = p.agents.named(by, sid)
    if named:
        return named
    found = lookup(sid)
    return (found.name if found else "") or sid[:8]


def asker(p: Project, who: Optional[str], session: str) -> Asker:
    return Asker(who=who, session=session, holder=lambda it: p.agents.holder(p.state, it),
                 calls=lambda: p.agents.calls_for(p.state, who, session),
                 told=lambda seq: p.agents.told_stop(who, session, seq))


def work_for(p: Project, req: Request, who: Optional[str], session: str) -> Work:
    """What to do now for this agent session (under the lock); the queue task it takes is held for it."""
    w = next_work(p.reading(file_ref(req, p)), p.slug, p.gone, asker(p, who, session))
    if w.claim:
        p.state.claim(w.claim[0], w.claim[1], time.time())
    if w.stop and who:  # told once (T816)
        p.agents.tell_stop(who, session, w.stop[1])
    return w


def see_sessions(p: Project) -> None:
    """How this project's agent sessions are now (T711, T768: working, idle, waiting on the user): each looked up by
    the id its agent gave, out of the lock (a few small reads)."""
    with p.lock:
        sids = p.agents.sids()
    found = {sid: s for sid, s in ((sid, lookup(sid)) for sid in sids) if s}
    with p.lock:
        p.agents.see_sessions(found)


def presence(p: Project) -> dict:
    """What the page shows about agents: who came when, each session as its app says it is and the task it is on, who
    waits now (for work, or on the user), and whether work waits for them."""
    see_sessions(p)
    with p.lock:
        work = next_work(p.reading(), p.slug, p.gone, Asker()).has_work
        waking = {sid for sid, n in p.waker.waiting.items() if n}
        return {"agents": p.agents.presence(p.state, waking), "work": work}


def local_root(p: Project, req: Request) -> str:
    """Taska on this machine, for what the agents here run (T833); else the address the caller used."""
    return getattr(p.shared, "local", "") or f"{req.host()}{req.prefix}"


def back(p: Project, sid: str) -> None:
    """T833: a session the user asked to bring back called: it is back (no project lock held)."""
    rc = getattr(p.shared, "reconnects", None)
    if rc and SID.fullmatch(sid or "") and rc.heard(sid):
        p.news.wake()  # the page shows it connected


def relay_job(p: Project, req: Request, by: str) -> str:
    """T833: for a connected Claude or Antigravity session, the narrow job of bringing back a lost one ('' none)."""
    sid = req.arg("sid")
    ws = p.shared
    if "ui" in req.query or by not in ("claude-code", "antigravity") or not SID.fullmatch(sid or "") or not hasattr(ws, "relay_for"):
        return ""
    return ws.relay_for(by, sid, local_root(p, req))  # type: ignore[union-attr]


def get(req: Request, p: Project, sub: str, base: str) -> Optional[Response]:
    """An agent's read, or None when the path is not one."""
    q = req.query
    by = req.arg("by", "agent")
    agent_call = (sub in AGENT_READS or TASK_PATH.fullmatch(sub)) and "ui" not in q
    if agent_call:
        with p.lock:
            p.agents.saw(by, 1 if sub == "/next" and q.get("wait") else 0, req.session(), req.arg("sid"), req.arg("parent"))
        back(p, req.arg("sid"))
    if sub == "/agent":
        with p.lock:
            head = render.rules_head(p.state)
            if agent_call:
                p.agents.read_guide(by, req.session(), render.guide_version())
        return text(200, render.guide(base, head))
    if sub == "/next":
        return _next(req, p, by)
    if sub == "/waker":  # T762: the Antigravity session's waker, started in its own terminal
        return text(200, SCRIPT.replace("{base}", base).replace("{slug}", p.slug), "text/x-shellscript; charset=utf-8")
    if sub == "/listen":  # T869: Taska's wait for work, run as it is
        ses = req.session()
        body = reconnect_text.LISTEN.format(base=base, by=quote(by), session=f"&session={quote(ses)}" if ses else "")
        return text(200, body, "text/x-shellscript; charset=utf-8")
    if sub == "/wake":
        return _wake(req, p)
    if sub == "/rules":
        shared = p.shared_texts()  # the shared rules its lines put in (T779), read before its own lock
        listed = skills.listing(p.skills(), base)  # T821: the skills, to apply one when it fits
        with p.lock:
            return text(200, render.rules_text(p.state, shared) + ("\n\n" + listed if listed else ""))
    if sub == "/skill":  # T821: a skill's text, by its name (/qa)
        have = p.skills()
        name = next((n for n in have if includes.norm(n) == includes.norm(req.arg("name", ""))), None)
        if name is None:
            return text(404, "no skill by that name; the skills: " + (", ".join(sorted(have)) or "none yet") + "\n")
        return text(200, f"{name}\n\n{have[name].strip()}\n")
    if sub == "/connect":
        return text(200, CONNECT.format(name=p.slug, base=base, host=req.host() + req.prefix))
    if sub in ("/inbox", "/inputs"):
        with p.lock:
            return text(200, render.inbox(p.reading(file_ref(req, p))))
    if sub == "/archive":
        with p.lock:
            return text(200, render.listing(p.state, {"archived": ["1"], **q}))
    if sub == "/tasks":
        with p.lock:
            return text(200, render.listing(p.state, q))
    if sub == "/items":  # T864: there are no items, only tasks: told where the list is now
        query = urlsplit(req.target).query
        raise Refused(f"there are no items any more, only tasks: GET {base}/tasks" + (f"?{query}" if query else ""))
    if sub == "/log":
        with p.lock:
            return text(200, change_log.text(p.state, int(req.arg("n", "30"))))
    if TASK_PATH.fullmatch(sub):
        return _card(req, p, sub[1:], by)
    return None


def let_go(p: Project, w: Work) -> None:
    """The task handed to a session that does not take it is no longer held for it (T832)."""
    if w.claim:
        c = p.state.claims.get(w.claim[0])
        if c and c.who == w.claim[1]:
            del p.state.claims[w.claim[0]]


REPLACED = ("replaced: another Antigravity session runs this project now (since {t}). Stop here: end your turn, do not "
            "call /next again or start a wait, and tell the user in one line that this session was replaced.\n")


def _next(req: Request, p: Project, by: str) -> Response:
    q = req.query
    wait = max(0, min(int(req.arg("wait", "0") or 0), 540))
    end = time.time() + wait
    given: Optional[int] = None
    session = session_of(p, req, by) if "ui" not in q else req.session()
    sid = req.arg("sid") if by == "antigravity" and "ui" not in q else ""
    if sid:  # T755: one Antigravity session runs a project; a newer one takes over (lead=1), the one before stops
        with p.lock:
            if q.get("lead"):
                p.agents.take_lead(sid, time.strftime("%m-%d %H:%M"))
            since = p.agents.replaced(sid)
        if since:
            if q.get("wait"):
                with p.lock:
                    p.agents.saw(by, -1)
            return text(200, REPLACED.format(t=since))
    lis = getattr(p.shared, "listeners", None)  # T869: whether the wait is Taska's script, which takes any work
    me_key = ident(by, session)
    scripted = bool(wait and lis and q.get("listen") and "ui" not in q)
    if scripted and lis:
        lis.start(p.slug, me_key)
    elif wait and lis and by == "claude-code" and "ui" not in q:
        lis.own_wait(p.slug, req.arg("sid") or me_key)
    try:
        with p.lock:  # ?wait=N: while there is nothing to do, hold until work arrives
            who = req.arg("by") or None if "ui" not in q else None
            # what each session held before this ask: a wait is not woken by the task it already holds and works on
            # (T741: a manager whose own doing task came back at once re-asked every 20 s); a plain /next still gets it
            held = {n: c.who for n, c in p.state.claims.items()}

            key = req.arg("sid") or session or (who or "")

            def mark(n: int) -> object:
                it = p.state.tasks.get(n)
                return (it.status, it.when, it.t1, len(it.thread)) if it else None

            def nothing_new(w: Work) -> bool:
                if not w.has_work:
                    return True
                if wait and w.given is not None and p.agents.offers.passed(key, w.given, mark(w.given)):
                    let_go(p, w)  # T832: it does not take this one: not held for it, so others may
                    return True
                if not wait or not w.claim:
                    return False
                n, me = w.claim
                it = p.state.tasks.get(n)
                return bool(it and it.status == "doing" and held.get(n) == me)

            job = relay_job(p, req, by)  # T833: bringing back a lost session comes before any other work
            if job:
                return text(200, job)
            w = work_for(p, req, who, session)
            while nothing_new(w) and not p.gone and time.time() < end:  # a deleted project lets its agents go
                p.news.wait(timeout=end - time.time())
                if sid and p.agents.replaced(sid):  # taken over while it waited: told at once
                    return text(200, REPLACED.format(t=p.agents.replaced(sid)))  # (the wait is let go below)
                job = relay_job(p, req, by)
                if job:
                    return text(200, job)
                w = work_for(p, req, who, session)
            given = w.given
            if wait and given is not None and key and p.agents.offers.handed(key, given, mark(given)):
                let_go(p, w)
                p.run([(0, {"op": "say", "ref": p.state.code(given), "kind": "progress", "src": None, "files": [],
                            "text": f"会话「{key[:40]}」连着 {TIMES} 次拿到这件都没接，现在没人在做。"})], "taska")
                p.agents.offers.changed(key, given, mark(given))
            if sid:  # the waker wakes it only when it is idle (T762)
                p.waker.next_read(sid, w.has_work)
            if given is not None and who:  # the card it was given holds what other sessions wrote there
                p.agents.heard_task(p.state, given, who, session)
    finally:
        if scripted and lis:
            lis.stop(p.slug, me_key)
        if q.get("wait"):
            with p.lock:
                p.agents.saw(by, -1)
                p.agents.stopped_listening(req.arg("sid"))
    out = w.text
    if not wait and lis and "ui" not in q and lis.tell(p.slug, req.arg("sid") or me_key):
        out = OWN_WAIT + out
    if "ui" not in q:
        shared = p.shared_texts()  # before its own lock (T779)
        with p.lock:
            p.agents.read_next(by)
            if given is not None:
                p.agents.read_task(given, by, p.state)
            news = p.agents.rule_news(p.state, by, session)  # the rules changed since it last heard: said first
            news += p.agents.shared_news(p.state, by, session, shared)  # and the shared rules they put in (T779)
            news += p.agents.guide_news(by, session, render.guide_version())  # and so did the guide (T743)
            news += p.agents.roster_news(p.state, by, session)  # who else works here, when that changed (T774)
        if news:
            lines = out.split("\n")
            at = next((i + 1 for i, x in enumerate(lines) if "Project rules" in x), 1)
            out = "\n".join(lines[:at] + news + lines[at:])
    return text(200, out)


def _wake(req: Request, p: Project) -> Response:
    """GET /wake?sid=&wait=: the waker's wait (T762). "wake" when the session has work and may be woken (idle, or
    silent since it was woken), "stop" when the project is gone, "replaced" when another session runs it, else
    "nothing to do now" when the time is up. It takes no task and marks nothing read: the session does, on /next."""
    sid = req.arg("sid")
    if not SID.fullmatch(sid):
        raise Refused("sid: the Antigravity session id")
    end = time.time() + max(0, min(int(req.arg("wait", "0") or 0), 540))
    with p.lock:
        p.waker.holding(sid, 1)
        p.agents.saw("antigravity", 1, sid=sid)
    try:
        with p.lock:
            rc = getattr(p.shared, "reconnects", None)

            def ready() -> bool:
                return bool(p.gone or p.agents.replaced(sid) or (p.waker.due(sid) and (
                    next_work(p.reading(), p.slug, p.gone, asker(p, "antigravity", "")).has_work
                    or (rc and rc.waiting_for("antigravity", sid)))))  # T833: a lost session to bring back

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
            p.agents.saw("antigravity", -1, sid=sid)  # its listening ends too (it was counted with its id)


def _card(req: Request, p: Project, ref: str, by: str) -> Response:
    q = req.query
    task_n: Optional[int] = None
    with p.lock:
        st = p.state
        if ref[0] in "dD":
            return text(200, render.doc_text(p.reading(), rules.doc_at(st, ref)))
        if ref[0] in "rR":
            inp = st.inputs.get("r" + ref[1:].lstrip("0"))
            if not inp:
                raise Refused(f"{ref} not found")
            return text(200, render.input_card(p.reading(file_ref(req, p)), inp) + "\n")
        it = rules.task_at(st, ref, follow=False)
        answer = text(200, render.card(p.reading(file_ref(req, p)), it))
        if "ui" not in q:
            p.agents.heard_task(st, it.n, by, session_of(p, req, by))
            task_n = it.n
    if task_n is not None:  # an agent read the task, and so your words on it
        with p.lock:
            p.agents.read_task(task_n, by, p.state)
    return answer


def do(req: Request, p: Project) -> Response:
    """POST /do: commands, one per line; the answer has one line per command."""
    body = req.body(MAX_FILE).decode("utf-8", "replace")
    by = req.arg("by", "agent")[:20]
    agent = by not in PEOPLE
    with p.lock:
        if agent:
            p.agents.saw(by, 0, req.session(), req.arg("sid"), req.arg("parent"))
    session = session_of(p, req, by) if agent else ""
    with p.lock:
        calls: List[str] = p.agents.call_news(p.state, by, session) if agent else []  # what others wrote before
    if agent:
        back(p, req.arg("sid"))
    commands = parse(body)
    taken: List[Tuple[str, str]] = []
    moves: List[int] = []
    if agent:
        with p.lock:
            commands, taken, moves = held_by_others(p, commands, by, session)
    lines, _ = p.run(commands, by, session=session)
    if moves:  # doing on a task already doing, taken or handed on: the change is recorded, so the hold moves (T769)
        with p.lock:
            for n in moves:
                code = p.state.code(n)
                h = p.agents.holder(p.state, p.state.tasks[n])
                if h and h[0] != ident(by, session):
                    p.emit(ev.FieldsSet(n=n, by=by, f={"status": "doing"}, was={"status": "doing"}, ses=session or None))
                lines = [f"ok {code} status=doing (yours now)" if x.startswith(f"ok {code} no change") else x for x in lines]
    if taken:  # said on the task, so the session that had it hears it there (it is told what is written on its tasks)
        p.run([(0, {"op": "say", "ref": ref, "kind": "progress", "text": f"@{who.split(' · ')[-1]} {ref} is taken over from you, as the user asked: stop working on it.",
                    "src": None, "files": []}) for ref, who in taken], by, session=session)
    with p.lock:
        news = p.agents.news_for(by, rules.for_agent(p.state, p.organizing.on, p.held_fn)) if agent else []
        rule_lines = p.agents.rule_news(p.state, by, session) if agent else []
        rule_lines += p.agents.guide_news(by, session, render.guide_version()) if agent else []
        calls += p.agents.call_news(p.state, by, session) if agent else []
        rev = p.news.rev
    note = (f"\n{len(news)} new input{'s' if len(news) != 1 else ''} since your last /next: {' '.join(news)}."
            " Finish the step you are on, then GET /next.") if news else ""
    note += "".join("\n" + r for r in rule_lines + calls)
    job = relay_job(p, req, by) if agent else ""  # T833: told at work too, to do once the step it is on is done
    if job:
        note += "\n" + job.rstrip("\n")
    lis = getattr(p.shared, "listeners", None)
    if agent and lis and lis.tell(p.slug, req.arg("sid") or ident(by, session)):  # T869
        note += "\n" + OWN_WAIT.rstrip("\n")
    return text(200, "\n".join(lines) + f"\nrev {rev}: GET /next to continue{note}\n")


def held_by_others(p: Project, commands: Parsed, by: str, session: str) -> Tuple[Parsed, List[Tuple[str, str]], List[int]]:
    """T772: `T03 doing` from a session while another one holds T03 is not done: it is told who holds it and since
    when, and how to go on (leave it, write to the holder, or take it when the user asked: `T03 take`). -> the
    commands to run, the tasks taken over with who had them, and the tasks already doing whose hold moves to it."""
    me = ident(by, session)
    rec = p.agents.agents.get(agent_name(by))
    parent = rec.parents.get(session_name(session), "") if rec and session else ""
    boss = ident(by, parent) if parent else ""  # its manager hands it on
    out: Parsed = []
    taken: List[Tuple[str, str]] = []
    moves: List[int] = []
    for no, c in commands:
        if isinstance(c, dict) and c.get("op") == "set" and (c.get("f") or {}).get("status") == "doing":
            take = bool(c.pop("take", False))
            try:
                it = task_at(p.state, str(c.get("ref") or ""))
            except Refused:
                out.append((no, c))
                continue
            h = p.agents.holder(p.state, it)
            if h and h[0] != me and it.status == "doing" and (take or h[0] == boss):
                moves.append(it.n)  # already doing: the plain change would be none, and the hold would stay
            if h and h[0] != me and h[0] != boss:
                code = p.state.code(it.n)
                if take:
                    taken.append((code, h[0]))
                else:
                    mins = max(1, int((time.time() - h[1]) // 60))
                    out.append((no, Refused(
                        f"{code} is held by {h[0]} (heard from {mins} min ago): leave it and take the next one, or write to it with "
                        f"`{code} say @{h[0].split(' · ')[-1]} ...`; only when the user asked you to take it: `{code} take`")))
                    continue
        out.append((no, c))
    return out, taken, moves


def serve_file(p: Project, name: str, byte_range: str = "") -> Response:
    """A project's file. A file never changes under its name: the browser keeps it. `byte_range` (the Range header):
    one part of it, as a video player asks for its parts (the iPhone's plays only a file served this way, T747)."""
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
    """The task a voice note is about (?scope=): its words are spelled like that task's."""
    try:
        return task_at(p.state, req.arg("scope"), follow=False).n if req.query.get("scope") else None
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
