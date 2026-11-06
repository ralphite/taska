"""What was said: an input arriving, its edits, its words from voice, deleting, moving and scoping it, the
organizer's note."""

from __future__ import annotations

from typing import List

from .. import events as ev
from ..model import Input, InputDeletion, InputVersion, Moved
from ..state import ProjectState, Taken, TakenMessage, TakenSource
from ..voices import said
from .core import reduces
from .steps import by_id, changed_words, link, org_note, post, show_edit
from .voices import came_late, heard, inputs_with


@reduces(ev.InputAdded)
def _input(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.InputAdded)
    inp = Input(id=e.id, t=e.t, by=e.by, text=e.text, scope=e.scope, files=list(e.files), seq=e.seq)
    if e.kind == "answer":  # a form you sent: in its item's talk as it is, nothing more to do
        inp.kind, inp.acked = "answer", True
    elif e.kind == "cancelled":  # a recording you cancelled: kept to listen to and send later, not work (B627)
        inp.kind = "cancelled"
    state.inputs[inp.id] = inp
    state.max_input = max(state.max_input, inp.number)
    if e.q:
        state.page_ids[e.q] = inp.id
    it = state.items.get(inp.scope) if inp.scope is not None else None
    if it:
        post(state, it, e, "say", inp.text, inp.id)
        link(state, it.n, inp.id, handled=False)


@reduces(ev.InputsAcked)
def _ack(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.InputsAcked)
    for rid in e.ids:
        if rid in state.inputs:
            state.inputs[rid].acked = True


@reduces(ev.InputAmended)
def _amend(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.InputAmended)
    inp = state.inputs[str(e.src)]
    inp.history.append(InputVersion(text=inp.text, t=e.t, mode=e.mode))
    inp.text = e.text
    changed_words(inp, e)
    if e.files:
        inp.files = inp.files + list(e.files)
    show_edit(state, inp, e)


@reduces(ev.WordsIn)
def _words(state: ProjectState, e: ev.Event) -> None:
    """A voice note's words, in after its input was sent, as changes stored before B682 said it: into the note's
    record (the input keeps what was typed). Late: an agent or the organizer had the input without them, so it comes
    back to them updated; you changed nothing (B626)."""
    assert isinstance(e, ev.WordsIn)
    before = [said(state, i.text, i.files) for i in inputs_with(state, e.f)] if e.late else []
    heard(state, e.f, e, "done", e.heard or "", e.tr)
    if e.late:
        came_late(state, e.f, e, before)


@reduces(ev.WordsKept)
def _kept(state: ProjectState, e: ev.Event) -> None:
    """Words as said, word for word, of notes heard before F568: into their records."""
    assert isinstance(e, ev.WordsKept)
    for notes in e.notes.values():
        for f, words in notes.items():
            if f in state.voices:
                state.voices[f].said = words


@reduces(ev.InputDeleted)
def _delete_input(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.InputDeleted)
    rid = str(e.src)
    inp = state.inputs.get(rid)
    if inp:
        inp.deleted = InputDeletion(t=e.t, seq=e.seq, ns=list(e.ns), kept=[list(k) for k in e.kept])
    for n in e.ns:
        if n in state.items:
            state.items[n].deleted = rid
    took: List[Taken] = []
    state.deletion_took[e.seq] = took  # the items that stay lose it from their sources, and its words on them
    for it in state.items.values():
        if it.deleted == rid:
            continue
        if rid in it.srcs:
            took.append(TakenSource(it.n, it.srcs.index(rid)))
            it.srcs.remove(rid)
        own = [x for x in it.thread if x.src == rid and x.by == "you"]
        if own:
            took += [TakenMessage(it.n, x) for x in own]
            it.thread = [x for x in it.thread if x not in own]


@reduces(ev.InputRestored)
def _restore_input(state: ProjectState, e: ev.Event) -> None:
    rid = str(e.src)
    inp = state.inputs.get(rid)
    gone = inp.deleted if inp else None
    if inp:
        inp.deleted = None
    for it in state.items.values():
        if it.deleted == rid:
            it.deleted = None
    for taken in reversed(state.deletion_took.pop(gone.seq, []) if gone else []):
        it = state.items.get(taken.n)
        if not it:
            continue
        if isinstance(taken, TakenSource):
            if rid not in it.srcs:
                it.srcs.insert(min(taken.at, len(it.srcs)), rid)
        elif all(m.id != taken.message.id for m in it.thread):
            it.thread.append(taken.message)
            it.thread.sort(key=by_id)


@reduces(ev.InputMoved)
def _move_input(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.InputMoved)
    inp = state.inputs.get(str(e.src))
    if not inp:
        return
    inp.acked, inp.moved = True, Moved(to=e.to, as_=e.as_)
    it = state.items.get(inp.scope) if inp.scope is not None else None
    if it:  # its message on the item goes with it
        it.thread = [x for x in it.thread if x.id != inp.seq]
        if inp.id in it.srcs and inp.id not in [x.src for x in it.thread]:
            it.srcs.remove(inp.id)


@reduces(ev.InputSent)
def _sent(state: ProjectState, e: ev.Event) -> None:
    """A cancelled input sent after all: a new input like any other."""
    inp = state.inputs.get(str(e.src))
    if inp and inp.kind == "cancelled":
        inp.kind = None


@reduces(ev.InputRescoped)
def _rescope(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.InputRescoped)
    inp = state.inputs.get(str(e.src))
    if not inp:
        return
    old = inp.scope
    inp.scope = e.to
    inp.touched = [n for n in inp.touched if n != old] + ([] if e.to in inp.touched else [e.to])
    was = state.items.get(old) if old is not None else None
    if was:
        moved = [x for x in was.thread if x.src == e.src and x.by == "you"]
        was.thread = [x for x in was.thread if x not in moved]
        new = state.items.get(e.to)
        if new:
            new.thread = sorted(new.thread + moved, key=by_id)


@reduces(ev.Organized)
def _organized(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.Organized)
    inp = state.inputs.get(str(e.src))
    if inp:
        inp.org = None if e.retry else org_note(e)
