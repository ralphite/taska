"""Items: adding, setting fields, talk, merging, archiving, deleting, hiding a message, the project's name."""

from __future__ import annotations


from .. import events as ev
from ..model import Decision, Item
from ..state import DeletedGroup, ProjectState
from ..text import clean_title
from ..vocab import DECISIONS, PEOPLE
from .core import reduces
from .steps import link, post


@reduces(ev.ItemAdded)
def _add(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.ItemAdded)
    state.max_n = max(state.max_n, e.n)
    title, named = clean_title(e.title)  # "[src=r246] ..." from an agent: the item gets the title without it
    state.items[e.n] = Item(n=e.n, type=e.type, title=title, body=e.body_text, pri=e.pri, when=e.when, status=e.status,
                            parent=e.parent, next=e.next, t0=e.t, t1=e.t, by=e.by or None)
    link(state, e.n, e.src, handled=not e.keep)
    if named and not e.src and named in state.inputs:
        link(state, e.n, named, handled=False)  # the input it named is its source; handled stays as it was


@reduces(ev.FieldsSet)
def _set(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.FieldsSet)
    it = state.items[e.n]
    f = e.fields
    if "status" in f and e.by == "you":  # what you decided on a proposal or on finished work, kept
        was = e.was.get("status", it.status)
        dec = it.decided
        if was in DECISIONS and f["status"] != was:
            last = next((x for x in reversed(it.thread) if x.by not in PEOPLE), None)
            it.decided = Decision(from_=was, to=f["status"], msg=last.id if last else None, t=e.t)
        elif dec and dec.from_ == f["status"]:
            it.decided = None  # taken back: the question is open again
        elif dec and dec.to == was and f["status"] in DECISIONS[dec.from_]:  # decided again
            it.decided = Decision(from_=dec.from_, to=f["status"], msg=dec.msg, t=e.t)
    for name, value in f.items():
        it.put(name, value)
    it.t1 = e.t
    if e.undo_of:
        state.undone_changes.add(e.undo_of)
    link(state, it.n, e.src, handled=not e.keep)


@reduces(ev.MessagePosted)
def _say(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.MessagePosted)
    it = state.items[e.n]
    post(state, it, e, e.kind, e.text, e.src, e.files)
    link(state, it.n, e.src, handled=not e.keep)


@reduces(ev.ItemMerged)
def _merge(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.ItemMerged)
    a, b = state.items[e.n], state.items[e.into]
    a.merged_into, a.t1 = b.n, e.t
    for c in state.items.values():
        if c.parent == a.n:
            c.parent = b.n
    post(state, b, e, "progress", f"Merged in {state.code(a.n)}: {a.title}", e.src)
    for rid in a.srcs:
        link(state, b.n, rid, handled=False)
    link(state, b.n, e.src, handled=not e.keep)


@reduces(ev.ItemsArchived)
def _archive(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.ItemsArchived)
    for n in e.ns:
        it = state.items.get(n)
        if it:
            it.archived, it.t1 = e.on, e.t


@reduces(ev.ItemsDeleted)
def _delete_items(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.ItemsDeleted)
    for n in e.ns:
        if n in state.items:
            state.items[n].deleted = "#item"
            state.items[n].deleted_at = e.t
    state.deleted_groups.append(DeletedGroup(ns=list(e.ns), t=e.t, seq=e.seq))


@reduces(ev.ItemsRestored)
def _restore_items(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.ItemsRestored)
    for n in e.ns:
        if n in state.items and state.items[n].deleted == "#item":
            state.items[n].deleted = None
    state.deleted_groups = [g for g in state.deleted_groups if g.ns != list(e.ns)]


@reduces(ev.MessageHidden)
def _hide(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.MessageHidden)
    it = state.items.get(e.n)
    for x in it.thread if it else []:
        if x.id == e.id:
            x.hidden = bool(e.on)


@reduces(ev.ProjectRenamed)
def _rename(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.ProjectRenamed)
    if e.name is not None:
        state.title = e.name
