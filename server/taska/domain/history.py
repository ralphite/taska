"""Reading a project's log back: what the organizer filed and whether it can be undone, which of your changes can
be put back, what deleting an input takes with it, and who last changed what. Pure functions of the state.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Set, Tuple

from . import events as ev
from .model import Item
from .rules import agent_hands, touched_since, touches
from .state import ProjectState
from .vocab import PEOPLE, STATUS_WORDS


@dataclass
class Filing:
    """What the organizer last did with an input, in words, and whether all of it is still as it left it (an undo
    takes back only its own work, not what you or an agent did after)."""

    can: bool
    what: str  # "removes F08 · B12 back to P2"
    why: str  # "F08 changed since"


def filings(state: ProjectState) -> Dict[str, Filing]:
    last: Dict[int, int] = {}
    by_src: Dict[str, List[ev.Event]] = {}
    for e in state.events:
        for m in touches(state, e):
            last[m] = e.seq
        if e.by == "org" and e.src and isinstance(e, (ev.ItemAdded, ev.FieldsSet, ev.MessagePosted, ev.ItemMerged)) \
                and e.seq not in state.filing_off:
            by_src.setdefault(e.src, []).append(e)
    out: Dict[str, Filing] = {}
    for rid, xs in by_src.items():
        inp = state.inputs.get(rid)
        if not inp or inp.deleted or not inp.org or not inp.org.ok or inp.org.undone:
            continue
        xs = [x for x in xs if x.seq > inp.edit_seq]
        mine: Dict[int, int] = {}
        for x in xs:
            for m in (getattr(x, "n", None), getattr(x, "into", None)):
                if m:
                    mine[m] = x.seq
        changed = [m for m, s in mine.items() if last.get(m, 0) > s]
        words: List[str] = []
        for x in xs:
            c = state.code(getattr(x, "n"))
            if isinstance(x, ev.ItemAdded):
                words.append(f"removes {c}")
            elif isinstance(x, ev.FieldsSet):
                words += [f"{c} back to {STATUS_WORDS.get(str(x.was.get(f)), x.was.get(f))}"
                          if f in ("pri", "status", "when", "type") else f"{c}'s old {f}" for f in x.f]
            elif isinstance(x, ev.MessagePosted):
                words.append(f"takes back the note on {c}")
            elif isinstance(x, ev.ItemMerged):
                words.append(f"{c} no longer merged into {state.code(x.into)}")
        words = list(dict.fromkeys(words))
        if words:
            out[rid] = Filing(can=not changed, why=f"{state.code(changed[0])} changed since" if changed else "",
                              what=" · ".join(words[:4]) + (f" · and {len(words) - 4} more" if len(words) > 4 else ""))
    return out


def redo_blocked(state: ProjectState, rid: object) -> Optional[str]:
    """Why the filing an undo took back cannot come back now, or None."""
    last = next((x for x in reversed(state.events) if x.src == rid and (
        isinstance(x, (ev.FilingUndone, ev.FilingRedone, ev.InputAmended)) or x.by == "org")), None)
    if not isinstance(last, ev.FilingUndone):
        return f"there is no undone filing of {rid} to put back"
    for seq in state.undo_took.get(last.seq, []):
        x = state.event(seq)
        for m in (getattr(x, "n", None), getattr(x, "into", None)):
            if m and touched_since(state, m, last.seq):
                return f"{state.code(m)} changed since the filing was undone"
    return None


@dataclass
class Undoable:
    """One of your changes that can still be put back."""

    seq: int
    n: int
    f: Dict[str, Any]
    was: Dict[str, Any]
    t: str


def undoable(state: ProjectState, limit: int = 5, scan: int = 600) -> List[Undoable]:
    """Your latest field changes that nobody changed again since, newest first. An undo and the change it put back
    cancel out, so undoing again walks further back."""
    out: List[Undoable] = []
    seen: Set[Tuple[int, str]] = set()
    for e in reversed(state.events[-scan:]):
        if isinstance(e, ev.ItemsArchived):  # archived in a batch since: an older archive is not the latest any more
            seen.update((n, "archived") for n in e.ns)
        if not isinstance(e, ev.FieldsSet) or e.undo_of or e.seq in state.undone_changes:
            continue
        it = state.items.get(e.n)
        fields = e.fields
        if e.by == "you" and it and it.live:
            f = {k: v for k, v in fields.items() if (e.n, k) not in seen and _has(it, k) and it.get(k) == v}
            if f:
                out.append(Undoable(seq=e.seq, n=e.n, f=f, was={k: e.was.get(k) for k in f}, t=e.t))
                if len(out) >= limit:
                    break
        seen.update((e.n, k) for k in fields)
    return out


def _has(it: Item, name: str) -> bool:
    return hasattr(it, name)


@dataclass
class DeletionPlan:
    """What deleting an input does: the items that go with it, and those that stay with why."""

    go: List[int]
    keep: List[List[Any]]  # [n, why]


def deletions(state: ProjectState, only: Optional[List[str]] = None) -> Dict[str, DeletionPlan]:
    """Delete moves an input to Deleted, with the items only it made, as long as no agent worked on them. An item
    with other inputs, or that an agent changed or wrote on, stays and only loses this input."""
    made: Dict[str, List[int]] = {}
    for e in state.events:
        if isinstance(e, ev.ItemAdded) and e.src:
            made.setdefault(e.src, []).append(e.n)
    hands = agent_hands(state)
    out: Dict[str, DeletionPlan] = {}
    for rid in (only or [r for r, i in state.inputs.items() if not i.deleted]):
        go: List[int] = []
        keep: Dict[int, str] = {}
        for n in made.get(rid, []):
            it = state.items.get(n)
            if not it or it.merged_into or it.deleted:
                continue
            if any(r != rid and r in state.inputs and not state.inputs[r].deleted for r in it.srcs):
                keep[n] = "it has other inputs"
            elif n in hands:
                keep[n] = "an agent already worked on it"
            else:
                go.append(n)
        stays = True
        while stays:  # a subitem that stays keeps its parent
            stays = False
            for n in list(go):
                if any(k.parent == n and k.live and k.n not in go for k in state.items.values()):
                    go.remove(n)
                    keep[n], stays = "a subitem of it stays", True
        if go or keep:
            out[rid] = DeletionPlan(go=sorted(go), keep=[[n, keep[n]] for n in sorted(keep)])
    return out


def followed(state: ProjectState, k: Item, name: str) -> Tuple[Optional[int], Any]:
    """The item k's last change of field `name` followed (or None), and what the field was before it."""
    for e in reversed(state.events):
        if isinstance(e, ev.FieldsSet) and e.n == k.n and name in e.f:
            return e.cascade, e.was.get(name)
    return None, None


def status_set_by(state: ProjectState, it: Item) -> Optional[str]:
    """Who last set an item's status (an agent may not reopen what the user dropped)."""
    for e in reversed(state.events):
        if isinstance(e, ev.FieldsSet) and e.n == it.n and "status" in e.f:
            return e.by
        if isinstance(e, ev.ItemAdded) and e.n == it.n:
            return e.by
    return None


def last_archive(state: ProjectState, n: int) -> Optional[ev.ItemsArchived]:
    return next((e for e in reversed(state.events) if isinstance(e, ev.ItemsArchived) and e.on and n in e.ns), None)


def made_by_organizer(state: ProjectState, rid: str) -> bool:
    return any(x.src == rid and x.by == "org" and isinstance(x, (ev.ItemAdded, ev.FieldsSet, ev.MessagePosted, ev.ItemMerged))
               for x in state.events)


def is_person(by: str) -> bool:
    return by in PEOPLE
