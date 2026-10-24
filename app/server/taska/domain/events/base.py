"""What every change has, the event of a kind this version does not apply, and the helpers that read stored rows."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, ClassVar, Dict, List, Optional

from ..model import FileRef, Row


@dataclass
class Event:
    """What every change has: who made it, when, from which agent session, and its number in the log."""

    by: str = ""
    t: str = ""
    ses: Optional[str] = None
    seq: int = 0  # its place in the log, from 1; set when it is applied
    src: Optional[str] = None  # the input it came from, for the kinds that keep one

    KIND: ClassVar[str] = ""

    def body(self) -> Row:
        """The stored keys between "k" and "t", in their stored order."""
        raise NotImplementedError

    def to_row(self) -> Row:
        row: Row = {"k": self.KIND, **self.body(), "t": self.t}
        if self.ses:
            row["ses"] = self.ses
        return row

    def items_touched(self) -> List[int]:
        """The items this change is about directly (documents are added by the rules, which know their items)."""
        return []


def opt(row: Row, key: str, value: Any, when: bool) -> None:
    if when:
        row[key] = value


@dataclass
class Unknown(Event):
    """A kind this version does not apply (an old one, like "plain"): kept in the log as it is."""

    kind: str = ""
    raw: Row = field(default_factory=dict)

    def body(self) -> Row:
        return {k: v for k, v in self.raw.items() if k not in ("k", "t", "ses")}

    def to_row(self) -> Row:
        return dict(self.raw)


class Unreadable(Exception):
    """A stored row this version cannot read."""


def files_of(row: Row) -> List[FileRef]:
    return [FileRef.from_row(f) for f in row.get("files") or []]


def need(row: Row, key: str) -> Any:
    if key not in row:
        raise Unreadable(f"{row.get('k')} without {key}")
    return row[key]


def common(row: Row) -> Dict[str, Any]:
    return {"by": row.get("by") or "", "t": row.get("t") or "", "ses": row.get("ses") or None}


Reader = Callable[[Row], Event]
