"""A project's current state, as the change log leaves it: the records, and the bookkeeping the rules read back.

Only the projector writes it (applying events); everything else reads it.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, NamedTuple, Optional, Set, Union

from .events import Event
from .model import Doc, Input, Item, Message
from .vocab import LETTER


class Claim(NamedTuple):
    """An agent session's hold on an item: who, since when (seconds)."""

    who: str
    since: float


class TakenSource(NamedTuple):
    """An input deletion took this input out of an item's sources, at this place."""

    n: int
    at: int


class TakenMessage(NamedTuple):
    """An input deletion took this message of the user's off an item."""

    n: int
    message: Message


Taken = Union[TakenSource, TakenMessage]


@dataclass
class DeletedGroup:
    """Items deleted by themselves in one change (an item and its subitems)."""

    ns: List[int]
    t: str
    seq: int


@dataclass
class ProjectState:
    items: Dict[int, Item] = field(default_factory=dict)
    inputs: Dict[str, Input] = field(default_factory=dict)
    docs: Dict[int, Doc] = field(default_factory=dict)
    events: List[Event] = field(default_factory=list)  # the whole log, in order
    title: Optional[str] = None  # what people call the project (its address never changes)
    max_n: int = 0
    max_input: int = 0
    max_doc: int = 0
    page_ids: Dict[str, str] = field(default_factory=dict)  # the page's id for an input it sent -> the input
    undone_changes: Set[int] = field(default_factory=set)  # your changes that were put back
    filing_off: Set[int] = field(default_factory=set)  # organizer changes taken back by an undo
    undo_took: Dict[int, List[int]] = field(default_factory=dict)  # each undo's list of them
    deletion_took: Dict[int, List[Taken]] = field(default_factory=dict)  # each input deletion: what it took off
    deleted_groups: List[DeletedGroup] = field(default_factory=list)
    addressed_items: Set[int] = field(default_factory=set)  # items with a message to an agent session (@name)
    claims: Dict[int, Claim] = field(default_factory=dict)
    first_acts: Dict[str, Dict[int, int]] = field(default_factory=dict)  # agent session -> item -> its first change

    def code(self, n: Optional[int]) -> str:
        """An item's code: its type's letter and its number, padded to the width of the largest number."""
        it = self.items.get(n) if n is not None else None
        return (LETTER[it.type] if it else "?") + str(n).zfill(len(str(self.max_n)))

    def bare_code(self, n: Optional[int]) -> Optional[str]:
        it = self.items.get(n) if n is not None else None
        return f"{LETTER[it.type]}{it.n}" if it else None

    def docs_of(self, n: int) -> List[Doc]:
        """The documents of an item that are not deleted."""
        return [d for d in self.docs.values() if d.n == n and not d.deleted]

    def live_items(self) -> List[Item]:
        """Items not merged and not deleted."""
        return [i for i in self.items.values() if i.live]

    def children(self, n: int) -> List[Item]:
        return [k for k in self.items.values() if k.parent == n and k.live]

    def event(self, seq: int) -> Event:
        return self.events[seq - 1]

    def first_act(self, who: str) -> Dict[int, int]:
        return self.first_acts.get(who, {})

    def claim(self, n: int, who: str, since: float) -> None:
        self.claims[n] = Claim(who, since)


def ident(by: object, ses: object = "") -> str:
    """An agent session as the page and agents name it, "claude-code · worker" (the agent alone without one)."""
    s = " ".join(str(ses or "").split())[:60]
    return f"{by} · {s}" if s else str(by)
