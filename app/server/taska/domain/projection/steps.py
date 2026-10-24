"""The bookkeeping that several kinds of change share: posting to an item's talk, linking an input to what it
became, noting what an agent did, showing an edit."""

from __future__ import annotations

from typing import List, Optional

from .. import events as ev
from ..model import AgentMark, FileRef, Input, Item, Message, OrgNote
from ..state import ProjectState, ident
from ..text import edit_note, seconds
from ..vocab import CLAIM_TTL, PEOPLE


def post(state: ProjectState, it: Item, e: ev.Event, kind: str, text: str, src: Optional[str],
          files: Optional[List[FileRef]] = None) -> None:
    """A message on the item's talk, written by this change."""
    to = list(getattr(e, "to", None) or []) if isinstance(e, ev.MessagePosted) else []
    it.thread.append(Message(id=e.seq, by=e.by, kind=kind, text=text, t=e.t, src=src, files=list(files or []),
                             ses=e.ses, to=to or None))
    it.t1 = e.t
    if to:
        state.addressed_items.add(it.n)


def link(state: ProjectState, n: Optional[int], rid: Optional[str], handled: bool = True) -> None:
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


def note_agent(state: ProjectState, e: ev.Event) -> None:
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


def show_edit(state: ProjectState, inp: Input, e: ev.Event, mark: bool = True) -> None:
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
                    post(state, it, e, "say", edit_note(rid, old, inp.text), rid)
                    th[-1].change = True
            continue
        note = next((x for x in reversed(th) if x.src == rid and x.text.startswith(head)), None)
        if note:
            note.text = head + inp.text
            if mark:
                note.edited = e.t
        elif mark:
            post(state, it, e, "say", head + inp.text, rid)


def changed_words(inp: Input, e: ev.Event) -> None:
    inp.v += 1
    inp.edit_seq = e.seq
    inp.updated = e.t
    inp.acked = False
    inp.org = None


def by_id(m: Message) -> int:
    return m.id


def org_note(e: ev.Organized) -> OrgNote:
    keep = e.keep if e.keep is not None else "Left for your coding agent" in e.msg
    return OrgNote(ok=e.ok, msg=e.msg, t=e.t, keep=bool(keep), changed=bool(e.changed) if e.changed is not None else False)
