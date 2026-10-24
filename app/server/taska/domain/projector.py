"""Applying a change to a project's state: one reducer per kind of event, and the bookkeeping every change shares.

Replaying a project's log is `for event in log: apply(state, event)`. A reducer never checks whether a change is
allowed (the command handlers did); it only says what the change does. The stored log's meaning is fixed, so this is
the behaviour of the stored format, kept exactly.
"""

from __future__ import annotations

from typing import Callable, Dict, List, Optional, Type

from . import events as ev
from .model import AgentMark, Comment, Decision, Doc, FileRef, Input, InputDeletion, InputVersion, Item, Message, \
    Moved, OrgNote
from .state import DeletedGroup, ProjectState, Taken, TakenMessage, TakenSource, ident
from .text import clean_title, edit_note, seconds
from .vocab import CLAIM_TTL, DECISIONS, PEOPLE

Reducer = Callable[[ProjectState, ev.Event], None]
_REDUCERS: Dict[Type[ev.Event], Reducer] = {}


def reduces(kind: Type[ev.Event]) -> Callable[[Callable[[ProjectState, ev.Event], None]], Reducer]:
    def register(fn: Callable[[ProjectState, ev.Event], None]) -> Reducer:
        _REDUCERS[kind] = fn
        return fn
    return register


def apply(state: ProjectState, event: ev.Event) -> None:
    """Add the event to the log and apply it. The event counts even when applying it fails (a damaged change in an
    old log): its number is its place in the log."""
    state.events.append(event)
    event.seq = len(state.events)
    reducer = _REDUCERS.get(type(event))
    if reducer is None:
        return
    reducer(state, event)
    _note_agent(state, event)


# ----------------------------------------------------------------------------- shared steps


def _post(state: ProjectState, it: Item, e: ev.Event, kind: str, text: str, src: Optional[str],
          files: Optional[List[FileRef]] = None) -> None:
    """A message on the item's talk, written by this change."""
    to = list(getattr(e, "to", None) or []) if isinstance(e, ev.MessagePosted) else []
    it.thread.append(Message(id=e.seq, by=e.by, kind=kind, text=text, t=e.t, src=src, files=list(files or []),
                             ses=e.ses, to=to or None))
    it.t1 = e.t
    if to:
        state.addressed_items.add(it.n)


def _link(state: ProjectState, n: Optional[int], rid: Optional[str], handled: bool = True) -> None:
    """The item and the input it came from know each other; `handled` marks the input done with."""
    it = state.items.get(n) if n is not None else None
    inp = state.inputs.get(rid) if rid else None
    if it and rid and rid not in it.srcs:
        it.srcs.append(rid)
    if inp:
        if n not in inp.touched:
            inp.touched.append(n)  # type: ignore[arg-type]
        if handled:
            inp.acked = True


def _note_agent(state: ProjectState, e: ev.Event) -> None:
    """Who works on an item: an agent's change or message there (another session's message leaves the work with
    the session on it); its first change or word on each item, per session."""
    if not e.by or e.by in PEOPLE or not isinstance(e, (ev.ItemAdded, ev.FieldsSet, ev.MessagePosted)):
        return
    it = state.items.get(e.n)
    if not it:
        return
    a = it.agent
    me = ident(e.by, e.ses)
    if not isinstance(e, ev.MessagePosted) or not a or it.status != "doing" or ident(a.by, a.ses) == me \
            or seconds(e.t) - seconds(a.t) >= CLAIM_TTL:
        it.agent = AgentMark(by=e.by, t=e.t, ses=e.ses)
        if not isinstance(e, ev.MessagePosted):
            state.claim(e.n, me, seconds(e.t))
    state.first_acts.setdefault(me, {}).setdefault(e.n, e.seq)


def _show_edit(state: ProjectState, inp: Input, e: ev.Event, mark: bool = True) -> None:
    """An input you changed shows as its one message, with the new words, marked edited, wherever it is in a talk.
    When someone wrote there since, a short note after theirs says what changed; where the input only started an
    item, one "rN updated" message carries the latest words."""
    rid, head = inp.id, f"{inp.id} updated:\n"
    old = inp.history[-1].text if inp.history else ""
    for n in dict.fromkeys(inp.touched + ([inp.scope] if inp.scope else [])):
        it = state.items.get(n)
        if not it:
            continue
        th = it.thread
        own = next((x for x in th if x.src == rid and x.id == inp.seq), None)
        if own:
            own.text = inp.text
            if mark:
                own.edited = e.t
                if any(x.by not in (inp.by, "org") for x in th[th.index(own) + 1:]):
                    _post(state, it, e, "say", edit_note(rid, old, inp.text), rid)
                    th[-1].change = True
            continue
        note = next((x for x in reversed(th) if x.src == rid and x.text.startswith(head)), None)
        if note:
            note.text = head + inp.text
            if mark:
                note.edited = e.t
        elif mark:
            _post(state, it, e, "say", head + inp.text, rid)


def _changed_words(inp: Input, e: ev.Event) -> None:
    inp.v += 1
    inp.edit_seq = e.seq
    inp.updated = e.t
    inp.acked = False
    inp.org = None


def _by_id(m: Message) -> int:
    return m.id


# ----------------------------------------------------------------------------- inputs


@reduces(ev.InputAdded)
def _input(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.InputAdded)
    inp = Input(id=e.id, t=e.t, by=e.by, text=e.text, scope=e.scope, files=list(e.files), seq=e.seq)
    if e.kind == "answer":  # a form you sent: in its item's talk as it is, nothing more to do
        inp.kind, inp.acked = "answer", True
    state.inputs[inp.id] = inp
    state.max_input = max(state.max_input, inp.number)
    if e.q:
        state.page_ids[e.q] = inp.id
    it = state.items.get(inp.scope) if inp.scope is not None else None
    if it:
        _post(state, it, e, "say", inp.text, inp.id)
        _link(state, it.n, inp.id, handled=False)


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
    _changed_words(inp, e)
    if e.files:
        inp.files = inp.files + list(e.files)
    _show_edit(state, inp, e)


@reduces(ev.WordsIn)
def _words(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.WordsIn)
    inp = state.inputs.get(str(e.src))
    if not inp:
        return
    old = inp.text
    inp.files = [f.with_words(e.tr) if f.f == e.f else f for f in inp.files]
    if e.was and e.was in old:  # fuller words in place of the shorter ones given first
        inp.text = old.replace(e.was, e.tr, 1)
    elif e.was:  # you changed those words: the fuller ones follow, said as such
        inp.text = old.rstrip() + "\n\nFuller words of the voice note:\n" + e.tr
    elif e.tr not in old:
        inp.text = old.rstrip() + "\n" + e.tr if old.strip() else e.tr
    if e.late:  # an agent or the organizer saw it without its words: it comes back to them updated
        inp.history.append(InputVersion(text=old, t=e.t, mode="append"))
        _changed_words(inp, e)
        _show_edit(state, inp, e)
    else:  # nobody read it yet: its message simply shows the words now
        inp.v += 1
        _show_edit(state, inp, e, mark=False)


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
            it.thread.sort(key=_by_id)


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
            new.thread = sorted(new.thread + moved, key=_by_id)


@reduces(ev.Organized)
def _organized(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.Organized)
    inp = state.inputs.get(str(e.src))
    if inp:
        inp.org = None if e.retry else _org_note(e)


def _org_note(e: ev.Organized) -> OrgNote:
    keep = e.keep if e.keep is not None else "Left for your coding agent" in e.msg
    return OrgNote(ok=e.ok, msg=e.msg, t=e.t, keep=bool(keep), changed=bool(e.changed) if e.changed is not None else False)


# ----------------------------------------------------------------------------- items


@reduces(ev.ItemAdded)
def _add(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.ItemAdded)
    state.max_n = max(state.max_n, e.n)
    title, named = clean_title(e.title)  # "[src=r246] ..." from an agent: the item gets the title without it
    state.items[e.n] = Item(n=e.n, type=e.type, title=title, body=e.body_text, pri=e.pri, when=e.when, status=e.status,
                            parent=e.parent, next=e.next, t0=e.t, t1=e.t, by=e.by or None)
    _link(state, e.n, e.src, handled=not e.keep)
    if named and not e.src and named in state.inputs:
        _link(state, e.n, named, handled=False)  # the input it named is its source; handled stays as it was


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
    _link(state, it.n, e.src, handled=not e.keep)


@reduces(ev.MessagePosted)
def _say(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.MessagePosted)
    it = state.items[e.n]
    _post(state, it, e, e.kind, e.text, e.src, e.files)
    _link(state, it.n, e.src, handled=not e.keep)


@reduces(ev.ItemMerged)
def _merge(state: ProjectState, e: ev.Event) -> None:
    assert isinstance(e, ev.ItemMerged)
    a, b = state.items[e.n], state.items[e.into]
    a.merged_into, a.t1 = b.n, e.t
    for c in state.items.values():
        if c.parent == a.n:
            c.parent = b.n
    _post(state, b, e, "progress", f"Merged in {state.code(a.n)}: {a.title}", e.src)
    for rid in a.srcs:
        _link(state, b.n, rid, handled=False)
    _link(state, b.n, e.src, handled=not e.keep)


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


# ----------------------------------------------------------------------------- the organizer's filing


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
                it.thread.sort(key=_by_id)
        elif isinstance(x, ev.ItemMerged):
            it.merged_into = x.into
            b = state.items.get(x.into)
            if b and all(m.id != seq for m in b.thread):
                b.thread.append(Message(id=seq, by=x.by, kind="progress", text=f"Merged in {state.code(it.n)}: {it.title}",
                                        t=x.t, src=x.src, files=[]))
                b.thread.sort(key=_by_id)
    org = next((x for x in reversed(state.events[:undo.seq - 1])
                if isinstance(x, ev.Organized) and x.src == rid and not x.retry), None)
    inp = state.inputs.get(str(rid))
    if org and inp:
        note = _org_note(org)
        inp.acked, inp.org = not note.keep, note


# ----------------------------------------------------------------------------- documents


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


def replay(rows: List[ev.Row], warn: Callable[[int, str], None]) -> ProjectState:
    """A state from a stored log; a change that cannot be read or applied is told to `warn` and skipped."""
    state = ProjectState()
    for i, row in enumerate(rows, 1):
        try:
            event = ev.decode(row)
        except ev.Unreadable as ex:
            event = ev.Unknown(kind=str(row.get("k", "")), raw=dict(row), by=str(row.get("by") or ""),
                               t=str(row.get("t") or ""), ses=row.get("ses") or None, src=row.get("src"))
            warn(i, f"could not read: {ex}")
        try:
            apply(state, event)
        except Exception as ex:  # a damaged change must not stop the project from opening
            warn(i, f"did not apply: {ex!r}")
    return state
