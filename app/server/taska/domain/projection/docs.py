"""Documents and the comments on them, and taking a file off whatever it was on."""

from __future__ import annotations

from typing import Optional

from .. import events as ev
from ..model import Comment, Doc
from ..state import ProjectState
from .core import reduces


@reduces(ev.DocWritten)
def _doc(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.DocWritten)
    d = state.docs.get(e.d)
    if not d:
        state.max_doc = max(state.max_doc, e.d)
        d = state.docs[e.d] = Doc(d=e.d, n=e.n, t0=e.t)
    d.title, d.md, d.t1, d.by = e.title or d.title, e.md, e.t, e.by
    if e.fmt or d.fmt:
        d.fmt = e.fmt or "md"  # each write says which; none is Markdown
    d.versions += 1
    it = state.items.get(d.n)
    if it:
        it.t1 = e.t


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
                              files=list(e.files)))


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
