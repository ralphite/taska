"""Documents and the comments on them, and taking a file off whatever it was on."""

from __future__ import annotations

from typing import Optional

from .. import events as ev
from ..model import Comment, Doc, Proposal
from ..state import ProjectState
from .core import reduces


@reduces(ev.DocWritten)
def _doc(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.DocWritten)
    d = _made(state, e.d, e.n, e.t, e.kind)
    d.title, d.md, d.t1, d.by = e.title or d.title, e.md, e.t, e.by
    if e.fmt or d.fmt:
        d.fmt = e.fmt or "md"  # each write says which; none is Markdown
    d.versions += 1
    it = state.items.get(d.n)
    if it:
        it.t1 = e.t


def _made(state: ProjectState, dn: int, n: int, t: str, kind: Optional[str]) -> Doc:
    d = state.docs.get(dn)
    if not d:
        state.max_doc = max(state.max_doc, dn)
        d = state.docs[dn] = Doc(d=dn, n=n, t0=t, kind=kind)
        if kind == "rules":
            d.title, state.rules_d = "Rules", dn
    return d


@reduces(ev.DocProposed)
def _proposed(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.DocProposed)
    d = _made(state, e.d, 0, e.t, "rules")  # the first proposal makes the (empty) rules document
    d.proposals.append(Proposal(id=e.seq, by=e.by, t=e.t, why=e.why, base=e.base, edits=list(e.edits), ses=e.ses,
                                src=e.src))


@reduces(ev.DocDecided)
def _decided(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.DocDecided)
    d = state.docs.get(e.d)
    p = next((x for x in d.proposals if x.id == e.p), None) if d else None
    if p:
        p.state, p.decided, p.note = e.to, e.t, e.note


@reduces(ev.RulesMoved)
def _rules_moved(state: ProjectState, e: ev.Event) -> None:
    """The rule items go with everything on them: their talk, their documents; what pointed at them lets go."""
    assert isinstance(e, ev.RulesMoved)
    gone = set(e.ns)
    for n in gone:
        state.items.pop(n, None)
        state.claims.pop(n, None)
    for dn in [d.d for d in state.docs.values() if d.n in gone]:
        del state.docs[dn]
    for it in state.items.values():
        if it.parent in gone:
            it.parent = None
        if it.merged_into in gone:
            it.merged_into = None
    for inp in state.inputs.values():
        inp.touched = [n for n in inp.touched if n not in gone]
        if inp.scope in gone:
            inp.scope = None
    state.deleted_groups = [g for g in state.deleted_groups if not gone & set(g.ns)]
    state.addressed_items -= gone
    for acts in state.first_acts.values():
        for n in gone & set(acts):
            del acts[n]


@reduces(ev.DocDeleted)
def _delete_doc(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.DocDeleted)
    d = state.docs.get(e.d)
    if d:
        d.deleted = e.t if e.on else None


@reduces(ev.DocMoved)
def _move_doc(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.DocMoved)
    d = state.docs.get(e.d)
    if d and e.to in state.items:
        d.n = e.to


def thread_of(d: Doc, key: str, quote: str, by: str, th: Optional[int], seq: int) -> int:
    """Each place you select in a paragraph has its own thread: a reply names its thread; your comment on a new
    selection starts one, on the same selection joins it; an agent's answer to the paragraph goes to its oldest
    thread still waiting for an answer (else its latest)."""
    same = [c for c in d.comments if c.key == key]
    threads = list(dict.fromkeys(c.th for c in same))
    if th in threads:
        return int(th)  # type: ignore[arg-type]
    if by == "you":
        return next((c.th for c in same if c.th == c.id and c.quote == quote), seq)
    waiting = [t for t in threads if [c for c in same if c.th == t][-1].by == "you"]
    return waiting[0] if waiting else (threads[-1] if threads else seq)


@reduces(ev.CommentAdded)
def _comment(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.CommentAdded)
    d = state.docs[e.d]
    th = thread_of(d, e.key, e.quote, e.by, e.th, e.seq)
    d.resolved.pop(f"{e.key}#{th}", None)  # a new word opens a resolved thread again
    d.comments.append(Comment(id=e.seq, key=e.key, th=th, quote=e.quote, text=e.text, by=e.by, t=e.t,
                              files=list(e.files), ses=e.ses))


@reduces(ev.CommentEdited)
def _edit_comment(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.CommentEdited)
    c = state.docs[e.d].comment(e.id)
    if c:
        c.text, c.edited = e.text, e.t
        if e.files:
            c.files = c.files + list(e.files)


@reduces(ev.CommentDeleted)
def _delete_comment(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.CommentDeleted)
    d = state.docs[e.d]
    c = d.comment(e.id)
    if c:
        d.comments.remove(c)
        d.gone[e.id] = c


@reduces(ev.CommentRestored)
def _restore_comment(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.CommentRestored)
    d = state.docs[e.d]
    c = d.gone.pop(e.id, None)
    if c:
        d.comments = sorted(d.comments + [c], key=lambda x: x.id)


@reduces(ev.CommentMoved)
def _move_comment(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.CommentMoved)
    c = state.docs[e.d].comment(e.id)
    if c:
        c.key, c.quote, c.th = e.key, e.quote, c.id  # a thread of its own there


@reduces(ev.ThreadResolved)
def _resolve(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.ThreadResolved)
    d = state.docs[e.d]
    threads = [e.th] if e.th else sorted({c.th for c in d.comments if c.key == e.key})
    for th in threads:
        if e.on:
            d.resolved[f"{e.key}#{th}"] = e.t
        else:
            d.resolved.pop(f"{e.key}#{th}", None)


@reduces(ev.FileTakenOff)
def _unfile(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.FileTakenOff)
    if e.d:
        c = state.docs[e.d].comment(int(e.id or 0))
        if c:
            c.files = [f for f in c.files if f.f != e.f]
        return
    inp = state.inputs.get(str(e.src))
    if not inp:
        return
    inp.files = [f for f in inp.files if f.f != e.f]
    for it in state.items.values():
        for x in it.thread:
            if x.src == e.src and x.files:
                x.files = [f for f in x.files if f.f != e.f]
