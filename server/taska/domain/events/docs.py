"""Documents and the comments on them: typed events and how their stored rows read."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import ClassVar, Dict, List, Optional

from ..model import FileRef, Row, files_row
from .base import Event, Reader, common, files_of, need, opt


@dataclass
class DocWritten(Event):
    """A document made, or its text replaced."""

    KIND: ClassVar[str] = "doc"
    d: int = 0
    n: int = 0
    title: str = ""
    md: str = ""
    fmt: Optional[str] = None

    def body(self) -> Row:
        row: Row = {"d": self.d, "n": self.n, "title": self.title, "md": self.md, "by": self.by}
        opt(row, "fmt", self.fmt, bool(self.fmt))
        return row

    def items_touched(self) -> List[int]:
        return [self.n] if self.n else []


@dataclass
class DocDeleted(Event):
    KIND: ClassVar[str] = "ddel"
    d: int = 0
    on: bool = True  # False: restored

    def body(self) -> Row:
        return {"d": self.d, "on": self.on, "by": self.by}


@dataclass
class DocMoved(Event):
    KIND: ClassVar[str] = "dmove"
    d: int = 0
    to: int = 0

    def body(self) -> Row:
        return {"d": self.d, "to": self.to, "by": self.by}


@dataclass
class CommentMoved(Event):
    KIND: ClassVar[str] = "dcmove"
    d: int = 0
    id: int = 0
    key: str = ""
    quote: str = ""

    def body(self) -> Row:
        return {"d": self.d, "id": self.id, "key": self.key, "quote": self.quote, "by": self.by}


@dataclass
class ThreadResolved(Event):
    """A comment thread resolved (on) or open again; th: one thread of the paragraph, else all of them."""

    KIND: ClassVar[str] = "dcres"
    d: int = 0
    key: str = ""
    on: bool = True
    th: Optional[int] = None

    def body(self) -> Row:
        row: Row = {"d": self.d, "key": self.key, "on": self.on, "by": self.by}
        opt(row, "th", self.th, bool(self.th))
        return row


@dataclass
class CommentAdded(Event):
    KIND: ClassVar[str] = "dc"
    d: int = 0
    key: str = ""
    quote: str = ""
    text: str = ""
    files: List[FileRef] = field(default_factory=list)
    th: Optional[int] = None  # the thread a reply goes in

    def body(self) -> Row:
        row: Row = {"d": self.d, "key": self.key, "quote": self.quote, "text": self.text, "by": self.by}
        opt(row, "files", files_row(self.files), bool(self.files))
        opt(row, "th", self.th, bool(self.th))
        return row


@dataclass
class CommentEdited(Event):
    KIND: ClassVar[str] = "dcedit"
    d: int = 0
    id: int = 0
    text: str = ""
    files: List[FileRef] = field(default_factory=list)

    def body(self) -> Row:
        row: Row = {"d": self.d, "id": self.id, "text": self.text, "by": self.by}
        opt(row, "files", files_row(self.files), bool(self.files))
        return row


@dataclass
class CommentDeleted(Event):
    KIND: ClassVar[str] = "dcdel"
    d: int = 0
    id: int = 0

    def body(self) -> Row:
        return {"d": self.d, "id": self.id, "by": self.by}


@dataclass
class CommentRestored(Event):
    KIND: ClassVar[str] = "dcundel"
    d: int = 0
    id: int = 0

    def body(self) -> Row:
        return {"d": self.d, "id": self.id, "by": self.by}


DOC_EVENTS = ("dc", "dcedit", "dcdel", "dcundel", "dcres", "ddel", "dmove", "dcmove")

READERS: Dict[str, Reader] = {
    "doc": lambda r: DocWritten(d=need(r, "d"), n=need(r, "n"), title=r.get("title") or "", md=need(r, "md"),
                                fmt=r.get("fmt"), **common(r)),
    "ddel": lambda r: DocDeleted(d=need(r, "d"), on=bool(r.get("on", True)), **common(r)),
    "dmove": lambda r: DocMoved(d=need(r, "d"), to=need(r, "to"), **common(r)),
    "dcmove": lambda r: CommentMoved(d=need(r, "d"), id=need(r, "id"), key=need(r, "key"), quote=r.get("quote", ""),
                                     **common(r)),
    "dcres": lambda r: ThreadResolved(d=need(r, "d"), key=need(r, "key"), on=bool(r.get("on")), th=r.get("th"),
                                      **common(r)),
    "dc": lambda r: CommentAdded(d=need(r, "d"), key=need(r, "key"), quote=need(r, "quote"), text=need(r, "text"),
                                 files=files_of(r), th=r.get("th"), **common(r)),
    "dcedit": lambda r: CommentEdited(d=need(r, "d"), id=need(r, "id"), text=need(r, "text"), files=files_of(r),
                                      **common(r)),
    "dcdel": lambda r: CommentDeleted(d=need(r, "d"), id=need(r, "id"), **common(r)),
    "dcundel": lambda r: CommentRestored(d=need(r, "d"), id=need(r, "id"), **common(r)),
}
