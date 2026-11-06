"""Commands on the project's rules document (I693): the user writes it whole (the page's editor), restores a version
or takes a restore back; the organizer changes sections from the user's own words, at once; agents only propose
changes by sections, with why, and the user approves or declines. Every write is a version (domain.versions); a
proposal whose sections changed since it was written goes back to its agent to write again.
"""

from __future__ import annotations

from typing import List, Optional

from ..domain import events as ev
from ..domain.model import Doc, Proposal, SectionEdit
from ..domain.rules import proposal_comments
from ..domain.sections import apply, read_edits
from ..domain.state import ProjectState
from ..domain.versions import last_write, stale, versions, writes
from ..domain.vocab import MAX_TEXT, PEOPLE, Refused
from .base import Args, Outcome, Run, handles

WHY_MAX = 200


def _why(r: Run, a: Args) -> str:
    why = " ".join(a.text("why").split())[:WHY_MAX]
    if not why and r.by != "you":  # optional for the user, required for agents and the organizer (r1128 #7)
        raise Refused("say why the rules change: `rules propose <why>` (one line)")
    return why


def _edits(a: Args) -> List[SectionEdit]:
    got = a.get("edits")
    if isinstance(got, list):
        return [SectionEdit.from_row(x) for x in got]
    return read_edits(a.text("body"))


def _doc(s: ProjectState) -> Optional[Doc]:
    return s.rules


def _number(s: ProjectState) -> int:
    return s.rules_d or s.max_doc + 1


def _proposal(s: ProjectState, ref: object) -> Proposal:
    d = _doc(s)
    pid = str(ref or "").strip().lstrip("Pp")
    p = next((x for x in d.proposals if str(x.id) == pid), None) if d and pid.isdigit() else None
    if not p:
        raise Refused(f"no rules proposal {ref}")
    return p


def write(r: Run, md: str, why: str, src: Optional[str], **more: object) -> Optional[ev.DocWritten]:
    """A new version of the rules (none when the text does not change); proposals it overtook go back."""
    s = r.state
    md = md.strip("\n")
    if len(md) > MAX_TEXT:
        raise Refused("the rules are too long")
    d = _doc(s)
    if (d.md if d else "") == md and not more.get("undo"):
        return None
    e = ev.DocWritten(d=_number(s), n=0, kind="rules", title="Rules", md=md, why=why, by=r.by, src=src,
                      **more)  # type: ignore[arg-type]
    r.emit(e)
    send_back(r)
    return e


def send_back(r: Run) -> None:
    """Every waiting proposal a section it changes changed since: back to its agent, to write again."""
    s = r.state
    d = _doc(s)
    for p in [x for x in (d.proposals if d else []) if x.state == "wait"]:
        gone = stale(s, d, p)  # type: ignore[arg-type]
        if gone:
            r.emit(ev.DocDecided(d=d.d, p=p.id, to="stale", by="taska",  # type: ignore[union-attr]
                                 note="changed since: " + ", ".join(gone)))


def _v(r: Run) -> int:
    d = _doc(r.state)
    return len(versions(r.state, d)) if d else 0


@handles("rules")
def write_whole(r: Run, a: Args) -> Outcome:
    """The whole text, the user's (the page's editor)."""
    if r.by != "you":
        raise Refused("agents propose changes to the rules: `rules propose <why>` with the sections it changes")
    e = write(r, a.text("md"), _why(r, a), a.get("src") or r.ctx.src)
    if not e:
        return Outcome("ok rules unchanged", "")
    return Outcome(f"ok rules v{_v(r)}", "Changed the rules")


@handles("redit")
def edit_sections(r: Run, a: Args) -> Outcome:
    """Sections changed at once: the organizer from the user's own words (or the user)."""
    if not r.person:
        raise Refused("only the user's own words change the rules at once: `rules propose <why>`, the user approves it")
    why, edits = _why(r, a), _edits(a)
    d = _doc(r.state)
    md = apply(d.md if d else "", edits)
    e = write(r, md, why, a.get("src") or r.ctx.src)
    if not e:
        return Outcome("ok rules unchanged", "")
    return Outcome(f"ok rules v{_v(r)}", "Changed the rules")


@handles("rpropose")
def propose(r: Run, a: Args) -> Outcome:
    """An agent's change, by sections, with why: it waits for the user. (The user's and the organizer's apply.)"""
    if r.person:
        return edit_sections(r, a)
    s = r.state
    why, edits = _why(r, a), _edits(a)
    d = _doc(s)
    now = d.md if d else ""
    if apply(now, edits) == now.strip("\n"):
        raise Refused("that changes nothing in the rules")
    e = ev.DocProposed(d=_number(s), base=last_write(s, d) if d else 0, edits=edits, why=why, by=r.by,
                       src=a.get("src") or r.ctx.src)
    r.emit(e)
    return Outcome(f"ok rules proposal P{e.seq} (on v{_v(r)}): the user approves or declines it", "")


@handles("rdecide")
def decide(r: Run, a: Args) -> Outcome:
    """The user approves a proposal (it becomes the next version, its agent's) or declines it."""
    if r.by != "you":
        raise Refused("only the user approves or declines a change to the rules")
    s = r.state
    p = _proposal(s, a.get("p"))
    d = _doc(s)
    assert d is not None
    if p.state != "wait":
        raise Refused(f"P{p.id} was {'sent back' if p.state == 'stale' else p.state} already")
    if not a.on("ok"):
        r.emit(ev.DocDecided(d=d.d, p=p.id, to="declined", by=r.by))
        return Outcome(f"ok P{p.id} declined", "")
    gone = stale(s, d, p)
    if gone:
        r.emit(ev.DocDecided(d=d.d, p=p.id, to="stale", by="taska", note="changed since: " + ", ".join(gone)))
        return Outcome(f"ok P{p.id} sent back: {', '.join(gone)} changed since it was written", "")
    md = apply(d.md, p.edits)
    r.emit(ev.DocDecided(d=d.d, p=p.id, to="approved", by=r.by))
    who = Run(project=r.project, by=p.by, ctx=r.ctx, session=p.ses or "")
    write(who, md, p.why, p.src, p=p.id)
    return Outcome(f"ok P{p.id} approved: rules v{_v(r)}", "")


@handles("rrestore")
def restore(r: Run, a: Args) -> Outcome:
    """A version's text back, as a new version (nothing is lost)."""
    if r.by != "you":
        raise Refused("only the user restores a version of the rules")
    d = _doc(r.state)
    vs = versions(r.state, d) if d else []
    v = a.number("v")
    x = next((x for x in vs if x.v == v), None)
    if not x:
        raise Refused(f"the rules have no v{v}")
    e = write(r, x.md, f"Restored v{v}", None, restored=v)
    if not e:
        return Outcome(f"ok rules unchanged: v{v} is the text now", "")
    return Outcome(f"ok rules v{_v(r)}: v{v} restored", "")


@handles("rundo")
def undo(r: Run, a: Args) -> Outcome:
    """The last write taken back (a restore's Undo, the organizer's change): its version goes."""
    if r.by not in PEOPLE:
        raise Refused("only the user takes back a change to the rules")
    s = r.state
    d = _doc(s)
    ws = writes(s, d) if d else []
    seq = a.number("seq")
    if not ws or ws[-1].seq != seq:
        raise Refused("the rules changed since: restore the version you want instead")
    assert d is not None
    write(r, ws[-2].md if len(ws) > 1 else "", "", None, undo=seq)
    return Outcome(f"ok rules back to v{_v(r)}", "")


@handles("rreply")
def reply(r: Run, a: Args) -> Outcome:
    """A word on a proposal's thread: the user's goes to its agent; the agent answers there."""
    s = r.state
    p = _proposal(s, a.get("p"))
    d = _doc(s)
    assert d is not None
    text = a.text("text").strip()[:MAX_TEXT]
    if not text:
        raise Refused("empty comment")
    th = next((c.th for c in proposal_comments(d, p.id)), None)
    r.emit(ev.CommentAdded(d=d.d, key=f"p{p.id}", quote=p.why[:500], text=text, by=r.by, th=th))
    return Outcome(f"ok P{p.id} comment", "")


def undo_filing(r: Run, rid: str) -> None:
    """The organizer's change to the rules from this input taken back with its filing, while it is the last."""
    d = _doc(r.state)
    ws = writes(r.state, d) if d else []
    if ws and ws[-1].by == "org" and ws[-1].src == rid:
        write(r, ws[-2].md if len(ws) > 1 else "", "", None, undo=ws[-1].seq)
