"""The table of reducers, one per kind of event, and applying an event or a whole stored log to a state."""

from __future__ import annotations

from typing import Callable, Dict, List, Type

from .. import events as ev
from ..state import ProjectState
from .steps import note_agent


Reducer = Callable[[ProjectState, ev.Event], None]
_REDUCERS: Dict[Type[ev.Event], Reducer] = {}


def reduces(kind: Type[ev.Event]) -> Callable[[Callable[[ProjectState, ev.Event], None]], Reducer]:
    def register(fn: Callable[[ProjectState, ev.Event], None]) -> Reducer:
        _REDUCERS[kind] = fn
        return fn
    return register


def apply(state: ProjectState, event: ev.Event) -> None:
    """Add the event to the log and apply it. The event counts even when applying it fails (a damaged change in an
    stored log): its number is its place in the log."""
    state.events.append(event)
    event.seq = len(state.events)
    reducer = _REDUCERS.get(type(event))
    if reducer is None:
        return
    reducer(state, event)
    note_agent(state, event)


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
