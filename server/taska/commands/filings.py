"""Commands from the page about what the organizer did with an input, and about your own earlier changes: take its
filing back, put it back, ask the organizer again, put back one change of yours."""

from __future__ import annotations

from ..domain import events as ev
from ..domain.history import filings, redo_blocked, undoable
from ..domain.vocab import Refused
from .base import Args, Outcome, Run, handles
from .items import set_fields


@handles("filing-undo")
def undo_filing(r: Run, a: Args) -> Outcome:
    rid = a.get("id")
    inp = r.state.inputs.get(rid)
    if not inp or inp.deleted or not inp.org or inp.org.undone:
        raise Refused(f"nothing to undo for {rid}")
    f = filings(r.state).get(rid)
    if f and not f.can:  # only the organizer's own work, as it left it
        raise Refused(f"{f.why}: undo that by hand")
    r.emit(ev.FilingUndone(src=rid, by="you"))
    return Outcome(f"ok {rid} filing undone", "")


@handles("filing-redo")
def redo_filing(r: Run, a: Args) -> Outcome:
    rid = a.get("id")
    why = redo_blocked(r.state, rid)
    if why:
        raise Refused(why)
    r.emit(ev.FilingRedone(src=rid, by="you"))
    return Outcome(f"ok {rid} filing back", "")


@handles("organize-again")
def organize_again(r: Run, a: Args) -> Outcome:
    rid = a.get("id")
    if rid not in r.state.inputs:
        raise Refused(f"unknown input {rid}")
    if r.state.inputs[rid].deleted:
        raise Refused(f"{rid} is deleted; restore it first")
    r.emit(ev.Organized(src=rid, retry=True, by="you"))
    return Outcome(f"ok {rid} to the organizer again", "")


@handles("revert")
def revert(r: Run, a: Args) -> Outcome:
    """Put back one of your changes (the page's Undo of something done earlier)."""
    seq = a.number("seq")
    u = next((u for u in undoable(r.state, 50) if u.seq == seq), None)
    if not u:
        raise Refused("that change can't be undone any more: it was undone already, or changed again since")
    return set_fields(r, Args({"op": "set", "ref": r.state.code(u.n), "f": u.was, "undo_of": seq}))
