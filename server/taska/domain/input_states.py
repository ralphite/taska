"""What becomes of an input on Taska's side (T728 #1): the states of its way from being sent to being handled, the
steps between them, and the one rule for a failure that goes away by itself. The organizer, the agents' inbox and the
voice notes' late words all ask here; the page's model of what became of an input (web/src/model/inputStates.ts)
says these states in its own words, from the same fields.

    (sent) ------------------> queued       the organizer on: it takes it, the oldest first
    (sent) ------------------> agents       the organizer off: for the agents as it is
    (kept with Esc) ---------> cancelled    a recording kept, not sent (B627)
    cancelled --Send---------> queued, agents
    queued --taken-----------> organizing   (organizing.busy; while its voice notes' words come it waits: held)
    organizing --busy service> queued       asked again later, longer each time (T424); nothing is written
    organizing --failed------> failed       a failure that does not go away by itself (its key refused)
    organizing --filed-------> handled      it made or changed items, or there was nothing to do
    organizing --left--------> left         for an agent (pass, or edited after it was handled)
    failed, undone --Retry---> queued, agents
    handled, left --Undo-----> undone       only the organizer's own filing, as it left it (`filing_of`)
    left, agents --acked-----> handled      an agent did it
    any --edited-------------> queued, agents
    any --moved--------------> moved        it is in another project now

Pure: no I/O."""

from __future__ import annotations

import re
from typing import Collection, FrozenSet, Optional, Tuple

from .model import Input

CANCELLED = "cancelled"
MOVED = "moved"
DELETED = "deleted"
QUEUED = "queued"
ORGANIZING = "organizing"
FAILED = "failed"
UNDONE = "undone"
LEFT = "left"
AGENTS = "agents"
HANDLED = "handled"
STATES: FrozenSet[str] = frozenset((CANCELLED, MOVED, DELETED, QUEUED, ORGANIZING, FAILED, UNDONE, LEFT, AGENTS,
                                    HANDLED))

# The steps above, as (from, step, to); `from` None: where an input starts.
STEPS: Tuple[Tuple[Optional[str], str, str], ...] = (
    (None, "sent", QUEUED),
    (None, "sent", AGENTS),
    (None, "kept", CANCELLED),
    (CANCELLED, "send", QUEUED),
    (CANCELLED, "send", AGENTS),
    (QUEUED, "taken", ORGANIZING),
    (ORGANIZING, "busy", QUEUED),
    (ORGANIZING, "failed", FAILED),
    (ORGANIZING, "filed", HANDLED),
    (ORGANIZING, "left", LEFT),
    (FAILED, "retry", QUEUED),
    (FAILED, "retry", AGENTS),
    (UNDONE, "retry", QUEUED),
    (UNDONE, "retry", AGENTS),
    (HANDLED, "undo", UNDONE),
    (LEFT, "undo", UNDONE),
    (LEFT, "acked", HANDLED),
    (AGENTS, "acked", HANDLED),
) + tuple((s, "edited", to) for s in (FAILED, UNDONE, LEFT, AGENTS, HANDLED) for to in (QUEUED, AGENTS)) \
  + tuple((s, "moved", MOVED) for s in (CANCELLED, QUEUED, FAILED, UNDONE, LEFT, AGENTS, HANDLED)) \
  + tuple((s, "deleted", DELETED) for s in STATES - {DELETED, MOVED})

_TRANSIENT = re.compile(r"(?i)\b(429|5\d\d)\b|rate.?limit|quota|exhausted|overload|unavailable|high demand|"
                        r"unreachable|timed? ?out|timeout|deadline|connection|reset|network|temporar|empty answer")
_REFUSED = re.compile(r"(?i)\b(401|403)\b|api.?key|unauthori")


def transient(msg: str) -> bool:
    """A failure that goes away by itself: the service busy, slow or out of reach (not a refused key or request). The
    one rule for it: the organizer asks again by itself and writes nothing, so a failure written is one to fix."""
    return bool(_TRANSIENT.search(msg or "")) and not _REFUSED.search(msg or "")


def state_of(inp: Input, organizer_on: bool, busy: Collection[str]) -> str:
    """Where an input is on its way (`busy`: the inputs the organizer is on now). Whether it waits for its voice
    notes' words is apart from this (held): any state can wait for them."""
    if inp.deleted:
        return DELETED
    if inp.moved:
        return MOVED
    return _progress(inp, organizer_on, busy)


def _progress(inp: Input, organizer_on: bool, busy: Collection[str]) -> str:
    """Its state, whether or not it was deleted since."""
    if inp.kind == "cancelled":
        return CANCELLED
    if inp.acked:
        return HANDLED
    if inp.id in busy:
        return ORGANIZING
    o = inp.org
    if o is None:
        return QUEUED if organizer_on else AGENTS
    if o.undone:
        return UNDONE
    if not o.ok:
        return FAILED
    return LEFT


# the organizer takes it (once it is due, and not while it waits for its words)
FOR_ORGANIZER: FrozenSet[str] = frozenset((QUEUED,))
# an agent's inbox holds it: the organizer left it, is off, or failed (an agent can do it by hand)
FOR_AGENTS: FrozenSet[str] = frozenset((LEFT, AGENTS, FAILED))
# the organizer or an agent had it: its voice note's late words bring it back to them
REACHED: FrozenSet[str] = frozenset((ORGANIZING, FAILED, UNDONE, LEFT, HANDLED))


def undoable(inp: Input) -> bool:
    """The organizer filed it and that stands (handled, or left for an agent, its note not failed nor taken back): what
    it filed can be taken back, where it is as the organizer left it (history.filings says)."""
    return state_of(inp, True, ()) in (HANDLED, LEFT) and inp.org is not None and inp.org.ok and not inp.org.undone


def reached(inp: Input, busy: Collection[str]) -> bool:
    """The organizer or an agent had it already (deleted since or not; whether the organizer is on does not matter)."""
    return _progress(inp, True, busy) in REACHED
