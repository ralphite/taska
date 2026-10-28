"""Taking back what the organizer filed for an input, and filing it again."""

from __future__ import annotations

from typing import List

from .. import events as ev
from ..model import Message, OrgNote
from ..state import ProjectState
from .core import reduces
from .steps import by_id, org_note


@reduces(ev.FilingUndone)
def _undo_filing(state: ProjectState, e: ev.Event) -> None:
    """The organizer's changes for an input taken back; fields changed again since stay as they are."""
    rid = e.src
    inp = state.inputs.get(str(rid))
    since = inp.edit_seq if inp else 0
    took: List[int] = []
    state.undo_took[e.seq] = took
    for x in [x for x in state.events if x.src == rid and x.by == "org" and x.seq > since]:
        if x.seq in state.filing_off:  # taken back already
            continue
        if isinstance(x, (ev.ItemAdded, ev.FieldsSet, ev.MessagePosted, ev.ItemMerged)):
            state.filing_off.add(x.seq)
            took.append(x.seq)
        if isinstance(x, ev.ItemAdded) and x.n in state.items:
            it = state.items[x.n]
            it.status, it.archived, it.t1 = "dropped", True, e.t
        elif isinstance(x, ev.FieldsSet) and x.n in state.items:
            it = state.items[x.n]
            for name, value in x.fields.items():
                if it.get(name) == value:
                    it.put(name, x.was.get(name))
            it.t1 = e.t
        elif isinstance(x, ev.MessagePosted) and x.n in state.items:
            it = state.items[x.n]
            it.thread = [m for m in it.thread if m.id != x.seq]
        elif isinstance(x, ev.ItemMerged) and x.n in state.items:
            a, b = state.items[x.n], state.items.get(x.into)
            if a.merged_into == x.into:
                a.merged_into = None
            if b:
                b.thread = [m for m in b.thread if m.id != x.seq]
    if inp:  # unhandled again (the organizer's changes had marked it handled)
        inp.acked = False
        inp.org = OrgNote(ok=True, msg="Undone", t=e.t, keep=False, undone=True)


@reduces(ev.FilingRedone)
def _redo_filing(state: ProjectState, e: ev.Event) -> None:
    """What the last undo of this input's filing took back comes back."""
    rid = e.src
    undo = next((x for x in reversed(state.events[:e.seq - 1]) if isinstance(x, ev.FilingUndone) and x.src == rid), None)
    if not undo:
        return
    for seq in state.undo_took.get(undo.seq, []):
        x = state.event(seq)
        state.filing_off.discard(seq)
        it = state.items.get(getattr(x, "n", None))  # type: ignore[arg-type]
        if not it:
            continue
        it.t1 = e.t
        if isinstance(x, ev.ItemAdded):
            it.status, it.archived = x.status, False
        elif isinstance(x, ev.FieldsSet):
            for name, value in x.fields.items():
                if it.get(name) == x.was.get(name):
                    it.put(name, value)
        elif isinstance(x, ev.MessagePosted):
            if all(m.id != seq for m in it.thread):
                it.thread.append(Message(id=seq, by=x.by, kind=x.kind, text=x.text, t=x.t, src=x.src,
                                         files=list(x.files), ses=x.ses))
                it.thread.sort(key=by_id)
        elif isinstance(x, ev.ItemMerged):
            it.merged_into = x.into
            b = state.items.get(x.into)
            if b and all(m.id != seq for m in b.thread):
                b.thread.append(Message(id=seq, by=x.by, kind="progress", text=f"Merged in {state.code(it.n)}: {it.title}",
                                        t=x.t, src=x.src, files=[]))
                b.thread.sort(key=by_id)
    org = next((x for x in reversed(state.events[:undo.seq - 1])
                if isinstance(x, ev.Organized) and x.src == rid and not x.retry), None)
    inp = state.inputs.get(str(rid))
    if org and inp:
        note = org_note(org)
        inp.acked, inp.org = not note.keep, note
